/**
 * On-device diagnostics log of listen sessions: localStorage `lang-lern:speech-log`,
 * `{ v: 1, entries }`, newest last, at most 50 entries. No transcript text is stored.
 * Reads are tolerant (bad JSON or bad entries are dropped); this module never touches other keys.
 */
import type { BrowserFamily } from "./platform";
import type { ListenErrorKind } from "./messages";

export const SPEECH_LOG_KEY = "lang-lern:speech-log";
export const SPEECH_LOG_VERSION = 1;
export const SPEECH_LOG_MAX = 50;
const EVENT = "lang-lern:speech-log";

/** Why a session ended. */
export type ListenEndReason =
  | "silence" // auto-stop after silence following speech
  | "finish" // finish() called (tap to finish)
  | "cap" // hard cap reached
  | "ended" // the browser ended on its own (onend)
  | "end-timeout" // onend never came after stopping: aborted and settled with what was heard
  | "no-speech" // nothing heard within noSpeechMs of listening
  | "start-timeout" // never reached listening
  | "cancel" // cancel() called
  | "replaced" // another session started
  | "hidden" // page went to the background
  | "error"; // the browser reported an error

export interface SpeechLogEntry {
  /** ISO time the session started. */
  at: string;
  locale: string;
  mode: "phrase" | "long";
  /** Milliseconds from start() to entering each state (absent = never reached). */
  timings: Partial<Record<"listening" | "hearing" | "processing" | "end", number>>;
  reason: ListenEndReason;
  outcome: "done" | "error";
  error?: ListenErrorKind;
  /** Raw browser error code, when there was one (e.g. "service-not-allowed"). */
  code?: string;
  /** Length in characters of the final transcript (0 on error). */
  chars: number;
  alternatives: number;
  standalone: boolean;
  browser: BrowserFamily;
}

interface Stored {
  v: number;
  entries: SpeechLogEntry[];
}

function isEntry(e: unknown): e is SpeechLogEntry {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.at === "string" &&
    typeof o.locale === "string" &&
    (o.mode === "phrase" || o.mode === "long") &&
    typeof o.reason === "string" &&
    (o.outcome === "done" || o.outcome === "error") &&
    !!o.timings &&
    typeof o.timings === "object"
  );
}

/** Every logged session, oldest first (empty when missing, unreadable or on the server). */
export function readSpeechLog(): SpeechLogEntry[] {
  try {
    const raw = window.localStorage.getItem(SPEECH_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Stored> | null;
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return entries.filter(isEntry).slice(-SPEECH_LOG_MAX);
  } catch {
    return [];
  }
}

export function appendSpeechLog(entry: SpeechLogEntry): void {
  try {
    const entries = [...readSpeechLog(), entry].slice(-SPEECH_LOG_MAX);
    const stored: Stored = { v: SPEECH_LOG_VERSION, entries };
    window.localStorage.setItem(SPEECH_LOG_KEY, JSON.stringify(stored));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage unavailable or full: diagnostics are best effort.
  }
}

/** Removes only `lang-lern:speech-log`. */
export function clearSpeechLog(): void {
  try {
    window.localStorage.removeItem(SPEECH_LOG_KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Nothing to clear.
  }
}

/** Notifies on every append/clear in this tab and on changes from other tabs. */
export function subscribeSpeechLog(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SPEECH_LOG_KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
