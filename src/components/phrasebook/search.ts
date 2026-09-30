/** Accent-, case- and punctuation-insensitive text folding for search and answer matching. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** True when every word of `query` appears in the folded `haystack`. */
export function matches(foldedHaystack: string, query: string): boolean {
  const words = fold(query).split(" ").filter(Boolean);
  return words.every((w) => foldedHaystack.includes(w));
}
