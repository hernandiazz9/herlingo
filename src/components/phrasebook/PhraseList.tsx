"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { SpeakerIcon } from "@/components/icons";
import { speak } from "@/lib/audio";
import { TargetText } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getAllLessons, type Pack, type Phrase } from "@/lib/content";
import { useFavorites } from "@/lib/favorites/use-favorites";
import { recordListen } from "@/lib/progress/activity";
import { dedupeByText } from "@/lib/srs/dedupe";
import { ExpandIcon, SlowIcon, StarIcon } from "./icons";
import { fold, matches, romanizedForSearch } from "./search";
import { SearchHeader, situationChips, type Chip, type Filter } from "./SearchHeader";
import { ShowMode } from "./ShowMode";
import { useLessonLang } from "@/components/exercises";

interface Entry {
  phrase: Phrase;
  /** `phrase.id` first, then other ids with the same target-language text (hidden duplicates). */
  ids: string[];
  haystack: string;
}

/**
 * One entry per target-language text: of several ids with the same text, the one taught first on the
 * path wins (unused phrases after); entries keep the pack order.
 */
function buildEntries(pack: Pack): Entry[] {
  const rank = new Map<string, number>();
  getAllLessons(pack).forEach((lesson, i) => lesson.items.forEach((id) => rank.has(id) || rank.set(id, i)));
  const byId = new Map(pack.phrases.map((p) => [p.id, p]));
  const byPath = pack.phrases
    .map((p, i) => ({ id: p.id, key: rank.get(p.id) ?? Number.MAX_SAFE_INTEGER, i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((x) => x.id);
  const { ids: kept, aliases } = dedupeByText(byPath, (id) => byId.get(id)?.text);
  const keep = new Set(kept);
  return pack.phrases
    .filter((phrase) => keep.has(phrase.id))
    .map((phrase) => {
      const ids = [phrase.id, ...(aliases.get(phrase.id) ?? [])];
      const all = ids.map((id) => byId.get(id)).filter((p): p is Phrase => !!p);
      return {
        phrase,
        ids,
        haystack: fold(
          all
            .flatMap((p) => [p.text, ...romanizedForSearch([p.text], pack), p.es, p.literal, p.notes, ...(p.tags ?? [])])
            .filter(Boolean)
            .join(" "),
        ),
      };
    });
}

interface PhraseListProps {
  pack: Pack;
  query: string;
  onQuery: (query: string) => void;
  filter: Filter;
  onFilter: (filter: Filter) => void;
}

/** "Frases" view: every phrase of the pack grouped by situation, searchable, tap to play. */
export function PhraseList({ pack, query, onQuery, filter: rawFilter, onFilter }: PhraseListProps) {
  const { favorites, toggle } = useFavorites(pack.meta.lang);
  const deferredQuery = useDeferredValue(query);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shown, setShown] = useState<Phrase | null>(null);
  const closeShow = useCallback(() => setShown(null), []);

  const entries = useMemo(() => buildEntries(pack), [pack]);
  // A phrase is a favourite when any of its ids is (a favourite saved on a now hidden duplicate).
  const isFav = useCallback((e: Entry) => e.ids.some((id) => favorites.has(id)), [favorites]);
  const favCount = useMemo(() => entries.filter(isFav).length, [entries, isFav]);
  const toggleFav = (e: Entry) => {
    const on = e.ids.filter((id) => favorites.has(id));
    if (on.length) on.forEach(toggle);
    else toggle(e.phrase.id);
  };

  const situations = useMemo(
    () => pack.meta.situations.filter((s) => entries.some((e) => e.phrase.situation === s.id)),
    [pack, entries],
  );
  // The filter is shared with Palabras: a topic without phrases falls back to "Todas".
  const filter = useMemo<Filter>(
    () =>
      rawFilter.kind === "situation" && !situations.some((s) => s.id === rawFilter.id) ? { kind: "all" } : rawFilter,
    [rawFilter, situations],
  );

  const groups = useMemo(() => {
    const visible = entries.filter(
      (e) =>
        (filter.kind === "all" ||
          (filter.kind === "fav" && isFav(e)) ||
          (filter.kind === "situation" && e.phrase.situation === filter.id)) &&
        matches(e.haystack, deferredQuery),
    );
    return situations
      .map((s) => ({ situation: s, entries: visible.filter((e) => e.phrase.situation === s.id) }))
      .filter((g) => g.entries.length > 0);
  }, [entries, situations, filter, isFav, deferredQuery]);

  const total = groups.reduce((n, g) => n + g.entries.length, 0);

  const chips: Chip[] = [
    { key: "all", label: "Todas", filter: { kind: "all" }, active: filter.kind === "all" },
    { key: "fav", label: `★ Favoritas (${favCount})`, filter: { kind: "fav" }, active: filter.kind === "fav" },
    ...situationChips(situations, filter),
  ];

  return (
    <div className="flex flex-col gap-4">
      <SearchHeader query={query} onQuery={onQuery} label="Buscar frase" chips={chips} onFilter={onFilter} />

      <p className="text-sm text-ink-muted" aria-live="polite">
        {total === 1 ? "1 frase" : `${total} frases`}
      </p>

      {total === 0 ? (
        <p className="rounded-card border-2 border-dashed border-line p-6 text-center text-ink-muted">
          {filter.kind === "fav" && favCount === 0
            ? "Aún no tienes favoritas. Toca la estrella de una frase para guardarla aquí."
            : "No hay frases que coincidan. Prueba con otra palabra."}
        </p>
      ) : null}

      {groups.map(({ situation, entries: rows }) => (
        <section key={situation.id} className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-ink">
            {situation.emoji ? <span aria-hidden="true">{situation.emoji} </span> : null}
            {situation.title}
          </h2>
          <ul className="flex flex-col gap-2">
            {rows.map((entry) => (
              <PhraseRow
                key={entry.phrase.id}
                phrase={entry.phrase}
                open={openId === entry.phrase.id}
                favorite={isFav(entry)}
                onPlay={() => {
                  speak(entry.phrase, { lang: pack.meta.lang });
                  recordListen(entry.phrase.audioKey, pack.meta.lang);
                  setOpenId(entry.phrase.id);
                }}
                onToggleFavorite={() => toggleFav(entry)}
                onShow={() => setShown(entry.phrase)}
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
  const lang = useLessonLang();
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
            <span lang={lang} className="block text-lg leading-snug font-bold text-ink">
              <TargetText text={phrase.text} lang={lang} />
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
              onClick={() => {
                speak(phrase, { lang, slow: true });
                recordListen(phrase.audioKey, lang);
              }}
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
