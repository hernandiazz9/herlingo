/**
 * Stories finished on this device, per language pack (localStorage `lang-lern:stories:<lang>`,
 * `{ v: 1, done: { [storyId]: { doneAt, plays } } }`). Tolerant parsing; nothing here throws.
 */
import { useMemo, useSyncExternalStore } from "react";

const PREFIX = "lang-lern:stories:";
const EVENT = "lang-lern:stories-change";

export interface StoryDone {
  /** Epoch ms of the first time it was finished. */
  doneAt: number;
  /** Times finished (reading + games or their summary). */
  plays: number;
}

export type StoriesDone = Record<string, StoryDone>;

const key = (lang: string) => PREFIX + lang;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

function readRaw(lang: string): string {
  try {
    return window.localStorage.getItem(key(lang)) ?? "";
  } catch {
    return "";
  }
}

export function parseStoriesDone(raw: string): StoriesDone {
  const out: StoriesDone = {};
  if (!raw) return out;
  try {
    const v: unknown = JSON.parse(raw);
    const done = v && typeof v === "object" ? (v as Record<string, unknown>).done : undefined;
    if (!done || typeof done !== "object" || Array.isArray(done)) return out;
    for (const [id, d] of Object.entries(done as Record<string, unknown>)) {
      if (!d || typeof d !== "object") continue;
      const o = d as Record<string, unknown>;
      out[id] = { doneAt: num(o.doneAt), plays: Math.max(1, Math.round(num(o.plays))) };
    }
  } catch {
    // Corrupt value: nothing done.
  }
  return out;
}

export function markStoryDone(lang: string, storyId: string, now = Date.now()): void {
  const done = parseStoriesDone(readRaw(lang));
  const prev = done[storyId];
  done[storyId] = { doneAt: prev?.doneAt || now, plays: (prev?.plays ?? 0) + 1 };
  try {
    window.localStorage.setItem(key(lang), JSON.stringify({ v: 1, done }));
  } catch {
    // Storage unavailable: nothing to persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
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

const empty = () => "";

/** Stories done, live. Empty on the server and during hydration. */
export function useStoriesDone(lang: string): StoriesDone {
  const raw = useSyncExternalStore(subscribe, () => readRaw(lang), empty);
  return useMemo(() => parseStoriesDone(raw), [raw]);
}
