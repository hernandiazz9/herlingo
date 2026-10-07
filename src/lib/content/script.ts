/**
 * Script helpers driven by a pack's `pack.json` rules (`stress`, `romanization`, `fold`):
 * framework-free and free of the generated bundle, so scripts (`content:check`, `npm run audio`)
 * and the app share them. Re-exported from `@/lib/content`.
 *
 *   stripStress(text, pack)   text without the pack's stress mark (TTS, matching)
 *   foldText(text, pack)      letters folded with `fold` (matching, speech scoring)
 *   romanize(text, pack)      Latin line for a non-Latin pack (unchanged text without `romanization`)
 *
 * A pack without those fields gets its text back unchanged from every helper.
 */
import type { Pack, PackMeta } from "./types";

type Rules = Pick<PackMeta, "stress" | "romanization" | "fold">;
/** A pack or its meta: `romanize(text, pack)` and `romanize(text, pack.meta)` both work. */
export type ScriptRulesSource = Pack | Rules;

function rules(p: ScriptRulesSource): Rules {
  return "meta" in p ? p.meta : p;
}

/** `text` without the pack's stress mark (`stress.mark`); unchanged for a pack without `stress`. */
export function stripStress(text: string, pack: ScriptRulesSource): string {
  const mark = rules(pack).stress?.mark;
  return mark ? text.split(mark).join("") : text;
}

/**
 * `text` with the pack's `fold` letters replaced (upper case folds to upper case); unchanged for a
 * pack without `fold`. Does not strip stress marks: call `stripStress` too when matching.
 */
export function foldText(text: string, pack: ScriptRulesSource): string {
  const fold = rules(pack).fold;
  if (!fold) return text;
  let out = "";
  for (const ch of text) {
    const lower = ch.toLocaleLowerCase();
    const to = fold[lower];
    out += to === undefined ? ch : lower === ch ? to : to.toLocaleUpperCase();
  }
  return out;
}

const isLetter = (ch: string | undefined) => ch !== undefined && /\p{L}/u.test(ch);
const isMark = (ch: string) => /\p{M}/u.test(ch);
const LATIN_VOWEL = /[aeiouy]/i;

/** Puts an acute accent on the last Latin vowel of `latin` ("io" → "ió"). */
function accent(latin: string): string {
  for (let i = latin.length - 1; i >= 0; i--) {
    if (LATIN_VOWEL.test(latin[i])) return (latin.slice(0, i + 1) + "́" + latin.slice(i + 1)).normalize("NFC");
  }
  return latin;
}

const compiled = new WeakMap<Rules, { keys: string[]; vowels: Set<string>; self: Set<string> }>();

/**
 * Latin transliteration of `text` with the pack's `romanization` (see the schema): greedy
 * per-letter map, `wordStart` / `afterVowel` variants, stress mark → acute when `stressAccent`
 * (also on a `selfStressed` letter in a word with two or more vowels). Characters the map does not
 * know (punctuation, digits, Latin letters) pass through; other combining marks are dropped.
 * Returns `text` unchanged for a pack without `romanization`.
 */
