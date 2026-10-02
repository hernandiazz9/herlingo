/**
 * Liga configuration (docs/league.md). Framework-free, no supabase-js import.
 *
 * Both values are public by design and inlined by Next at build time (`NEXT_PUBLIC_` prefix, read
 * as literal `process.env.X` so the bundler can replace them). Without them Liga is hidden.
 */

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** True when both Supabase env vars were set at build time. Same answer on server and client. */
export function leagueEnabled(): boolean {
  return SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
}

/** Project URL and public anon key. Only meaningful when `leagueEnabled()`. */
export function supabaseConfig(): { url: string; anonKey: string } {
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

/** localStorage key where supabase-js keeps the auth session (access + refresh token). */
export const AUTH_STORAGE_KEY = "lang-lern:league-auth";

/** Route of the Liga screen; also where magic links redirect (must be in Supabase's Redirect URLs). */
export const LEAGUE_PATH = "/liga/";

/** Absolute URL the magic link sends the user back to (current origin + `/liga/`). */
export function leagueRedirectUrl(): string {
  return new URL(LEAGUE_PATH, window.location.origin).toString();
}
