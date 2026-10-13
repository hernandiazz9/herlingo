/**
 * Gramática "Leído" (docs/grammar.md): read counts per grammar entry and the small daily-capped
 * reading XP. Framework-free; React reads it with `useGrammarReads()` from `./use-grammar-reads`.
 */
import { getPack, hasPack, isDrillable, type Pack } from "@/lib/content";
import { getProgress, recordReviewResult, startReviewing } from "@/lib/progress";
import { dayKey } from "@/lib/progress/dates";
import type { SrsEntry } from "@/lib/srs";
import { getGrammarReads, writeGrammarReads, type GrammarReads } from "./reads";

export {
  clearGrammarReads,
  getGrammarReads,
  GRAMMAR_READS_VERSION,
  parseGrammarReads,
  subscribeGrammarReads,
  type GrammarRead,
  type GrammarReads,
} from "./reads";

/** XP for the first read of an entry each day. */
export const GRAMMAR_READ_XP = 3;
/** Most reading XP per pack and day. */
export const GRAMMAR_DAILY_XP_CAP = 15;

/**
 * One "Leído" tap on entry `id` of pack `lang`: +1 read, and `GRAMMAR_READ_XP` if it is the
 * entry's first read today and the day's cap is not reached. The XP goes through
 * `recordReviewResult(…, "grammar")` (streak, activity log, Liga). A drillable entry (a verb, or a
 * card with `drills`) not yet in spaced repetition joins it (box 0: due now), so its drills show up
 * in Repaso only once it has been read. Returns the new read count and the XP given.
 */
export function markGrammarRead(lang: string, id: string, now = Date.now()): { count: number; xp: number } {
  if (!lang || !id) return { count: 0, xp: 0 };
  const today = dayKey(new Date(now));
  const state = getGrammarReads(lang);
  const prev = state.reads[id];
  const spent = state.xp.day === today ? state.xp.amount : 0;
  const xp = prev?.last === today ? 0 : Math.max(0, Math.min(GRAMMAR_READ_XP, GRAMMAR_DAILY_XP_CAP - spent));
  const count = (prev?.n ?? 0) + 1;
  state.reads[id] = { n: count, last: today };
  state.xp = { day: today, amount: spent + xp };
  writeGrammarReads(lang, state);
  if (hasPack(lang) && isDrillable(id, getPack(lang))) startReviewing(lang, id, now);
  if (xp > 0) {
    recordReviewResult(
      {
        lessonId: "grammar",
        lang,
        seed: "",
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        xp,
        exercises: 0,
        firstTryCorrect: 0,
        items: [],
      },
      "grammar",
    );
  }
  return { count, xp };
}

/**
 * The read drillable entries of `pack` (a verb, or a card with `drills`), best first for lesson
 * drills (docs/grammar.md "Exercises"): most lapses, then the lowest SRS box, then the least read
 * (ties by id). An entry with no SRS state counts as box 0 without lapses.
 */
export function rankDrillEntries(reads: GrammarReads, srs: Readonly<Record<string, SrsEntry>>, pack: Pack): string[] {
  const ranked = Object.entries(reads.reads)
    .filter(([id]) => isDrillable(id, pack))
    .map(([id, read]) => ({ id, n: read.n, lapses: srs[id]?.lapses ?? 0, box: srs[id]?.box ?? 0 }));
  ranked.sort((a, b) => b.lapses - a.lapses || a.box - b.box || a.n - b.n || a.id.localeCompare(b.id));
  return ranked.map((e) => e.id);
}

/** `rankDrillEntries` for pack `lang` from this device's reads and progress (empty when nothing is read). */
export function lessonDrillIds(lang: string): string[] {
  if (!lang || !hasPack(lang)) return [];
  return rankDrillEntries(getGrammarReads(lang), getProgress(lang).srs, getPack(lang));
}
