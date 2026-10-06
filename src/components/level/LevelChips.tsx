"use client";

import { cn } from "@/lib/cn";
import type { Level } from "@/lib/content";

/** "Todos" in a filter: every level. */
export const ALL_LEVELS = "all";
export type LevelFilter = Level | typeof ALL_LEVELS;

interface LevelChipsProps<T extends LevelFilter> {
  levels: Level[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group ("Tu nivel", "Filtrar por nivel"). */
  label: string;
  /** Adds a first "Todos" chip (filters only). */
  allLabel?: string;
  className?: string;
}

/**
 * A row of CEFR level chips (A2, B1…), optionally preceded by "Todos". Render it only for a pack
 * with levels (`levels.length > 0`).
 */
export function LevelChips<T extends LevelFilter>({ levels, value, onChange, label, allLabel, className }: LevelChipsProps<T>) {
  const options: { id: LevelFilter; text: string }[] = [
    ...(allLabel ? [{ id: ALL_LEVELS as LevelFilter, text: allLabel }] : []),
    ...levels.map((l) => ({ id: l as LevelFilter, text: l })),
  ];
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id as T)}
            className={cn(
              "min-h-11 min-w-14 shrink-0 rounded-full border-2 px-4 text-base font-bold whitespace-nowrap",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
              active ? "border-sea bg-sea text-on-accent" : "border-line bg-surface text-ink",
            )}
          >
            {o.text}
          </button>
        );
      })}
    </div>
  );
}
