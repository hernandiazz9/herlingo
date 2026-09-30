/**
 * Learner progress, stored on the device per language pack (localStorage, versioned JSON under
 * `lang-lern:progress:<lang>`): lessons done, XP, daily streak (local time zone), per-item
 * spaced-repetition state, onboarding/placement. Framework-free; React reads it with
 * `useProgress()` from `./use-progress`.
 *
 * Parsing is tolerant: empty, corrupt or partly invalid values give an empty progress or drop
 * just the bad entries. Nothing here throws.
 */
import { getItem, getLesson, getLessonItems, getPack, type Pack } from "@/lib/content";
import type { LessonResult } from "@/lib/exercises";
import { dueIds, newEntry, parseEntry, schedule, type SrsEntry } from "@/lib/srs";
import { addDays, dayKey, isDayKey } from "./dates";

export { addDays, dayKey } from "./dates";
export * from "./settings";

export const PROGRESS_VERSION = 1;
const PREFIX = "lang-lern:progress:";
const EVENT = "lang-lern:progress-change";

export interface LessonProgress {
  /** Epoch ms of the first time it was marked done. */
  doneAt: number;
  /** Times played to the end (0 = only marked done by the placement test). */
  plays: number;
  /** Marked done by the placement test (and not played since). */
  placement?: boolean;
}

export interface Streak {
  /** Consecutive active days ending on `last`. */
  count: number;
  best: number;
  /** Last active day ("YYYY-MM-DD", local), "" = never. */
  last: string;
}

export interface Progress {
  v: typeof PROGRESS_VERSION;
  xp: number;
  lessons: Record<string, LessonProgress>;
  srs: Record<string, SrsEntry>;
  streak: Streak;
  /** Welcome/placement seen (done or skipped). */
  onboarded: boolean;
  /** Epoch ms of the last placement test (0 = never taken). */
  placementAt: number;
}

export function emptyProgress(): Progress {
  return { v: PROGRESS_VERSION, xp: 0, lessons: {}, srs: {}, streak: { count: 0, best: 0, last: "" }, onboarded: false, placementAt: 0 };
}

const key = (lang: string) => PREFIX + lang;
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Raw stored value ("" when none): a stable snapshot for useSyncExternalStore. */
export function readProgressRaw(lang: string): string {
  try {
    return window.localStorage.getItem(key(lang)) ?? "";
  } catch {
    return "";
  }
}

export function parseProgress(raw: string): Progress {
  const out = emptyProgress();
  if (!raw) return out;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!isObject(v)) return out;
  out.xp = Math.round(num(v.xp));
  out.onboarded = v.onboarded === true;
  out.placementAt = num(v.placementAt);
  if (isObject(v.lessons)) {
    for (const [id, l] of Object.entries(v.lessons)) {
      if (!isObject(l)) continue;
      out.lessons[id] = { doneAt: num(l.doneAt), plays: Math.round(num(l.plays)), ...(l.placement === true ? { placement: true } : {}) };
    }
  }
  if (isObject(v.srs)) {
    for (const [id, e] of Object.entries(v.srs)) {
      const entry = parseEntry(e);
      if (entry) out.srs[id] = entry;
    }
  }
  if (isObject(v.streak)) {
    const s = v.streak;
    const last = isDayKey(s.last) ? s.last : "";
    const count = last ? Math.max(1, Math.round(num(s.count))) : 0;
    out.streak = { count, best: Math.max(count, Math.round(num(s.best))), last };
  }
  return out;
}

export function getProgress(lang: string): Progress {
  if (typeof window === "undefined") return emptyProgress();
  return parseProgress(readProgressRaw(lang));
}

