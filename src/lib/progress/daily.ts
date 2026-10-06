/**
 * Daily XP bookkeeping per pack (localStorage `lang-lern:daily-xp:<lang>`, local day): audio
 * already rewarded today (listening XP, one per audio, capped per day) and how many times each
 * activity was finished today (repeats earn half). Tolerant parsing: another day or a bad value
 * starts the day empty.
 */
import { dayKey } from "./dates";

const VERSION = 1;
const PREFIX = "lang-lern:daily-xp:";

/** XP for listening to an audio for the first time today. */
export const XP_LISTEN = 1;
/** Most listening XP per pack and day. */
export const LISTEN_DAILY_CAP = 40;

interface Daily {
  v: typeof VERSION;
  day: string;
  /** Audio keys rewarded today. */
  heard: string[];
  /** Times each activity id was finished today. */
  plays: Record<string, number>;
}

const key = (lang: string) => PREFIX + lang;

function read(lang: string): Daily {
  const today = dayKey();
  const empty: Daily = { v: VERSION, day: today, heard: [], plays: {} };
  let v: unknown;
  try {
    v = JSON.parse(window.localStorage.getItem(key(lang)) ?? "");
  } catch {
    return empty;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return empty;
  const o = v as Record<string, unknown>;
  if (o.v !== VERSION || o.day !== today) return empty;
  const heard = Array.isArray(o.heard) ? o.heard.filter((x): x is string => typeof x === "string") : [];
  const plays: Record<string, number> = {};
  if (o.plays && typeof o.plays === "object" && !Array.isArray(o.plays)) {
    for (const [id, n] of Object.entries(o.plays)) if (typeof n === "number" && Number.isFinite(n) && n > 0) plays[id] = Math.round(n);
  }
  return { v: VERSION, day: today, heard, plays };
}

function write(lang: string, d: Daily): void {
  try {
    window.localStorage.setItem(key(lang), JSON.stringify(d));
  } catch {
    // Storage unavailable: the award is still given, only not remembered.
  }
}

/** Listening XP for `audioKey` (0 when already heard today or the daily cap is reached), remembered. */
export function claimListen(lang: string, audioKey: string): number {
  if (typeof window === "undefined" || !audioKey) return 0;
  const d = read(lang);
  if (d.heard.includes(audioKey) || d.heard.length * XP_LISTEN >= LISTEN_DAILY_CAP) return 0;
  d.heard.push(audioKey);
  write(lang, d);
  return XP_LISTEN;
}

/** Counts one finish of activity `id` today. Returns how many times it was finished before today's. */
export function countPlay(lang: string, id: string): number {
  if (typeof window === "undefined") return 0;
  const d = read(lang);
  const before = d.plays[id] ?? 0;
  d.plays[id] = before + 1;
  write(lang, d);
  return before;
}

/** Full XP the first time today, half (rounded up) on repeats. */
export function repeatXp(full: number, playedBefore: number): number {
  return playedBefore > 0 ? Math.ceil(full / 2) : full;
}

/** Forgets today's bookkeeping (part of "Borrar progreso"). */
export function clearDaily(lang: string): void {
  try {
    window.localStorage.removeItem(key(lang));
  } catch {
    // Nothing stored.
  }
}
