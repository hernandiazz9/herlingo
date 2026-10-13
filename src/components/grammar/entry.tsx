import type { SVGProps } from "react";
import { listGrammarTopics, listVerbs, type Level, type Pack } from "@/lib/content";

/**
 * What the Gramática index of `pack` lists for the learner's `level` (as `/gramatica/` does).
 * Entry points (Frasario button, Ruta card) hide when both are 0.
 */
export function grammarCounts(pack: Pack, level: Level | null): { verbs: number; topics: number } {
  return { verbs: listVerbs(pack).length, topics: listGrammarTopics(pack, level).length };
}

/** "12 verbos · 9 temas" (the parts that are not 0; Spanish UI copy of the Ruta and the Frasario). */
export function grammarCountsLabel({ verbs, topics }: { verbs: number; topics: number }): string {
  return [verbs ? `${verbs} ${verbs === 1 ? "verbo" : "verbos"}` : "", topics ? `${topics} ${topics === 1 ? "tema" : "temas"}` : ""]
    .filter(Boolean)
    .join(" · ");
}

/** Closed book with text lines: the Gramática entry points. */
export function GrammarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M5 19.5v-15A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Zm0 0A1.5 1.5 0 0 0 6.5 21H19v-3" />
      <path d="M9 7.5h6M9 11h4" />
    </svg>
  );
}
