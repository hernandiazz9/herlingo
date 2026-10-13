/**
 * Pre-generated mp3 backend (`npm run audio` → public/audio/<lang>/). Client-only.
 *
 * One shared <audio> element: iOS unlocks playback per element, on a user gesture, so we keep
 * reusing the one that `unlockOnFirstGesture()` primed. Short lines play with `mp3Play`; a long
 * file the learner pauses and seeks (Modo deporte's episode) with `mp3Media`.
 */

export type Mp3Result = "ended" | "failed" | "interrupted";

type Manifest = Record<string, string>;

const manifests = new Map<string, Manifest>();
const loading = new Map<string, Promise<void>>();

let el: HTMLAudioElement | null = null;
let settle: ((r: Mp3Result) => void) | null = null;
/** The long media on the shared element (`mp3Media`), until something else takes it. */
let media: { release: (notify: boolean) => void } | null = null;

/** 30 ms of silence (8 kHz 8-bit mono WAV), used to unlock the element on iOS. */
const SILENCE =
  "data:audio/wav;base64,UklGRhQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YfAAAAC" + "AgIC".repeat(80) + "A";

export function mp3Available(): boolean {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

/** Starts fetching `/audio/<lang>/manifest.json` once. Missing manifest = no mp3 (TTS only). */
export function preloadManifest(lang: string): void {
  if (!mp3Available() || manifests.has(lang) || loading.has(lang)) return;
  loading.set(
    lang,
    fetch(`/audio/${lang}/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
      .catch(() => null)
      .then((m) => {
        loading.delete(lang);
        // A failed fetch (offline, not cached yet) is retried on the next call.
        if (m) manifests.set(lang, m);
      }),
  );
}

/**
 * URL of the mp3 for `audioKey` once the manifest of `lang` has loaded (fetched now if needed);
 * undefined when the line has no mp3 or the manifest cannot be loaded. Never rejects.
 */
export async function mp3UrlWhenReady(lang: string, audioKey: string): Promise<string | undefined> {
  preloadManifest(lang);
  await loading.get(lang);
  return mp3Url(lang, audioKey);
}

/** URL of the mp3 for `audioKey`, or undefined (not generated, or manifest not loaded yet). */
export function mp3Url(lang: string, audioKey: string): string | undefined {
  preloadManifest(lang);
  const file = manifests.get(lang)?.[audioKey];
  return file ? `/audio/${lang}/${file}` : undefined;
}

function element(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = "auto";
  }
  return el;
}

/** Plays `url` at `rate`. Resolves when it ends, fails (caller falls back) or is stopped. */
export function mp3Play(url: string, rate: number): Promise<Mp3Result> {
  mp3Stop();
  const a = element();
  return new Promise<Mp3Result>((resolve) => {
    const done = (r: Mp3Result) => {
      if (settle !== done) return;
      settle = null;
      a.onended = null;
      a.onerror = null;
      resolve(r);
    };
    settle = done;
    a.onended = () => done("ended");
    a.onerror = () => done("failed");
    a.src = url;
    a.defaultPlaybackRate = rate;
    a.playbackRate = rate;
    a.preservesPitch = true;
    a.play().catch(() => done("failed"));
  });
}

const silences = new Map<number, string>();

/**
 * Object URL of `ms` of silence (8 kHz 8-bit mono WAV, ~8 KB per second), made once per length,
 * for `mp3Play`. Undefined where there is no audio element.
 */
export function mp3Silence(ms: number): string | undefined {
  if (!mp3Available() || typeof URL.createObjectURL !== "function") return undefined;
  const length = Math.max(1, Math.round(ms));
  const known = silences.get(length);
  if (known) return known;
  const samples = Math.round((8000 * length) / 1000);
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true); // sample rate
  view.setUint32(28, 8000, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(0x80, 44); // 8-bit PCM silence is the midpoint
  const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  silences.set(length, url);
  return url;
}

export function mp3Stop(): void {
  media?.release(true);
  const s = settle;
  settle = null;
  if (el) {
    el.onended = null;
    el.onerror = null;
    el.pause();
  }
  s?.("interrupted");
}

/** What happens to the long media on the shared element (`mp3Media`). */
export interface Mp3MediaEvents {
  /** Position, duration or play/pause changed: the element's event type ("timeupdate", "pause"…). */
  onChange: (type: string) => void;
  onEnded: () => void;
  onError: () => void;
  /** Something else took the element (`speak()`, `stop()`, another media): this media is gone. */
  onReleased: () => void;
}

/** A long mp3 (Modo deporte's joined episode) on the shared element: play, pause, seek. */
export interface Mp3Media {
  /** Starts or resumes; call it inside a user gesture. Resolves false when the browser refused. */
  play(): Promise<boolean>;
  pause(): void;
  /** Jumps to `sec` (applied once the file's metadata has loaded). */
  seek(sec: number): void;
  /** Position in seconds. */
  time(): number;
  paused(): boolean;
  /** True until something else takes the element or `release()` is called. */
  active(): boolean;
  /** Pauses and lets the element go (no `onReleased`). */
  release(): void;
}

const MEDIA_CHANGES = ["timeupdate", "seeked", "play", "pause", "playing", "loadedmetadata", "durationchange"] as const;

/**
 * Puts the long mp3 at `url` on the shared, gesture-unlocked element, at `startSec`, at rate 1,
 * stopping whatever played. Nothing plays until `play()`. Any later `mp3Play()` / `mp3Stop()`
 * (`speak()`, `stop()`) or `mp3Media()` releases it (`onReleased`).
 */
export function mp3Media(url: string, events: Mp3MediaEvents, startSec = 0): Mp3Media {
  mp3Stop();
  const a = element();
  const listeners = new AbortController();
  const on = { signal: listeners.signal };
  /** Where to go once the metadata is in (seeking before it is not reliable everywhere). */
  let pending: number | undefined = startSec > 0 ? startSec : undefined;
  const me = {
    release(notify: boolean) {
      if (media !== me) return;
      media = null;
      listeners.abort();
      a.pause();
      if (notify) events.onReleased();
    },
  };
  const active = () => media === me;
  const applyPending = () => {
    if (pending === undefined || a.readyState < HTMLMediaElement.HAVE_METADATA) return;
    a.currentTime = pending;
    pending = undefined;
  };
  a.addEventListener("loadedmetadata", applyPending, on);
  for (const type of MEDIA_CHANGES) a.addEventListener(type, () => events.onChange(type), on);
  a.addEventListener("ended", () => events.onEnded(), on);
  a.addEventListener("error", () => events.onError(), on);
  a.src = url;
  a.defaultPlaybackRate = 1;
  a.playbackRate = 1;
  a.preservesPitch = true;
  media = me;
  return {
    play: () => (active() ? a.play().then(() => true, () => false) : Promise.resolve(false)),
    pause: () => {
      if (active()) a.pause();
    },
    seek: (sec) => {
      if (!active()) return;
      pending = sec;
      applyPending();
    },
    time: () => (active() ? (pending ?? a.currentTime) : 0),
    paused: () => !active() || a.paused,
    active,
    release: () => me.release(false),
  };
}

/**
 * iOS only lets audio start inside a user gesture. On the first tap/key anywhere, prime the
 * shared <audio> element and speechSynthesis so later playback (including the TTS fallback that
 * starts after an mp3 fails asynchronously) is allowed.
 */
export function unlockOnFirstGesture(): void {
  if (!mp3Available()) return;
  const events = ["touchend", "click", "keydown"] as const;
  const unlock = () => {
    events.forEach((e) => document.removeEventListener(e, unlock, true));
    const a = element();
    if (!settle && !media) {
      a.src = SILENCE;
      a.play()
        .then(() => {
          if (!settle && !media) a.pause();
        })
        .catch(() => {});
    }
    if ("speechSynthesis" in window && !window.speechSynthesis.speaking) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  };
  // Capture phase: runs before the tapped button's own handler (which may call speak()).
  events.forEach((e) => document.addEventListener(e, unlock, { capture: true, passive: true }));
}
