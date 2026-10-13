/**
 * Learner progress, stored on the device per language pack (localStorage, versioned JSON under
 * `lang-lern:progress:<lang>`): lessons done, XP, daily streak (local time zone), per-item
 * spaced-repetition state, onboarding/placement. Framework-free; React reads it with
 * `useProgress()` from `./use-progress`.
 *
 * Parsing is tolerant: empty, corrupt or partly invalid values give an empty progress or drop
 * just the bad entries. Nothing here throws.
 */
import { getItem, getLesson, getLessonItems, getPack, listLangs, type Pack } from "@/lib/content";
import type { LessonResult } from "@/lib/exercises";
import { clearGame } from "@/lib/game/storage";
import { clearGrammarReads } from "@/lib/grammar/reads";
import { clearStoriesDone } from "@/lib/stories/done";
import { dueIds, newEntry, parseEntry, schedule, type SrsEntry } from "@/lib/srs";
import { clearDaily } from "./daily";
import { addDays, dayKey, isDayKey } from "./dates";
import {
  addActivity,
  ensureActivity,
  globalBest,
  globalStreak,
  readActivityRaw,
  removeActivityLang,
  resolveActivity,
  type LangStreak,
} from "./points";

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

/** Every pack's stored streak (seed and best-streak source of the global activity log). */
export function langStreaks(): LangStreak[] {
  if (typeof window === "undefined") return [];
  return listLangs().map((lang) => ({ lang, ...getProgress(lang).streak }));
}

/** Global streak (any language) and best, as stored on the device now. */
export function getGlobalStreak(today = dayKey()): { count: number; best: number } {
  if (typeof window === "undefined") return { count: 0, best: 0 };
  const log = resolveActivity(readActivityRaw(), langStreaks);
  return { count: globalStreak(log, today), best: globalBest(log, today) };
}

/** Writes `lang-lern:activity` from the stored streaks if it does not exist yet (first run). */
export function ensureAppPoints(): void {
  ensureActivity(langStreaks);
}

// ---------------------------------------------------------------------------------------------
// XP awards (the one place where awards are reported; Liga queues them, docs/league.md → Sync)

const XP_EVENT = "lang-lern:xp-award";

/** What earned XP. Liga sends it as the event `source` (`^[a-z][a-z_-]{0,19}$`). */
export type XpSource =
  | "lesson"
  | "review"
  | "game"
  | "story"
  | "dialogue"
  | "listen"
  | "discover"
  | "placement"
  | "coach"
  | "grammar"
  | "activity";

/** One XP award, reported after the progress holding it has been saved. */
export interface XpAward {
  lang: string;
  /** XP added (> 0). */
  amount: number;
  source: XpSource;
  /** Epoch ms when it was earned. */
  earnedAt: number;
}

function reportXp(award: XpAward): void {
  if (award.amount <= 0 || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<XpAward>(XP_EVENT, { detail: award }));
}

/** Calls `onAward` after every XP award saved in this tab. Returns the unsubscribe. */
export function subscribeXpAwards(onAward: (award: XpAward) => void): () => void {
  const listener = (e: Event) => {
    const award = (e as CustomEvent<XpAward>).detail;
    if (!award) return;
    try {
      onAward(award);
    } catch {
      // A listener must never break saving progress.
    }
  };
  window.addEventListener(XP_EVENT, listener);
  return () => window.removeEventListener(XP_EVENT, listener);
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

/**
 * Every XP award goes through here: saves the result (plus `extra` changes) and then reports the
 * award (`subscribeXpAwards`).
 */
function saveResult(result: LessonResult, source: XpSource, now: number, extra?: (p: Progress, pack: Pack) => void): Progress {
  const pack = getPack(result.lang);
  const p = update(result.lang, (p) => {
    applyResult(p, result, pack, now);
    extra?.(p, pack);
  });
  // Global day log (monthly XP, global streak); 0 XP still marks the day.
  addActivity(result.lang, Math.max(0, Math.round(result.xp)), dayKey(new Date(now)), langStreaks);
  reportXp({ lang: result.lang, amount: Math.max(0, Math.round(result.xp)), source, earnedAt: now });
  return p;
}

/** A lesson played to the end: done, XP, streak, SRS (practised items + the rest as new). */
export function recordLessonResult(result: LessonResult): Progress {
  const now = result.finishedAt || Date.now();
  return saveResult(result, "lesson", now, (p, pack) => {
    const prev = p.lessons[result.lessonId];
    p.lessons[result.lessonId] = { doneAt: prev?.doneAt || now, plays: (prev?.plays ?? 0) + 1 };
    const lesson = getLesson(result.lessonId, pack);
    if (!lesson) return;
    for (const item of getLessonItems(lesson, pack)) {
      if (item.kind !== "grammar" && !p.srs[item.id]) p.srs[item.id] = newEntry(now);
    }
  });
}

/** A review session played to the end (or practice outside lessons, `source`): XP, streak and SRS only. */
export function recordReviewResult(result: LessonResult, source: XpSource = "review"): Progress {
  return saveResult(result, source, result.finishedAt || Date.now());
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

/**
 * Deletes all progress of the pack, plus its game records/known phrases, finished stories, grammar
 * reads, today's XP bookkeeping and its days in the global activity log (settings and other
 * languages are kept).
 * The welcome shows again.
 */
export function resetProgress(lang: string): void {
  // Seed first (if needed) so the other languages' streak days survive the removal below.
  ensureAppPoints();
  try {
    window.localStorage.removeItem(key(lang));
  } catch {
    // Nothing stored.
  }
  clearGame(lang);
  clearStoriesDone(lang);
  clearGrammarReads(lang);
  removeActivityLang(lang, langStreaks);
  clearDaily(lang);
  window.dispatchEvent(new Event(EVENT));
}
