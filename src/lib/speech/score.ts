/**
 * Scoring of what the learner said against what they should have said (framework-free).
 *
 * Word-level alignment of the expected text against every alternative the recogniser returned:
 * - Normalisation from `@/lib/exercises/normalize`: case, punctuation and accents are ignored,
 *   apostrophes split words ("dov'è" = "dov è").
 * - The pack's `equivalents` are written out on both sides ("i'm" = "i am"), then digits on both
 *   sides with the pack's `numberWords` ("40" heard = "quaranta", "21" = "twenty-one").
 * - Words written together or apart match ("buon giorno" = "buongiorno", "dove" = "dov'è").
 * - A one-letter slip in a word of 5+ letters counts as right: the recogniser's spelling, not the
 *   learner's pronunciation, is usually at fault.
 *
 * Every expected word ends up `ok`, `missing` (nothing heard in its place) or `wrong` (something
 * else heard). Score = right words / (expected words + half a word per extra word heard), in [0, 1];
 * the attempt passes from `SPEECH_PASS_THRESHOLD`.
 */
import { expandEquivalents, levenshtein, normalizeAnswer, spellNumbers, type Equivalents } from "@/lib/exercises/normalize";

/**
 * Score (0–1) from which a spoken answer counts as right: 0.7 = 3 of 4 words right passes,
 * 2 of 3 does not; a one- or two-word phrase must be fully right. Used for phrases and for
 * choosing a dialogue option (`bestOption`).
 */
export const SPEECH_PASS_THRESHOLD = 0.7;

/** Weight of each word heard that is not in the expected text (fillers, a repeated word...). */
const EXTRA_WORD_PENALTY = 0.5;

export type WordStatus = "ok" | "missing" | "wrong";

/** One word of the expected text, as written in the content, with its result. */
export interface ScoredWord {
  /** The word as written (punctuation kept), for display. */
  text: string;
  status: WordStatus;
  /** For `wrong`: what was heard in its place (lower case). */
  heard?: string;
}

export interface SpeechScore {
  /** The expected text that matched best (one of `expected`), word by word. */
  words: ScoredWord[];
  /** In [0, 1]. */
  score: number;
  passed: boolean;
  /** The alternative heard that matched best, as the recogniser returned it ("" = nothing). */
  heard: string;
  /** The expected text that matched best. */
  expected: string;
  /** Words heard that are not in the expected text, in order (lower case). */
  extra: string[];
}

export type NumberWords = Readonly<Record<string, string>> | undefined;

/** The pack's matching fields: pass the pack's `meta` as is. Missing = plain comparison. */
export interface Matching {
  numberWords?: NumberWords;
  equivalents?: Equivalents;
}

interface Token {
  key: string;
  /** Lower case, accents kept: for display. */
  shown: string;
  /** Index of the written word it comes from (expected tokens only). */
  word: number;
}

function tokens(text: string, matching: Matching, word = -1): Token[] {
  const spelled = spellNumbers(expandEquivalents(text, matching.equivalents), matching.numberWords);
  const keys = normalizeAnswer(spelled, true).split(" ").filter(Boolean);
  const shown = normalizeAnswer(spelled).split(" ").filter(Boolean);
  return keys.map((key, i) => ({ key, shown: shown[i] ?? key, word }));
}

function same(a: string, b: string): boolean {
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 5 && levenshtein(a, b) <= 1;
}

type Op = "match" | "sub" | "missing" | "extra" | "merge-expected" | "merge-heard";
const COST: Record<Op, number> = { match: 0, sub: 1, missing: 1, extra: EXTRA_WORD_PENALTY, "merge-expected": 0, "merge-heard": 0 };

