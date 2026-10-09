"use client";

import { useState } from "react";
import { MiniPlay, PlayControls, Prompt, useLessonGloss, useLessonLang, type ExerciseProps } from "@/components/exercises";
import { TargetText } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { AnswerExercise, ChoiceOption } from "@/lib/exercises";

/** Comprehension: hear (and read) a question about the story, pick the right answer. */
export function QuestionExercise({ exercise, answered, onAnswer }: ExerciseProps<AnswerExercise>) {
  const [picked, setPicked] = useState<string | null>(null);
  const [showEs, setShowEs] = useState(false);
  const lang = useLessonLang();
  const gloss = useLessonGloss();

  const choose = (option: ChoiceOption) => {
    if (answered || picked) return;
    setPicked(option.id);
    onAnswer({ correct: option.correct, given: option.label });
  };

  return (
    <div className="flex flex-col gap-6">
      <Prompt>Responde sobre la historia</Prompt>
      <PlayControls audio={exercise.question} size="md" />
      <div className="flex flex-col gap-1">
        <p lang={lang} className="text-2xl font-bold text-sea-deep">
          <TargetText text={exercise.question.text} lang={lang} />
        </p>
        {showEs || answered ? (
          <p lang={gloss.tag} className="text-base text-ink-muted">
            {exercise.questionGloss}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setShowEs(true)}
            className="self-start text-sm font-bold text-sea underline underline-offset-4"
          >
            Ver en español
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {exercise.options.map((option) => {
          const isPicked = picked === option.id;
          const reveal = answered && option.correct;
          return (
            <li key={option.id} className="flex items-center gap-2">
              <button
                type="button"
                lang={lang}
                disabled={answered}
                onClick={() => choose(option)}
                className={cn(
                  "pressable min-h-14 flex-1 rounded-button border-2 px-4 py-3 text-left text-lg font-bold",
                  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
                  reveal
                    ? "border-success bg-success-soft text-success-deep [--ledge:var(--success)]"
                    : isPicked
                      ? "border-error bg-error-soft text-error-deep [--ledge:var(--error)]"
                      : "border-line bg-surface text-ink [--ledge:var(--line)]",
                  answered && !reveal && !isPicked && "opacity-60",
                )}
              >
                <TargetText text={option.label} lang={lang} />
              </button>
              {option.audio ? <MiniPlay audio={option.audio} label={`Escuchar: ${option.label}`} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
