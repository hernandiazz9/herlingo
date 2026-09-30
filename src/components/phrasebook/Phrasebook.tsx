"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { SpeakerIcon } from "@/components/icons";
import { speak } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { getPack, type Phrase } from "@/lib/content";
import { useFavorites } from "@/lib/favorites/use-favorites";
import { CloseIcon, ExpandIcon, SearchIcon, SlowIcon, StarIcon } from "./icons";
import { fold, matches } from "./search";
import { ShowMode } from "./ShowMode";

type Filter = { kind: "all" } | { kind: "fav" } | { kind: "situation"; id: string };

interface Entry {
  phrase: Phrase;
  haystack: string;
}

/** Pocket phrasebook: every phrase of the pack grouped by situation, searchable, tap to play. */
export function Phrasebook({ lang }: { lang?: string }) {
  const pack = getPack(lang);
  const { favorites, toggle } = useFavorites(pack.meta.lang);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [shown, setShown] = useState<Phrase | null>(null);
  const closeShow = useCallback(() => setShown(null), []);

  const entries = useMemo<Entry[]>(
    () =>
      pack.phrases.map((phrase) => ({
        phrase,
        haystack: fold(
          [phrase.text, phrase.es, phrase.literal, phrase.notes, ...(phrase.tags ?? [])].filter(Boolean).join(" "),
        ),
      })),
    [pack],
  );

  const situations = useMemo(
    () => pack.meta.situations.filter((s) => entries.some((e) => e.phrase.situation === s.id)),
    [pack, entries],
  );

  const groups = useMemo(() => {
    const visible = entries.filter(
      (e) =>
        (filter.kind === "all" ||
          (filter.kind === "fav" && favorites.has(e.phrase.id)) ||
          (filter.kind === "situation" && e.phrase.situation === filter.id)) &&
        matches(e.haystack, deferredQuery),
    );
    return situations
      .map((s) => ({ situation: s, phrases: visible.filter((e) => e.phrase.situation === s.id).map((e) => e.phrase) }))
      .filter((g) => g.phrases.length > 0);
  }, [entries, situations, filter, favorites, deferredQuery]);

  const total = groups.reduce((n, g) => n + g.phrases.length, 0);

  const chips: Array<{ key: string; label: string; filter: Filter; active: boolean }> = [
    { key: "all", label: "Todas", filter: { kind: "all" }, active: filter.kind === "all" },
    { key: "fav", label: `★ Favoritas (${favorites.size})`, filter: { kind: "fav" }, active: filter.kind === "fav" },
    ...situations.map((s) => ({
      key: s.id,
      label: s.emoji ? `${s.emoji} ${s.title}` : s.title,
      filter: { kind: "situation", id: s.id } as Filter,
      active: filter.kind === "situation" && filter.id === s.id,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 bg-cream px-5 pt-[calc(0.5rem+var(--safe-top))] pb-2">
        <label className="flex min-h-12 items-center gap-2 rounded-button border-2 border-line bg-surface px-3 focus-within:border-sea">
          <SearchIcon className="shrink-0 text-ink-muted" />
          <span className="sr-only">Buscar frase</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
              onClick={() => setQuery("")}
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
              onClick={() => setFilter(chip.filter)}
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

      <p className="text-sm text-ink-muted" aria-live="polite">
        {total === 1 ? "1 frase" : `${total} frases`}
      </p>

      {total === 0 ? (
        <p className="rounded-card border-2 border-dashed border-line p-6 text-center text-ink-muted">
          {filter.kind === "fav" && favorites.size === 0
            ? "Aún no tienes favoritas. Toca la estrella de una frase para guardarla aquí."
            : "No hay frases que coincidan. Prueba con otra palabra."}
        </p>
      ) : null}

      {groups.map(({ situation, phrases }) => (
        <section key={situation.id} className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-ink">
            {situation.emoji ? <span aria-hidden="true">{situation.emoji} </span> : null}
            {situation.title}
          </h2>
          <ul className="flex flex-col gap-2">
            {phrases.map((phrase) => (
              <PhraseRow
                key={phrase.id}
                phrase={phrase}
                open={openId === phrase.id}
                favorite={favorites.has(phrase.id)}
                onPlay={() => {
                  speak(phrase);
                  setOpenId(phrase.id);
                }}
                onToggleFavorite={() => toggle(phrase.id)}
                onShow={() => setShown(phrase)}
              />
            ))}
          </ul>
        </section>
      ))}

      {shown ? <ShowMode item={shown} onClose={closeShow} /> : null}
    </div>
  );
}

interface PhraseRowProps {
  phrase: Phrase;
  open: boolean;
  favorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onShow: () => void;
}

function PhraseRow({ phrase, open, favorite, onPlay, onToggleFavorite, onShow }: PhraseRowProps) {
  return (
    <li className={cn("rounded-card border-2 bg-surface", open ? "border-sea" : "border-line")}>
      <div className="flex items-start gap-1 p-2 pl-4">
        <button
          type="button"
          onClick={onPlay}
          aria-expanded={open}
          className="flex min-h-12 flex-1 items-start gap-3 py-1.5 text-left"
        >
          <span className="flex-1">
            <span lang="it" className="block text-lg leading-snug font-bold text-ink">
              {phrase.text}
            </span>
            <span className="block text-base text-ink-muted">{phrase.es}</span>
          </span>
          <SpeakerIcon className="mt-1 shrink-0 text-sea" width={22} height={22} />
        </button>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? "Quitar de favoritas" : "Añadir a favoritas"}
          className={cn(
            "inline-flex size-12 shrink-0 items-center justify-center rounded-full",
            favorite ? "text-lemon-deep" : "text-ink-muted",
          )}
        >
          <StarIcon filled={favorite} />
        </button>
      </div>
      {open ? (
        <div className="flex flex-col gap-3 border-t-2 border-line px-4 py-3">
          {phrase.literal ? (
            <p className="text-sm text-ink-muted">
              <span className="font-bold">Literal:</span> {phrase.literal}
            </p>
          ) : null}
          {phrase.notes ? <p className="text-sm text-ink">{phrase.notes}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => speak(phrase, { slow: true })}
              className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-button border-2 border-line bg-surface font-bold text-sea [--ledge:var(--line)]"
            >
              <SlowIcon width={20} height={20} /> Lento
            </button>
            <button
              type="button"
              onClick={onShow}
              className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-button bg-terracotta font-bold text-on-accent [--ledge:var(--terracotta-ledge)]"
            >
              <ExpandIcon width={20} height={20} /> Mostrar
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
