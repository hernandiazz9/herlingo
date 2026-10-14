/**
 * Preparing an episode (docs/sport.md "Player", "Offline", "Save mp3"): download every clip of the
 * compiled episode, check that they share one format and join them byte by byte, with silent
 * frames for the gaps, into one mp3 with exact chapter times. Rebuilt from the cached clips each
 * time; nothing here is stored.
 *
 * Content lines come from their mp3 (`fetch`: the service worker's audio cache answers offline);
 * generated lines (narrator, slow, Prepárate lines) from `generatedClip` (memory, Cache Storage
 * within a short bound, else `/api/coach/tts/` once). Never the device voice.
 *
 * While the page is hidden (screen locked, app in the background) no clip starts, and a clip that
 * failed while it was hidden is fetched again once it is visible (iOS fails fetches at once in the
 * background): only failures while visible count towards `missing`, each with its reason
 * (`missingBy`), so the notice can say why.
 */
import { mp3UrlWhenReady } from "@/lib/audio";
import { generatedClip, isGenerated } from "@/lib/audio/generated";
import { DEFAULT_GLOSS_LANG, type GlossLang, type Playable } from "@/lib/content";
import { compileEpisode } from "./compile";
import {
  frameSeconds,
  Mp3FormatError,
  parseMp3,
  sameFormat,
  SILENCE_FORMAT,
  SILENT_FRAME_BYTES,
  silenceFrames,
  xingFrame,
  type Mp3Clip,
} from "./mp3-frames";
import { EPISODE_GAPS } from "./narration";
import { countHides, pageHidden, whenPageVisible } from "./page";
import type { EpisodeChapter, SportEpisode } from "./types";

/** A chapter of a prepared file: where it starts (s) and which episode it belongs to. */
export type PreparedChapter = EpisodeChapter & { startSec: number; episodeId: string };

export interface PreparedEpisode {
  /** The joined mp3 (`audio/mpeg`). */
  blob: Blob;
  /** In play order: per episode, the opening, one per step, the final scene. */
  chapters: PreparedChapter[];
  /** Exact, from the frame count. */
  durationSec: number;
  /** Clips (distinct lines) that could not be fetched and were left out. */
  missing: number;
  /** Why they were left out (the counts add up to `missing`). */
  missingBy: MissingClips;
}

/**
 * Missing clips by reason (each clip counted once, with the reason of its last attempt):
 * `network` = the download failed, came back unusable or took too long; `declined` = the day's
 * voice allowance is used up (the line is not asked for again this session); `offline` = no
 * connection.
 */
export interface MissingClips {
  network: number;
  declined: number;
  offline: number;
}

export type MissingReason = keyof MissingClips;

/** Every reason, in the order the notice lists them. */
export const MISSING_REASONS: readonly MissingReason[] = ["network", "declined", "offline"];

const noneMissing = (): MissingClips => ({ network: 0, declined: 0, offline: 0 });

export interface PrepareProgress {
  /** Clips settled so far (fetched or given up). */
  done: number;
  /** Distinct clips of the episode. */
  total: number;
}

export interface PrepareOptions {
  /** After each clip settles, and once at the start ({ done: 0, total }). */
  onProgress?: (progress: PrepareProgress) => void;
  /** Aborting rejects with an `AbortError` DOMException. */
  signal?: AbortSignal;
  /** Gloss language of the narration (default `es`). */
  glossLang?: GlossLang;
}

/**
 * `format`: a clip is not in the episode format (MPEG version, layer, sample rate, channel mode of
 * the edge-tts lines): the episode cannot be joined and plays nothing.
 */
export type EpisodeAudioErrorCode = "format";

export class EpisodeAudioError extends Error {
  constructor(
    readonly code: EpisodeAudioErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EpisodeAudioError";
  }
}

/** Clips downloaded at the same time. */
const CONCURRENCY = 3;
/** Failed attempts after which a clip is left out (one retry); attempts the hidden page spoiled do not count. */
const ATTEMPTS = 2;

/** Frame sizes of each prepared blob (its body = the blob minus the Xing frame), for `joinEpisodes`. */
const layouts = new WeakMap<Blob, Uint16Array>();

const FRAME_SEC = frameSeconds(SILENCE_FORMAT);
const seconds = (frames: number) => Math.round(frames * FRAME_SEC * 1000) / 1000;

