/**
 * MP3 frames for Modo deporte's joined episode (docs/sport.md "Player"): bytes only, no browser
 * API, so it runs anywhere.
 *
 * - `parseMp3` walks a clip's frame headers: drops ID3v2 tags, a Xing/Info (LAME) or VBRI frame and
 *   anything after the last whole frame (an ID3v1 tag); returns the audio frames and their sizes.
 *   Every frame lasts the same number of samples, so durations come from frame counts (exact).
 * - `SILENCE_FORMAT` is the format every clip must share (MPEG version, layer, sample rate, channel
 *   mode): edge-tts `audio-24khz-48kbitrate-mono-mp3`. Bitrates may differ from clip to clip (the
 *   pack's Gemini lines are 64 kbps): each frame header carries its own.
 * - `silenceFrames` repeats one pre-encoded silent frame (LAME, 24 kHz mono 48 kbps, 24 ms, no
 *   bit reservoir) to a gap's length.
 * - `xingFrame` writes the header frame of the joined file (frame count, byte count, seek table),
 *   so browsers know its exact duration and seek well although frames have different bitrates.
 * - `concatMp3` puts the pieces of one long voice line back together (docs/coach.md "Generated audio").
 */

export interface Mp3Format {
  version: 1 | 2 | 2.5;
  layer: 1 | 2 | 3;
  sampleRate: number;
  /** 0 stereo, 1 joint stereo, 2 dual channel, 3 mono. */
  channelMode: 0 | 1 | 2 | 3;
}

export interface Mp3Clip {
  format: Mp3Format;
  /** The audio frames' bytes in contiguous runs (tags and the Xing/Info frame left out). */
  parts: Uint8Array<ArrayBuffer>[];
  /** Byte size of every audio frame, in order. */
  sizes: number[];
}

interface FrameHeader extends Mp3Format {
  /** Frame length in bytes (header included). */
  size: number;
  crc: boolean;
}

