"use client";

import { useEffect, useRef } from "react";
import { MiniPlay, useLessonLang } from "@/components/exercises";
import { TargetText } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getPack } from "@/lib/content";
import { diffWords, scriptRules, type DiffWord, type Exercise, type ExerciseOutcome } from "@/lib/exercises";

const PRAISE = ["¡Genial!", "¡Muy bien!", "¡Perfecto!", "¡Eso es!", "¡Bravo!"];

export interface FeedbackSheetProps {
  exercise: Exercise;
  outcome: ExerciseOutcome;
  /** Picks the praise line (any number; e.g. the position in the session). */
  seq: number;
  onContinue: () => void;
}

/** The words of a sentence, the `wrong` ones highlighted. */
function Highlighted({ words, tone }: { words: DiffWord[]; tone: "fix" | "mistake" }) {
  return words.map((w, i) => (
    <span key={i}>
      {i > 0 ? " " : null}
      {w.wrong ? (
        <mark
          className={cn(
            "rounded px-0.5",
            tone === "fix" ? "bg-success-soft text-success-deep underline decoration-2" : "bg-error-soft text-error-deep line-through",
          )}
        >
          {w.text}
        </mark>
      ) : (
        w.text
      )}
    </span>
  ));
}

/**
 * Green/red sheet after each answer: verdict, right answer with a play button, Continuar.
 * Yellow when right with a small typo: the words to fix are highlighted.
 */
export function FeedbackSheet({ exercise, outcome, seq, onContinue }: FeedbackSheetProps) {
  const lang = useLessonLang();
  const { correct } = outcome;
  const { solution } = exercise;
  const isMatch = exercise.type === "match";
  const matchMistakes = isMatch ? (outcome.wrongItemIds?.length ?? 0) : 0;
  const typo = correct && outcome.typo === true && !!outcome.given;
  const diff = typo && outcome.given ? diffWords(outcome.given, solution.text, scriptRules(getPack(lang).meta)) : null;
  const title = !correct ? "Casi…" : typo ? "¡Casi perfecto!" : matchMistakes > 0 ? "¡Hecho!" : PRAISE[seq % PRAISE.length];
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
        typo ? "border-lemon bg-lemon-soft" : correct ? "border-success bg-success-soft" : "border-error bg-error-soft",
      )}
    >
      <p className={cn("text-2xl font-extrabold", typo ? "text-ink" : correct ? "text-success-deep" : "text-error-deep")}>
        {title}
      </p>

      {diff ? (
        <p className="text-base text-ink">
          Te cuenta como bien, pero tienes un fallo de letra:{" "}
          <span lang={lang} className="font-bold">
            <Highlighted words={diff.given} tone="mistake" />
          </span>
        </p>
      ) : null}

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
              <TargetText text={solution.text} lang={lang}>
                {diff ? <Highlighted words={diff.expected} tone="fix" /> : solution.text}
              </TargetText>
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
          "pressable mt-1 min-h-14 w-full rounded-button px-6 text-lg font-bold tracking-wide",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
          typo
            ? "bg-lemon text-on-lemon [--ledge:var(--lemon-ledge)]"
            : correct
              ? "bg-success text-on-accent [--ledge:var(--success-ledge)]"
              : "bg-error text-on-accent [--ledge:var(--error-ledge)]",
        )}
      >
        Continuar
      </button>
    </section>
  );
}