/** Scores one heard text against one expected text. */
function scoreOne(heard: string, expected: string, matching: Matching): SpeechScore {
  const written = expected.split(/\s+/).filter(Boolean);
  const e = written.flatMap((w, i) => tokens(w, matching, i));
  const h = tokens(heard, matching);
  const n = e.length;
  const m = h.length;

  // dp[i][j] = cheapest alignment of e[0..i) with h[0..j).
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  const op = Array.from({ length: n + 1 }, () => new Array<Op | null>(m + 1).fill(null));
  dp[0][0] = 0;
  const relax = (i: number, j: number, from: number, o: Op) => {
    const c = from + COST[o];
    if (c < dp[i][j]) {
      dp[i][j] = c;
      op[i][j] = o;
    }
  };
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (i > 0 && j > 0) {
        relax(i, j, dp[i - 1][j - 1], same(e[i - 1].key, h[j - 1].key) ? "match" : "sub");
        if (i > 1 && same(e[i - 2].key + e[i - 1].key, h[j - 1].key)) relax(i, j, dp[i - 2][j - 1], "merge-expected");
        if (j > 1 && same(e[i - 1].key, h[j - 2].key + h[j - 1].key)) relax(i, j, dp[i - 1][j - 2], "merge-heard");
      }
      if (i > 0) relax(i, j, dp[i - 1][j], "missing");
      if (j > 0) relax(i, j, dp[i][j - 1], "extra");
    }
  }

  // Walk back: status per expected token, plus the extra words.
  const status: WordStatus[] = new Array<WordStatus>(n).fill("missing");
  const inPlace: string[][] = Array.from({ length: n }, () => []);
  const extra: string[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const o = op[i][j];
    if (o === "match" || o === "sub") {
      status[i - 1] = o === "match" ? "ok" : "wrong";
      inPlace[i - 1].push(h[j - 1].shown);
      i--;
      j--;
    } else if (o === "merge-expected") {
      status[i - 1] = status[i - 2] = "ok";
      i -= 2;
      j--;
    } else if (o === "merge-heard") {
      status[i - 1] = "ok";
      i--;
      j -= 2;
    } else if (o === "missing") {
      i--;
    } else {
      extra.unshift(h[j - 1].shown);
      j--;
    }
  }

  const words: ScoredWord[] = written.map((text) => ({ text, status: "ok" }));
  written.forEach((_, w) => {
    const idx = e.flatMap((t, k) => (t.word === w ? [k] : []));
    if (!idx.length) return; // Punctuation only ("—"): nothing to say.
    const st = idx.map((k) => status[k]);
    if (st.every((s) => s === "ok")) return;
    if (st.every((s) => s === "missing")) words[w].status = "missing";
    else {
      words[w].status = "wrong";
      const heardHere = idx.flatMap((k) => inPlace[k]).join(" ");
      if (heardHere) words[w].heard = heardHere;
    }
  });

  const ok = status.filter((s) => s === "ok").length;
  const score = n === 0 ? 0 : ok / (n + EXTRA_WORD_PENALTY * extra.length);
  return { words, score, passed: score >= SPEECH_PASS_THRESHOLD, heard: heard.trim(), expected, extra };
}

/**
 * Best result of every alternative heard (`transcripts`, best first) against the expected
 * text(s). Ties keep the earlier alternative and the earlier expected text. With nothing heard,
 * every word is `missing` and the score is 0.
 */
export function scoreHeard(
  transcripts: readonly string[],
  expected: string | readonly string[],
  matching: Matching = {},
): SpeechScore {
  const targets = typeof expected === "string" ? [expected] : expected;
  const heards = transcripts.map((t) => t.trim()).filter(Boolean);
  if (!heards.length) heards.push("");
  let best: SpeechScore | null = null;
  for (const heard of heards) {
    for (const target of targets.length ? targets : [""]) {
      const r = scoreOne(heard, target, matching);
      if (!best || r.score > best.score) best = r;
    }
  }
  return best!;
}

/**
 * Which dialogue option the learner said: the option with the best `scoreHeard` result.
 * `index` = that option, or -1 when even the best does not pass; `result` = its word-by-word
 * result (also when it does not pass, for feedback), or null when there are no options.
 * Ties keep the earlier option.
 */
export function bestOption(
  options: readonly string[],
  transcripts: readonly string[],
  matching: Matching = {},
): { index: number; result: SpeechScore | null } {
  let index = -1;
  let result: SpeechScore | null = null;
  options.forEach((o, i) => {
    const r = scoreHeard(transcripts, o, matching);
    if (!result || r.score > result.score) {
      result = r;
      index = i;
    }
  });
  const best = result as SpeechScore | null;
  return { index: best?.passed ? index : -1, result: best };
}
