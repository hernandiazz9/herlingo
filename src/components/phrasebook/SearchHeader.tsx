"use client";

import { cn } from "@/lib/cn";
import type { Situation } from "@/lib/content";
import { CloseIcon, SearchIcon } from "./icons";

export type Filter = { kind: "all" } | { kind: "fav" } | { kind: "situation"; id: string };

export interface Chip {
  key: string;
  label: string;
  filter: Filter;
  active: boolean;
}

/** One chip per situation, active when `filter` points at it. */
export function situationChips(situations: Situation[], filter: Filter): Chip[] {
  return situations.map((s) => ({
    key: s.id,
    label: s.emoji ? `${s.emoji} ${s.title}` : s.title,
    filter: { kind: "situation", id: s.id },
    active: filter.kind === "situation" && filter.id === s.id,
  }));
}

interface SearchHeaderProps {
  query: string;
  onQuery: (query: string) => void;
  /** Accessible name of the search field ("Buscar frase"). */
  label: string;
  chips: Chip[];
  onFilter: (filter: Filter) => void;
}

/** Sticky search field plus the row of filter chips (shared by Frases and Palabras). */
export function SearchHeader({ query, onQuery, label, chips, onFilter }: SearchHeaderProps) {
  return (
    <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 bg-cream px-5 pt-[calc(0.5rem+var(--safe-top))] pb-2">
      <label className="flex min-h-12 items-center gap-2 rounded-button border-2 border-line bg-surface px-3 focus-within:border-sea">
        <SearchIcon className="shrink-0 text-ink-muted" />
        <span className="sr-only">{label}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Busca en italiano o en español"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label="Borrar búsqueda"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted"
          >
            <CloseIcon width={20} height={20} />
          </button>
        ) : null}
      </label>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrar por situación">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={chip.active}
            onClick={() => onFilter(chip.filter)}
            className={cn(
              "shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold whitespace-nowrap",
              chip.active ? "border-sea bg-sea text-on-accent" : "border-line bg-surface text-ink",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
