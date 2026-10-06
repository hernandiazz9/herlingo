"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { LiveTranscript, MicButton, useListen } from "@/components/speech";
import { getPack, languageName } from "@/lib/content";
import { checkAnswer, spellNumbers, type DictationExercise as Dictation } from "@/lib/exercises";
import { PlayControls, Prompt, useLessonLang, type ExerciseProps } from "./shared";

/**
 * Hear the target language, type it (or say it: the microphone writes what it hears, live, and the
 * text stays editable). Accents and punctuation are forgiven (with a note for accents); a small typo
 * counts as right ("almost").
 */
export function DictationExercise({ exercise, answered, onAnswer }: ExerciseProps<Dictation>) {
  const lang = useLessonLang();
  const { meta } = getPack(lang);
  const [text, setText] = useState("");
  const listen = useListen({
    locale: meta.speechLocale,
    mode: "phrase",
    onResult: (r) => setText(spellNumbers(r.transcript, meta.numberWords)),
  });

  // While the mic is open the field shows the live text; the final transcript replaces the answer.
  const live = listen.active && listen.interim ? spellNumbers(listen.interim, meta.numberWords) : null;
  const value = live ?? text;

  const check = () => {
    if (answered || listen.active || !text.trim()) return;
    listen.reset();
    const result = checkAnswer(text, exercise.accepted, { typos: true, equivalents: meta.equivalents });
    onAnswer({ correct: result.correct, accentNote: result.accentNote, typo: result.typo, given: text.trim() });
  };

  return (
    <form
      className="flex flex-1 flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        check();
      }}
    >
      <Prompt>Escribe lo que oyes</Prompt>
      <PlayControls audio={exercise.audio} />
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="sr-only">Lo que oyes, en {languageName(lang)}</span>
          <textarea
            lang={lang}
            value={value}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                check();
              }
            }}
            readOnly={answered || listen.active}
            rows={3}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              listen.supported ? `Escribe o dicta en ${languageName(lang)}…` : `Escribe en ${languageName(lang)}…`
            }
            className="w-full resize-none rounded-card border-2 border-line bg-surface p-4 text-xl font-bold text-ink placeholder:font-normal placeholder:text-ink-muted focus:border-sea focus:outline-none"
          />
        </label>
        {!answered ? (
          <>
            <MicButton listen={listen} size="sm" idleLabel="O díctalo en voz alta" className="self-start" />
            <LiveTranscript listen={listen} lang={lang} align="start" />
          </>
        ) : null}
      </div>
      <div className="mt-auto">
        <Button type="submit" fullWidth disabled={answered || listen.active || !text.trim()}>
          Comprobar
        </Button>
      </div>
    </form>
  );
}