export function romanize(text: string, pack: ScriptRulesSource): string {
  const r = rules(pack);
  const rom = r.romanization;
  if (!rom) return text;
  let c = compiled.get(r);
  if (!c) {
    const keys = [...new Set([...Object.keys(rom.map), ...Object.keys(rom.wordStart ?? {}), ...Object.keys(rom.afterVowel ?? {})])];
    keys.sort((a, b) => b.length - a.length);
    c = { keys, vowels: new Set(r.stress?.vowels ?? ""), self: new Set(r.stress?.selfStressed ?? "") };
    compiled.set(r, c);
  }
  const mark = r.stress?.mark;
  const chars = [...text.normalize("NFC")];
  const lower = chars.map((ch) => ch.toLocaleLowerCase());

  /** Vowel count of the word around position `i` (letters and marks, hyphens join parts). */
  const wordVowels = (i: number) => {
    let a = i;
    while (a > 0 && (isLetter(chars[a - 1]) || isMark(chars[a - 1]) || (chars[a - 1] === "-" && isLetter(chars[a - 2])))) a--;
    let b = i;
    while (b < chars.length && (isLetter(chars[b]) || isMark(chars[b]) || (chars[b] === "-" && isLetter(chars[b + 1])))) b++;
    let n = 0;
    for (let k = a; k < b; k++) if (c.vowels.has(lower[k])) n++;
    return n;
  };

  let out = "";
  /** Previous source letter (marks skipped) and whether its Latin form had no Latin letter. */
  let prev: string | undefined;
  let prevSilent = false;
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (mark && ch === mark) {
      i++;
      continue; // handled with the vowel before it
    }
    if (isMark(ch)) {
      i++;
      continue;
    }
    const key = c.keys.find((k) => lower.slice(i, i + [...k].length).join("") === k);
    if (!key) {
      out += ch;
      prev = isLetter(ch) ? lower[i] : undefined;
      prevSilent = false;
      i++;
      continue;
    }
    const len = [...key].length;
    const wordStart = prev === undefined;
    const afterVowel: boolean = prev !== undefined && (c.vowels.has(prev) || prevSilent);
    let latin: string =
      (wordStart ? rom.wordStart?.[key] : undefined) ??
      (afterVowel ? rom.afterVowel?.[key] : undefined) ??
      rom.map[key] ??
      key;
    const next = chars[i + len];
    if (rom.stressAccent) {
      const marked = mark !== undefined && next === mark;
      const self = [...key].some((k) => c.self.has(k)) && wordVowels(i) >= 2;
      if (marked || self) latin = accent(latin);
    }
    if (ch !== lower[i] && latin) latin = latin[0].toLocaleUpperCase() + latin.slice(1);
    out += latin;
    prev = lower[i + len - 1];
    prevSilent = !/\p{L}/u.test(latin);
    i += len;
  }
  return out;
}

/** One stress-rule problem in a target-language text: the word and what is wrong. */
export interface StressIssue {
  word: string;
  problem: string;
}

/**
 * Checks the pack's `stress` rule on `text` (used by `content:check`): every word (hyphenated
 * parts count as one word) with two or more `vowels` and no `selfStressed` letter has exactly one
 * mark, right after a vowel; one-vowel words and words with a self-stressed letter have none.
 * Words without vowels of the script (Latin names, numbers) are ignored.
 */
export function stressIssues(text: string, pack: ScriptRulesSource): StressIssue[] {
  const rule = rules(pack).stress;
  if (!rule) return [];
  const vowels = new Set(rule.vowels);
  const self = new Set(rule.selfStressed ?? "");
  const issues: StressIssue[] = [];
  const words = text.normalize("NFC").match(/[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu) ?? [];
  for (const word of words) {
    const chars = [...word];
    const lower = chars.map((ch) => ch.toLocaleLowerCase());
    const nVowels = lower.filter((ch) => vowels.has(ch)).length;
    if (nVowels === 0) continue;
    const marks = chars.flatMap((ch, i) => (ch === rule.mark ? [i] : []));
    const misplaced = marks.some((i) => i === 0 || !vowels.has(lower[i - 1]));
    const hasSelf = lower.some((ch) => self.has(ch));
    if (misplaced) issues.push({ word, problem: "stress mark not right after a vowel" });
    else if (nVowels === 1 && marks.length) issues.push({ word, problem: "one-vowel word must not have a stress mark" });
    else if (hasSelf && marks.length) issues.push({ word, problem: "word with a self-stressed letter must not have a stress mark" });
    else if (nVowels >= 2 && !hasSelf && marks.length !== 1) {
      issues.push({ word, problem: marks.length ? "more than one stress mark" : "missing stress mark" });
    }
  }
  return issues;
}
