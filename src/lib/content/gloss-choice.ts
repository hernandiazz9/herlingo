/**
 * The learner's gloss language per pack (translations, notes, grammar cards in Spanish, Russian…).
 * Framework-free; React reads it with `useGlossLang(lang)` from `./use-gloss`.
 *
 * Key: `lang-lern:gloss:<lang>` = `{ v: 1, gloss }`. Resolution (`getGlossLang()`): the stored
 * choice when it is one of the pack's `glossLangs`, else the pack's first gloss language (`es` for
 * every pack without `glossLangs`). Only `setGlossLang()` writes, and only its own key. The Perfil
 * backup and the cloud save pick the key up like every `lang-lern:*` key.
 */
import { glossLangsOf, isGlossLang, type GlossLang } from "./gloss";
import { getPack, hasPack } from "./index";

export const GLOSS_CHOICE_PREFIX = "lang-lern:gloss:";
export const GLOSS_CHOICE_EVENT = "lang-lern:gloss-change";
const VERSION = 1;

/** The pack's gloss languages (default first); `["es"]` for an unknown pack. */
export function packGlossLangs(lang: string): readonly GlossLang[] {
  return glossLangsOf(hasPack(lang) ? getPack(lang).meta : {});
}

/** Tolerant: the stored `gloss` when it is a known gloss language, else null. */
export function parseGlossChoice(raw: string | null): GlossLang | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    const gloss = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>).gloss : undefined;
    return isGlossLang(gloss) ? gloss : null;
  } catch {
    return null;
  }
}

/** The gloss language for `lang` (the pack's first one on the server and when nothing valid is stored). */
export function getGlossLang(lang: string): GlossLang {
  const langs = packGlossLangs(lang);
  if (typeof window === "undefined") return langs[0];
  let stored: GlossLang | null = null;
  try {
    stored = parseGlossChoice(window.localStorage.getItem(GLOSS_CHOICE_PREFIX + lang));
  } catch {
    // Storage unavailable: default.
  }
  return stored && langs.includes(stored) ? stored : langs[0];
}

/** Stores the choice for `lang` (ignored when the pack does not carry `gloss`) and notifies subscribers. */
export function setGlossLang(lang: string, gloss: GlossLang): void {
  if (!packGlossLangs(lang).includes(gloss)) return;
  try {
    window.localStorage.setItem(GLOSS_CHOICE_PREFIX + lang, JSON.stringify({ v: VERSION, gloss }));
  } catch {
    // Storage unavailable (private mode): not stored.
  }
  window.dispatchEvent(new Event(GLOSS_CHOICE_EVENT));
}

/** Calls `onChange` when any pack's choice may have changed (this tab or another). */
export function subscribeGlossLang(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(GLOSS_CHOICE_PREFIX)) onChange();
  };
  window.addEventListener(GLOSS_CHOICE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(GLOSS_CHOICE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
