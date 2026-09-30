/**
 * Learner settings stored on the device (all packs): slow audio by default, speaking exercises.
 * Framework-free. React: `useSettings()` from `./use-progress`.
 */

export interface Settings {
  /** Play target-language audio slowly everywhere (the "Lento" buttons are always slow). */
  slowAudio: boolean;
  /** Include "say it aloud" exercises in lessons and reviews. */
  speaking: boolean;
}

export const SETTINGS_KEY = "lang-lern:settings";
export const SETTINGS_EVENT = "lang-lern:settings-change";
const VERSION = 1;

export const DEFAULT_SETTINGS: Settings = { slowAudio: false, speaking: true };

export function readSettingsRaw(): string {
  try {
    return window.localStorage.getItem(SETTINGS_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Tolerant: unknown, missing or corrupt values fall back to the defaults. */
export function parseSettings(raw: string): Settings {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw) return out;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return out;
    const o = v as Record<string, unknown>;
    if (typeof o.slowAudio === "boolean") out.slowAudio = o.slowAudio;
    if (typeof o.speaking === "boolean") out.speaking = o.speaking;
  } catch {
    // Corrupt JSON: defaults.
  }
  return out;
}

export function getSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  return parseSettings(readSettingsRaw());
}

export function updateSettings(patch: Partial<Settings>): void {
  const next = { ...getSettings(), ...patch };
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ v: VERSION, ...next }));
  } catch {
    // Storage unavailable (private mode): nothing to persist.
  }
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function subscribeSettings(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SETTINGS_KEY) onChange();
  };
  window.addEventListener(SETTINGS_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
