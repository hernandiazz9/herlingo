/**
 * Whether the Latin line (`romanize()`) shows under target-language text, per language. Only
 * packs with `romanization` in `pack.json` use it. Framework-free; React reads it with
 * `useShowRomanization(lang)` from `./use-romanization`.
 *
 * Key: `lang-lern:romanization:<lang>` = `{ v: 1, show }`. Default `show: true` (missing, corrupt
 * or unknown values). Only `setShowRomanization()` writes, and only its own key. The Perfil backup
 * picks the key up like every `lang-lern:*` key.
 */

export const ROMANIZATION_PREFIX = "lang-lern:romanization:";
export const ROMANIZATION_EVENT = "lang-lern:romanization-change";
const VERSION = 1;

/** Tolerant: anything but a stored `show: false` is "show". */
export function parseShowRomanization(raw: string | null): boolean {
  if (!raw) return true;
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v) && (v as Record<string, unknown>).show === false) return false;
  } catch {
    // Corrupt JSON: default.
  }
  return true;
}

/** True when the Latin line shows for `lang` (true on the server: the default). */
export function getShowRomanization(lang: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return parseShowRomanization(window.localStorage.getItem(ROMANIZATION_PREFIX + lang));
  } catch {
    return true;
  }
}

/** Stores the choice for `lang` and notifies subscribers. */
export function setShowRomanization(lang: string, show: boolean): void {
  try {
    window.localStorage.setItem(ROMANIZATION_PREFIX + lang, JSON.stringify({ v: VERSION, show }));
  } catch {
    // Storage unavailable (private mode): not stored.
  }
  window.dispatchEvent(new Event(ROMANIZATION_EVENT));
}

/** Calls `onChange` when any language's choice may have changed (this tab or another). */
export function subscribeShowRomanization(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(ROMANIZATION_PREFIX)) onChange();
  };
  window.addEventListener(ROMANIZATION_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ROMANIZATION_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
