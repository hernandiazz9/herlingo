"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { stop } from "@/lib/audio";
import { getPack } from "@/lib/content";
import { cn } from "@/lib/cn";
import type { SpeakExercise as Speak } from "@/lib/exercises";
import { canRecognize, listenOnce, scoreSpeech, SPEAKING_PAUSE_MINUTES, type RecognitionSession } from "@/lib/speech";
import { MicIcon, PlayControls, Prompt, useLessonLang, type ExerciseProps } from "./shared";

const MAX_TRIES = 2;

export interface SpeakExerciseProps extends ExerciseProps<Speak> {
  /** "No puedo hablar ahora": the player pauses speaking and skips these exercises. */
  onCannotSpeak: () => void;
}

/**
 * Say it aloud. With Web Speech recognition: listen and compare (fuzzy). Without it, or if the
 * microphone is refused: self-evaluation ("Me ha salido / No me ha salido").
 */
export function SpeakExercise({ exercise, answered, onAnswer, onCannotSpeak }: SpeakExerciseProps) {
  const lang = useLessonLang();
  const [mode, setMode] = useState<"mic" | "self">(() => (canRecognize() ? "mic" : "self"));
  const [listening, setListening] = useState(false);
  const [tries, setTries] = useState(0);
  const [heard, setHeard] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const session = useRef<RecognitionSession | null>(null);

  useEffect(() => () => session.current?.abort(), []);

  const listen = () => {
    if (answered) return;
    if (listening) {
      session.current?.stop();
      return;
    }
    stop();
    const { meta } = getPack(lang);
    const s = listenOnce(meta.speechLocale);
    session.current = s;
    setListening(true);
    setNotice(null);
    void s.result.then((r) => {
      if (session.current !== s) return;
      session.current = null;
      setListening(false);
      if (!r.ok) {
        if (r.error === "aborted") return;
        if (r.error === "no-speech") {
          setNotice("No te he oído. Toca el micro y habla más cerca.");
          return;
        }
        setMode("self");
        setNotice(
          r.error === "not-allowed"
            ? "No tengo permiso para usar el micro. Dilo en voz alta y evalúate tú."
            : "El reconocimiento de voz no funciona ahora. Dilo en voz alta y evalúate tú.",
        );
        return;
      }
      const score = scoreSpeech(r.transcripts, exercise.audio.text, meta.numberWords);
      setHeard(score.heard);
      const used = tries + 1;
      setTries(used);
      if (score.passed) onAnswer({ correct: true, given: score.heard });
      else if (used >= MAX_TRIES) onAnswer({ correct: false, given: score.heard });
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Prompt>Dilo en voz alta</Prompt>
      <div className="flex flex-col gap-2">
        <p lang="it" className="text-2xl font-bold text-sea-deep">
          {exercise.audio.text}
        </p>
        <p className="text-lg text-ink-muted">{exercise.es}</p>
      </div>
      <PlayControls audio={exercise.audio} size="md" />

      {notice ? <p className="rounded-button bg-lemon-soft px-4 py-3 text-base text-ink">{notice}</p> : null}

      {mode === "mic" ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={listen}
            disabled={answered}
            aria-label={listening ? "Dejar de escuchar" : "Toca y habla"}
            className={cn(
              "pressable inline-flex size-24 items-center justify-center rounded-full text-on-accent",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep disabled:opacity-50",
              listening
                ? "animate-pulse bg-terracotta [--ledge:var(--terracotta-ledge)] motion-reduce:animate-none"
                : "bg-sea [--ledge:var(--sea-ledge)]",
            )}
          >
            <MicIcon className="size-11" />
          </button>
          <p className="text-base font-bold text-ink-muted" aria-live="polite">
            {listening ? "Te escucho…" : tries > 0 && !answered ? "Casi. Inténtalo otra vez." : "Toca y habla"}
          </p>
          {heard && !answered ? (
            <p className="text-base text-ink-muted">
              He entendido: <span lang="it" className="font-bold text-ink">«{heard}»</span>
            </p>
          ) : null}
          {!answered ? (
            <button
              type="button"
              onClick={() => {
                session.current?.abort();
                setMode("self");
              }}
              className="text-base font-bold text-sea underline underline-offset-4"
            >
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
        </div>
      )}

      {!answered ? (
        <button
          type="button"
          onClick={() => {
            session.current?.abort();
            onCannotSpeak();
          }}
          className="mt-auto self-center text-base font-bold text-ink-muted underline underline-offset-4"
        >
          No puedo hablar ahora ({SPEAKING_PAUSE_MINUTES} min)
        </button>
      ) : null}
    </div>
  );
}
