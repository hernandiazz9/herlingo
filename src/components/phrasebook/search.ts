import { romanize, type Pack } from "@/lib/content";

/** Accent-, case- and punctuation-insensitive text folding for search and answer matching. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The Latin spelling of target-language texts for search, for a pack with `romanization` (none
 * otherwise): `romanize()` without the apostrophes, so "den" or "vosm" find what is romanized
 * "den'" / "vos'm".
 */
export function romanizedForSearch(texts: (string | undefined)[], pack: Pack): string[] {
  if (!pack.meta.romanization) return [];
  return texts.filter((t): t is string => !!t).map((t) => romanize(t, pack).replace(/['’]/g, ""));
}

/** True when every word of `query` appears in the folded `haystack`. */
export function matches(foldedHaystack: string, query: string): boolean {
  const words = fold(query).split(" ").filter(Boolean);
  return words.every((w) => foldedHaystack.includes(w));
}
