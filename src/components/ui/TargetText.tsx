"use client";

import type { ReactNode } from "react";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useRomanization } from "@/lib/content/use-romanization";

export interface TargetTextProps {
  /** The target-language text (also what gets romanized). */
  text: string;
  /** The text's language; omitted = the screen's language (the active one). */
  lang?: string | null;
  /** What to show instead of plain `text` (e.g. highlighted words); the Latin line still uses `text`. */
  children?: ReactNode;
  /** Extra classes for the Latin line. */
  latinClassName?: string;
}

/**
 * Target-language text as shown everywhere in the app: for a pack with `romanization` (and the
 * Perfil switch on) it adds the muted Latin line under it. For every other pack it renders the
 * text alone, exactly as plain `{text}` would (no wrapper).
 */
export function TargetText({ text, lang, children, latinClassName }: TargetTextProps) {
  const screenLang = useScreenLang();
  const latin = useRomanization(text, lang === undefined ? screenLang : lang);
  const content = children ?? text;
  if (!latin) return <>{content}</>;
  return (
    <span className="block">
      <span className="block">{content}</span>
      <span
        className={`mt-0.5 block text-[max(0.875rem,0.65em)] font-normal not-italic leading-snug opacity-70 ${latinClassName ?? ""}`}
      >
        {latin}
      </span>
    </span>
  );
}

/**
 * Only the Latin line of `text` (nothing for a pack without `romanization` or with the switch
 * off), for places where the target text itself is rendered elsewhere (e.g. a page title).
 */
export function LatinLine({ text, lang, className }: { text: string; lang?: string | null; className?: string }) {
  const screenLang = useScreenLang();
  const latin = useRomanization(text, lang === undefined ? screenLang : lang);
  return latin ? <span className={`block ${className ?? ""}`}>{latin}</span> : null;
}
