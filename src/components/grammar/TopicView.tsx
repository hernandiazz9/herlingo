"use client";

import { getGrammarEntry, getPack } from "@/lib/content";
import { GrammarCardBody } from "./GrammarCardBody";
import { GrammarScreen } from "./GrammarScreen";

/**
 * A topic page of pack `lang`: the grammar card as lessons show it (summary, points, table,
 * examples with audio), full page. The page header holds the title.
 */
export function TopicView({ id, lang }: { id: string; lang: string }) {
  const entry = getGrammarEntry(id, getPack(lang));
  if (entry?.kind !== "topic") return null;
  return (
    <GrammarScreen lang={lang}>
      <div className="flex flex-col gap-5">
        <GrammarCardBody card={entry.card} heading={false} />
      </div>
    </GrammarScreen>
  );
}
