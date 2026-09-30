/**
 * Some texts exist under more than one content id (same words taught in two units). Ids stay
 * (lessons, placement and SRS reference them); screens that list or quiz texts collapse them here.
 */

/** Accent-, case- and punctuation-insensitive key: "Sei di qui?" and "sei di qui" match. */
export function textKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface Deduped {
  /** First id of each text, input order kept. */
  ids: string[];
  /** Kept id → the other ids with the same text (only when there are any). */
  aliases: Map<string, string[]>;
}

/** Keeps the first id of each text. Ids without a text (`textOf` → undefined) are always kept. */
export function dedupeByText(ids: readonly string[], textOf: (id: string) => string | undefined): Deduped {
  const firstByKey = new Map<string, string>();
  const out: Deduped = { ids: [], aliases: new Map() };
  for (const id of ids) {
    const text = textOf(id);
    const key = text === undefined ? "" : textKey(text);
    const first = key ? firstByKey.get(key) : undefined;
    if (first) {
      out.aliases.set(first, [...(out.aliases.get(first) ?? []), id]);
      continue;
    }
    if (key) firstByKey.set(key, id);
    out.ids.push(id);
  }
  return out;
}
