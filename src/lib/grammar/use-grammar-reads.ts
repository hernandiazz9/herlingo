"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseGrammarReads, readGrammarReadsRaw, subscribeGrammarReads, type GrammarReads } from "./reads";

const empty = () => "";

/** Grammar reads of `lang`, live. Empty on the server and during hydration. */
export function useGrammarReads(lang: string): GrammarReads {
  const raw = useSyncExternalStore(subscribeGrammarReads, () => readGrammarReadsRaw(lang), empty);
  return useMemo(() => parseGrammarReads(raw), [raw]);
}
