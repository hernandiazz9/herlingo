/**
 * Which episodes are fully downloaded: every clip of the compiled episode already on the device,
 * so it prepares without the network. «Escuchar seguidos» (docs/sport.md "Length") joins only
 * those: it never downloads a whole section at once.
 *
 * Generated lines count when their mp3 is kept in memory this session or is in Cache Storage
 * (`generatedOnDeviceCheck`: one listing of the cache, bounded like a line's lookup). Content lines
 * (only with `DIALOGUE_LINES_FROM_CONTENT`) count when any cache holds their mp3 (the service
 * worker's audio cache).
 */
import { generatedOnDeviceCheck, isGenerated, mp3UrlWhenReady } from "@/lib/audio";
import { DEFAULT_GLOSS_LANG, type GlossLang, type Playable } from "@/lib/content";
import { compileEpisode } from "./compile";
import type { SportEpisode } from "./types";

/** The distinct clips of an episode as compiled (what `prepareEpisode` downloads). */
function clipsOf(episode: SportEpisode, glossLang: GlossLang): Playable[] {
  const clips = new Map<string, Playable>();
  for (const s of compileEpisode(episode, glossLang).segments) {
    if (s.kind === "clip" && !clips.has(s.playable.audioKey)) clips.set(s.playable.audioKey, s.playable);
  }
  return [...clips.values()];
}

async function contentCached(lang: string, p: Playable): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  const url = await mp3UrlWhenReady(lang, p.audioKey);
  if (!url) return false;
  try {
    return (await caches.match(url, { ignoreSearch: true })) !== undefined;
  } catch {
    return false;
  }
}

/**
 * The episodes of `list` (in order) whose every clip is on the device. Never rejects; without
 * Cache Storage, only those whose clips are all generated lines kept in memory.
 */
export async function downloadedEpisodes<T extends SportEpisode>(
  list: readonly T[],
  glossLang: GlossLang = DEFAULT_GLOSS_LANG,
): Promise<T[]> {
  if (!list.length) return [];
  const generatedOnDevice = await generatedOnDeviceCheck();
  const out: T[] = [];
  for (const episode of list) {
    let complete = true;
    for (const clip of clipsOf(episode, glossLang)) {
      complete = isGenerated(clip) ? generatedOnDevice(clip) : await contentCached(episode.lang, clip);
      if (!complete) break;
    }
    if (complete) out.push(episode);
  }
  return out;
}

/** Distinct clips of an episode (the `total` its preparation reports). */
export function episodeClipCount(episode: SportEpisode, glossLang: GlossLang = DEFAULT_GLOSS_LANG): number {
  return clipsOf(episode, glossLang).length;
}
