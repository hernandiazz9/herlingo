/**
 * Preparing an episode (docs/sport.md "Player", "Offline", "Save mp3"): download every clip of the
 * compiled episode, check that they share one format and join them byte by byte, with silent
 * frames for the gaps, into one mp3 with exact chapter times. Rebuilt from the cached clips each
 * time; nothing here is stored.
 *
 * Content lines come from their mp3 (`fetch`: the service worker's audio cache answers offline);
 * generated lines (narrator, slow, Prepárate lines) from `generatedBytes` (Cache Storage, else
 * `/api/coach/tts/` once, with a patient deadline). Never the device voice.
 *
 * While the page is hidden (screen locked, app in the background) no clip starts, and a clip that
 * failed while it was hidden is fetched again once it is visible (iOS fails fetches at once in the
 * background): only failures while visible count towards `missing`, each with its reason.
 */
import { generatedBytes, generatedFailure, isGenerated, mp3UrlWhenReady, type GeneratedFailure } from "@/lib/audio";
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

/** Why clips were left out, and how many for each reason (they add up to `missing`). */
export type MissingReasons = Partial<Record<GeneratedFailure, number>>;

export interface PreparedEpisode {
  /** The joined mp3 (`audio/mpeg`). */
  blob: Blob;
  /** In play order: per episode, the opening, one per step, the final scene. */
  chapters: PreparedChapter[];
  /** Exact, from the frame count. */
  durationSec: number;
  /** Clips (distinct lines) that could not be fetched and were left out. */
  missing: number;
  /** Why they were left out. */
  reasons: MissingReasons;
}

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
/** Failed attempts after which a clip is left out; attempts the hidden page spoiled do not count. */
const ATTEMPTS = 3;
/** Pause before each retry (ms), growing: a busy voice service gets time to recover. */
const RETRY_PAUSES_MS = [2_000, 6_000];
/** Reasons a retry now cannot fix: the clip is left out at once. */
const NO_RETRY: ReadonlySet<GeneratedFailure> = new Set(["limit", "access", "offline"]);
/**
 * Clips left out in a row after which the rest are not tried (the service is down or the day's
 * allowance is used up): they are left out at once under the last reason.
 */
const GIVE_UP_STREAK = 5;

/** Frame sizes of each prepared blob (its body = the blob minus the Xing frame), for `joinEpisodes`. */
const layouts = new WeakMap<Blob, Uint16Array>();

const FRAME_SEC = frameSeconds(SILENCE_FORMAT);
const seconds = (frames: number) => Math.round(frames * FRAME_SEC * 1000) / 1000;

/** The joined file: Xing frame + frames; its sizes kept for `joinEpisodes`. */
function build(
  parts: BlobPart[],
  sizes: number[],
  chapters: PreparedChapter[],
  missing: number,
  reasons: MissingReasons,
): PreparedEpisode {
  const layout = Uint16Array.from(sizes);
  const blob = new Blob([xingFrame(layout), ...parts], { type: "audio/mpeg" });
  layouts.set(blob, layout);
  return { blob, chapters, durationSec: seconds(sizes.length), missing, reasons };
}

function countReason(reasons: MissingReasons, reason: GeneratedFailure, by = 1): void {
  if (by > 0) reasons[reason] = (reasons[reason] ?? 0) + by;
}

function pushSilence(parts: BlobPart[], sizes: number[], ms: number): void {
  const { bytes, frames } = silenceFrames(ms);
  parts.push(bytes);
  for (let i = 0; i < frames; i++) sizes.push(SILENT_FRAME_BYTES);
}

/** A clip's bytes, or why there are none. */
type ClipAttempt = { bytes: Uint8Array<ArrayBuffer> } | { failure: GeneratedFailure };

