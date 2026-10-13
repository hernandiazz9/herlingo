"use client";

import { useMemo } from "react";
import type { SequenceLine } from "@/lib/audio";
import { getGrammarEntry, getPack, glossOf, type GrammarCard } from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";
import { GrammarCardBody } from "./GrammarCardBody";
import { GrammarScreen } from "./GrammarScreen";
import { usePlayAll } from "./play-all";
import { GrammarReadButton } from "./ReadButton";

/**
 * A topic page of pack `lang`: the grammar card as lessons show it (summary, points, table,
 * examples with audio, «Escuchar todo» for the examples in order), full page, then "Leído". The page
 * header holds the title.
 */
export function TopicView({ id, lang }: { id: string; lang: string }) {
  const entry = getGrammarEntry(id, getPack(lang));
  if (entry?.kind !== "topic") return null;
  return (
    <GrammarScreen lang={lang}>
      <TopicPage card={entry.card} lang={lang} />
    </GrammarScreen>
  );
}

function TopicPage({ card, lang }: { card: GrammarCard; lang: string }) {
  const gloss = useGlossLang(lang);
  const lines = useMemo<SequenceLine[]>(() => card.examples.map((input) => ({ input, options: { lang } })), [card, lang]);
  const player = usePlayAll(lines, glossOf(card.title, gloss.lang));
  return (
    <div className="flex flex-col gap-5">
      <GrammarCardBody card={card} heading={false} player={player} />
      <GrammarReadButton key={card.id} id={card.id} lang={lang} />
    </div>
  );
}
