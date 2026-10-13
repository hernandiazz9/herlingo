"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SpeakerIcon } from "@/components/icons";
import { Button, Card, Picture, TargetText } from "@/components/ui";
import { speak, stop, type SequenceLine } from "@/lib/audio";
import { useSequencePlayer } from "@/lib/audio/use-sequence-player";
import { cn } from "@/lib/cn";
import { getPack, getStoryKeywords, glossOf, hasImage, type Story, type StoryKeyword } from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import { getTab } from "@/lib/navigation";
import { recordListen } from "@/lib/progress/activity";
import { segmentStory } from "@/lib/stories";

/** Pause between sentences in "Escuchar todo". */
const GAP_MS = 350;

interface Open {
  sentence: string;
  keyword: string;
}

/**
 * Sentence-by-sentence reader: tap to hear, Spanish on demand, key words with their meaning.
 * Every sentence or key word heard earns listening XP (`recordListen`). "Escuchar todo" plays the
 * sentences in order: one joined file when every sentence has an mp3 (it keeps playing with the
 * screen locked), else one after another (`useSequencePlayer`).
 */
export function StoryReader({ story, lang, onPlay }: { story: Story; lang: string; onPlay: () => void }) {
  const pack = getPack(lang);
  const gloss = useGlossLang(lang);
  const copy = useLearnCopy();
  const keywords = useMemo(() => getStoryKeywords(story, pack), [story, pack]);
  const byId = useMemo(() => new Map<string, StoryKeyword>(keywords.map((k) => [k.id, k])), [keywords]);
  const segments = useMemo(() => segmentStory(story, keywords), [story, keywords]);
  const [showAll, setShowAll] = useState(false);
  const [shown, setShown] = useState<string[]>([]);
  const [open, setOpen] = useState<Open | null>(null);
  /** The sentence a single tap is playing. */
  const [tapped, setTapped] = useState<number | null>(null);
  const run = useRef(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  /** One step per sentence. */
  const steps = useMemo<SequenceLine[][]>(() => story.sentences.map((input) => [{ input, options: { lang } }]), [story, lang]);
  const all = useSequencePlayer(steps, {
    gapMs: GAP_MS,
    title: story.title,
    artist: getTab("stories").title,
    onStepDone: (i) => recordListen(story.sentences[i].audioKey, lang),
  });
  const playingAll = all.status !== "idle";
  const current = all.step ?? tapped;

  // Leaving the page stops "Escuchar todo" and any sentence.
  useEffect(
    () => () => {
      run.current++;
      stop();
    },
    [],
  );

  // The sentence "Escuchar todo" reaches scrolls into view.
  useEffect(() => {
    if (all.step === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    refs.current[all.step]?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [all.step]);

  const cancelAll = () => {
    run.current++;
    all.stop();
    setTapped(null);
  };

  const playSentence = (i: number) => {
    cancelAll();
    setTapped(i);
    const token = run.current;
    recordListen(story.sentences[i].audioKey, lang);
    void speak(story.sentences[i], { lang }).then(() => {
      if (run.current === token) setTapped(null);
    });
  };

  const playAll = () => {
    if (playingAll) {
      cancelAll();
      return;
    }
    cancelAll();
    all.play(0);
  };

  const tapKeyword = (sentence: string, id: string, keepOpen = false) => {
    const k = byId.get(id);
    if (!k) return;
    cancelAll();
    if (!keepOpen) setOpen(open?.sentence === sentence && open.keyword === id ? null : { sentence, keyword: id });
    void speak(k, { lang });
    recordListen(k.audioKey, lang);
  };

  const toggleAll = () => {
    setShowAll(!showAll);
    setShown([]);
  };
  const toggleOne = (id: string) => setShown(shown.includes(id) ? shown.filter((x) => x !== id) : [...shown, id]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button size="md" onClick={playAll} aria-pressed={playingAll}>
          <SpeakerIcon className="size-5" />
          {playingAll ? copy.stop : copy.listenAll}
        </Button>
        <Button size="md" variant="secondary" onClick={toggleAll} aria-pressed={showAll}>
          {showAll ? copy.hideTranslation : copy.showTranslation}
        </Button>
      </div>
      <p className="text-sm text-ink-muted">{copy.readerHint}</p>

      <ol className="flex flex-col gap-2">
        {story.sentences.map((s, i) => {
          const es = showAll || shown.includes(s.id);
          const kw = open?.sentence === s.id ? byId.get(open.keyword) : undefined;
          return (
            <li
              key={s.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className={cn(
                "flex flex-col gap-2 rounded-card border-2 p-3 transition-colors motion-reduce:transition-none",
                current === i ? "border-lemon-deep bg-lemon-soft" : "border-transparent",
              )}
            >
              <div className="flex items-start gap-2">
                <p lang={lang} className="flex-1 cursor-pointer text-xl leading-relaxed text-ink" onClick={() => playSentence(i)}>
                  <TargetText text={s.text} lang={lang}>
                    {(segments.get(s.id) ?? [{ text: s.text }]).map((seg, j) =>
                      seg.keywordId ? (
                        <button
                          key={j}
                          type="button"
                          aria-expanded={kw?.id === seg.keywordId}
                          onClick={(e) => {
                            e.stopPropagation();
                            tapKeyword(s.id, seg.keywordId!);
                          }}
                          className="rounded-md bg-terracotta-soft px-0.5 font-bold text-terracotta-deep underline decoration-dotted underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
                        >
                          {seg.text}
                        </button>
                      ) : (
                        <span key={j}>{seg.text}</span>
                      ),
                    )}
                  </TargetText>
                </p>
                <PlayButton label={copy.listenSentence(i + 1)} onClick={() => playSentence(i)} />
              </div>
              {kw ? (
                <Card tone="terracotta" className="flex items-start gap-3 p-3">
                  <PlayButton label={copy.listenTo(kw.text)} onClick={() => tapKeyword(s.id, kw.id, true)} />
                  <div className="flex min-w-0 flex-col">
                    <span lang={lang} className="text-lg font-bold text-ink">
                      <TargetText text={kw.text} lang={lang} />
                    </span>
                    <span lang={gloss.tag} className="text-base text-ink">
                      {glossOf(kw, gloss.lang)}
                    </span>
                    {kw.notes ? (
                      <span lang={gloss.tag} className="mt-1 text-sm text-ink-muted">
                        {glossOf(kw.notes, gloss.lang)}
                      </span>
                    ) : null}
                  </div>
                  {hasImage(kw) ? (
                    <div className="ml-auto w-20 shrink-0">
                      <Picture image={kw.image} alt="" />
                    </div>
                  ) : null}
                </Card>
              ) : null}
              {es ? (
                <p lang={gloss.tag} className="text-base text-ink-muted">
                  {glossOf(s, gloss.lang)}
                </p>
              ) : null}
              {!showAll ? (
                <button
                  type="button"
                  onClick={() => toggleOne(s.id)}
                  aria-expanded={es}
                  className="self-start text-sm font-bold text-sea underline underline-offset-4"
                >
                  {es ? copy.hideTranslation : copy.showTranslation}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>

      <Card tone="sea" className="flex flex-col gap-3">
        <p className="text-lg font-bold text-ink">{copy.doneReading}</p>
        <p className="text-base text-ink-muted">{copy.doneReadingHint}</p>
        <Button
          fullWidth
          onClick={() => {
            cancelAll();
            stop();
            onPlay();
          }}
        >
          {copy.playStory}
        </Button>
      </Card>
    </div>
  );
}

/** Small round play button (same look as the lesson one) that runs the reader's own handler. */
function PlayButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="pressable inline-flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
    >
      <SpeakerIcon className="size-5" />
    </button>
  );
}
