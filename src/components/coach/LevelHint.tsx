"use client";

import Link from "next/link";
import { useLearnerProfile } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { ChevronRightIcon } from "./icons";
import { FOCUS } from "./shared";

/**
 * Route of the AI level interview, set by plan 005 T48 when the interview exists. While it is
 * empty the hint stays hidden.
 */
const LEVEL_TEST_HREF: string = "";

/** Prepárate's offer of the level interview while no assessment exists (a link, never blocking). */
export function LevelHint({ lang }: { lang: string }) {
  const { latest } = useLearnerProfile(lang);
  if (!LEVEL_TEST_HREF || latest) return null;
  return (
    <Link
      href={LEVEL_TEST_HREF}
      className={cn(
        "pressable flex items-center gap-3 rounded-card border-2 border-lemon bg-lemon-soft p-4 [--ledge:var(--lemon-ledge)]",
        FOCUS,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-bold text-ink">Haz la prueba de nivel</span>
        <span className="text-sm text-ink-muted">Unas pocas preguntas para que te prepare situaciones a tu medida.</span>
      </span>
      <ChevronRightIcon className="shrink-0 text-ink-muted" />
    </Link>
  );
}
