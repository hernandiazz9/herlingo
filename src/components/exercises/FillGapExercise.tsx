"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { getPack } from "@/lib/content";
import { checkAnswer, scriptRules, type FillGapExercise as FillGap } from "@/lib/exercises";
import { MiniPlay, Prompt, useLessonLang, type ExerciseProps } from "./shared";

/** Target-language sentence with a missing word: pick the word. */
export function FillGapExercise({ exercise, answered, onAnswer }: ExerciseProps<FillGap>) {
  const lang = useLessonLang();
  const rules = scriptRules(getPack(lang).meta);
  const [picked, setPicked] = useState<string | null>(null);

  const choose = (word: string) => {
    if (answered || picked) return;
    setPicked(word);
    const result = checkAnswer(word, exercise.gap, rules);
    onAnswer({ correct: result.correct, accentNote: result.accentNote, given: word });
  };
  const correct = picked !== null && checkAnswer(picked, exercise.gap, rules).correct;

  return (
    <div className="flex flex-col gap-6">
      <Prompt>Completa la frase</Prompt>
      <p className="text-lg text-ink-muted">{exercise.es}</p>
      <div className="flex items-start gap-3">
        {answered ? <MiniPlay audio={exercise.audio} /> : null}
        <p lang={lang} className="whitespace-pre-wrap text-2xl font-bold leading-relaxed text-ink">
          {exercise.before}
          <span
            className={cn(
              "inline-block min-w-20 rounded-lg border-b-4 px-2 text-center",
              !picked && "border-lemon-deep bg-lemon-soft text-transparent",
              picked && correct && "border-success bg-success-soft text-success-deep",
              picked && !correct && "border-error bg-error-soft text-error-deep",
            )}
          >
            {picked ?? "····"}
          </span>
          {exercise.after}
        </p>
      </div>
      <div lang={lang} className="grid grid-cols-2 gap-3">
        {exercise.options.map((word) => (
          <button
            key={word}
            type="button"
            disabled={answered}
            onClick={() => choose(word)}
            className={cn(
              "pressable min-h-14 rounded-button border-2 border-line bg-surface px-3 text-lg font-bold text-ink [--ledge:var(--line)]",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
              answered && picked !== word && "opacity-60",
            )}
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
