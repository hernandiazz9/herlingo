/**
 * Generated-audio backend: lines that are not part of the static content (Prepárate packs, level
 * interview), spoken by a registered source (the coach TTS endpoint). Client-only.
 *
 * A generated playable is a plain `Playable` whose `audioKey` is `generatedKey(voice, text)`
 * ("gen:<hash of voice + text>"), so it travels through the same types as content playables.
 * Its mp3 is looked up in memory, then in Cache Storage (`GENERATED_AUDIO_CACHE`, which the
 * service worker never deletes), then fetched once through the source and cached. No mp3 →
 * the caller falls back to speechSynthesis. A line the source declines (`null`, e.g. the day's
 * voice allowance is used up) is not asked for again this session: it goes straight to the
 * device voice, inside the gesture.
 *
 * A slow line (`generatedPlayable(text, voice, { slow: true })`, Modo deporte) is read slower by
 * the voice itself (the source asks for it with `slow: true`), so it has its own key and mp3 and
 * always plays at rate 1. `generatedBytes()` gives a line's mp3 as bytes (to join clips).
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
/**
 * Upper bound for one line's cache lookup + download: past it the job settles empty (the player
 * falls back to the device voice) and the download is aborted, even if a source never settles.
 */
const LOAD_DEADLINE_MS = 8_000;

/** How a generated line is read: `slow` = by the voice itself at a slower rate (never `playbackRate`). */
export interface GeneratedLineOptions {
  slow?: boolean;
}

/**
 * Fetches the mp3 of one line (read slower by the voice when `options.slow`); rejects when it
 * cannot this time (the caller falls back to the device voice and a later tap tries again),
 * resolves `null` when it will not this session (the line then always uses the device voice,
 * without asking the source again).
 */
export type GeneratedAudioSource = (
  text: string,
  voice: string,
  signal?: AbortSignal,
  options?: GeneratedLineOptions,
) => Promise<Blob | null>;

/** A generated playable; `slow: true` marks a line the voice reads slower (its own key and mp3). */
export type GeneratedPlayable = Playable & { slow?: true };

let source: GeneratedAudioSource | undefined;
const memo = new Map<string, string>();
/** Keys of lines the source declined (`null`): device voice for the rest of the session. */
const declined = new Set<string>();
/**
 * Keys of slow lines made this session: a slow key is always requested slow, even from a copy
 * of its playable that lost the `slow` flag (its cached mp3 must never be a normal-rate one).
 */
const slowKeys = new Set<string>();
/** One shared job per line, aborted once every caller has given up (a player never gives up). */
interface Job {
  promise: Promise<Blob | undefined>;
  ctrl: AbortController;
  /** Callers still waiting: players (no signal) and callers whose signal has not aborted. */
  waiting: number;
}
const inflight = new Map<string, Job>();

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

/**
 * Audio key of a generated line: a hash of voice + text, and of the slow flag for a slow line
 * (normal lines keep their keys). Content keys never contain ":", so they cannot collide.
 */
export function generatedKey(voice: string, text: string, options: GeneratedLineOptions = {}): string {
  // "@" never appears in a voice name, so a slow key never equals a normal one.
  return KEY_PREFIX + hash(options.slow ? `${voice}@slow\n${text}` : `${voice}\n${text}`);
}

/**
 * A playable for a line outside the static content: pass it to `speak()` like any other. With
 * `{ slow: true }` the voice reads it slower (own key and mp3); `speak()` plays it at rate 1.
 */
export function generatedPlayable(text: string, voice: string, options: GeneratedLineOptions = {}): GeneratedPlayable {
  if (!options.slow) return { text, voice, audioKey: generatedKey(voice, text) };
  const audioKey = generatedKey(voice, text, { slow: true });
  slowKeys.add(audioKey);
  return { text, voice, audioKey, slow: true };
}

export function isGenerated(p: Playable): boolean {
  return p.audioKey.startsWith(KEY_PREFIX);
}

/** True for a slow generated line (its mp3 is already slow: it plays at rate 1). */
export function isSlowGenerated(p: Playable): boolean {
  return (p as GeneratedPlayable).slow === true || slowKeys.has(p.audioKey);
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
  const blob = isSlowGenerated(p)
    ? await source(p.text, p.voice, signal, { slow: true })
    : await source(p.text, p.voice, signal);
  if (blob === null) {
    declined.add(p.audioKey);
    return undefined;
  }
  if (!blob.size) return undefined;
  const headers = { "Content-Type": blob.type || "audio/mpeg" };
  await cache?.put(cacheUrl(p.audioKey), new Response(blob, { headers })).catch(() => {});
  return blob;
}