const VERSIONS = [2.5, undefined, 2, 1] as const;
const LAYERS = [undefined, 3, 2, 1] as const;
const SAMPLE_RATES: Record<Mp3Format["version"], readonly number[]> = {
  1: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  2.5: [11025, 12000, 8000],
};
/** kbps by bitrate index (1–14). */
const BITRATES = {
  v1l1: [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  v1l2: [32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  v1l3: [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2l1: [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  v2l23: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
} as const;

/** Samples in one frame of `format`. */
export function samplesPerFrame(format: Pick<Mp3Format, "version" | "layer">): number {
  if (format.layer === 1) return 384;
  if (format.layer === 2 || format.version === 1) return 1152;
  return 576;
}

/** Length of one frame of `format`, in seconds. */
export function frameSeconds(format: Mp3Format): number {
  return samplesPerFrame(format) / format.sampleRate;
}

export function sameFormat(a: Mp3Format, b: Mp3Format): boolean {
  return a.version === b.version && a.layer === b.layer && a.sampleRate === b.sampleRate && a.channelMode === b.channelMode;
}

/** The frame header at `at`, or null when there is none (no sync, reserved or free-format values). */
function readHeader(b: Uint8Array, at: number): FrameHeader | null {
  if (at + 4 > b.length || b[at] !== 0xff || (b[at + 1] & 0xe0) !== 0xe0) return null;
  const version = VERSIONS[(b[at + 1] >> 3) & 3];
  const layer = LAYERS[(b[at + 1] >> 1) & 3];
  const bitrateIndex = b[at + 2] >> 4;
  const rateIndex = (b[at + 2] >> 2) & 3;
  if (!version || !layer || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;
  const table =
    version === 1
      ? layer === 1
        ? BITRATES.v1l1
        : layer === 2
          ? BITRATES.v1l2
          : BITRATES.v1l3
      : layer === 1
        ? BITRATES.v2l1
        : BITRATES.v2l23;
  const bitrate = table[bitrateIndex - 1] * 1000;
  const sampleRate = SAMPLE_RATES[version][rateIndex];
  const padding = (b[at + 2] >> 1) & 1;
  const size =
    layer === 1
      ? (Math.floor((12 * bitrate) / sampleRate) + padding) * 4
      : Math.floor(((layer === 3 && version !== 1 ? 72 : 144) * bitrate) / sampleRate) + padding;
  return {
    version,
    layer,
    sampleRate,
    channelMode: ((b[at + 3] >> 6) & 3) as Mp3Format["channelMode"],
    size,
    crc: (b[at + 1] & 1) === 0,
  };
}

/** Bytes of Layer III side information after the header (and its CRC). */
function sideInfoLength(f: Pick<Mp3Format, "version" | "channelMode">): number {
  const mono = f.channelMode === 3;
  return f.version === 1 ? (mono ? 17 : 32) : mono ? 9 : 17;
}

function ascii(b: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...b.subarray(at, at + length));
}

/** True for a Xing/Info (LAME) or VBRI header frame: metadata, no audio. */
function isTagFrame(b: Uint8Array, at: number, h: FrameHeader): boolean {
  if (h.layer !== 3) return false;
  const xing = at + 4 + (h.crc ? 2 : 0) + sideInfoLength(h);
  const tag = ascii(b, xing, 4);
  return tag === "Xing" || tag === "Info" || ascii(b, at + 36, 4) === "VBRI";
}

/** Bytes taken by ID3v2 tags at the start of the file. */
function id3v2Length(b: Uint8Array): number {
  let at = 0;
  while (at + 10 <= b.length && ascii(b, at, 3) === "ID3") {
    const size = ((b[at + 6] & 0x7f) << 21) | ((b[at + 7] & 0x7f) << 14) | ((b[at + 8] & 0x7f) << 7) | (b[at + 9] & 0x7f);
    at += 10 + size + (b[at + 5] & 0x10 ? 10 : 0);
  }
  return at;
}

/**
 * A frame at `at` that is followed by another frame of the same format, or that ends the file: a
 * real frame, not a stray sync pattern.
 */
function lockedHeader(b: Uint8Array, at: number, format?: Mp3Format): FrameHeader | null {
  const h = readHeader(b, at);
  if (!h || (format && !sameFormat(h, format)) || at + h.size > b.length) return null;
  if (at + h.size === b.length) return h;
  const next = readHeader(b, at + h.size);
  return next && sameFormat(next, h) ? h : null;
}

/** Error thrown by `parseMp3` for a clip whose frames do not all share one format. */
export class Mp3FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Mp3FormatError";
  }
}

/**
 * The audio frames of an mp3 file: ID3v2 tags, a leading Xing/Info/VBRI frame, junk between frames
 * and trailing tags left out. Null when it holds no frame at all (not an mp3). Throws
 * `Mp3FormatError` when its frames change format midway.
 */
export function parseMp3(bytes: Uint8Array<ArrayBuffer>): Mp3Clip | null {
  let at = Math.min(id3v2Length(bytes), bytes.length);
  let format: Mp3Format | undefined;
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const sizes: number[] = [];
  let runStart = -1;
  const closeRun = (end: number) => {
    if (runStart >= 0 && end > runStart) parts.push(bytes.subarray(runStart, end));
    runStart = -1;
  };
  while (at < bytes.length) {
    const h = format ? readHeader(bytes, at) : null;
    if (h && sameFormat(h, format!) && at + h.size <= bytes.length) {
      if (runStart < 0) runStart = at;
      sizes.push(h.size);
      at += h.size;
      continue;
    }
    if (h && at + h.size <= bytes.length && lockedHeader(bytes, at)) {
      throw new Mp3FormatError("The frames of this mp3 change format.");
    }
    // Out of sync (first frame, junk, a trailing tag): look for the next real frame.
    closeRun(at);
    let found: FrameHeader | null = null;
    while (at < bytes.length && !(found = lockedHeader(bytes, at, format))) at++;
    if (!found) break;
    if (!format) {
      format = { version: found.version, layer: found.layer, sampleRate: found.sampleRate, channelMode: found.channelMode };
      if (isTagFrame(bytes, at, found)) {
        at += found.size;
        continue;
      }
    }
    runStart = at;
    sizes.push(found.size);
    at += found.size;
  }
  closeRun(at);
  return format && sizes.length ? { format, parts, sizes } : null;
}

/**
 * One silent frame from LAME (`-write_xing 0 -id3v2_version 0`): MPEG-2 Layer III, 24 kHz mono,
 * 48 kbps, 144 bytes, 24 ms; `main_data_begin` 0 (needs no bit reservoir), so it can be repeated
 * and put between any clips.
 */
const SILENT_FRAME = "//NkxAAAAANIAAAAAExBTUVVVVVMQU1FNC4wVVVV" + "V".repeat(152); // the rest is 0x55 fill

let silent: Uint8Array<ArrayBuffer> | undefined;
function silentFrame(): Uint8Array<ArrayBuffer> {
  if (!silent) {
    const raw = atob(SILENT_FRAME);
    silent = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) silent[i] = raw.charCodeAt(i);
  }
  return silent;
}

/** The format every clip of an episode must have: the silent frame's (edge-tts). */
export const SILENCE_FORMAT: Mp3Format = { version: 2, layer: 3, sampleRate: 24000, channelMode: 3 };
/** Bytes of one silent frame. */
export const SILENT_FRAME_BYTES = 144;

const silences = new Map<number, Uint8Array<ArrayBuffer>>();

/** Silent frames for `ms` (rounded to whole 24 ms frames, at least one). */
export function silenceFrames(ms: number): { bytes: Uint8Array<ArrayBuffer>; frames: number } {
  const frames = Math.max(1, Math.round(ms / 1000 / frameSeconds(SILENCE_FORMAT)));
  let bytes = silences.get(frames);
  if (!bytes) {
    const one = silentFrame();
    bytes = new Uint8Array(one.length * frames);
    for (let i = 0; i < frames; i++) bytes.set(one, i * one.length);
    silences.set(frames, bytes);
  }
  return { bytes, frames };
}

/**
 * The Xing header frame for a stream of SILENCE_FORMAT frames whose sizes are `sizes` (in order,
 * the header frame not included): frame count, byte count (header frame included) and the
 * 100-entry seek table. A decoder that ignores it plays it as one silent frame.
 */
export function xingFrame(sizes: ArrayLike<number>): Uint8Array<ArrayBuffer> {
  const frame = new Uint8Array(SILENT_FRAME_BYTES);
  frame.set(silentFrame().subarray(0, 4)); // same header; side info all zero = silence
  const view = new DataView(frame.buffer);
  const at = 4 + sideInfoLength(SILENCE_FORMAT);
  const count = sizes.length;
  let total = frame.length;
  for (let i = 0; i < count; i++) total += sizes[i];
  [..."Xing"].forEach((c, i) => (frame[at + i] = c.charCodeAt(0)));
  view.setUint32(at + 4, 0x7); // frames, bytes and seek table present
  view.setUint32(at + 8, count);
  view.setUint32(at + 12, total);
  // Seek table: entry i = where i % of the duration starts, as a fraction (0–255) of the bytes.
  let frameIndex = 0;
  let offset = frame.length;
  for (let i = 0; i < 100; i++) {
    const target = Math.floor((i * count) / 100);
    while (frameIndex < target) offset += sizes[frameIndex++];
    frame[at + 16 + i] = Math.min(255, Math.floor((offset * 256) / total));
  }
  return frame;
}

/**
 * Several mp3 files as one, played back to back with no silence added (the pieces of one long
 * voice line, `splitSpokenText`): their audio frames without tags or header frames, behind a Xing
 * frame when they are in SILENCE_FORMAT (edge-tts). Files that are not mp3s of one format are
 * just concatenated (a browser still plays them; Modo deporte's joiner then reports `format`).
 */
export function concatMp3(files: readonly Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  let clips: Mp3Clip[] | null = [];
  for (const file of files) {
    let clip: Mp3Clip | null = null;
    try {
      clip = parseMp3(file);
    } catch (e) {
      if (!(e instanceof Mp3FormatError)) throw e;
    }
    if (!clip || (clips.length && !sameFormat(clip.format, clips[0].format))) {
      clips = null;
      break;
    }
    clips.push(clip);
  }
  const chunks: Uint8Array<ArrayBuffer>[] = clips ? clips.flatMap((clip) => clip.parts) : [...files];
  if (clips?.length && sameFormat(clips[0].format, SILENCE_FORMAT)) chunks.unshift(xingFrame(clips.flatMap((clip) => clip.sizes)));
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
