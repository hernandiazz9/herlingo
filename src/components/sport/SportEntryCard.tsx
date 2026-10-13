"use client";

import Link from "next/link";
import { ChevronRightIcon } from "@/components/coach/icons";
import { FOCUS } from "@/components/coach/shared";
import { coachAvailable } from "@/lib/coach/available";
import { cn } from "@/lib/cn";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { SPORT_HREF, SPORT_TITLE } from "./nav";

/** The Jugar card that opens Modo deporte (only for packs Prepárate supports: `coachAvailable`). */
export function SportEntryCard() {
  const lang = useScreenLang();
  if (!lang || !coachAvailable(lang)) return null;
  return (
    <Link
      href={SPORT_HREF}
      className={cn(
        "pressable flex items-center gap-4 rounded-card border-2 border-terracotta bg-terracotta-soft p-4 [--ledge:var(--terracotta-ledge)]",
        FOCUS,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-terracotta text-2xl leading-none"
      >
        🏃
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-lg font-extrabold leading-tight text-ink">{SPORT_TITLE}</span>
        <span className="text-sm font-bold text-terracotta-deep">
          Aprende una situación solo escuchando, mientras corres o vas en bici.
        </span>
      </span>
      <ChevronRightIcon className="shrink-0 text-terracotta-deep" />
    </Link>
  );
}
