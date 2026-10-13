"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/path/icons";
import { markGrammarRead } from "@/lib/grammar";
import { useGrammarReads } from "@/lib/grammar/use-grammar-reads";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";

/**
 * "Leído" at the end of a verb or topic page (docs/grammar.md "Leído"): a tap counts one read
 * (and the small reading XP, shown by the XP toast); then it shows the count and stays disabled
 * until the page is left, so one visit counts once. Render it with `key={id}`.
 */
export function GrammarReadButton({ id, lang }: { id: string; lang: string }) {
  const copy = useLearnCopy();
  const reads = useGrammarReads(lang);
  // The count after this visit's tap; null until tapped.
  const [count, setCount] = useState<number | null>(null);
  const before = reads.reads[id]?.n ?? 0;

  return (
    <div aria-live="polite" className="flex flex-col items-center gap-2 pt-2">
      {count === null ? (
        <button
          type="button"
          onClick={() => setCount(markGrammarRead(lang, id).count)}
          className="pressable inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-button bg-sea px-6 text-lg font-bold tracking-wide text-on-accent [--ledge:var(--sea-ledge)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
        >
          <CheckIcon className="size-5" />
          {copy.grammarRead}
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="inline-flex min-h-14 w-full cursor-default items-center justify-center gap-2 rounded-button border-2 border-success bg-success-soft px-6 text-lg font-bold tracking-wide text-success-deep"
        >
          <CheckIcon className="size-5" />
          {copy.grammarReadCount(count)}
        </button>
      )}
      {count === null && before > 0 ? <p className="text-sm text-ink-muted">{copy.grammarReadBefore(before)}</p> : null}
    </div>
  );
}

/** The "×n" read badge of a Gramática tile or topic row (nothing before the first read). */
export function GrammarReadBadge({ n }: { n: number }) {
  const copy = useLearnCopy();
  if (n < 1) return null;
  return (
    <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success-deep">
      <span aria-hidden="true">×{n}</span>
      <span className="sr-only">{copy.grammarReadTimes(n)}</span>
    </span>
  );
}