/** False when localStorage cannot be written (some private modes): progress will not persist. */
export function canPersist(): boolean {
  try {
    const k = `${PREFIX}__test`;
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function save(lang: string, p: Progress): void {
  try {
    window.localStorage.setItem(key(lang), JSON.stringify(p));
  } catch {
    // Storage unavailable or full: nothing to persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

function update(lang: string, fn: (p: Progress) => void): Progress {
  const p = getProgress(lang);
  fn(p);
  save(lang, p);
  return p;
}

export function subscribeProgress(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// ---------------------------------------------------------------------------------------------
// Derived values

/** Current streak: 0 once a whole day has passed without practice. */
export function currentStreak(p: Progress, today = dayKey()): number {
  return p.streak.last === today || p.streak.last === addDays(today, -1) ? p.streak.count : 0;
}

export function practisedToday(p: Progress, today = dayKey()): boolean {
  return p.streak.last === today;
}

export function isLessonDone(p: Progress, lessonId: string): boolean {
  return lessonId in p.lessons;
}

/** Vocabulary items of the lessons done (played or passed in the placement test). */
export function wordsLearned(p: Progress, pack: Pack): number {
  const words = new Set<string>();
  for (const id of Object.keys(p.lessons)) {
    const lesson = getLesson(id, pack);
    if (!lesson) continue;
    for (const item of getLessonItems(lesson, pack)) if (item.kind === "vocab") words.add(item.id);
  }
  return words.size;
}

/** Items due for review (most urgent first), skipping ids no longer in the content. */
export function dueItemIds(p: Progress, pack: Pack, now: number): string[] {
  return dueIds(p.srs, now, (id) => {
    const item = getItem(id, pack);
    return !!item && item.kind !== "grammar";
  });
}

// ---------------------------------------------------------------------------------------------
// Actions

function bumpStreak(s: Streak, today: string): Streak {
  if (s.last === today) return s;
  const count = s.last === addDays(today, -1) ? s.count + 1 : 1;
  return { count, best: Math.max(s.best, count), last: today };
}

/** Shared by lessons and reviews: XP, streak and SRS state of the items practised. */
function applyResult(p: Progress, result: LessonResult, pack: Pack, now: number): void {
  p.xp += Math.max(0, Math.round(result.xp));
  p.streak = bumpStreak(p.streak, dayKey(new Date(now)));
  for (const o of result.items) {
    const item = getItem(o.itemId, pack);
    if (!item || item.kind === "grammar" || o.attempts <= 0) continue;
    p.srs[o.itemId] = schedule(p.srs[o.itemId], o.mistakes === 0, now);
  }
}

/** A lesson played to the end: done, XP, streak, SRS (practised items + the rest as new). */
export function recordLessonResult(result: LessonResult): Progress {
  const pack = getPack(result.lang);
  const now = result.finishedAt || Date.now();
  return update(result.lang, (p) => {
    const prev = p.lessons[result.lessonId];
    p.lessons[result.lessonId] = { doneAt: prev?.doneAt || now, plays: (prev?.plays ?? 0) + 1 };
    applyResult(p, result, pack, now);
    const lesson = getLesson(result.lessonId, pack);
    if (!lesson) return;
    for (const item of getLessonItems(lesson, pack)) {
      if (item.kind !== "grammar" && !p.srs[item.id]) p.srs[item.id] = newEntry(now);
    }
  });
}

/** A review session played to the end: XP, streak and SRS only. */
export function recordReviewResult(result: LessonResult): Progress {
  const pack = getPack(result.lang);
  return update(result.lang, (p) => applyResult(p, result, pack, result.finishedAt || Date.now()));
}

/**
 * Placement test result: marks `lessonIds` done. Lessons marked by an earlier placement test
 * and never played are unmarked when not passed again; played lessons are never touched.
 */
export function applyPlacement(lang: string, lessonIds: string[]): Progress {
  const now = Date.now();
  return update(lang, (p) => {
    for (const [id, l] of Object.entries(p.lessons)) if (l.placement && l.plays === 0) delete p.lessons[id];
    for (const id of lessonIds) if (!p.lessons[id]) p.lessons[id] = { doneAt: now, plays: 0, placement: true };
    p.onboarded = true;
    p.placementAt = now;
  });
}

/** Welcome skipped ("Empezar desde cero"). */
export function completeOnboarding(lang: string): Progress {
  return update(lang, (p) => {
    p.onboarded = true;
  });
}

/** Deletes all progress of the pack (settings are kept). The welcome shows again. */
export function resetProgress(lang: string): void {
  try {
    window.localStorage.removeItem(key(lang));
  } catch {
    // Nothing stored.
  }
  window.dispatchEvent(new Event(EVENT));
}
