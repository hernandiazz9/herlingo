/**
 * Gramática "Leído" (docs/grammar.md): read counts per grammar entry and the small daily-capped
 * reading XP. Framework-free; React reads it with `useGrammarReads()` from `./use-grammar-reads`.
 */
import { getPack, hasPack, isDrillable } from "@/lib/content";
import { recordReviewResult, startReviewing } from "@/lib/progress";
import { dayKey } from "@/lib/progress/dates";
import { getGrammarReads, writeGrammarReads } from "./reads";

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
