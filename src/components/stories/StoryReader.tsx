"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SpeakerIcon } from "@/components/icons";
import { Button, Card, Picture } from "@/components/ui";
import { speak, stop } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { getPack, getStoryKeywords, hasImage, type Story, type StoryKeyword } from "@/lib/content";
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
 * Every sentence or key word heard earns listening XP (`recordListen`).
 */
export function StoryReader({ story, lang, onPlay }: { story: Story; lang: string; onPlay: () => void }) {
  const pack = getPack(lang);
  const keywords = useMemo(() => getStoryKeywords(story, pack), [story, pack]);
  const byId = useMemo(() => new Map<string, StoryKeyword>(keywords.map((k) => [k.id, k])), [keywords]);
  const segments = useMemo(() => segmentStory(story, keywords), [story, keywords]);
  const [showAll, setShowAll] = useState(false);
  const [shown, setShown] = useState<string[]>([]);
  const [open, setOpen] = useState<Open | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const run = useRef(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  // Leaving the page stops "Escuchar todo".
  useEffect(
    () => () => {
      run.current++;
      stop();
    },
    [],
  );

  const cancelAll = () => {
    run.current++;
    setPlayingAll(false);
  };

  const playSentence = (i: number) => {
    cancelAll();
    setCurrent(i);
    const token = run.current;
    recordListen(story.sentences[i].audioKey, lang);
    void speak(story.sentences[i], { lang }).then(() => {
      if (run.current === token) setCurrent(null);
    });
  };

  const playAll = () => {
    if (playingAll) {
      cancelAll();
      stop();
      setCurrent(null);
      return;
    }
    const token = ++run.current;
    setPlayingAll(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = (i: number) => {
      if (run.current !== token) return;
      if (i >= story.sentences.length) {
        setPlayingAll(false);
        setCurrent(null);
        return;
      }
      setCurrent(i);
      refs.current[i]?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      void speak(story.sentences[i], { lang }).then(() => {
        if (run.current !== token) return;
        recordListen(story.sentences[i].audioKey, lang);
        window.setTimeout(() => step(i + 1), GAP_MS);
      });
    };
    step(0);
  };

  const tapKeyword = (sentence: string, id: string, keepOpen = false) => {
    const k = byId.get(id);
    if (!k) return;
    cancelAll();
    setCurrent(null);
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
          {playingAll ? "Parar" : "Escuchar todo"}
        </Button>
        <Button size="md" variant="secondary" onClick={toggleAll} aria-pressed={showAll}>
          {showAll ? "Ocultar traducción" : "Ver traducción"}
        </Button>
      </div>
      <p className="text-sm text-ink-muted">Toca una frase para escucharla y una palabra resaltada para ver qué significa.</p>

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
                </p>
                <PlayButton label={`Escuchar la frase ${i + 1}`} onClick={() => playSentence(i)} />
              </div>
              {kw ? (
                <Card tone="terracotta" className="flex items-start gap-3 p-3">
                  <PlayButton label={`Escuchar: ${kw.text}`} onClick={() => tapKeyword(s.id, kw.id, true)} />
                  <div className="flex min-w-0 flex-col">
                    <span lang={lang} className="text-lg font-bold text-ink">
                      {kw.text}
                    </span>
                    <span className="text-base text-ink">{kw.es}</span>
                    {kw.notes ? <span className="mt-1 text-sm text-ink-muted">{kw.notes}</span> : null}
                  </div>
                  {hasImage(kw) ? (
                    <div className="ml-auto w-20 shrink-0">
                      <Picture image={kw.image} alt="" />
                    </div>
                  ) : null}
                </Card>
              ) : null}
              {es ? <p className="text-base text-ink-muted">{s.es}</p> : null}
              {!showAll ? (
                <button
                  type="button"
                  onClick={() => toggleOne(s.id)}
                  aria-expanded={es}
                  className="self-start text-sm font-bold text-sea underline underline-offset-4"
                >
                  {es ? "Ocultar traducción" : "Ver traducción"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>

      <Card tone="sea" className="flex flex-col gap-3">
        <p className="text-lg font-bold text-ink">¿Has terminado de leer?</p>
        <p className="text-base text-ink-muted">Juega con las palabras y expresiones de la historia. Puedes saltar cualquier juego.</p>
        <Button
          fullWidth
          onClick={() => {
            cancelAll();
            stop();
            setCurrent(null);
            onPlay();
          }}
        >
          Jugar con la historia
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
