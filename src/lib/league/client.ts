/**
 * Lazy Supabase client for Liga. `@supabase/supabase-js` is only fetched (dynamic `import()`) the
 * first time Liga actually talks to the server, so no route pays for it in its first-load JS.
 *
 * Auth runs in the browser only: implicit flow (the magic link comes back as
 * `/liga/#access_token=…`, which works whichever browser opens the email; PKCE would need the
 * code verifier of the browser that asked for the link), session persisted in localStorage under
 * `AUTH_STORAGE_KEY`, tokens refreshed automatically while the client is loaded.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_STORAGE_KEY, leagueEnabled, supabaseConfig } from "./config";
import { fromRpcError, LeagueError } from "./errors";

export type { SupabaseClient };

/** Outcome of a magic-link redirect processed when the client was created. */
export interface AuthCallbackResult {
  /** A magic link (sign-in or email change) was in the URL. */
  present: boolean;
  /** Set when the link was rejected (expired, already used, invalid). */
  error: LeagueError | null;
}

let clientPromise: Promise<SupabaseClient> | null = null;
let callbackPromise: Promise<AuthCallbackResult> | null = null;

/** Auth parameters supabase-js reads from the URL fragment after a magic link (implicit flow). */
function urlFragmentParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

/** True when the current URL is a magic-link redirect (tokens or an auth error in the fragment). */
export function hasAuthCallbackInUrl(): boolean {
  if (typeof window === "undefined" || !window.location.hash) return false;
  const params = urlFragmentParams();
  return params.has("access_token") || params.has("error_description") || params.has("error_code");
}

/** Removes a leftover `#…` (error params, or the bare `#` supabase-js leaves) from the address bar. */
function cleanUrlFragment() {
  const { pathname, search, href } = window.location;
  if (window.location.hash || href.endsWith("#")) {
    window.history.replaceState(window.history.state, "", `${pathname}${search}`);
  }
}

function linkError(params: URLSearchParams, error: unknown): LeagueError {
  const code = params.get("error_code") ?? (error as { details?: { code?: string } })?.details?.code;
  const message = params.get("error_description") ?? code ?? String(error);
  return new LeagueError(code === "otp_expired" ? "link_expired" : "link_invalid", message);
}

/**
 * The shared client (created once). Rejects with `LeagueError("disabled")` when Liga is not
 * configured, and with `offline`/`network` when supabase-js cannot be loaded.
 */
export function getLeagueClient(): Promise<SupabaseClient> {
  if (!leagueEnabled() || typeof window === "undefined") {
    return Promise.reject(new LeagueError("disabled"));
  }
  if (!clientPromise) {
    // Read before supabase-js consumes (and clears) the fragment.
    const hadCallback = hasAuthCallbackInUrl();
    const params = urlFragmentParams();
    clientPromise = import("@supabase/supabase-js").then(
      ({ createClient }) => {
        const { url, anonKey } = supabaseConfig();
        const client = createClient(url, anonKey, {
          auth: {
            flowType: "implicit",
            detectSessionInUrl: true,
            persistSession: true,
            autoRefreshToken: true,
            storageKey: AUTH_STORAGE_KEY,
          },
        });
        // The constructor already started initialize() (reads the session from storage and, if
        // present, from the URL); awaiting it again returns the same result.
        callbackPromise = client.auth.initialize().then(({ error }) => {
          if (!hadCallback) return { present: false, error: null };
          cleanUrlFragment();
          const failed = Boolean(error) || params.has("error_code") || params.has("error_description");
          return { present: true, error: failed ? linkError(params, error) : null };
        });
        return client;
      },
      (error: unknown) => {
        clientPromise = null; // Chunk failed to load (offline in dev): try again next time.
        const offline = navigator.onLine === false;
        throw new LeagueError(offline ? "offline" : "network", String(error));
      },
    );
  }
  return clientPromise;
}

/**
 * The magic-link redirect handled on this page load, once the client has processed it.
 * `{ present: false }` when there was none or the client was never created.
 */
export async function authCallbackResult(): Promise<AuthCallbackResult> {
  if (!clientPromise) return { present: false, error: null };
  await clientPromise;
  return callbackPromise ?? { present: false, error: null };
}

/** True once supabase-js has been loaded and the client created (no import is triggered). */
export function leagueClientLoaded(): boolean {
  return clientPromise !== null;
}

/**
 * Calls a `public.league_*` RPC (docs/league.md) as the signed-in user and returns its data.
 * Throws a `LeagueError` (server token, `offline`, `network`, `not_authenticated`…).
 */
export async function leagueRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const client = await getLeagueClient();
  let result: { data: unknown; error: unknown; status: number };
  try {
    result = await client.rpc(fn, args);
  } catch (error) {
    throw fromRpcError(error, 0);
  }
  if (result.error) throw fromRpcError(result.error, result.status);
  return result.data as T;
}
