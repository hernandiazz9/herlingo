"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { AnswerExercise, ChoiceOption, ListenMeaningExercise, ReadMeaningExercise } from "@/lib/exercises";
import { MiniPlay, PlayControls, Prompt, usePlay, type ExerciseProps } from "./shared";

type ChoiceKind = ListenMeaningExercise | ReadMeaningExercise | AnswerExercise;

/** Listen and pick the meaning / read and pick the meaning / answer the question. */
export function ChoiceExercise({ exercise, answered, onAnswer }: ExerciseProps<ChoiceKind>) {
  const [picked, setPicked] = useState<string | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const play = usePlay();

  const choose = (option: ChoiceOption) => {
    if (answered || picked) return;
    setPicked(option.id);
    if (exercise.type === "answer" && option.audio) play(option.audio);
    onAnswer({ correct: option.correct, given: option.label });
  };

  return (
    <div className="flex flex-col gap-6">
      {exercise.type === "listen-meaning" && (
        <>
          <Prompt>Escucha y elige qué significa</Prompt>
          <PlayControls audio={exercise.audio} />
        </>
      )}
      {exercise.type === "read-meaning" && (
        <>
          <Prompt>¿Qué significa?</Prompt>
          <div className="flex items-center gap-3">
            <MiniPlay audio={exercise.audio} />
            <p lang="it" className="text-2xl font-bold text-sea-deep">
              {exercise.audio.text}
            </p>
          </div>
        </>
      )}
      {exercise.type === "answer" && (
        <>
          <Prompt>Te preguntan… ¿qué respondes?</Prompt>
          <PlayControls audio={exercise.question} />
          {showQuestion || answered ? (
            <p lang="it" className="text-xl font-bold text-sea-deep">
              «{exercise.question.text}»
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setShowQuestion(true)}
              className="self-start text-base font-bold text-sea underline underline-offset-4"
            >
              Ver la pregunta
            </button>
          )}
        </>
      )}

      <ul className="flex flex-col gap-3">
        {exercise.options.map((option) => {
          const isPicked = picked === option.id;
          const reveal = answered && option.correct;
          return (
            <li key={option.id} className="flex items-center gap-2">
              <button
                type="button"
                disabled={answered}
                onClick={() => choose(option)}
                lang={exercise.type === "answer" ? "it" : undefined}
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
                {option.label}
              </button>
              {exercise.type === "answer" && option.audio ? <MiniPlay audio={option.audio} label={`Escuchar: ${option.label}`} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
