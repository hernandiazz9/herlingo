"use client";

import { useRef, useState } from "react";
import { Picture, TargetText } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import type { MatchExercise as Match } from "@/lib/exercises";
import { Prompt, useLessonGloss, useLessonLang, usePlay, type ExerciseProps } from "./shared";

type Side = "target" | "es";
interface Pick {
  side: Side;
  id: string;
}

const FLASH_MS = 600;

/**
 * Tap a target-language word and its meaning in the gloss language (either order). Mistakes are recorded per item.
 * When every pair has an `image`, the right column shows the pictures instead of the meanings.
 */
export function MatchExercise({ exercise, answered, onAnswer }: ExerciseProps<Match>) {
  const [selected, setSelected] = useState<Pick | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [wrong, setWrong] = useState<Pick[]>([]);
  const mistakes = useRef(new Set<string>());
  const play = usePlay();
  const lang = useLessonLang();
  const gloss = useLessonGloss();
  const copy = useLearnCopy();
  const pairs = new Map(exercise.pairs.map((p) => [p.id, p]));
  const pictures = exercise.pairs.every((p) => p.image);

  const tap = (pick: Pick) => {
    if (answered || done.includes(pick.id)) return;
    if (pick.side === "target") play(pairs.get(pick.id)!.audio);
    if (!selected || selected.side === pick.side) {
      setSelected(pick);
      return;
    }
    setSelected(null);
    if (selected.id === pick.id) {
      const next = [...done, pick.id];
      setDone(next);
      if (next.length === exercise.pairs.length) {
        onAnswer({ correct: true, wrongItemIds: [...mistakes.current] });
      }
    } else {
      // The target-language item of the wrong pair counts as a mistake.
      mistakes.current.add(selected.side === "target" ? selected.id : pick.id);
      const flash = [selected, pick];
      setWrong(flash);
      setTimeout(() => setWrong((w) => (w === flash ? [] : w)), FLASH_MS);
    }
  };

  const cell = (side: Side, id: string, label: string) => {
    const image = side === "es" && pictures ? pairs.get(id)!.image : undefined;
    const isDone = done.includes(id);
    const isSelected = selected?.side === side && selected.id === id;
    const isWrong = wrong.some((w) => w.side === side && w.id === id);
    return (
      <button
        key={`${side}:${id}`}
        type="button"
        lang={side === "target" ? lang : gloss.tag}
        disabled={answered || isDone}
        aria-pressed={isSelected}
        aria-label={image ? label : undefined}
        onClick={() => tap({ side, id })}
        className={cn(
          "pressable rounded-button border-2 px-3 py-2 text-base font-bold leading-tight transition-colors",
          pictures ? "flex min-h-28 items-center justify-center py-1" : "min-h-16",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
          isDone && "border-success bg-success-soft text-success-deep opacity-60 [--ledge:transparent]",
          !isDone && isWrong && "border-error bg-error-soft text-error-deep [--ledge:var(--error)]",
          !isDone && !isWrong && isSelected && "border-sea bg-sea-soft text-sea-deep [--ledge:var(--sea)]",
          !isDone && !isWrong && !isSelected && "border-line bg-surface text-ink [--ledge:var(--line)]",
        )}
      >
        {image ? (
          <Picture image={image} alt="" bordered={false} className="max-w-24" />
        ) : side === "target" ? (
          <TargetText text={label} lang={lang} />
        ) : (
          label
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Prompt>{pictures ? copy.matchPictures : copy.matchPairs}</Prompt>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">{exercise.textOrder.map((id) => cell("target", id, pairs.get(id)!.text))}</div>
        <div className="flex flex-col gap-3">{exercise.glossOrder.map((id) => cell("es", id, pairs.get(id)!.gloss))}</div>
      </div>
    </div>
  );
}
