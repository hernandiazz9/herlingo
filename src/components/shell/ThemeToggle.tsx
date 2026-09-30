"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import {
  THEME_CHOICES,
  readThemeChoice,
  setThemeChoice,
  subscribeThemeChoice,
  type ThemeChoice,
} from "@/lib/theme";

const LABELS: Record<ThemeChoice, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
};

const serverChoice = (): ThemeChoice => "system";

/** Segmented control to pick the app theme: follow the system, always light or always dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const choice = useSyncExternalStore(subscribeThemeChoice, readThemeChoice, serverChoice);

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn("grid grid-cols-3 gap-1 rounded-button border-2 border-line bg-sand p-1", className)}
    >
      {THEME_CHOICES.map((option) => {
        const selected = option === choice;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setThemeChoice(option)}
            className={cn(
              "min-h-11 rounded-[calc(var(--radius-button)-0.25rem)] px-3 text-base font-bold transition-colors",
              "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
              selected ? "bg-surface text-sea shadow-[0_2px_0_0_var(--line)]" : "text-ink-muted",
            )}
          >
            {LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
