/**
 * Liga errors: every failure the league layer throws is a `LeagueError` with a stable `code`, so the
 * UI maps codes to Spain Spanish copy. Framework-free, no supabase-js import.
 */

/** Tokens raised by the `league_*` RPCs (docs/league.md → "Errors"). */
export const SERVER_ERROR_CODES = [
  "not_authenticated",
  "no_profile",
  "nickname_invalid",
  "nickname_blocked",
  "nickname_taken",
  "emoji_invalid",
  "group_name_invalid",
  "group_name_blocked",
  "already_in_group",
  "too_many_groups",
  "not_in_group",
  "group_not_found",
  "try_again",
  "lang_invalid",
  "scope_invalid",
  "events_invalid",
  "too_many_events",
  "stats_invalid",
] as const;
export type LeagueServerErrorCode = (typeof SERVER_ERROR_CODES)[number];

/** Client-side codes (configuration, connectivity, Supabase Auth). */
export type LeagueClientErrorCode =
  /** Liga is not configured in this build. */
  | "disabled"
  /** The device is offline: nothing was sent. */
  | "offline"
  /** Request failed (network, timeout, 5xx): retry later. */
  | "network"
  /** The action needs a joined account. */
  | "not_joined"
  /** Anonymous sign-ins are switched off in the Supabase project. */
  | "anonymous_disabled"
  /** Malformed email address. */
  | "email_invalid"
  /** The email already belongs to another account (linking). */
  | "email_taken"
  /** No account with that email (sign in with email). */
  | "email_not_found"
  /** Default Supabase mailer: only project team members receive emails. */
  | "email_not_authorized"
  /** Too many emails / requests: wait a bit. */
  | "rate_limited"
  /** The magic link the user opened has expired or was already used. */
  | "link_expired"
  /** The magic link the user opened was rejected for another reason. */
  | "link_invalid"
  /** Any other auth or unexpected error. */
  | "unknown";

export type LeagueErrorCode = LeagueServerErrorCode | LeagueClientErrorCode;

export class LeagueError extends Error {
  readonly code: LeagueErrorCode;

  constructor(code: LeagueErrorCode, message?: string) {
    super(message ?? code);
    this.name = "LeagueError";
    this.code = code;
  }
}

export function isLeagueError(error: unknown): error is LeagueError {
  return error instanceof LeagueError;
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Fallback for failures without a known token: offline, network or unknown. */
function connectivityError(message: string, network: boolean): LeagueError {
  if (isOffline()) return new LeagueError("offline", message);
  return new LeagueError(network ? "network" : "unknown", message);
}

/**
 * A PostgREST error from `supabase.rpc()` (`{ code, message }`, plus the response `status`) or a
 * thrown value → LeagueError.
 */
export function fromRpcError(error: unknown, status?: number): LeagueError {
  if (isLeagueError(error)) return error;
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  const text = typeof message === "string" ? message : String(error);
  if (code === "P0001" && (SERVER_ERROR_CODES as readonly string[]).includes(text)) {
    return new LeagueError(text as LeagueServerErrorCode, text);
  }
  // Expired/invalid JWT (PGRST301/303, HTTP 401): treat as not signed in.
  if (code === "PGRST301" || code === "PGRST303" || status === 401) {
    return new LeagueError("not_authenticated", text);
  }
  // Failed fetches come back with status 0, an empty code and a "TypeError: Failed to fetch" message.
  const network = status === 0 || (status !== undefined && status >= 500) || code === "" || code === undefined;
  return connectivityError(text, network);
}

const AUTH_CODES: Partial<Record<string, LeagueClientErrorCode>> = {
  anonymous_provider_disabled: "anonymous_disabled",
  email_address_invalid: "email_invalid",
  validation_failed: "email_invalid",
  email_exists: "email_taken",
  user_already_exists: "email_taken",
  identity_already_exists: "email_taken",
  otp_disabled: "email_not_found",
  user_not_found: "email_not_found",
  signup_disabled: "email_not_found",
  email_address_not_authorized: "email_not_authorized",
  over_email_send_rate_limit: "rate_limited",
  over_request_rate_limit: "rate_limited",
  request_timeout: "network",
};

/** An AuthError from supabase-js (`{ code, status, name }`) → LeagueError. */
export function fromAuthError(error: unknown): LeagueError {
  if (isLeagueError(error)) return error;
  const { code, status, name, message } = (error ?? {}) as {
    code?: unknown;
    status?: unknown;
    name?: unknown;
    message?: unknown;
  };
  const text = typeof message === "string" ? message : String(error);
  const mapped = typeof code === "string" ? AUTH_CODES[code] : undefined;
  if (mapped) return new LeagueError(mapped, text);
  if (status === 429) return new LeagueError("rate_limited", text);
  const network =
    name === "AuthRetryableFetchError" || status === 0 || (typeof status === "number" && status >= 500);
  return connectivityError(text, network);
}
