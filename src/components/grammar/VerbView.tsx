"use client";

import { useMemo, useState, type Ref } from "react";
import { MiniPlay, SlowIcon } from "@/components/exercises/shared";
import { SpeakerIcon } from "@/components/icons";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, TargetText } from "@/components/ui";
import { speak, type SequenceLine } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { getGrammarTenses, getPack, getVerb, glossOf, type Verb, type VerbForm } from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import { GrammarScreen } from "./GrammarScreen";
import { PLAYING_FRAME, PlayAllButton, usePlayAll } from "./play-all";
import { GrammarReadButton } from "./ReadButton";

/**
 * A verb page of pack `lang`: the infinitive (tap = audio), its gloss and notes, then one chip per
 * tense the verb has (pack.json order, the first selected) and that tense's forms. Tapping a row
 * plays it ("io sono"; snail = slow); irregular forms are in another colour. Below the table: the
 * tense notes and its example with audio. «Escuchar todo» plays the selected tense: each form in
 * row order, then the example, the line playing highlighted. "Leído" at the end.
 */
export function VerbView({ id, lang }: { id: string; lang: string }) {
  const verb = getVerb(id, getPack(lang));
  if (!verb) return null;
  return (
    <GrammarScreen lang={lang}>
      <VerbPage verb={verb} lang={lang} />
    </GrammarScreen>
  );
}

function VerbPage({ verb, lang }: { verb: Verb; lang: string }) {
  const gloss = useGlossLang(lang);
  const copy = useLearnCopy();
  const titles = new Map(getGrammarTenses(getPack(lang)).map((t) => [t.id, t.title]));
  const [tenseId, setTenseId] = useState(verb.tenses[0]?.id);
  const tense = verb.tenses.find((t) => t.id === tenseId) ?? verb.tenses[0];
  /** The forms in row order (as each row plays them), then the example: line `forms.length`. */
  const lines = useMemo<SequenceLine[]>(
    () => (tense ? [...tense.forms, tense.example].map((input) => ({ input, options: { lang } })) : []),
    [tense, lang],
  );
  const player = usePlayAll(lines);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <button
            type="button"
            lang={lang}
            onClick={() => void speak(verb, { lang })}
            className="inline-flex items-center gap-3 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
          >
            <TargetText text={verb.infinitive} lang={lang} />
            <SpeakerIcon className="shrink-0 text-sea" width={26} height={26} />
          </button>
        }
        subtitle={
          <>
            <span lang={gloss.tag}>{glossOf(verb, gloss.lang)}</span>
            {verb.irregular ? (
              <span className="ml-2 inline-block rounded-full bg-terracotta-soft px-2.5 py-0.5 align-middle text-xs font-bold text-terracotta-deep">
                {copy.grammarIrregular}
              </span>
            ) : null}
          </>
        }
      />

      {verb.notes ? (
        <Card tone="lemon" className="p-4">
          <p lang={gloss.tag} className="text-base text-ink">
            {glossOf(verb.notes, gloss.lang)}
          </p>
        </Card>
      ) : null}

      {verb.tenses.length ? (
        <div role="group" aria-label={copy.grammarTenses} className="flex flex-wrap gap-2">
          {verb.tenses.map((t) => {
            const active = t.id === tense?.id;
            const title = titles.get(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (!active) player.cancel();
                  setTenseId(t.id);
                }}
                lang={gloss.tag}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border-2 px-4 text-base font-bold whitespace-nowrap",
                  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
                  active ? "border-sea bg-sea text-on-accent" : "border-line bg-surface text-ink",
                )}
              >
                {title ? glossOf(title, gloss.lang) : t.id}
              </button>
            );
          })}
        </div>
      ) : null}

      {tense ? (
        <>
          <PlayAllButton player={player} />
          <ul className="flex flex-col gap-2">
            {tense.forms.map((form, i) => (
              <FormRow key={form.audioKey} form={form} lang={lang} playing={player.playing === i} rowRef={player.itemRef(i)} />
            ))}
          </ul>
          {tense.forms.some((f) => f.irregular) ? (
            <p className="-mt-2 text-sm text-ink-muted">
              <span aria-hidden="true" className="font-extrabold text-terracotta-deep">
                ●
              </span>{" "}
              {copy.grammarIrregularLegend}
            </p>
          ) : null}
          {tense.notes ? (
            <p lang={gloss.tag} className="text-base text-ink">
              {glossOf(tense.notes, gloss.lang)}
            </p>
          ) : null}
          <div
            ref={player.itemRef(tense.forms.length)}
            className={cn(
              "flex flex-col gap-2 rounded-card border-2 p-4",
              player.playing === tense.forms.length ? PLAYING_FRAME : "border-line bg-surface",
            )}
          >
            <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">{copy.grammarExample}</p>
            <div className="flex items-center gap-3">
              <MiniPlay audio={tense.example} />
              <span>
                <TargetText text={tense.example.text} lang={lang}>
                  <span lang={lang} className="font-bold text-ink">
                    {tense.example.text}
                  </span>{" "}
                  <span className="text-ink-muted">
                    · <span lang={gloss.tag}>{glossOf(tense.example, gloss.lang)}</span>
                  </span>
                </TargetText>
              </span>
            </div>
          </div>
        </>
      ) : null}
      <GrammarReadButton key={verb.id} id={verb.id} lang={lang} />
    </div>
  );
}

/** One form: person · form (big) · gloss (small). Tap = audio; the snail plays it slowly. `playing`: «Escuchar todo» is on it. */
function FormRow({
  form,
  lang,
  playing,
  rowRef,
}: {
  form: VerbForm;
  lang: string;
  playing: boolean;
  rowRef: Ref<HTMLLIElement>;
}) {
  const gloss = useGlossLang(lang);
  const copy = useLearnCopy();
  return (
    <li
      ref={rowRef}
      className={cn("flex items-center gap-1 rounded-card border-2 pr-2", playing ? PLAYING_FRAME : "border-line bg-surface")}
    >
      <button
        type="button"
        onClick={() => void speak(form, { lang })}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
      >
        <span lang={lang} className="w-20 shrink-0 text-sm font-bold break-words text-ink-muted">
          {form.person}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            lang={lang}
            className={cn("text-xl font-extrabold leading-tight break-words", form.irregular ? "text-terracotta-deep" : "text-ink")}
          >
            <TargetText text={form.form} lang={lang} />
            {form.irregular ? (
              <span lang={gloss.tag} className="sr-only">
                {" "}
                ({copy.grammarIrregular})
              </span>
            ) : null}
          </span>
          <span lang={gloss.tag} className="text-sm leading-snug text-ink-muted">
            {glossOf(form, gloss.lang)}
          </span>
        </span>
        <SpeakerIcon className="shrink-0 text-sea" width={20} height={20} />
      </button>
      <button
        type="button"
        onClick={() => void speak(form, { lang, slow: true })}
        aria-label={copy.listenSlowly}
        title={copy.listenSlowly}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-sea focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
      >
        <SlowIcon width={20} height={20} />
      </button>
    </li>
  );
}
