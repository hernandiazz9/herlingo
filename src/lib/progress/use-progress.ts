"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseProgress, readProgressRaw, subscribeProgress, type Progress } from "./index";
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

/** False on the server and during hydration, true once the device's storage can be read. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, yes, no);
}
