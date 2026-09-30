/**
 * "No puedo hablar ahora": turns speaking exercises off for a while, on this device only.
 * Stored in localStorage. React: `useSyncExternalStore(subscribeSpeakingPause, speakingPausedUntil, () => 0)`.
 */

export const SPEAKING_PAUSE_MINUTES = 15;
const KEY = "lang_lern:speaking-paused-until";
const EVENT = "lang_lern:speaking-pause";

/** Epoch ms until which speaking is paused (0 = not paused). */
export function speakingPausedUntil(): number {
  try {
    const v = Number(window.localStorage.getItem(KEY) ?? 0);
    return Number.isFinite(v) && v > Date.now() ? v : 0;
  } catch {
    return 0;
  }
}

export function isSpeakingPaused(): boolean {
  return speakingPausedUntil() > 0;
}

function write(value: number) {
  try {
    if (value) window.localStorage.setItem(KEY, String(value));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode): nothing to persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Pauses speaking exercises for `minutes` (default 15). */
export function pauseSpeaking(minutes = SPEAKING_PAUSE_MINUTES): void {
  write(Date.now() + minutes * 60_000);
}

export function resumeSpeaking(): void {
  write(0);
}

export function subscribeSpeakingPause(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
