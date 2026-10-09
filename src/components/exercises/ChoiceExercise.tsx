"use client";

import { useState } from "react";
import { TargetText } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import type { AnswerExercise, ChoiceOption, ListenMeaningExercise, ReadMeaningExercise } from "@/lib/exercises";
import { MiniPlay, PlayControls, Prompt, useLessonGloss, useLessonLang, usePlay, type ExerciseProps } from "./shared";

type ChoiceKind = ListenMeaningExercise | ReadMeaningExercise | AnswerExercise;

/** Listen and pick the meaning / read and pick the meaning / answer the question. */
export function ChoiceExercise({ exercise, answered, onAnswer }: ExerciseProps<ChoiceKind>) {
  const lang = useLessonLang();
  const gloss = useLessonGloss();
  const [picked, setPicked] = useState<string | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const play = usePlay();
  const copy = useLearnCopy();

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
          <Prompt>{copy.listenMeaning}</Prompt>
          <PlayControls audio={exercise.audio} />
        </>
      )}
      {exercise.type === "read-meaning" && (
        <>
          <Prompt>{copy.readMeaning}</Prompt>
          <div className="flex items-center gap-3">
            <MiniPlay audio={exercise.audio} />
            <p lang={lang} className="text-2xl font-bold text-sea-deep">
              <TargetText text={exercise.audio.text} lang={lang} />
            </p>
          </div>
        </>
      )}
      {exercise.type === "answer" && (
        <>
          <Prompt>{copy.answerPrompt}</Prompt>
          <PlayControls audio={exercise.question} />
          {showQuestion || answered ? (
            <p lang={lang} className="text-xl font-bold text-sea-deep">
              <TargetText text={exercise.question.text} lang={lang}>
                «{exercise.question.text}»
              </TargetText>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setShowQuestion(true)}
              className="self-start text-base font-bold text-sea underline underline-offset-4"
            >
              {copy.showQuestion}
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
                lang={exercise.type === "answer" ? lang : gloss.tag}
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
                {exercise.type === "answer" ? <TargetText text={option.label} lang={lang} /> : option.label}
              </button>
              {exercise.type === "answer" && option.audio ? <MiniPlay audio={option.audio} label={copy.listenTo(option.label)} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
