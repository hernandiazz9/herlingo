/**
 * Names shared by the service worker build (scripts/pwa/build.ts) and the page
 * (`./audio-cache`). Framework-free, no imports: the build script reads it with tsx.
 */

/** One SW-owned cache per language: `lang-lern-audio-<lang>` (no build version: mp3 names are content hashes). */
export const AUDIO_CACHE_PREFIX = "lang-lern-audio-";

/** The build writes one audio list per language at `/sw-audio/<lang>.json` (precached). */
export const AUDIO_LIST_DIR = "/sw-audio/";

/** Message types between the page and the SW (`postMessage`). */
export const AUDIO_SET_LANG = "AUDIO_SET_LANG";
export const AUDIO_PROGRESS = "AUDIO_PROGRESS";
