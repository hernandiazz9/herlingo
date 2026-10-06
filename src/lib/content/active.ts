/**
 * The active language: the pack the learner is studying now. Framework-free; React reads it with
 * `useActiveLang()` from `./use-active-lang`.
 *
 * Resolution (`getActiveLang()`):
 *   1. `lang-lern:active-lang` = `{ v: 1, lang }`, if it names an existing pack;
 *   2. else the first pack (default first, `listPacks()` order) whose stored progress
 *      `lang-lern:progress:<lang>` is onboarded (a device that used the app before languages
 *      could be picked resolves to its language with no prompt);
 *   3. else null = first launch: the language picker shows.
 *
 * Only `setActiveLang()` writes, and only its own key: nothing here rewrites or clears another
 * language's keys. Parsing is tolerant and nothing throws.
 */
import { hasPack, listPacks } from "./index";

export const ACTIVE_LANG_KEY = "lang-lern:active-lang";
export const ACTIVE_LANG_EVENT = "lang-lern:active-lang-change";
const ACTIVE_LANG_VERSION = 1;

// Same names as in `@/lib/progress` (not imported: that module depends on `@/lib/content`).
const PROGRESS_PREFIX = "lang-lern:progress:";
const PROGRESS_EVENT = "lang-lern:progress-change";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The stored choice, when it names an existing pack (only `lang` is read, any version). */
export function getStoredActiveLang(): string | null {
  if (typeof window === "undefined") return null;
  const lang = parseObject(read(ACTIVE_LANG_KEY))?.lang;
  return typeof lang === "string" && hasPack(lang) ? lang : null;
}

function isOnboarded(lang: string): boolean {
  return parseObject(read(PROGRESS_PREFIX + lang))?.onboarded === true;
}

/** The active language (resolution order above); null on the server and on first launch. */
export function getActiveLang(): string | null {
  if (typeof window === "undefined") return null;
  return getStoredActiveLang() ?? listPacks().find((m) => isOnboarded(m.lang))?.lang ?? null;
}

/** Makes `lang` the active language (ignored when no pack exists for it) and notifies subscribers. */
export function setActiveLang(lang: string): void {
  if (!hasPack(lang)) return;
  try {
    window.localStorage.setItem(ACTIVE_LANG_KEY, JSON.stringify({ v: ACTIVE_LANG_VERSION, lang }));
  } catch {
    // Storage unavailable (private mode): not stored, the fallback resolution applies.
  }
  window.dispatchEvent(new Event(ACTIVE_LANG_EVENT));
}

/**
 * Calls `onChange` when the active language may have changed: `setActiveLang()`, a progress change
 * (onboarding decides the fallback), or either key changed in another tab.
 */
export function subscribeActiveLang(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === ACTIVE_LANG_KEY || e.key.startsWith(PROGRESS_PREFIX)) onChange();
  };
  window.addEventListener(ACTIVE_LANG_EVENT, onChange);
  window.addEventListener(PROGRESS_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ACTIVE_LANG_EVENT, onChange);
    window.removeEventListener(PROGRESS_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
