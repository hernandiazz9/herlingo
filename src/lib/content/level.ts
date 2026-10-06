/**
 * The learner's CEFR level per language, for packs split by level (`pack.json` `levels`).
 * Framework-free; React reads it with `useLevel()` from `./level-hook`.
 *
 * Stored in `lang-lern:level:<lang>` = `{ v: 1, level }` (one key per language, covered by the
 * Perfil backup like every `lang-lern:*` key). Resolution (`getLevel()`):
 *   1. the stored level, if it is one of the pack's levels;
 *   2. else the pack's first level (the placement test writes its suggestion when confirmed);
 *   3. null for a pack without levels (one course: no selector anywhere).
 *
 * Only `setLevel()` writes, and only its own key. Parsing is tolerant and nothing throws.
 */
import { getLevels, getPack, hasPack } from "./index";
import type { Level, PlacementQuestion } from "./types";

export const LEVEL_PREFIX = "lang-lern:level:";
export const LEVEL_EVENT = "lang-lern:level-change";
const LEVEL_VERSION = 1;

/** Share of a level's placement questions answered right to pass it (≥ 2/3). */
const PASS_SHARE = 2 / 3;

/** The pack's levels in order, or [] when `lang` has no pack or the pack is one course. */
export function packLevels(lang: string): Level[] {
  return hasPack(lang) ? getLevels(getPack(lang)) : [];
}

/** The stored level, when it is one of the pack's levels (only `level` is read, any version). */
export function getStoredLevel(lang: string): Level | null {
  if (typeof window === "undefined") return null;
  const levels = packLevels(lang);
  if (!levels.length) return null;
  try {
    const raw = window.localStorage.getItem(LEVEL_PREFIX + lang);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    const level = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>).level : undefined;
    return typeof level === "string" && (levels as string[]).includes(level) ? (level as Level) : null;
  } catch {
    return null;
  }
}

/** The learner's level for `lang` (resolution above); null for a pack without levels. */
export function getLevel(lang: string): Level | null {
  return getStoredLevel(lang) ?? packLevels(lang)[0] ?? null;
}

/** Stores `level` for `lang` (ignored when it is not one of the pack's levels) and notifies. */
export function setLevel(lang: string, level: Level): void {
  if (!packLevels(lang).includes(level)) return;
  try {
    window.localStorage.setItem(LEVEL_PREFIX + lang, JSON.stringify({ v: LEVEL_VERSION, level }));
  } catch {
    // Storage unavailable (private mode): not stored, the first level applies.
  }
  window.dispatchEvent(new Event(LEVEL_EVENT));
}

/** Calls `onChange` when a level may have changed (`setLevel()`, or another tab). */
export function subscribeLevel(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(LEVEL_PREFIX)) onChange();
  };
  window.addEventListener(LEVEL_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LEVEL_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Placement suggestion: the highest level where the learner got ≥ 2/3 of that level's questions
 * right and every lower level passed too; else the first level. Null for a pack without levels.
 * `answers[i]` = whether `questions[i]` was answered right.
 */
export function suggestLevel(levels: Level[], questions: PlacementQuestion[], answers: boolean[]): Level | null {
  if (!levels.length) return null;
  let suggested = levels[0];
  for (const level of levels) {
    const asked = questions.map((q, i) => ({ q, right: answers[i] === true })).filter(({ q }) => q.level === level);
    const right = asked.filter((a) => a.right).length;
    if (!asked.length || right < asked.length * PASS_SHARE) break;
    suggested = level;
  }
  return suggested;
}
