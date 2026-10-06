/**
 * Lenient answer checking, shared by lessons, review and dialogues.
 *
 * - Case, punctuation and whitespace are ignored.
 * - Apostrophe variants (’ ‘ ` ´ ʼ ') are all the same, and an apostrophe counts as a word break,
 *   so "un'acqua", "un’acqua", "un' acqua" and "un acqua" are equal.
 * - Missing or wrong accents are accepted, but reported (`accentNote`) so the UI can say
 *   "cuidado con el acento".
 * - Typed answers (`{ typos: true }`) also accept a small typo (one letter, two in long answers),
 *   reported (`typo`) so the UI can show it as "almost" and highlight the words to fix.
 */

const APOSTROPHES = /['’‘`´ʼ]/g;
// Everything that is not a letter, a number or whitespace is punctuation here.
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

/** Lower-cased, punctuation-free, single-spaced text. Accents are kept unless `stripAccents`. */
export function normalizeAnswer(text: string, stripAccents = false): string {
  let out = text.normalize("NFC").toLowerCase().replace(APOSTROPHES, " ").replace(PUNCTUATION, " ");
  if (stripAccents) out = out.normalize("NFD").replace(/\p{M}/gu, "");
  return out.replace(/\s+/g, " ").trim();
}

export interface AnswerCheck {
  correct: boolean;
  /** Correct except for accents: show "cuidado con el acento". */
  accentNote: boolean;
  /** Accepted with a small typo (only with `typos`): show it as "almost" and highlight it. */
  typo: boolean;
  /** The accepted answer it matched (or the first one when wrong). */
  expected: string;
}

export interface CheckOptions {
  /** Accept a small typo (typed answers): see `typoAllowance`. */
  typos?: boolean;
}

/** Letters that may be wrong in a typed answer: none under 4, one, two from 12 (accents ignored). */
export function typoAllowance(expected: string): number {
  const n = normalizeAnswer(expected, true).replace(/ /g, "").length;
  return n < 4 ? 0 : n < 12 ? 1 : 2;
}

/** Compares a typed/built answer with one or more accepted answers. */
export function checkAnswer(given: string, accepted: string | readonly string[], options: CheckOptions = {}): AnswerCheck {
  const list = typeof accepted === "string" ? [accepted] : accepted;
  const g = normalizeAnswer(given);
  for (const a of list) if (normalizeAnswer(a) === g) return { correct: true, accentNote: false, typo: false, expected: a };
  const gs = normalizeAnswer(given, true);
  for (const a of list) {
    if (normalizeAnswer(a, true) === gs) return { correct: true, accentNote: true, typo: false, expected: a };
  }
  if (options.typos && gs) {
    for (const a of list) {
      const allowed = typoAllowance(a);
      if (allowed > 0 && levenshtein(normalizeAnswer(a, true), gs) <= allowed) {
        return { correct: true, accentNote: false, typo: true, expected: a };
      }
    }
  }
  return { correct: false, accentNote: false, typo: false, expected: list[0] ?? "" };
}

/** A word of a sentence, `wrong` when it has no exact (accent-insensitive) match in the other one. */
export interface DiffWord {
  text: string;
  wrong: boolean;
}

/**
 * Word-level diff (longest common subsequence, accents/case/punctuation ignored): both sentences
 * split into their words, marking the ones that differ.
 */
export function diffWords(given: string, expected: string): { given: DiffWord[]; expected: DiffWord[] } {
  const a = given.split(/\s+/).filter(Boolean);
  const b = expected.split(/\s+/).filter(Boolean);
  const na = a.map((w) => normalizeAnswer(w, true));
  const nb = b.map((w) => normalizeAnswer(w, true));
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = na[i] === nb[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const okA = new Set<number>();
  const okB = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (na[i] === nb[j]) {
      okA.add(i++);
      okB.add(j++);
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  return {
    given: a.map((text, k) => ({ text, wrong: !okA.has(k) && na[k] !== "" })),
    expected: b.map((text, k) => ({ text, wrong: !okB.has(k) && nb[k] !== "" })),
  };
}

/**
 * Writes out the numbers of a text with `words` ("alle 11:40" → "alle undici:quaranta"): speech
 * recognition often returns digits. Numbers without a word are left as they are.
 */
export function spellNumbers(text: string, words: Readonly<Record<string, string>> | undefined): string {
  if (!words) return text;
  return text.replace(/\d+/g, (n) => words[String(Number(n))] ?? n);
}

/** Edit distance (insertions, deletions, substitutions) between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Similarity in [0, 1] of two texts after lenient normalisation (accents ignored). */
export function similarity(a: string, b: string): number {
  const x = normalizeAnswer(a, true);
  const y = normalizeAnswer(b, true);
  const max = Math.max(x.length, y.length);
  if (max === 0) return 1;
  return 1 - levenshtein(x, y) / max;
}

/** Words of a sentence as tiles: split on spaces, surrounding punctuation removed. */
export function toTiles(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’]+$/gu, ""))
    .filter(Boolean);
}