/** The joined file: Xing frame + frames; its sizes kept for `joinEpisodes`. */
function build(parts: BlobPart[], sizes: number[], chapters: PreparedChapter[], missingBy: MissingClips): PreparedEpisode {
  const layout = Uint16Array.from(sizes);
  const blob = new Blob([xingFrame(layout), ...parts], { type: "audio/mpeg" });
  layouts.set(blob, layout);
  const missing = missingBy.network + missingBy.declined + missingBy.offline;
  return { blob, chapters, durationSec: seconds(sizes.length), missing, missingBy };
}

function pushSilence(parts: BlobPart[], sizes: number[], ms: number): void {
  const { bytes, frames } = silenceFrames(ms);
  parts.push(bytes);
  for (let i = 0; i < frames; i++) sizes.push(SILENT_FRAME_BYTES);
}

/** A clip's bytes, or why there are none this time. */
type ClipResult = { bytes: Uint8Array<ArrayBuffer>; reason?: undefined } | { bytes: null; reason: MissingReason };

const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;
const failedFetch = (): ClipResult => ({ bytes: null, reason: offline() ? "offline" : "network" });

/** One attempt at a clip's bytes; null when `signal` aborts. Never rejects. */
async function clipBytes(p: Playable, lang: string, signal: AbortSignal): Promise<ClipResult | null> {
  if (isGenerated(p)) return generatedClip(p, signal);
  const url = await mp3UrlWhenReady(lang, p.audioKey);
  if (signal.aborted) return null;
  if (!url) return failedFetch();
  try {
    const res = await fetch(url, { signal });
    return res.ok ? { bytes: new Uint8Array(await res.arrayBuffer()) } : failedFetch();
  } catch {
    return signal.aborted ? null : failedFetch();
  }
}

/**
 * A clip's bytes, or why there are none after `ATTEMPTS` failed attempts (the last one's reason);
 * null when `signal` aborts. Each attempt starts only while the page is visible; one that fails
 * while the page is hidden, or that it went hidden during, does not count and is made again once
 * the page is visible.
 */
async function fetchClip(p: Playable, lang: string, signal: AbortSignal, hides: () => number): Promise<ClipResult | null> {
  let last: ClipResult = { bytes: null, reason: "network" };
  for (let failed = 0; failed < ATTEMPTS; ) {
    await whenPageVisible(signal);
    if (signal.aborted) return null;
    const before = hides();
    const result = await clipBytes(p, lang, signal);
    if (!result || signal.aborted) return null;
    if (result.bytes) return result;
    if (!pageHidden() && hides() === before) {
      failed++;
      last = result;
    }
  }
  return last;
}

const aborted = () => new DOMException("The episode was not prepared.", "AbortError");

/**
 * Downloads every clip of `episode` (3 at a time, one retry each, paused while the page is hidden)
 * and joins them into one mp3. A clip that cannot be fetched while the page is visible is left
 * out (its gaps merge) and counted in `missing` (by reason in `missingBy`). Rejects with
 * `EpisodeAudioError` "format" when a clip is not in the episode format, with an `AbortError`
 * when `signal` aborts.
 */
