/**
 * Generated-audio backend: lines that are not part of the static content (Prepárate packs, level
 * interview), spoken by a registered source (the coach TTS endpoint). Client-only.
 *
 * A generated playable is a plain `Playable` whose `audioKey` is `generatedKey(voice, text)`
 * ("gen:<hash of voice + text>"), so it travels through the same types as content playables.
 * Its mp3 is looked up in memory, then in Cache Storage (`GENERATED_AUDIO_CACHE`, which the
 * service worker never deletes), then fetched once through the source and cached. No mp3 →
 * the caller falls back to speechSynthesis.
 */
import type { Playable } from "@/lib/content";
import { mp3Play } from "./mp3";

/** Cache Storage name for generated mp3s; scripts/pwa keeps it across service worker updates. */
export const GENERATED_AUDIO_CACHE = "lang-lern-coach-audio";

const KEY_PREFIX = "gen:";
/** Cache entries live under this synthetic path (never requested over the network). */
const CACHE_PATH = "/coach-audio/";
/** Object URLs kept in memory (least recently used dropped first). */
const MEMO_SIZE = 64;
const PREFETCH_CONCURRENCY = 3;

/** Fetches the mp3 of one line; rejects when it cannot (the caller falls back to the device voice). */
export type GeneratedAudioSource = (text: string, voice: string, signal?: AbortSignal) => Promise<Blob>;

let source: GeneratedAudioSource | undefined;
const memo = new Map<string, string>();
const inflight = new Map<string, Promise<Blob | undefined>>();

/** Registers where generated mp3s come from (`@/lib/coach` registers the coach TTS endpoint). */
export function setGeneratedAudioSource(fn: GeneratedAudioSource | undefined): void {
  source = fn;
}

/** 64-bit hex hash (two 32-bit multiplicative lanes, cyrb53-style); synchronous, no crypto needed. */
function hash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/** Audio key of a generated line. Content keys never contain ":", so they cannot collide. */
export function generatedKey(voice: string, text: string): string {
  return KEY_PREFIX + hash(`${voice}\n${text}`);
}

/** A playable for a line outside the static content: pass it to `speak()` like any other. */
export function generatedPlayable(text: string, voice: string): Playable {
  return { text, voice, audioKey: generatedKey(voice, text) };
}

export function isGenerated(p: Playable): boolean {
  return p.audioKey.startsWith(KEY_PREFIX);
}

const cacheUrl = (key: string) => `${CACHE_PATH}${key.slice(KEY_PREFIX.length)}.mp3`;

/** Cache Storage only exists in secure contexts (https, localhost); elsewhere nothing is cached. */
async function openCache(): Promise<Cache | undefined> {
  if (typeof caches === "undefined") return undefined;
  try {
    return await caches.open(GENERATED_AUDIO_CACHE);
  } catch {
    return undefined;
  }
}

async function cachedBlob(cache: Cache | undefined, key: string): Promise<Blob | undefined> {
  try {
    const hit = await cache?.match(cacheUrl(key));
    return hit ? await hit.blob() : undefined;
  } catch {
    return undefined;
  }
}

async function download(p: Playable, cache: Cache | undefined, signal?: AbortSignal): Promise<Blob | undefined> {
  if (!source || (typeof navigator !== "undefined" && navigator.onLine === false)) return undefined;
  const blob = await source(p.text, p.voice, signal);
  if (!blob.size) return undefined;
  const headers = { "Content-Type": blob.type || "audio/mpeg" };
  await cache?.put(cacheUrl(p.audioKey), new Response(blob, { headers })).catch(() => {});
  return blob;
}

/** The mp3 of a line: Cache Storage, else one download (deduplicated while in flight). */
function loadBlob(p: Playable, signal?: AbortSignal): Promise<Blob | undefined> {
  let job = inflight.get(p.audioKey);
  if (!job) {
    job = (async () => {
      const cache = await openCache();
      return (await cachedBlob(cache, p.audioKey)) ?? (await download(p, cache, signal));
    })()
      .catch(() => undefined)
      .finally(() => inflight.delete(p.audioKey));
    inflight.set(p.audioKey, job);
  }
  return job;
}

function remembered(key: string): string | undefined {
  const url = memo.get(key);
  if (url) {
    memo.delete(key);
    memo.set(key, url);
  }
  return url;
}

function remember(key: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  memo.set(key, url);
  for (const [old, oldUrl] of memo) {
    if (memo.size <= MEMO_SIZE) break;
    memo.delete(old);
    URL.revokeObjectURL(oldUrl);
  }
  return url;
}

async function generatedUrl(p: Playable): Promise<string | undefined> {
  const blob = await loadBlob(p);
  if (!blob) return undefined;
  return remembered(p.audioKey) ?? remember(p.audioKey, blob);
}

/**
 * Plays a generated line at `rate`. A line already in memory starts synchronously (inside the
 * gesture); otherwise after the cache lookup/download, on the audio element unlocked by the first
 * gesture. `fallback()` (device voice) runs when there is no playable mp3 and `isCurrent()` says
 * this speak() call was not superseded meanwhile.
 */
export function playGenerated(
  p: Playable,
  rate: number,
  isCurrent: () => boolean,
  fallback: () => Promise<void>,
): Promise<void> {
  const play = (url: string | undefined): Promise<void> | undefined => {
    if (!isCurrent()) return;
    if (!url) return fallback();
    return mp3Play(url, rate).then((result) => {
      if (result === "failed" && isCurrent()) return fallback();
    });
  };
  const hit = remembered(p.audioKey);
  if (hit) return Promise.resolve(play(hit));
  return generatedUrl(p).then(play);
}

export interface PrefetchResult {
  total: number;
  /** Lines whose mp3 is now on the device. */
  ready: number;
  failed: number;
}

/** Downloads and caches every line not cached yet (for offline use). Never rejects. */
export async function prefetchGenerated(list: readonly Playable[], signal?: AbortSignal): Promise<PrefetchResult> {
  const todo = [...new Map(list.filter(isGenerated).map((p) => [p.audioKey, p])).values()];
  const result: PrefetchResult = { total: todo.length, ready: 0, failed: 0 };
  let next = 0;
  const worker = async () => {
    while (next < todo.length && !signal?.aborted) {
      const blob = await loadBlob(todo[next++], signal);
      if (blob) result.ready++;
      else result.failed++;
    }
  };
  await Promise.all(Array.from({ length: PREFETCH_CONCURRENCY }, worker));
  return result;
}

/** Deletes cached generated mp3s whose key is not in `keep` (lines of packs that no longer exist). */
export async function pruneGenerated(keep: ReadonlySet<string>): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  const wanted = new Set([...keep].map(cacheUrl));
  try {
    const requests = await cache.keys();
    await Promise.all(
      requests.filter((r) => !wanted.has(new URL(r.url).pathname)).map((r) => cache.delete(r)),
    );
  } catch {
    // Storage unavailable: nothing to tidy.
  }
}

/** Forgets every generated mp3 (memory and Cache Storage). */
export async function clearGeneratedAudio(): Promise<void> {
  for (const url of memo.values()) URL.revokeObjectURL(url);
  memo.clear();
  if (typeof caches === "undefined") return;
  await caches.delete(GENERATED_AUDIO_CACHE).catch(() => false);
}
