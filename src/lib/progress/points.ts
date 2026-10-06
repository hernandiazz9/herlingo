/**
 * App points: activity of every language per local calendar day, stored on the device under
 * `lang-lern:activity` (`{ v: 1, days: { "YYYY-MM-DD": { <lang>: xp } }, best }`). It gives the
 * global streak (consecutive active days, any language), the best streak and the monthly XP (all
 * languages, current local calendar month). Lifetime XP is not stored here: it is the sum of every
 * pack's `progress:<lang>.xp`.
 *
 * First run (key absent): seeded from each language's stored streak (`{ count, last }`), so a
 * streak earned before this key existed carries over; seeded days hold 0 XP (the first month
 * counts from the update). Per-language `progress.streak` is still kept by `./index`.
 *
 * Framework-free and free of `./index` imports (it passes the per-language streaks in). Parsing is
 * tolerant; nothing here throws.
 */
import { addDays, dayKey, isDayKey } from "./dates";

export const ACTIVITY_VERSION = 1;
export const ACTIVITY_KEY = "lang-lern:activity";
const EVENT = "lang-lern:activity-change";

export interface ActivityLog {
  v: typeof ACTIVITY_VERSION;
  /** Local day → language → XP earned that day (0 = practised without XP, or seeded). */
  days: Record<string, Record<string, number>>;
  /** Best global streak (at least the longest run in `days`). */
  best: number;
}

/** What seeding and best-streak recomputation need from each language's progress. */
export interface LangStreak {
  lang: string;
  count: number;
  best: number;
  /** Last active day ("YYYY-MM-DD"), "" = never. */
  last: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

export function emptyActivity(): ActivityLog {
  return { v: ACTIVITY_VERSION, days: {}, best: 0 };
}

/** Raw stored value ("" when none): a stable snapshot for useSyncExternalStore. */
export function readActivityRaw(): string {
  try {
    return window.localStorage.getItem(ACTIVITY_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Parsed log, or null when nothing (valid) is stored yet. */
export function parseActivity(raw: string): ActivityLog | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(v)) return null;
  const out = emptyActivity();
  if (isObject(v.days)) {
    for (const [day, langs] of Object.entries(v.days)) {
      if (!isDayKey(day) || !isObject(langs)) continue;
      const entry: Record<string, number> = {};
      for (const [lang, xp] of Object.entries(langs)) if (lang) entry[lang] = num(xp);
      if (Object.keys(entry).length) out.days[day] = entry;
    }
  }
  out.best = Math.max(num(v.best), longestRun(out.days));
  return out;
}

/** The log a device without the key starts from: each language's current streak run. */
export function seedActivity(streaks: LangStreak[]): ActivityLog {
  const out = emptyActivity();
  for (const s of streaks) {
    if (!isDayKey(s.last) || s.count <= 0) continue;
    for (let i = 0; i < s.count; i++) {
      const day = addDays(s.last, -i);
      const entry = (out.days[day] ??= {});
      entry[s.lang] ??= 0;
    }
  }
  out.best = Math.max(longestRun(out.days), ...streaks.map((s) => s.best), 0);
  return out;
}

/** Stored log, or the seed when nothing is stored yet (not written: see `ensureActivity`). */
export function resolveActivity(raw: string, streaks: () => LangStreak[]): ActivityLog {
  return parseActivity(raw) ?? seedActivity(streaks());
}

function write(log: ActivityLog): void {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log));
  } catch {
    // Storage unavailable or full: nothing to persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Writes the seed if the key is absent (first run after the update). */
export function ensureActivity(streaks: () => LangStreak[]): void {
  if (typeof window === "undefined" || parseActivity(readActivityRaw())) return;
  write(seedActivity(streaks()));
}

/** Marks `day` as active for `lang` and adds `xp` (0 still marks the day). */
export function addActivity(lang: string, xp: number, day: string, streaks: () => LangStreak[]): void {
  if (typeof window === "undefined" || !lang || !isDayKey(day)) return;
  const log = resolveActivity(readActivityRaw(), streaks);
  const entry = (log.days[day] ??= {});
  entry[lang] = (entry[lang] ?? 0) + num(xp);
  log.best = Math.max(log.best, longestRun(log.days));
  write(log);
}

/**
 * Removes `lang` from every day ("Borrar progreso" of one language). `remaining` = the other
 * languages' streaks: the best streak is recomputed from what is left.
 */
export function removeActivityLang(lang: string, remaining: () => LangStreak[]): void {
  if (typeof window === "undefined") return;
  const log = resolveActivity(readActivityRaw(), remaining);
  for (const [day, entry] of Object.entries(log.days)) {
    delete entry[lang];
    if (!Object.keys(entry).length) delete log.days[day];
  }
  log.best = Math.max(longestRun(log.days), ...remaining().map((s) => s.best), 0);
  write(log);
}

export function subscribeActivity(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === ACTIVITY_KEY) onChange();
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

/** Longest run of consecutive active days. */
function longestRun(days: Record<string, Record<string, number>>): number {
  const keys = Object.keys(days).sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const k of keys) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/** Global streak: consecutive active days ending today or yesterday (0 once a day is missed). */
export function globalStreak(log: ActivityLog, today = dayKey()): number {
  let day = log.days[today] ? today : addDays(today, -1);
  let count = 0;
  while (log.days[day]) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

export function globalBest(log: ActivityLog, today = dayKey()): number {
  return Math.max(log.best, globalStreak(log, today));
}

/** XP of the local calendar month of `today`, all languages. */
export function monthXp(log: ActivityLog, today = dayKey()): number {
  const month = today.slice(0, 8); // "YYYY-MM-"
  let sum = 0;
  for (const [day, entry] of Object.entries(log.days)) {
    if (day.startsWith(month)) for (const xp of Object.values(entry)) sum += xp;
  }
  return sum;
}

/** Spanish month name ("octubre") of `date`. */
export function monthName(date: Date = new Date()): string {
  return date.toLocaleDateString("es-ES", { month: "long" });
}
