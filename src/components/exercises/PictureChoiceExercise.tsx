"use client";

import { useState } from "react";
import { Button, Picture, TargetText } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import type { PictureChoiceExercise as PictureChoice, PictureOption } from "@/lib/exercises";
import { PlayControls, Prompt, useLessonGloss, useLessonLang, usePlay, type ExerciseProps } from "./shared";

/**
 * Pick the picture among 4 cards (2×2), then "Comprobar".
 * - `picture-choice`: Spanish prompt; each card shows its picture and target-language word, tap = audio + select.
 * - `picture-listen`: target-language audio only; cards show pictures alone (tap = select, no audio, or the
 *   sounds would give the answer away) and reveal their words once checked.
 */
export function PictureChoiceExercise({ exercise, answered, onAnswer }: ExerciseProps<PictureChoice>) {
  const lang = useLessonLang();
  const gloss = useLessonGloss();
  const copy = useLearnCopy();
  const [picked, setPicked] = useState<string | null>(null);
  const play = usePlay();
  const listen = exercise.type === "picture-listen";

  const select = (option: PictureOption) => {
    if (answered) return;
    if (!listen) play(option.audio);
    setPicked(option.id);
  };

  const check = () => {
    const option = exercise.options.find((o) => o.id === picked);
    if (answered || !option) return;
    onAnswer({ correct: option.correct, given: listen ? option.gloss : option.text });
  };

  return (
    <div className="flex flex-col gap-6">
      {listen ? (
        <>
          <Prompt>{copy.listenPicture}</Prompt>
          <PlayControls audio={exercise.audio} />
        </>
      ) : (
        <Prompt>
          {copy.whichIs[0]}{" "}
          <span lang={gloss.tag} className="text-sea-deep">
            «{exercise.gloss}»
          </span>
          {copy.whichIs[1]}
        </Prompt>
      )}

      <ul className="grid grid-cols-2 gap-3">
        {exercise.options.map((option) => {
          const isPicked = picked === option.id;
          const reveal = answered && option.correct;
          const wrong = answered && isPicked && !option.correct;
          const showWord = !listen || answered;
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={answered}
                aria-pressed={isPicked}
                aria-label={showWord ? undefined : option.gloss}
                onClick={() => select(option)}
                className={cn(
                  "pressable flex w-full flex-col items-center gap-2 rounded-card border-2 p-3",
                  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
                  reveal
                    ? "border-success bg-success-soft text-success-deep [--ledge:var(--success)]"
                    : wrong
                      ? "border-error bg-error-soft text-error-deep [--ledge:var(--error)]"
                      : isPicked
                        ? "border-sea bg-sea-soft text-sea-deep [--ledge:var(--sea)]"
                        : "border-line bg-surface text-ink [--ledge:var(--line)]",
                  answered && !reveal && !wrong && "opacity-60",
                )}
              >
                <Picture image={option.image} alt="" bordered={false} className="max-w-36" />
                <span
                  lang={lang}
                  className={cn("min-h-7 text-center text-lg font-bold leading-tight", !showWord && "invisible")}
                  aria-hidden={!showWord}
                >
                  <TargetText text={option.text} lang={lang} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {!answered ? (
        <Button fullWidth disabled={!picked} onClick={check}>
          {copy.check}
        </Button>
      ) : null}
    </div>
  );
}
