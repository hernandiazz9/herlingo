/**
 * The only place in `src/` that touches the `SpeechRecognition` / `webkitSpeechRecognition`
 * globals, plus small platform probes used by the engine and its diagnostics.
 */

export interface RecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}
export interface RecognitionResultLike extends ArrayLike<RecognitionAlternativeLike> {
  isFinal?: boolean;
}
export interface RecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<RecognitionResultLike>;
}
export interface RecognitionErrorEventLike {
  error: string;
  message?: string;
}
export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: RecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionCtor = new () => RecognitionLike;

export function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** True when this browser can do speech recognition (false on the server). */
export function canRecognize(): boolean {
  return recognitionCtor() !== undefined;
}

/** True when running as the installed app (home-screen PWA), false in a browser tab or on the server. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
    return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  } catch {
    return false;
  }
}

export type BrowserFamily =
  | "ios-safari"
  | "ios-chrome"
  | "ios-other"
  | "android-chrome"
  | "android-other"
  | "edge"
  | "chrome"
  | "safari"
  | "firefox"
  | "other";

/** Coarse browser family from the user agent (no version, nothing identifying). */
export function browserFamily(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): BrowserFamily {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
  if (ios) {
    if (/CriOS/.test(ua)) return "ios-chrome";
    if (/FxiOS|EdgiOS|OPiOS/.test(ua)) return "ios-other";
    return "ios-safari";
  }
  if (/Android/.test(ua)) return /Chrome\//.test(ua) && !/EdgA|SamsungBrowser|OPR/.test(ua) ? "android-chrome" : "android-other";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}