function startJob(p: Playable): Job {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      ctrl.abort();
      resolve(undefined);
    }, LOAD_DEADLINE_MS);
  });
  const work = (async () => {
    const cache = await openCache();
    return (await cachedBlob(cache, p.audioKey)) ?? (await download(p, cache, ctrl.signal));
  })().catch(() => undefined);
  const job: Job = { ctrl, waiting: 0, promise: Promise.race([work, deadline]) };
  void job.promise.then(() => {
    clearTimeout(timer);
    if (inflight.get(p.audioKey) === job) inflight.delete(p.audioKey);
  });
  return job;
}

/**
 * The mp3 of a line: Cache Storage, else one download (deduplicated while in flight, bounded by
 * `LOAD_DEADLINE_MS`). With `signal`, this caller stops waiting (undefined) when it aborts; the
 * shared download is aborted only once no caller waits for it any more.
 */
function loadBlob(p: Playable, signal?: AbortSignal): Promise<Blob | undefined> {
  if (signal?.aborted || declined.has(p.audioKey)) return Promise.resolve(undefined);
  let job = inflight.get(p.audioKey);
  if (!job) {
    job = startJob(p);
    inflight.set(p.audioKey, job);
  }
  const shared = job;
  shared.waiting++;
  if (!signal) return shared.promise;
  return new Promise((resolve) => {
    const onAbort = () => {
      if (--shared.waiting === 0) {
        shared.ctrl.abort();
        if (inflight.get(p.audioKey) === shared) inflight.delete(p.audioKey);
      }
      resolve(undefined);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void shared.promise.then((blob) => {
      signal.removeEventListener("abort", onAbort);
      resolve(blob);
    });
  });
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
 * Plays a generated line at `rate` (a slow line at rate 1: its mp3 is already slow). A line
 * already in memory starts synchronously (inside the gesture); otherwise after the cache
 * lookup/download, on the audio element unlocked by the first gesture. `fallback()` (device
 * voice) runs when there is no playable mp3 and `isCurrent()` says this speak() call was not
 * superseded meanwhile.
 */
export function playGenerated(
  p: Playable,
  rate: number,
  isCurrent: () => boolean,
  fallback: () => Promise<void>,
): Promise<void> {
  const mp3Rate = isSlowGenerated(p) ? 1 : rate;
  const play = (url: string | undefined): Promise<void> | undefined => {
    if (!isCurrent()) return;
    if (!url) return fallback();
    return mp3Play(url, mp3Rate).then((result) => {
      if (result === "failed" && isCurrent()) return fallback();
    });
  };
  const hit = remembered(p.audioKey);
  if (hit || declined.has(p.audioKey)) return Promise.resolve(play(hit));
  return generatedUrl(p).then(play);
}

export interface PrefetchResult {
  total: number;
  /** Lines whose mp3 is now on the device. */
  ready: number;
  failed: number;
}

/** A line's mp3 from the object URL kept in memory (not counted as a use: playback order is kept). */
async function memoBlob(key: string): Promise<Blob | undefined> {
  const url = memo.get(key);
  if (!url) return undefined;
  try {
    const res = await fetch(url);
    return res.ok ? await res.blob() : undefined;
  } catch {
    // Revoked meanwhile (dropped from memory): the cache or the source still has it.
    return undefined;
  }
}

/**
 * The mp3 of a generated line as bytes (Modo deporte joins clips into one file): memory, else
 * Cache Storage, else the source once (then cached; shared with taps and downloads in flight,
 * bounded like them). `null` when there is none this time (offline and not cached, declined,
 * source failure, `signal` aborted): never the device voice. Content playables are not its job
 * (`null`). Never rejects.
 */
export async function generatedBytes(p: Playable, signal?: AbortSignal): Promise<Uint8Array | null> {
  if (!isGenerated(p) || signal?.aborted) return null;
  const blob = (await memoBlob(p.audioKey)) ?? (await loadBlob(p, signal));
  if (!blob?.size) return null;
  try {
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
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
  declined.clear();
  if (typeof caches === "undefined") return;
  await caches.delete(GENERATED_AUDIO_CACHE).catch(() => false);
}
