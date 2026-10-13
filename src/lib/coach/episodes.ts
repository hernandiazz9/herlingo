/**
 * "Mis episodios" (Modo deporte, docs/sport.md "Client"): the AI episodes saved on the device per
 * language pack, newest first, unique ids, no count cap. Key `lang-lern:coach:episodes:<lang>` =
 * `{ v: 1, episodes }`. Invalid stored episodes are dropped whole; nothing throws. Saving an
 * episode downloads every generated line of the compiled episode (narrator, slow and target lines)
 * in the background, so it plays offline; deleting one deletes the cached mp3s nothing on the
 * device uses any more. Episodes are deleted only by the learner.
 */
import { prefetchGenerated, type PrefetchResult } from "@/lib/audio";
import { episodePlayables } from "@/lib/sport/compile";
import { parseSavedEpisodes, SAVED_LIST_VERSION } from "./parse";
import { pruneAfter, startPrefetch, stopPrefetch } from "./saved-audio";
import { COACH_KEYS, readRaw, writeJson } from "./store";
import type { StoredEpisode } from "./types";

export const readEpisodesRaw = (lang: string): string => readRaw(COACH_KEYS.episodes(lang));

export function getSavedEpisodes(lang: string): StoredEpisode[] {
  if (typeof window === "undefined") return [];
  return parseSavedEpisodes(readEpisodesRaw(lang));
}

export function getSavedEpisode(lang: string, id: string): StoredEpisode | undefined {
  return getSavedEpisodes(lang).find((e) => e.id === id);
}

function write(lang: string, episodes: StoredEpisode[]): boolean {
  return writeJson(COACH_KEYS.episodes(lang), { v: SAVED_LIST_VERSION, episodes });
}

/** Downloads every generated line of the compiled episode not on the device yet. Never rejects. */
export function cacheEpisodeAudio(episode: StoredEpisode, signal?: AbortSignal): Promise<PrefetchResult> {
  return prefetchGenerated(episodePlayables(episode), signal);
}

/**
 * Saves an episode at the top of the list (one with the same id is replaced) and downloads its
 * audio in the background. False if storage failed (nothing downloaded).
 */
export function saveEpisode(episode: StoredEpisode): boolean {
  const episodes = getSavedEpisodes(episode.lang);
  const replaced = episodes.some((e) => e.id === episode.id);
  if (!write(episode.lang, [episode, ...episodes.filter((e) => e.id !== episode.id)])) return false;
  const oldStopped = startPrefetch("episode", episode.lang, episode.id, (signal) => cacheEpisodeAudio(episode, signal));
  if (replaced) pruneAfter(oldStopped);
  return true;
}

/** Deletes a saved episode, stops its audio download and deletes the mp3s nothing saved uses any more. */
export function deleteEpisode(lang: string, id: string): void {
  write(lang, getSavedEpisodes(lang).filter((e) => e.id !== id));
  pruneAfter(stopPrefetch("episode", lang, id));
}
