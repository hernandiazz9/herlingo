/**
 * Grammar entries read on this device, per language pack (localStorage `lang-lern:grammar:<lang>`,
 * `{ v: 1, reads: { [entryId]: { n, last } }, xp: { day, amount } }`, docs/grammar.md "Leído").
 * Tolerant parsing: an invalid entry is dropped, never the whole key. Nothing here throws.
 * No imports from `@/lib/progress` (it imports `clearGrammarReads` from here for "Borrar progreso").
 */
import { isDayKey } from "@/lib/progress/dates";

export const GRAMMAR_READS_VERSION = 1;

const PREFIX = "lang-lern:grammar:";
const EVENT = "lang-lern:grammar-change";

export interface GrammarRead {
  /** Times read ("Leído" taps), ≥ 1. */
  n: number;
  /** Local day of the last read ("YYYY-MM-DD"; "" if unknown). */
  last: string;
}

export interface GrammarReads {
  /** By grammar entry id (`verb.*` or a grammar card id). */
  reads: Record<string, GrammarRead>;
  /** Reading XP given on `day` (daily cap bookkeeping). */
  xp: { day: string; amount: number };
}

const key = (lang: string) => PREFIX + lang;

export function emptyGrammarReads(): GrammarReads {
  return { reads: {}, xp: { day: "", amount: 0 } };
}

/** Raw stored value ("" when missing or storage is unavailable). */
export function readGrammarReadsRaw(lang: string): string {
  try {
    return window.localStorage.getItem(key(lang)) ?? "";
  } catch {
    return "";
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Any stored value (any `v`) → the entries it holds that are valid. */
export function parseGrammarReads(raw: string): GrammarReads {
  const out = emptyGrammarReads();
  if (!raw) return out;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!isObject(v)) return out;
  if (isObject(v.reads)) {
    for (const [id, entry] of Object.entries(v.reads)) {
      if (!id || !isObject(entry)) continue;
      const n = entry.n;
      if (typeof n !== "number" || !Number.isFinite(n) || n < 1) continue;
      out.reads[id] = { n: Math.floor(n), last: isDayKey(entry.last) ? entry.last : "" };
    }
  }
  if (isObject(v.xp) && isDayKey(v.xp.day)) {
    const amount = v.xp.amount;
    if (typeof amount === "number" && Number.isFinite(amount) && amount >= 0) out.xp = { day: v.xp.day, amount };
  }
  return out;
}

/** The grammar reads of `lang` (empty on the server or when nothing is stored). */
export function getGrammarReads(lang: string): GrammarReads {
  return parseGrammarReads(readGrammarReadsRaw(lang));
}

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Saves `reads` as the current version. Returns false if storage is unavailable. */
export function writeGrammarReads(lang: string, reads: GrammarReads): boolean {
  let ok = true;
  try {
    window.localStorage.setItem(key(lang), JSON.stringify({ v: GRAMMAR_READS_VERSION, reads: reads.reads, xp: reads.xp }));
  } catch {
    ok = false;
  }
  notify();
  return ok;
}

/** Forgets every read of the pack (part of "Borrar progreso"). */
export function clearGrammarReads(lang: string): void {
  try {
    window.localStorage.removeItem(key(lang));
  } catch {
    // Nothing stored.
  }
  notify();
}

/** Calls `onChange` when any pack's grammar reads change (this tab or another). Returns the unsubscribe. */
export function subscribeGrammarReads(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
