/**
 * «Escuchar todo» as one file (docs/coach.md "«Escuchar todo»"): every line's mp3 joined, with
 * silent frames between lines, so it keeps playing with the screen locked (iOS stops a chain of
 * clips there). Built with Modo deporte's joiner pieces (`@/lib/sport/mp3-frames`: the frame
 * parser, the silent frames, the Xing frame with the exact duration and seek table). Client-only;
 * nothing is stored: rebuilt from the cached clips each time.
 */
import { getPack, stripStress } from "@/lib/content";
import { getActiveLang } from "@/lib/content/active";
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
} from "@/lib/sport/mp3-frames";
import { generatedBytes, isGenerated } from "./generated";
import type { SequenceLine } from "./index";
import { mp3UrlWhenReady } from "./mp3";

export interface JoinedLines {
  /** The joined mp3 (`audio/mpeg`), played at rate 1. */
  blob: Blob;
  /** Where each line starts, in seconds (exact, from frame counts). */
  starts: number[];
  durationSec: number;
}

export interface JoinLinesOptions {
  /** Silence between two lines, in ms. */
  gapMs?: number;
  /** Generated lines only from the device (memory, Cache Storage): no download. */
  cachedOnly?: boolean;
  /** Aborting resolves null. */
  signal?: AbortSignal;
}

/** Clips fetched at the same time. */
const CONCURRENCY = 3;

const FRAME_SEC = frameSeconds(SILENCE_FORMAT);
const seconds = (frames: number) => Math.round(frames * FRAME_SEC * 1000) / 1000;

/** What `speak(input, options)` would play as an mp3, as bytes; null when it would use the device voice. */
async function lineBytes(line: SequenceLine, cachedOnly: boolean, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer> | null> {
  const { input, options = {} } = line;
  // A free text has no mp3; a slow line plays at another rate (one file has one).
  if (typeof input === "string" || options.slow) return null;
  const { meta } = getPack(options.lang ?? getActiveLang() ?? undefined);
  if (isGenerated(input)) {
    // As `speak()` sends it to the voice: stress marks stripped from a target-language line.
    const text = options.locale ? input.text : stripStress(input.text, meta);
    return generatedBytes({ ...input, text }, signal, { cachedOnly });
  }
  const url = await mp3UrlWhenReady(meta.lang, input.audioKey);
  if (!url || signal.aborted) return null;
  try {
    const res = await fetch(url, { signal });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

const lineKey = ({ input }: SequenceLine) => (typeof input === "string" ? `text:${input}` : input.audioKey);

/**
 * `lines` (each as `speak()` would play it) joined into one mp3, `gapMs` of silence between two
 * lines. Null when any line has no mp3 to join (the device voice would read it, it cannot be
 * fetched, it is slow, or its mp3 is not in the edge-tts format of the silent frames): play them
 * one by one then (`speakSequence`). Never rejects.
 */
export async function joinLines(lines: readonly SequenceLine[], options: JoinLinesOptions = {}): Promise<JoinedLines | null> {
  const { gapMs = 0, cachedOnly = false, signal } = options;
  if (!lines.length || signal?.aborted) return null;
  const todo = [...new Map(lines.map((line) => [lineKey(line), line] as const))];
  const clips = new Map<string, Mp3Clip>();
  const ctrl = new AbortController();
  const stopAll = () => ctrl.abort();
  signal?.addEventListener("abort", stopAll, { once: true });
  let next = 0;
  // The first line without an mp3 ends it: the lines are then played one by one.
  const worker = async () => {
    while (next < todo.length && !ctrl.signal.aborted) {
      const [key, line] = todo[next++];
      const bytes =
        (await lineBytes(line, cachedOnly, ctrl.signal)) ??
        (ctrl.signal.aborted ? null : await lineBytes(line, cachedOnly, ctrl.signal));
      if (ctrl.signal.aborted) return;
      let clip: Mp3Clip | null = null;
      try {
        clip = bytes && parseMp3(bytes);
      } catch (e) {
        if (!(e instanceof Mp3FormatError)) throw e;
      }
      if (!clip || !sameFormat(clip.format, SILENCE_FORMAT)) return ctrl.abort();
      clips.set(key, clip);
    }
  };
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } catch {
    return null;
  } finally {
    signal?.removeEventListener("abort", stopAll);
  }
  if (ctrl.signal.aborted || clips.size < todo.length) return null;

  const parts: BlobPart[] = [];
  const sizes: number[] = [];
  const starts: number[] = [];
  for (const line of lines) {
    if (sizes.length && gapMs > 0) {
      const { bytes, frames } = silenceFrames(gapMs);
      parts.push(bytes);
      for (let i = 0; i < frames; i++) sizes.push(SILENT_FRAME_BYTES);
    }
    starts.push(seconds(sizes.length));
    const clip = clips.get(lineKey(line))!;
    parts.push(...clip.parts);
    for (const size of clip.sizes) sizes.push(size);
  }
  return {
    blob: new Blob([xingFrame(sizes), ...parts], { type: "audio/mpeg" }),
    starts,
    durationSec: seconds(sizes.length),
  };
}
