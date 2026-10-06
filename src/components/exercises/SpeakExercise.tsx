"use client";

import { useState } from "react";
import { SpeakPanel, useListen, WordFeedback } from "@/components/speech";
import { Button } from "@/components/ui";
import { speak } from "@/lib/audio";
import { getPack } from "@/lib/content";
import type { SpeakExercise as Speak } from "@/lib/exercises";
import { SPEAKING_PAUSE_MINUTES, scoreHeard, type SpeechScore } from "@/lib/speech";
import { PlayControls, Prompt, useLessonLang, type ExerciseProps } from "./shared";

const MAX_TRIES = 2;

const LINK = "text-base font-bold underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep";

export interface SpeakExerciseProps extends ExerciseProps<Speak> {
  /** "No puedo hablar ahora": the player pauses speaking and skips these exercises. */
  onCannotSpeak: () => void;
}

/**
 * Say it aloud. With Web Speech recognition: the shared mic UI (live text, states, errors with
 * "Reintentar") and word-by-word feedback (`scoreHeard`); MAX_TRIES scored attempts. Errors never
 * count as a try nor switch to self-evaluation. Without recognition, or when the learner prefers:
 * self-evaluation ("Me ha salido / No me ha salido").
 */
export function SpeakExercise({ exercise, answered, onAnswer, onCannotSpeak }: SpeakExerciseProps) {
  const lang = useLessonLang();
  const { meta } = getPack(lang);
  const [preferSelf, setPreferSelf] = useState(false);
  const [tries, setTries] = useState(0);
  const [score, setScore] = useState<SpeechScore | null>(null);

  const listen = useListen({
    locale: meta.speechLocale,
    onResult: (r) => {
      if (answered) return;
      const s = scoreHeard(r.alternatives, exercise.audio.text, meta.numberWords);
      setScore(s);
      const used = tries + 1;
      setTries(used);
      if (s.passed) onAnswer({ correct: true, given: s.heard });
      else if (used >= MAX_TRIES) onAnswer({ correct: false, given: s.heard });
    },
  });

  const selfMode = !listen.supported || preferSelf;
  const retryShown = score !== null && !score.passed && !answered && !listen.active && !listen.error;

  const toSelf = () => {
    listen.cancel();
    setPreferSelf(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Prompt>Dilo en voz alta</Prompt>
      <div className="flex flex-col gap-2">
        <p lang={lang} className="text-2xl font-bold text-sea-deep">
          {exercise.audio.text}
        </p>
        <p className="text-lg text-ink-muted">{exercise.es}</p>
      </div>
      <PlayControls audio={exercise.audio} size="md" />

      {!selfMode ? (
        <div className="flex flex-col items-center gap-4">
          {score && !listen.active ? (
            <div className="flex w-full flex-col gap-2 rounded-card border-2 border-line bg-surface px-4 py-3">
              <p className="text-base font-bold text-ink" aria-live="polite">
                {score.passed ? "¡Bien dicho!" : answered
                    ? "Así ha quedado:"
                    : `Casi. ${MAX_TRIES - tries === 1 ? "Te queda un intento." : `Te quedan ${MAX_TRIES - tries} intentos.`}`}
              </p>
              <WordFeedback words={score.words} lang={lang} heard={score.heard} />
            </div>
          ) : null}

          {retryShown ? (
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="md" onClick={listen.start}>
                Reintentar
              </Button>
              <Button size="md" variant="secondary" onClick={() => void speak(exercise.audio, { lang })}>
                Escuchar la frase
              </Button>
            </div>
          ) : null}

          <SpeakPanel
            listen={listen}
            lang={lang}
            disabled={answered}
          />

          {!answered ? (
            <button type="button" onClick={toSelf} className={`${LINK} text-sea-deep`}>
              Prefiero evaluarme yo
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-base text-ink-muted">Escúchalo, dilo en voz alta y sé sincero:</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={answered}
              onClick={() => onAnswer({ correct: true })}
              className="pressable min-h-12 rounded-button bg-success px-4 text-base font-bold text-on-accent [--ledge:var(--success-ledge)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep disabled:opacity-50"
            >
              Me ha salido
            </button>
            <Button size="md" variant="secondary" disabled={answered} onClick={() => onAnswer({ correct: false })}>
              No me ha salido
            </Button>
          </div>
          {listen.supported && !answered ? (
            <button type="button" onClick={() => setPreferSelf(false)} className={`${LINK} self-center text-sea-deep`}>
              Usar el micrófono
            </button>
          ) : null}
        </div>
      )}

      {!answered ? (
        <button
          type="button"
          onClick={() => {
            listen.cancel();
            onCannotSpeak();
          }}
          className={`${LINK} mt-auto self-center text-ink-muted`}
        >
          No puedo hablar ahora ({SPEAKING_PAUSE_MINUTES} min)
        </button>
      ) : null}
    </div>
  );
}
