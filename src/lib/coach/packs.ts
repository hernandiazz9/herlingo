/**
 * "Mis situaciones": the packs saved on the device per language pack, newest first. Practising
 * a saved pack again needs no request. Invalid stored packs are dropped whole; nothing throws.
 * Saving or replacing a pack downloads its audio in the background (offline practice); replacing
 * or deleting one deletes the cached mp3s no saved pack uses any more.
 */
import { pruneGenerated } from "@/lib/audio";
import { listLangs } from "@/lib/content";
import { cachePackAudio, packPlayables } from "./audio";
import { parsePack } from "./parse";
import { COACH_KEYS, readRaw, readVersioned, writeJson } from "./store";
import type { CoachPack } from "./types";

const VERSION = 1;

export const readPacksRaw = (lang: string): string => readRaw(COACH_KEYS.packs(lang));

export function parseSavedPacks(raw: string): CoachPack[] {
  const list = readVersioned(raw, VERSION)?.packs;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: CoachPack[] = [];
  for (const v of list) {
    const pack = parsePack(v);
    if (pack && !seen.has(pack.id)) {
      seen.add(pack.id);
      out.push(pack);
    }
  }
  return out;
}

export function getSavedPacks(lang: string): CoachPack[] {
  if (typeof window === "undefined") return [];
  return parseSavedPacks(readPacksRaw(lang));
}

export function getSavedPack(lang: string, id: string): CoachPack | undefined {
  return getSavedPacks(lang).find((p) => p.id === id);
}

function write(lang: string, packs: CoachPack[]): boolean {
  return writeJson(COACH_KEYS.packs(lang), { v: VERSION, packs });
}

/** Deletes cached mp3s that no saved pack (any language) uses. Never rejects. */
export function pruneCoachAudio(): Promise<void> {
  const keep = new Set(listLangs().flatMap((lang) => getSavedPacks(lang).flatMap(packPlayables).map((p) => p.audioKey)));
  return pruneGenerated(keep);
}

/** Saves a pack at the top of the list (a pack with the same id is replaced). False if storage failed. */
export function savePack(pack: CoachPack): boolean {
  const packs = getSavedPacks(pack.lang);
  const replaced = packs.some((p) => p.id === pack.id);
  const ok = write(pack.lang, [pack, ...packs.filter((p) => p.id !== pack.id)]);
  if (replaced) void pruneCoachAudio();
  void cachePackAudio(pack);
  return ok;
}

/** Replaces the saved pack with the same id in place (a refinement); saves it at the top if absent. */
export function replacePack(pack: CoachPack): boolean {
  const packs = getSavedPacks(pack.lang);
  const i = packs.findIndex((p) => p.id === pack.id);
  if (i < 0) return savePack(pack);
  packs[i] = pack;
  const ok = write(pack.lang, packs);
  void pruneCoachAudio();
  void cachePackAudio(pack);
  return ok;
}

export function deletePack(lang: string, id: string): void {
  write(lang, getSavedPacks(lang).filter((p) => p.id !== id));
  void pruneCoachAudio();
}
