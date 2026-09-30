/**
 * Pre-generated mp3 backend (`npm run audio` → public/audio/<lang>/). Client-only.
 *
 * One shared <audio> element: iOS unlocks playback per element, on a user gesture, so we keep
 * reusing the one that `unlockOnFirstGesture()` primed.
 */

export type Mp3Result = "ended" | "failed" | "interrupted";

type Manifest = Record<string, string>;

const manifests = new Map<string, Manifest>();
const loading = new Set<string>();

let el: HTMLAudioElement | null = null;
let settle: ((r: Mp3Result) => void) | null = null;

/** 30 ms of silence (8 kHz 8-bit mono WAV), used to unlock the element on iOS. */
const SILENCE =
  "data:audio/wav;base64,UklGRhQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YfAAAAC" + "AgIC".repeat(80) + "A";

export function mp3Available(): boolean {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

/** Starts fetching `/audio/<lang>/manifest.json` once. Missing manifest = no mp3 (TTS only). */
export function preloadManifest(lang: string): void {
  if (!mp3Available() || manifests.has(lang) || loading.has(lang)) return;
  loading.add(lang);
  fetch(`/audio/${lang}/manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
    .catch(() => null)
    .then((m) => {
      loading.delete(lang);
      // A failed fetch (offline, not cached yet) is retried on the next call.
      if (m) manifests.set(lang, m);
    });
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

export function mp3Stop(): void {
  const s = settle;
  settle = null;
  if (el) {
    el.onended = null;
    el.onerror = null;
    el.pause();
  }
  s?.("interrupted");
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
    if (!settle) {
      a.src = SILENCE;
      a.play()
        .then(() => {
          if (!settle) a.pause();
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
