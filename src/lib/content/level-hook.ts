"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getLevel, packLevels, setLevel, subscribeLevel } from "./level";
import type { Level } from "./types";

export interface LevelState {
  /** The pack's levels in order; [] for a pack without levels (show no selector). */
  levels: Level[];
  /** The learner's level (stored, else the first); null for a pack without levels. */
  level: Level | null;
  setLevel: (level: Level) => void;
}

const none = () => null;

/** The learner's level for `lang`, live (see `./level`). Use it under a `ready` screen language. */
export function useLevel(lang: string): LevelState {
  const getSnapshot = useCallback(() => getLevel(lang), [lang]);
  const stored = useSyncExternalStore(subscribeLevel, getSnapshot, none);
  const levels = packLevels(lang);
  const set = useCallback((level: Level) => setLevel(lang, level), [lang]);
  return { levels, level: levels.length ? (stored ?? levels[0]) : null, setLevel: set };
}
