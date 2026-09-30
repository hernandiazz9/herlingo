/**
 * Favourite item ids (phrasebook stars), stored on the device per language pack.
 * Framework-free; React reads it with `useFavorites()` from `./use-favorites`.
 */

const PREFIX = "lang-lern:favorites:";
const CHANGE_EVENT = "lang-lern:favorites-change";

function key(lang: string) {
  return PREFIX + lang;
}

/** Raw stored value ("" when none). A string, so it is a stable snapshot for useSyncExternalStore. */
export function readFavoritesRaw(lang: string): string {
  try {
    return window.localStorage.getItem(key(lang)) ?? "";
  } catch {
    return "";
  }
}

export function parseFavorites(raw: string): Set<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function getFavorites(lang: string): Set<string> {
  return parseFavorites(readFavoritesRaw(lang));
}

/** Adds or removes `id`; returns true when it is now a favourite. */
export function toggleFavorite(lang: string, id: string): boolean {
  const favs = getFavorites(lang);
  const now = !favs.has(id);
  if (now) favs.add(id);
  else favs.delete(id);
  try {
    window.localStorage.setItem(key(lang), JSON.stringify([...favs]));
  } catch {
    // Storage unavailable (private mode): nothing to persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return now;
}

/** Subscribes to changes in this tab and in other tabs. */
export function subscribeFavorites(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
