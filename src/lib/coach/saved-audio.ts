/**
 * Audio of what is saved on the device (packs and quick routes): one background download per
 * saved item (a shared map, so saving a newer version aborts the older download) and the cache
 * tidy-up, which keeps every saved pack's and every saved route's lines in every language.
 * It reads the saved lists straight from storage, not through packs.ts / routes.ts (they import
 * this module).
 */
import { pruneGenerated } from "@/lib/audio";
import { listLangs } from "@/lib/content";
import { packPlayables, routePlayables } from "./audio";
import { parseSavedPacks, parseSavedRoutes } from "./parse";
import { COACH_KEYS, readRaw } from "./store";

/** Deletes cached mp3s that no saved pack or route (any language) uses. Never rejects. */
export function pruneCoachAudio(): Promise<void> {
  const keep = new Set<string>();
  for (const lang of listLangs()) {
    const lines = [
      ...parseSavedPacks(readRaw(COACH_KEYS.packs(lang))).flatMap(packPlayables),
      ...parseSavedRoutes(readRaw(COACH_KEYS.routes(lang))).flatMap(routePlayables),
    ];
    for (const line of lines) keep.add(line.audioKey);
  }
  return pruneGenerated(keep);
}

export type SavedKind = "pack" | "route";

/** The background audio download of each saved item (by kind + language + id) while it runs. */
const prefetches = new Map<string, { ctrl: AbortController; done: Promise<unknown> }>();
const prefetchId = (kind: SavedKind, lang: string, id: string) => `${kind}\n${lang}\n${id}`;

/** Aborts the item's running audio download; resolves once it has settled (at once if none). */
export function stopPrefetch(kind: SavedKind, lang: string, id: string): Promise<unknown> {
  const key = prefetchId(kind, lang, id);
  const running = prefetches.get(key);
  if (!running) return Promise.resolve();
  prefetches.delete(key);
  running.ctrl.abort();
  return running.done;
}

/**
 * Runs `download` (the item's audio) in the background and aborts the download of its older
 * version (after starting the new one, so lines both share keep their download). Resolves once
 * the old download has settled.
 */
export function startPrefetch(
  kind: SavedKind,
  lang: string,
  id: string,
  download: (signal: AbortSignal) => Promise<unknown>,
): Promise<unknown> {
  const key = prefetchId(kind, lang, id);
  const old = prefetches.get(key);
  const ctrl = new AbortController();
  const done = download(ctrl.signal);
  prefetches.set(key, { ctrl, done });
  void done.then(() => {
    if (prefetches.get(key)?.ctrl === ctrl) prefetches.delete(key);
  });
  if (!old) return Promise.resolve();
  old.ctrl.abort();
  return old.done;
}

/** Tidies the audio cache once an item's old download has stopped (it can no longer add files). */
export function pruneAfter(stopped: Promise<unknown>): void {
  void stopped.then(pruneCoachAudio);
}
