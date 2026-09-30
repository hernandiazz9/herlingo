/**
 * Lenient answer checking, shared by lessons, review and dialogues.
 *
 * - Case, punctuation and whitespace are ignored.
 * - Apostrophe variants (’ ‘ ` ´ ʼ ') are all the same, and an apostrophe counts as a word break,
 *   so "un'acqua", "un’acqua", "un' acqua" and "un acqua" are equal.
 * - Missing or wrong accents are accepted, but reported (`accentNote`) so the UI can say
 *   "cuidado con el acento".
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
  /** The accepted answer it matched (or the first one when wrong). */
  expected: string;
}

/** Compares a typed/built answer with one or more accepted answers. */
export function checkAnswer(given: string, accepted: string | readonly string[]): AnswerCheck {
  const list = typeof accepted === "string" ? [accepted] : accepted;
  const g = normalizeAnswer(given);
  for (const a of list) if (normalizeAnswer(a) === g) return { correct: true, accentNote: false, expected: a };
  const gs = normalizeAnswer(given, true);
  for (const a of list) {
    if (normalizeAnswer(a, true) === gs) return { correct: true, accentNote: true, expected: a };
  }
  return { correct: false, accentNote: false, expected: list[0] ?? "" };
}

function levenshtein(a: string, b: string): number {
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
