"use client";

import { useEffect, useRef } from "react";
import { MiniPlay, useLessonLang } from "@/components/exercises";
import { cn } from "@/lib/cn";
import type { Exercise, ExerciseOutcome } from "@/lib/exercises";

const PRAISE = ["¡Genial!", "¡Muy bien!", "¡Perfecto!", "¡Eso es!", "¡Bravo!"];

export interface FeedbackSheetProps {
  exercise: Exercise;
  outcome: ExerciseOutcome;
  /** Picks the praise line (any number; e.g. the position in the session). */
  seq: number;
  onContinue: () => void;
}

/** Green/red sheet after each answer: verdict, right answer with a play button, Continuar. */
export function FeedbackSheet({ exercise, outcome, seq, onContinue }: FeedbackSheetProps) {
  const lang = useLessonLang();
  const { correct } = outcome;
  const { solution } = exercise;
  const isMatch = exercise.type === "match";
  const matchMistakes = isMatch ? (outcome.wrongItemIds?.length ?? 0) : 0;
  const title = !correct ? "Casi…" : matchMistakes > 0 ? "¡Hecho!" : PRAISE[seq % PRAISE.length];
  const button = useRef<HTMLButtonElement>(null);
  // Focus Continuar (keyboard: Enter goes on) without scrolling the lesson.
  useEffect(() => button.current?.focus({ preventScroll: true }), []);
  // Enter goes on even when focus was lost (e.g. the answered option got disabled).
  useEffect(() => {
    // Ignore the Enter that submitted the answer (it may still be propagating when this runs).
    const shownAt = performance.now();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || e.timeStamp <= shownAt || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      onContinue();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onContinue]);

  return (
    <section
      role="status"
      aria-live="assertive"
      className={cn(
        "absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 rounded-t-card border-t-4 px-5 pt-5",
        "pb-[calc(var(--safe-bottom)+1.25rem)] shadow-[0_-8px_24px_-12px_var(--shadow)]",
        "transition-transform duration-200 ease-out starting:translate-y-full motion-reduce:transition-none",
        correct ? "border-success bg-success-soft" : "border-error bg-error-soft",
      )}
    >
      <p className={cn("text-2xl font-extrabold", correct ? "text-success-deep" : "text-error-deep")}>{title}</p>

      {outcome.accentNote ? (
        <p className="text-base font-bold text-ink">Cuidado con el acento: fíjate en cómo se escribe.</p>
      ) : null}
      {isMatch && matchMistakes > 0 ? (
        <p className="text-base text-ink">
          {matchMistakes === 1 ? "Has fallado 1 pareja, pero ya las tienes todas." : `Has fallado ${matchMistakes} parejas, pero ya las tienes todas.`}
        </p>
      ) : null}

      {!isMatch ? (
        <div className="flex items-start gap-3">
          {solution.audio ? <MiniPlay audio={solution.audio} label="Escuchar la respuesta" /> : null}
          <div className="flex min-w-0 flex-col">
            {!correct ? <span className="text-sm font-bold uppercase tracking-wider text-error-deep">Solución</span> : null}
            <span lang={lang} className="text-xl font-bold text-ink">
              {solution.text}
            </span>
            {solution.es ? <span className="text-base text-ink-muted">{solution.es}</span> : null}
            {solution.note ? <span className="mt-1 text-sm text-ink-muted">{solution.note}</span> : null}
          </div>
        </div>
      ) : null}

      {outcome.given && !correct ? (
        <p className="text-base text-ink-muted">
          {exercise.type === "speak" ? "He entendido" : "Tu respuesta"}: <span className="font-bold text-ink">{outcome.given}</span>
        </p>
      ) : null}
      {outcome.given && correct && exercise.type === "speak" ? (
        <p className="text-base text-ink-muted">
          He entendido: <span className="font-bold text-ink">{outcome.given}</span>
        </p>
      ) : null}

      <button
        type="button"
        ref={button}
        onClick={onContinue}
        className={cn(
          "pressable mt-1 min-h-14 w-full rounded-button px-6 text-lg font-bold tracking-wide text-on-accent",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
          correct ? "bg-success [--ledge:var(--success-ledge)]" : "bg-error [--ledge:var(--error-ledge)]",
        )}
      >
        Continuar
      </button>
    </section>
  );
}
