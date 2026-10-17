/** App-wide constants. Language-specific names and copy belong in content/<lang>/, not here. */
export const APP_NAME = "Herlingo";
export const APP_DESCRIPTION = "Tu entrenador personal de idiomas para viajar.";
/** Matches --sea in globals.css; used for the browser UI colour. */
export const THEME_COLOR = "#1768a6";
/** Where the app lives (renamed from Lang Lern on 2026-10-15). */
export const APP_URL = "https://herlingo.vercel.app";
/** The app's name before the move, for the "Herlingo se muda" copy. */
export const PREVIOUS_APP_NAME = "Lang Lern";
/**
 * Older addresses that still serve the same app: installed iPhones keep using them, and each
 * address has its own on-device data, so they are never redirected (src/lib/move.ts).
 */
export const LEGACY_HOSTS: readonly string[] = ["langlern-iota.vercel.app"];