export async function prepareEpisode(episode: SportEpisode, options: PrepareOptions = {}): Promise<PreparedEpisode> {
  const { onProgress, signal, glossLang = DEFAULT_GLOSS_LANG } = options;
  if (signal?.aborted) throw aborted();
  const { segments, chapters } = compileEpisode(episode, glossLang);

  // Download and parse each distinct clip once.
  const todo = [
    ...new Map(segments.flatMap((s) => (s.kind === "clip" ? [[s.playable.audioKey, s.playable] as const] : []))).values(),
  ];
  const clips = new Map<string, Mp3Clip>();
  const missingBy = noneMissing();
  const ctrl = new AbortController();
  const stopAll = () => ctrl.abort();
  signal?.addEventListener("abort", stopAll, { once: true });
  const hides = countHides();
  let failure: EpisodeAudioError | undefined;
  let done = 0;
  let next = 0;
  onProgress?.({ done, total: todo.length });
  const worker = async () => {
    while (next < todo.length && !ctrl.signal.aborted) {
      const p = todo[next++];
      const result = await fetchClip(p, episode.lang, ctrl.signal, hides.count);
      if (!result || ctrl.signal.aborted) return;
      try {
        const clip = result.bytes && parseMp3(result.bytes);
        if (clip && !sameFormat(clip.format, SILENCE_FORMAT)) throw new Mp3FormatError("Another mp3 format.");
        if (clip) clips.set(p.audioKey, clip);
        // No frames in the bytes: an unusable download.
        else missingBy[result.reason ?? "network"]++;
      } catch (e) {
        if (!(e instanceof Mp3FormatError)) throw e;
        failure = new EpisodeAudioError("format", `The audio of "${p.text}" is in another format.`);
        ctrl.abort();
        return;
      }
      onProgress?.({ done: ++done, total: todo.length });
    }
  };
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    signal?.removeEventListener("abort", stopAll);
    hides.stop();
  }
  if (failure) throw failure;
  if (signal?.aborted) throw aborted();

  // Join: a missing clip is left out and the gaps around it merge (the longer wins).
  const parts: BlobPart[] = [];
  const sizes: number[] = [];
  const startFrames: number[] = [];
  let waiting: number[] = [];
  let nextChapter = 0;
  let gapMs = 0;
  segments.forEach((segment, i) => {
    while (nextChapter < chapters.length && chapters[nextChapter].start <= i) waiting.push(nextChapter++);
    if (segment.kind === "gap") {
      gapMs = Math.max(gapMs, segment.ms);
      return;
    }
    const clip = clips.get(segment.playable.audioKey);
    if (!clip) return;
    if (gapMs > 0 && sizes.length) pushSilence(parts, sizes, gapMs);
    gapMs = 0;
    // A chapter starts on its first clip (after the gap that ends the previous one).
    for (const c of waiting) startFrames[c] = sizes.length;
    waiting = [];
    parts.push(...clip.parts);
    for (const size of clip.sizes) sizes.push(size);
  });
  while (nextChapter < chapters.length) waiting.push(nextChapter++);
  for (const c of waiting) startFrames[c] = sizes.length;

  return build(
    parts,
    sizes,
    chapters.map((chapter, c) => ({ ...chapter, startSec: seconds(startFrames[c]), episodeId: episode.id })),
    missingBy,
  );
}

/**
 * Several prepared episodes as one file («Escuchar seguidos»), in order, with the pause before a
 * part between two of them; every episode keeps its chapters (`episodeId`). One episode is
 * returned as it is.
 */
export function joinEpisodes(list: readonly PreparedEpisode[]): PreparedEpisode {
  if (list.length === 1) return list[0];
  const parts: BlobPart[] = [];
  const sizes: number[] = [];
  const chapters: PreparedChapter[] = [];
  const missingBy = noneMissing();
  for (const prepared of list) {
    const layout = layouts.get(prepared.blob);
    if (!layout) throw new EpisodeAudioError("format", "Only episodes made by prepareEpisode can be joined.");
    if (layout.length && sizes.length) pushSilence(parts, sizes, EPISODE_GAPS.section);
    const offset = sizes.length * FRAME_SEC;
    for (const chapter of prepared.chapters) {
      chapters.push({ ...chapter, startSec: Math.round((chapter.startSec + offset) * 1000) / 1000 });
    }
    parts.push(prepared.blob.slice(SILENT_FRAME_BYTES));
    for (const size of layout) sizes.push(size);
    for (const reason of MISSING_REASONS) missingBy[reason] += prepared.missingBy[reason];
  }
  return build(parts, sizes, chapters, missingBy);
}

/** Characters a file name cannot hold on some system. */
const NOT_IN_FILE_NAMES = new Set([..."/\\:*?\"<>|"]);

/**
 * The joined file as a `File` named after `title` («Guardar mp3»: the share sheet or a download):
 * "<title>.mp3", without characters file systems reject, at most 80 characters before ".mp3".
 */
export function episodeMp3File(blob: Blob, title: string): File {
  const clean = [...title.normalize("NFC")]
    .map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || NOT_IN_FILE_NAMES.has(c) ? " " : c))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "");
  const name = [...clean].slice(0, 80).join("").trim() || "Modo deporte";
  return new File([blob], `${name}.mp3`, { type: "audio/mpeg" });
}
