/**
 * Offline audio of the active language (client only). The service worker keeps one cache per
 * language (`lang-lern-audio-<lang>`, see scripts/pwa/sw.template.js) and fills only the active
 * language's; this module tells it which one (`postMessage`, at start and on every switch) and
 * reports its progress:
 *
 *   import { getAudioProgress, subscribeAudioProgress, useAudioProgress } from "@/lib/pwa/audio-cache";
 *   const { lang, total, cached, state } = useAudioProgress(lang);
 *
 * `state`: "idle" (no news from the SW yet), "downloading", "ready" (every file of the language is
 * on the device), "error" (stopped: offline or server unreachable; resumes when the app comes back
 * to the foreground or the language is chosen again), "unavailable" (no service worker: dev, http
 * on a LAN address, unsupported browser; audio streams from the network).
 *
 * Nothing here reads or writes localStorage keys other than through `getActiveLang()`, and the SW
 * never deletes anything but older precaches and, after a switch completed, the other languages'
 * audio caches.
 */
import { useSyncExternalStore } from "react";
import { getActiveLang, subscribeActiveLang } from "@/lib/content/active";
import { AUDIO_PROGRESS, AUDIO_SET_LANG } from "./audio-constants";

export type AudioCacheState = "idle" | "downloading" | "ready" | "error" | "unavailable";

export interface AudioCacheProgress {
  lang: string | null;
  /** Files of the language (its mp3s + manifest); 0 until the SW reports. */
  total: number;
  /** Files already in its audio cache. */
  cached: number;
  state: AudioCacheState;
}

const progress = new Map<string, AudioCacheProgress>();
const listeners = new Set<() => void>();
let supported: boolean | null = null;
let started = false;
let posted: string | null = null;

const NONE: AudioCacheProgress = { lang: null, total: 0, cached: 0, state: "idle" };
const SERVER: AudioCacheProgress = { lang: null, total: 0, cached: 0, state: "unavailable" };

function swSupported(): boolean {
  if (supported === null) {
    supported =
      typeof navigator !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production";
  }
  return supported;
}

function emit() {
  listeners.forEach((l) => l());
}

/** Progress for `lang` (default: the active language). Stable object until it changes. */
export function getAudioProgress(lang: string | null = getActiveLang()): AudioCacheProgress {
  if (!lang) return NONE;
  let p = progress.get(lang);
  if (!p) {
    p = { lang, total: 0, cached: 0, state: swSupported() ? "idle" : "unavailable" };
    progress.set(lang, p);
  }
  return p;
}

export function subscribeAudioProgress(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** React: progress of `lang` (default: the active language at render time). */
export function useAudioProgress(lang?: string | null): AudioCacheProgress {
  return useSyncExternalStore(
    subscribeAudioProgress,
    () => getAudioProgress(lang === undefined ? getActiveLang() : lang),
    () => SERVER,
  );
}

function post(lang: string) {
  posted = lang;
  navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ type: AUDIO_SET_LANG, lang }))
    .catch(() => {});
}

/** Tells the SW the active language (no-op on first launch, before a language is picked). */
function sync(force = false) {
  const lang = getActiveLang();
  if (!lang || (!force && lang === posted)) return;
  post(lang);
}

/**
 * Starts keeping the active language's audio offline. Called once by the SW registration
 * (`UpdatePrompt`); later calls do nothing.
 */
export function startAudioSync(): void {
  if (started || !swSupported()) return;
  started = true;
  const sw = navigator.serviceWorker;
  sw.addEventListener("message", (event: MessageEvent) => {
    const d: unknown = event.data;
    if (!d || typeof d !== "object") return;
    const m = d as Record<string, unknown>;
    if (m.type !== AUDIO_PROGRESS || typeof m.lang !== "string") return;
    const state = m.state;
    if (state !== "downloading" && state !== "ready" && state !== "error") return;
    progress.set(m.lang, {
      lang: m.lang,
      total: Number(m.total) || 0,
      cached: Number(m.cached) || 0,
      state,
    });
    emit();
  });
  sync(true);
  subscribeActiveLang(() => sync());
  // A new SW took control (first install): it does not know the language yet.
  sw.addEventListener("controllerchange", () => sync(true));
  // Back in the foreground: resume an unfinished download (the SW joins a running one).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const lang = getActiveLang();
    if (lang && getAudioProgress(lang).state !== "ready") sync(true);
  });
}