const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/** One attempt at a clip's bytes. Never rejects. */
async function clipBytes(p: Playable, lang: string, signal: AbortSignal): Promise<ClipAttempt> {
  if (isGenerated(p)) {
    const bytes = await generatedBytes(p, signal, { patient: true });
    return bytes ? { bytes } : { failure: generatedFailure(p) ?? "other" };
  }
  const url = await mp3UrlWhenReady(lang, p.audioKey);
  if (!url || signal.aborted) return { failure: "other" };
  try {
    const res = await fetch(url, { signal });
    return res.ok ? { bytes: new Uint8Array(await res.arrayBuffer()) } : { failure: "server" };
  } catch {
    return { failure: offline() ? "offline" : "network" };
  }
}

/** Resolves after `ms`, or at once when `signal` aborts. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

/**
 * A clip's bytes, or the reason of its last failure after `ATTEMPTS` failed attempts (at once for
 * a `NO_RETRY` reason; `RETRY_PAUSES_MS` between attempts). Each attempt starts only while the
 * page is visible; one that fails while the page is hidden, or that it went hidden during, does
 * not count and is made again once the page is visible.
 */
async function fetchClip(p: Playable, lang: string, signal: AbortSignal, hides: () => number): Promise<ClipAttempt> {
  let failure: GeneratedFailure = "other";
  for (let failed = 0; failed < ATTEMPTS; ) {
    await whenPageVisible(signal);
    if (signal.aborted) break;
    const before = hides();
    const attempt = await clipBytes(p, lang, signal);
    if ("bytes" in attempt || signal.aborted) return attempt;
    if (pageHidden() || hides() !== before) continue;
    failure = attempt.failure;
    failed++;
    if (NO_RETRY.has(failure) || failed >= ATTEMPTS) break;
    await pause(RETRY_PAUSES_MS[failed - 1] ?? 0, signal);
  }
  return { failure };
}

const aborted = () => new DOMException("The episode was not prepared.", "AbortError");

/**
 * Downloads every clip of `episode` (3 at a time, `ATTEMPTS` each, paused while the page is
 * hidden) and joins them into one mp3. A clip that cannot be fetched while the page is visible is
 * left out (its gaps merge) and counted in `missing` under its reason (`reasons`); after
 * `GIVE_UP_STREAK` clips left out in a row the rest are left out without trying. Rejects with
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
  const ctrl = new AbortController();
  const stopAll = () => ctrl.abort();
  signal?.addEventListener("abort", stopAll, { once: true });
  const hides = countHides();
  const reasons: MissingReasons = {};
  let failure: EpisodeAudioError | undefined;
  let done = 0;
  let next = 0;
  let streak = 0;
  let lastReason: GeneratedFailure = "other";
  onProgress?.({ done, total: todo.length });
  const worker = async () => {
    while (next < todo.length && !ctrl.signal.aborted && streak < GIVE_UP_STREAK) {
      const p = todo[next++];
      const attempt = await fetchClip(p, episode.lang, ctrl.signal, hides.count);
      if (ctrl.signal.aborted) return;
      try {
        const clip = "bytes" in attempt ? parseMp3(attempt.bytes) : null;
        if (clip && !sameFormat(clip.format, SILENCE_FORMAT)) throw new Mp3FormatError("Another mp3 format.");
        if (clip) {
          clips.set(p.audioKey, clip);
          streak = 0;
        } else {
          lastReason = "failure" in attempt ? attempt.failure : "other";
          countReason(reasons, lastReason);
          streak++;
        }
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
  // Not tried after too many clips left out in a row.
  countReason(reasons, lastReason, todo.length - next);

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
    todo.length - clips.size,
    reasons,
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
  const reasons: MissingReasons = {};
  let missing = 0;
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
    missing += prepared.missing;
    for (const reason of Object.keys(prepared.reasons) as GeneratedFailure[]) {
      countReason(reasons, reason, prepared.reasons[reason] ?? 0);
    }
  }
  return build(parts, sizes, chapters, missing, reasons);
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
