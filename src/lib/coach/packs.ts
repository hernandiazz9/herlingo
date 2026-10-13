/**
 * "Mis situaciones": the packs saved on the device per language pack, newest first. Practising
 * a saved pack again needs no request. Invalid stored packs are dropped whole; nothing throws.
 * Saving or replacing a pack downloads its audio in the background (offline practice); replacing
 * or deleting one deletes the cached mp3s no saved pack or route uses any more.
 */
import { cachePackAudio } from "./audio";
import { parseSavedPacks, SAVED_LIST_VERSION } from "./parse";
import { pruneAfter, startPrefetch, stopPrefetch } from "./saved-audio";
import { COACH_KEYS, readRaw, writeJson } from "./store";
import type { CoachPack } from "./types";

export const readPacksRaw = (lang: string): string => readRaw(COACH_KEYS.packs(lang));

export function getSavedPacks(lang: string): CoachPack[] {
  if (typeof window === "undefined") return [];
  return parseSavedPacks(readPacksRaw(lang));
}

export function getSavedPack(lang: string, id: string): CoachPack | undefined {
  return getSavedPacks(lang).find((p) => p.id === id);
}

function write(lang: string, packs: CoachPack[]): boolean {
  return writeJson(COACH_KEYS.packs(lang), { v: SAVED_LIST_VERSION, packs });
}

/** Downloads the pack's audio in the background (aborting its older version's download). */
const startPackPrefetch = (pack: CoachPack): Promise<unknown> =>
  startPrefetch("pack", pack.lang, pack.id, (signal) => cachePackAudio(pack, signal));

/** Saves a pack at the top of the list (a pack with the same id is replaced). False if storage failed. */
export function savePack(pack: CoachPack): boolean {
  const packs = getSavedPacks(pack.lang);
  const replaced = packs.some((p) => p.id === pack.id);
  const ok = write(pack.lang, [pack, ...packs.filter((p) => p.id !== pack.id)]);
  if (!ok) return false;
  const oldStopped = startPackPrefetch(pack);
  if (replaced) pruneAfter(oldStopped);
  return true;
}

/**
 * Replaces the saved pack with the same id in place (a refinement). False (nothing stored, no
 * audio) when no saved pack has that id: a refinement that arrives after its pack was deleted
 * never brings it back.
 */
export function replacePack(pack: CoachPack): boolean {
  const packs = getSavedPacks(pack.lang);
  const i = packs.findIndex((p) => p.id === pack.id);
  if (i < 0) return false;
  packs[i] = pack;
  if (!write(pack.lang, packs)) return false;
  pruneAfter(startPackPrefetch(pack));
  return true;
}

export function deletePack(lang: string, id: string): void {
  write(lang, getSavedPacks(lang).filter((p) => p.id !== id));
  pruneAfter(stopPrefetch("pack", lang, id));
}
