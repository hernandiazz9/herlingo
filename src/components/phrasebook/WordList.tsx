"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Picture } from "@/components/ui";
import { speak } from "@/lib/audio";
import { cn } from "@/lib/cn";
import { listVocab, type Pack, type Situation, type Vocab } from "@/lib/content";
import { fold, matches } from "./search";
import { SearchHeader, situationChips, type Chip, type Filter } from "./SearchHeader";

interface WordEntry {
  vocab: Vocab;
  haystack: string;
}

interface WordGroup {
  /** Pack situation, or undefined for the words without one ("Otras palabras"). */
  situation?: Situation;
  key: string;
  entries: WordEntry[];
}

/**
 * Words grouped by situation in pack order; inside each topic, pictured words first, then the
 * rest. One card per target-language text within a topic (a pictured duplicate wins).
 */
function buildGroups(pack: Pack): WordGroup[] {
  const groups = new Map<string, WordEntry[]>();
  for (const vocab of listVocab({}, pack)) {
    const key = vocab.situation ?? "";
    const list = groups.get(key) ?? [];
    const dupe = list.findIndex((e) => e.vocab.text === vocab.text);
    const entry = {
      vocab,
      haystack: fold([vocab.text, vocab.word, vocab.plural, vocab.es].filter(Boolean).join(" ")),
    };
    if (dupe === -1) list.push(entry);
    else if (!list[dupe].vocab.image && vocab.image) list[dupe] = entry;
    groups.set(key, list);
  }
  const ordered = (entries: WordEntry[]) => [
    ...entries.filter((e) => e.vocab.image),
    ...entries.filter((e) => !e.vocab.image),
  ];
  const out: WordGroup[] = pack.meta.situations
    .filter((s) => groups.has(s.id))
    .map((s) => ({ situation: s, key: s.id, entries: ordered(groups.get(s.id)!) }));
  const known = new Set(pack.meta.situations.map((s) => s.id));
  const others = [...groups.entries()].filter(([key]) => !known.has(key)).flatMap(([, entries]) => entries);
  if (others.length) out.push({ key: "", entries: ordered(others) });
  return out;
}

interface WordListProps {
  pack: Pack;
  query: string;
  onQuery: (query: string) => void;
  filter: Filter;
  onFilter: (filter: Filter) => void;
}

/** "Palabras" view: vocabulary as picture cards grouped by situation; tap to hear and translate. */
export function WordList({ pack, query, onQuery, filter: rawFilter, onFilter }: WordListProps) {
  const deferredQuery = useDeferredValue(query);
  const [openId, setOpenId] = useState<string | null>(null);
  const all = useMemo(() => buildGroups(pack), [pack]);
  const situations = useMemo(() => all.flatMap((g) => (g.situation ? [g.situation] : [])), [all]);

  // The filter is shared with Frases: favourites (phrases only) or a topic without words → "Todas".
  const topic =
    rawFilter.kind === "situation" && situations.some((s) => s.id === rawFilter.id) ? rawFilter.id : null;
  const filter: Filter = topic ? { kind: "situation", id: topic } : { kind: "all" };

  const groups = useMemo(
    () =>
      all
        .filter((g) => !topic || g.situation?.id === topic)
        .map((g) => ({ ...g, entries: g.entries.filter((e) => matches(e.haystack, deferredQuery)) }))
        .filter((g) => g.entries.length > 0),
    [all, topic, deferredQuery],
  );
  const total = groups.reduce((n, g) => n + g.entries.length, 0);

  const chips: Chip[] = [
    { key: "all", label: "Todas", filter: { kind: "all" }, active: filter.kind === "all" },
    ...situationChips(situations, filter),
  ];

  const play = (vocab: Vocab) => {
    speak(vocab, { lang: pack.meta.lang });
    setOpenId(vocab.id);
  };

  return (
    <div className="flex flex-col gap-4">
      <SearchHeader query={query} onQuery={onQuery} label="Buscar palabra" chips={chips} onFilter={onFilter} />

      <p className="text-sm text-ink-muted" aria-live="polite">
        {total === 1 ? "1 palabra" : `${total} palabras`}
      </p>

      {total === 0 ? (
        <p className="rounded-card border-2 border-dashed border-line p-6 text-center text-ink-muted">
          No hay palabras que coincidan. Prueba con otra palabra.
        </p>
      ) : null}

      {groups.map(({ situation, key, entries }) => {
        const pictured = entries.filter((e) => e.vocab.image);
        const plain = entries.filter((e) => !e.vocab.image);
        return (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="text-lg font-extrabold text-ink">
              {situation?.emoji ? <span aria-hidden="true">{situation.emoji} </span> : null}
              {situation?.title ?? "Otras palabras"}
            </h2>
            {pictured.length ? (
              <ul className="grid grid-cols-3 gap-2">
                {pictured.map(({ vocab }) => (
                  <WordCard
                    key={vocab.id}
                    vocab={vocab}
                    lang={pack.meta.lang}
                    open={openId === vocab.id}
                    onPlay={() => play(vocab)}
                  />
                ))}
              </ul>
            ) : null}
            {plain.length ? (
              <ul className="grid grid-cols-2 gap-2">
                {plain.map(({ vocab }) => (
                  <WordCard
                    key={vocab.id}
                    vocab={vocab}
                    lang={pack.meta.lang}
                    open={openId === vocab.id}
                    onPlay={() => play(vocab)}
                  />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

interface WordCardProps {
  vocab: Vocab;
  lang: string;
  open: boolean;
  onPlay: () => void;
}

/**
 * Picture (when the word has one) and the bare word; once tapped it plays and shows the word with
 * its article and the Spanish translation.
 */
function WordCard({ vocab, lang, open, onPlay }: WordCardProps) {
  return (
    <li className="flex">
      <button
        type="button"
        onClick={onPlay}
        aria-expanded={open}
        className={cn(
          "pressable flex w-full flex-col items-center gap-1 rounded-card border-2 bg-surface text-center [--ledge:var(--line)]",
          vocab.image ? "p-1.5 pb-2" : "min-h-16 justify-center px-3 py-2",
          open ? "border-sea" : "border-line",
        )}
      >
        {vocab.image ? <Picture image={vocab.image} alt="" bordered={false} /> : null}
        <span lang={lang} className="text-base leading-tight font-bold break-words text-ink">
          {open ? vocab.text : vocab.word}
        </span>
        {open ? <span className="text-sm leading-tight text-ink-muted">{vocab.es}</span> : null}
      </button>
    </li>
  );
}
