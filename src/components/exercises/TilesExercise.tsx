"use client";

import { useState } from "react";
import { Button, TargetText } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getPack } from "@/lib/content";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import { checkAnswer, scriptRules, type TilesExercise as Tiles } from "@/lib/exercises";
import { Prompt, useLessonGloss, useLessonLang, type ExerciseProps } from "./shared";

const TILE =
  "pressable min-h-12 rounded-xl border-2 border-line bg-surface px-3.5 text-lg font-bold text-ink [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep";

/** Spanish → target language by tapping word tiles. */
export function TilesExercise({ exercise, answered, onAnswer }: ExerciseProps<Tiles>) {
  const lang = useLessonLang();
  const gloss = useLessonGloss();
  const { meta } = getPack(lang);
  const copy = useLearnCopy();
  // Indexes into exercise.tiles, in the order chosen.
  const [chosen, setChosen] = useState<number[]>([]);

  const add = (i: number) => !answered && setChosen((c) => [...c, i]);
  const remove = (i: number) => !answered && setChosen((c) => c.filter((x) => x !== i));
  const check = () => {
    const given = chosen.map((i) => exercise.tiles[i]).join(" ");
    const result = checkAnswer(given, exercise.answer, scriptRules(meta));
    onAnswer({ correct: result.correct, accentNote: result.accentNote, given });
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Prompt>{copy.translateInto}</Prompt>
      <p lang={gloss.tag} className="text-xl font-bold text-ink">
        {exercise.gloss}
      </p>

      <div
        lang={lang}
        aria-label={copy.yourAnswer}
        className="flex min-h-28 flex-wrap content-start gap-2 border-b-2 border-line pb-3"
      >
        {chosen.map((i) => (
          <button key={i} type="button" className={TILE} onClick={() => remove(i)} disabled={answered}>
            <TargetText text={exercise.tiles[i]} lang={lang} />
          </button>
        ))}
      </div>

      <div lang={lang} className="flex flex-wrap justify-center gap-2">
        {exercise.tiles.map((word, i) => {
          const used = chosen.includes(i);
          return (
            <button
              key={i}
              type="button"
              className={cn(TILE, used && "invisible")}
              onClick={() => add(i)}
              disabled={answered || used}
              aria-hidden={used}
            >
              <TargetText text={word} lang={lang} />
            </button>
          );
        })}
      </div>

      <div className="mt-auto">
        <Button fullWidth onClick={check} disabled={answered || chosen.length === 0}>
          {copy.check}
        </Button>
      </div>
    </div>
  );
}
