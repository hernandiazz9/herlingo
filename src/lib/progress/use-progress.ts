"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { listLangs } from "@/lib/content";
import { dayKey } from "./dates";
import { ensureAppPoints, parseProgress, readProgressRaw, subscribeProgress, type Progress } from "./index";
import { globalBest, globalStreak, monthName, monthXp, readActivityRaw, resolveActivity, subscribeActivity } from "./points";
import { parseSettings, readSettingsRaw, subscribeSettings, type Settings } from "./settings";

const empty = () => "";
const yes = () => true;
const no = () => false;
const noop = () => () => {};

/** Progress of a pack, live. Empty on the server and during hydration. */
export function useProgress(lang: string): Progress {
  const raw = useSyncExternalStore(subscribeProgress, () => readProgressRaw(lang), empty);
  return useMemo(() => parseProgress(raw), [raw]);
}

/** Settings, live. Defaults on the server and during hydration. */
export function useSettings(): Settings {
  const raw = useSyncExternalStore(subscribeSettings, readSettingsRaw, empty);
  return useMemo(() => parseSettings(raw), [raw]);
}

const MINUTE = 60_000;
const nowMinute = () => Math.ceil(Date.now() / MINUTE) * MINUTE;
const zero = () => 0;
function subscribeMinute(onChange: () => void) {
  const id = window.setInterval(onChange, MINUTE / 2);
  return () => window.clearInterval(id);
}

/** Current time rounded up to the minute (0 on the server): for due dates, safe in render. */
export function useNow(): number {
  return useSyncExternalStore(subscribeMinute, nowMinute, zero);
}

export interface AppPoints {
  /** XP of the current local calendar month, all languages. */
  monthXp: number;
  /** Current month in Spanish ("octubre"), "" until hydrated. */
  month: string;
  /** Every pack's XP on this device. */
  lifetimeXp: number;
  /** XP per pack, default pack first. */
  byLang: { lang: string; xp: number }[];
  /** Global streak (any language) and its best. */
  streak: number;
  best: number;
}

const SEP = "\u0000";
const readAllRaw = () => [readActivityRaw(), ...listLangs().map(readProgressRaw)].join(SEP);
function subscribeAll(onChange: () => void) {
  const a = subscribeActivity(onChange);
  const b = subscribeProgress(onChange);
  return () => {
    a();
    b();
  };
}

/**
 * App-wide points, live: monthly XP, lifetime XP, global streak. Writes the activity log seed on
 * first use (`lang-lern:activity`). Zeros on the server and during hydration.
 */
export function useAppPoints(): AppPoints {
  const raw = useSyncExternalStore(subscribeAll, readAllRaw, empty);
  const now = useNow();
  useEffect(() => ensureAppPoints(), []);
  return useMemo(() => {
    const langs = listLangs();
    if (!raw || !now) {
      return { monthXp: 0, month: "", lifetimeXp: 0, byLang: langs.map((lang) => ({ lang, xp: 0 })), streak: 0, best: 0 };
    }
    const [activityRaw, ...progressRaws] = raw.split(SEP);
    const progress = langs.map((_, i) => parseProgress(progressRaws[i] ?? ""));
    const log = resolveActivity(activityRaw, () => langs.map((lang, i) => ({ lang, ...progress[i].streak })));
    const date = new Date(now);
    const today = dayKey(date);
    const byLang = langs.map((lang, i) => ({ lang, xp: progress[i].xp }));
    return {
      monthXp: monthXp(log, today),
      month: monthName(date),
      lifetimeXp: byLang.reduce((sum, l) => sum + l.xp, 0),
      byLang,
      streak: globalStreak(log, today),
      best: globalBest(log, today),
    };
  }, [raw, now]);
}

/** False on the server and during hydration, true once the device's storage can be read. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, yes, no);
}
