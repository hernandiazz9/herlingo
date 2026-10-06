"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ALL_LEVELS, LevelChips, type LevelFilter } from "@/components/level/LevelChips";
import { cn } from "@/lib/cn";
import { getLevels, getPack, type Pack } from "@/lib/content";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { PhraseList } from "./PhraseList";
import type { Filter } from "./SearchHeader";
import { readView, serverView, setView, subscribeView, type PhrasebookView } from "./view";
import { WordList } from "./WordList";

const VIEWS: Array<{ id: PhrasebookView; label: string }> = [
  { id: "phrases", label: "Frases" },
  { id: "words", label: "Palabras" },
];

/**
 * Pocket phrasebook: a "Frases | Palabras" switch (remembered on the device) over the phrase list
 * and the picture vocabulary. Search text and topic filter carry over between the two. A pack with
 * levels shows everything, with level chips to narrow it to one level.
 */
export function Phrasebook() {
  const lang = useScreenLang();
  return lang ? <PackPhrasebook key={lang} lang={lang} /> : null;
}

function PackPhrasebook({ lang }: { lang: string }) {
  const fullPack = getPack(lang);
  const levels = getLevels(fullPack);
  const [level, setLevel] = useState<LevelFilter>(ALL_LEVELS);
  const pack = useMemo(() => levelPack(fullPack, level), [fullPack, level]);
  const view = useSyncExternalStore(subscribeView, readView, serverView);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const props = { pack, query, onQuery: setQuery, filter, onFilter: setFilter };

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Ver" className="grid grid-cols-2 gap-1 rounded-button border-2 border-line bg-sand p-1">
        {VIEWS.map((option) => {
          const selected = option.id === view;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setView(option.id)}
              className={cn(
                "min-h-11 rounded-[calc(var(--radius-button)-0.25rem)] px-3 text-base font-bold transition-colors",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
                selected ? "bg-surface text-sea shadow-[0_2px_0_0_var(--line)]" : "text-ink-muted",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {levels.length ? <LevelChips levels={levels} value={level} onChange={setLevel} label="Filtrar por nivel" allLabel="Todos" /> : null}
      {view === "words" ? <WordList {...props} /> : <PhraseList {...props} />}
    </div>
  );
}

/** The pack with only one level's phrases and words (items carry their unit's level). */
function levelPack(pack: Pack, level: LevelFilter): Pack {
  if (level === ALL_LEVELS) return pack;
  return {
    ...pack,
    phrases: pack.phrases.filter((p) => p.level === level),
    vocab: pack.vocab.filter((v) => v.level === level),
  };
}
