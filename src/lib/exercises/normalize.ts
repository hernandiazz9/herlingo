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
 * - With the pack's `equivalents` (`{ equivalents }`), equivalent spellings are written out on both
 *   sides first ("i'm" → "i am"), so either form matches the other.
 * - With the pack's script rules (`{ stress, fold, romanization }`, the pack meta's fields): the
 *   stress mark is removed and `fold` applied on both sides (a missing mark is never an accent
 *   note), and with `romanization` an answer typed in Latin letters is compared with the
 *   romanization of each accepted answer (accents and apostrophes ignored, the `alternatives`
 *   spellings accepted, same typo tolerance).
 * A pack without those fields gets exactly the plain comparison.
 */
import { foldText, romanize, stripStress } from "@/lib/content/script";
import type { PackMeta } from "@/lib/content/types";

const APOSTROPHES = /['’‘`´ʼ]/g;
// Everything that is not a letter, a number or whitespace is punctuation here.
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

/** Lower-cased, punctuation-free, single-spaced text. Accents are kept unless `stripAccents`. */
export function normalizeAnswer(text: string, stripAccents = false): string {
  let out = text.normalize("NFC").toLowerCase().replace(APOSTROPHES, " ").replace(PUNCTUATION, " ");
  if (stripAccents) out = out.normalize("NFD").replace(/\p{M}/gu, "");
  return out.replace(/\s+/g, " ").trim();
}

/** The pack's `meta.equivalents`: lower-case spelling → its equivalent (`"i'm": "i am"`). */
export type Equivalents = Readonly<Record<string, string>> | undefined;

interface CompiledEquivalents {
  pattern: RegExp;
  map: Map<string, string>;
}

const compiledEquivalents = new WeakMap<object, CompiledEquivalents | null>();

function unifyApostrophes(text: string): string {
  return text.normalize("NFC").replace(APOSTROPHES, "'");
}

function compileEquivalents(equivalents: NonNullable<Equivalents>): CompiledEquivalents | null {
  const cached = compiledEquivalents.get(equivalents);
  if (cached !== undefined) return cached;
  const map = new Map<string, string>();
  for (const [from, to] of Object.entries(equivalents)) {
    const key = unifyApostrophes(from).toLowerCase().trim();
    if (key) map.set(key, to);
  }
  // Longest first, so a key that contains another one wins.
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Whole words only: no letter, number or apostrophe right before or after.
  const compiled = keys.length
    ? { pattern: new RegExp(`(?<![\\p{L}\\p{N}'])(?:${escaped.join("|")})(?![\\p{L}\\p{N}'])`, "giu"), map }
    : null;
  compiledEquivalents.set(equivalents, compiled);
  return compiled;
}

/**
 * Writes out the pack's `equivalents` in a text, whole words only, ignoring case and apostrophe
 * variants ("I’m here" → "i am here"). Without `equivalents` the text is returned as it is.
 */
export function expandEquivalents(text: string, equivalents: Equivalents): string {
  if (!equivalents) return text;
  const compiled = compileEquivalents(equivalents);
  if (!compiled) return text;
  return unifyApostrophes(text).replace(compiled.pattern, (m) => compiled.map.get(m.toLowerCase()) ?? m);
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

/** The pack's script rules (`meta.stress`, `meta.romanization`, `meta.fold`): pass the meta as is. */
export type ScriptRules = Partial<Pick<PackMeta, "stress" | "romanization" | "fold">>;

export interface CheckOptions extends ScriptRules {
  /** Accept a small typo (typed answers): see `typoAllowance`. */
  typos?: boolean;
  /** The pack's `meta.equivalents`: equivalent spellings match ("i'm" = "i am"). */
  equivalents?: Equivalents;
}

/** Only the script rules of a pack meta (`checkAnswer(x, y, scriptRules(meta))`, without `equivalents`). */
export function scriptRules(meta: ScriptRules): ScriptRules {
  return { stress: meta.stress, romanization: meta.romanization, fold: meta.fold };
}

/**
 * `text` ready for matching with the pack's script rules: stress mark removed and `fold` applied
 * (NFC first). Unchanged for a pack without `stress` / `fold`.
 */
export function prepareScript(text: string, rules: ScriptRules = {}): string {
  if (!rules.stress && !rules.fold) return text;
  return foldText(stripStress(text.normalize("NFC"), rules), rules);
}

/** Latin text for matching: lower case, no accents, no apostrophes, punctuation as spaces. */
function latinKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(APOSTROPHES, "")
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Romanization = NonNullable<PackMeta["romanization"]>;
/** Canonical spelling → every accepted spelling (itself first), as Latin keys. */
type Alternatives = Map<string, string[]>;
const compiledAlternatives = new WeakMap<Romanization, Alternatives>();

function alternativesOf(rom: Romanization): Alternatives {
  let c = compiledAlternatives.get(rom);
  if (!c) {
    c = new Map<string, string[]>();
    for (const [from, alts] of Object.entries(rom.alternatives ?? {})) {
      const key = latinKey(from);
      if (!key) continue;
      c.set(key, [...new Set([...(c.get(key) ?? [key]), ...alts.map(latinKey).filter(Boolean)])]);
    }
    compiledAlternatives.set(rom, c);
  }
  return c;
}

/**
 * Edit distance from the Latin answer `given` to the romanized `expected` (both Latin keys), where
 * a canonical spelling of the pack's `alternatives` found in `expected` may be typed as any of its
 * alternatives at no cost ("j" ← "kh", "ia" ← "ya"). Otherwise one per letter inserted, deleted or
 * substituted, as `levenshtein`.
 */
function latinDistance(given: string, expected: string, alt: Alternatives): number {
  const n = expected.length;
  const m = given.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  dp[0][0] = 0;
  const lower = (p: number, q: number, d: number) => {
    if (d < dp[p][q]) dp[p][q] = d;
  };
  for (let p = 0; p <= n; p++) {
    for (let q = 0; q <= m; q++) {
      const d = dp[p][q];
      if (d === Infinity) continue;
      if (p < n) lower(p + 1, q, d + 1);
      if (q < m) lower(p, q + 1, d + 1);
      if (p < n && q < m) lower(p + 1, q + 1, d + (expected[p] === given[q] ? 0 : 1));
      for (const [k, options] of alt) {
        if (!expected.startsWith(k, p)) continue;
        for (const o of options) if (given.startsWith(o, q)) lower(p + k.length, q + o.length, d);
      }
    }
  }
  return dp[n][m];
}

/** Letters that may be wrong in a typed answer: none under 4, one, two from 12 (accents ignored). */
export function typoAllowance(expected: string): number {
  const n = normalizeAnswer(expected, true).replace(/ /g, "").length;
  return n < 4 ? 0 : n < 12 ? 1 : 2;
}

/** Compares a typed/built answer with one or more accepted answers. */
export function checkAnswer(given: string, accepted: string | readonly string[], options: CheckOptions = {}): AnswerCheck {
  const list = typeof accepted === "string" ? [accepted] : accepted;
  const forms = list.map((a) => prepareScript(expandEquivalents(a, options.equivalents), options));
  const givenForm = prepareScript(expandEquivalents(given, options.equivalents), options);
  const g = normalizeAnswer(givenForm);
  for (let k = 0; k < list.length; k++) {
    if (normalizeAnswer(forms[k]) === g) return { correct: true, accentNote: false, typo: false, expected: list[k] };
  }
  const gs = normalizeAnswer(givenForm, true);
  for (let k = 0; k < list.length; k++) {
    if (normalizeAnswer(forms[k], true) === gs) return { correct: true, accentNote: true, typo: false, expected: list[k] };
  }
  // Latin letters typed for a pack with `romanization`: compare with each answer's romanization.
  const rom = options.romanization;
  const latin = rom ? latinKey(givenForm) : "";
  const alt = rom && latin && romanize(latin, { romanization: rom }) === latin ? alternativesOf(rom) : null;
  const latinForms = alt ? list.map((a) => latinKey(romanize(expandEquivalents(a, options.equivalents), { romanization: rom }))) : [];
  if (alt) {
    for (let k = 0; k < list.length; k++) {
      if (latinDistance(latin, latinForms[k], alt) === 0) return { correct: true, accentNote: false, typo: false, expected: list[k] };
    }
  }
  if (options.typos && gs) {
    for (let k = 0; k < list.length; k++) {
      const allowed = typoAllowance(prepareScript(list[k], options));
      if (allowed > 0 && levenshtein(normalizeAnswer(forms[k], true), gs) <= allowed) {
        return { correct: true, accentNote: false, typo: true, expected: list[k] };
      }
    }
    for (let k = 0; alt && k < list.length; k++) {
      const allowed = typoAllowance(prepareScript(list[k], options));
      if (allowed > 0 && latinDistance(latin, latinForms[k], alt) <= allowed) {
        return { correct: true, accentNote: false, typo: true, expected: list[k] };
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
 * split into their words, marking the ones that differ. With the pack's script rules (`rules`, the
 * pack meta), stress marks and `fold` are ignored, and Latin words typed for a pack with
 * `romanization` are compared with the romanized expected words.
 */
export function diffWords(
  given: string,
  expected: string,
  rules: ScriptRules = {},
): { given: DiffWord[]; expected: DiffWord[] } {
  const a = given.split(/\s+/).filter(Boolean);
  const b = expected.split(/\s+/).filter(Boolean);
  const na = a.map((w) => normalizeAnswer(prepareScript(w, rules), true));
  let nb = b.map((w) => normalizeAnswer(prepareScript(w, rules), true));
  // Latin letters typed for a pack with `romanization`: compare with the romanized words.
  const rom = rules.romanization;
  const latin = rom ? latinKey(given) : "";
  if (rom && latin && romanize(latin, { romanization: rom }) === latin) {
    const alt = alternativesOf(rom);
    const la = a.map(latinKey);
    const lb = b.map((w) => latinKey(romanize(w, { romanization: rom })));
    // The given word stands for the expected one it spells (same key), so the LCS below works.
    nb = lb.map((w) => (w && la.find((g) => g && latinDistance(g, w, alt) === 0)) || w);
    la.forEach((g, i) => (na[i] = g));
  }
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
