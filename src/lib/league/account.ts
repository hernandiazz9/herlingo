/**
 * Liga account: who the device is in the Liga (docs/league.md). Framework-free; the React hook is
 * in use-league-account.ts.
 *
 * - The account (Supabase user id, profile, email) is cached on the device under
 *   `lang-lern:league-account` so every screen knows synchronously, offline too, whether the user
 *   has joined. The server stays the source of truth: `refreshLeagueAccount()` re-reads it.
 * - supabase-js is only loaded when there is something to talk to the server about: an action
 *   (join, email…), a stored session to re-check, or a magic-link redirect in the URL.
 * - Every change fires `LEAGUE_ACCOUNT_EVENT` on `window` (a `CustomEvent` whose `detail` is a
 *   `LeagueAccountChange`); other modules use `subscribeLeagueAccount()`.
 */
import type { Session } from "@supabase/supabase-js";
import { DEFAULT_LANG } from "@/lib/content";
import { authCallbackResult, getLeagueClient, hasAuthCallbackInUrl, leagueRpc } from "./client";
import { AUTH_STORAGE_KEY, leagueEnabled, leagueRedirectUrl } from "./config";
import { fromAuthError, isLeagueError, LeagueError } from "./errors";

const KEY = "lang-lern:league-account";
const VERSION = 1;
export const LEAGUE_ACCOUNT_EVENT = "lang-lern:league-account-change";

/** What other players see. */
export interface LeagueProfile {
  nickname: string;
  emoji: string;
  /** ISO timestamp: when the user joined (only XP earned after it counts). */
  joinedAt: string;
}

/**
 * - `loading`: not known yet (server render, hydration, or checking a session with the server).
 * - `disabled`: Liga is not configured in this build: hide every entry point.
 * - `offline`: not joined (as far as the device knows) and no connection: joining is impossible now.
 * - `none`: online and not joined.
 * - `joined`: has a profile (also while offline: the cache says so).
 */
export type LeagueStatus = "loading" | "disabled" | "offline" | "none" | "joined";

export interface LeagueAccount {
  status: LeagueStatus;
  profile: LeagueProfile | null;
  /** Confirmed email linked to the account (never shown to other players). */
  email?: string;
  /** Email waiting for the user to open the magic link (after `linkEmail`). */
  pendingEmail?: string;
  /** Supabase user id (stable per account; changes after signing in with another email). */
  userId?: string;
  /** Device connectivity (`navigator.onLine`). */
  online: boolean;
  /** A magic link opened on this page load was rejected (`link_expired` / `link_invalid`). */
  linkError?: LeagueError;
}

/** Why the account changed (`detail` of `LEAGUE_ACCOUNT_EVENT`). */
export type LeagueAccountChange =
  /** The device became joined: profile created (`join`) or signed in to an account that has one. */
  | "joined"
  /** Profile, email or session data changed, or the server check finished. */
  | "updated"
  /** Signed in as a different user (magic link on a new device). Drop per-user local state. */
  | "user_changed"
  /** Signed out on this device. Drop per-user local state. */
  | "signed_out"
  /** `deleteMe()`: server data deleted and signed out. Drop all local Liga state. */
  | "deleted"
  /** Connectivity or another transient flag changed. */
  | "status";

interface StoredAccount {
  userId: string;
  profile: LeagueProfile | null;
  email: string | null;
  pendingEmail: string | null;
}

// ---------------------------------------------------------------------------------------------
// Storage (tolerant parsing, versioned)

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function parseProfile(v: unknown): LeagueProfile | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const nickname = str(o.nickname);
  const emoji = str(o.emoji);
  const joinedAt = str(o.joinedAt);
  return nickname && emoji && joinedAt ? { nickname, emoji, joinedAt } : null;
}

function parseStored(raw: string | null): StoredAccount | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object" || o.v !== VERSION) return null;
    const userId = str(o.userId);
    if (!userId) return null;
    return { userId, profile: parseProfile(o.profile), email: str(o.email), pendingEmail: str(o.pendingEmail) };
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function readStored(): StoredAccount | null {
  return typeof window === "undefined" ? null : parseStored(readRaw());
}

function emit(change: LeagueAccountChange) {
  window.dispatchEvent(new CustomEvent<LeagueAccountChange>(LEAGUE_ACCOUNT_EVENT, { detail: change }));
}

function writeStored(next: StoredAccount | null, change: LeagueAccountChange) {
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...next }));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage full or blocked: the in-memory flow still works for this page.
  }
  emit(change);
}

/** True when supabase-js has a stored session on this device (cheap check, no import). */
function hasStoredSession(): boolean {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Snapshot (stable identity while nothing changes, for useSyncExternalStore)

let checking = false;
let linkError: LeagueError | undefined;
let lastKey = "";
let lastSnapshot: LeagueAccount | null = null;

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

const SERVER_SNAPSHOT: LeagueAccount = {
  status: leagueEnabled() ? "loading" : "disabled",
  profile: null,
  online: true,
};

/** Account as rendered on the server and during hydration. */
export function getServerLeagueAccount(): LeagueAccount {
  return SERVER_SNAPSHOT;
}

/** Current account, synchronous (from the device cache). */
export function getLeagueAccount(): LeagueAccount {
  if (typeof window === "undefined" || !leagueEnabled()) return SERVER_SNAPSHOT;
  const raw = readRaw();
  const isOnline = online();
  const key = `${raw}|${isOnline}|${checking}|${linkError?.code ?? ""}`;
  if (lastSnapshot && key === lastKey) return lastSnapshot;

  const stored = parseStored(raw);
  const status: LeagueStatus = stored?.profile
    ? "joined"
    : !isOnline
      ? "offline"
      : checking
        ? "loading"
        : "none";
  lastKey = key;
  lastSnapshot = {
    status,
    profile: stored?.profile ?? null,
    email: stored?.email ?? undefined,
    pendingEmail: stored?.pendingEmail ?? undefined,
    userId: stored?.userId,
    online: isOnline,
    linkError,
  };
  return lastSnapshot;
}

/** True when this device has joined the Liga (cached; works offline). */
export function isLeagueJoined(): boolean {
  return getLeagueAccount().status === "joined";
}

/**
 * Calls `onChange(change)` on every account change: this tab's actions, server checks, other tabs
 * (storage event, reported as `updated`) and connectivity (`status`). Returns the unsubscribe.
 */
export function subscribeLeagueAccount(onChange: (change: LeagueAccountChange) => void): () => void {
  const onEvent = (e: Event) => onChange((e as CustomEvent<LeagueAccountChange>).detail ?? "updated");
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onChange("updated");
  };
  const onConnectivity = () => onChange("status");
  window.addEventListener(LEAGUE_ACCOUNT_EVENT, onEvent);
  window.addEventListener("storage", onStorage);
  window.addEventListener("online", onConnectivity);
  window.addEventListener("offline", onConnectivity);
  return () => {
    window.removeEventListener(LEAGUE_ACCOUNT_EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("online", onConnectivity);
    window.removeEventListener("offline", onConnectivity);
  };
}

function setChecking(value: boolean) {
  if (checking === value) return;
  checking = value;
  emit("status");
}

/** Forgets the error of a rejected magic link (after the UI has shown it). */
export function clearLeagueLinkError() {
  if (!linkError) return;
  linkError = undefined;
  emit("status");
}

// ---------------------------------------------------------------------------------------------
// Session sync

let lang = DEFAULT_LANG;
let listening = false;
let started = false;
let lastRefresh = 0;
let refreshing: Promise<void> | null = null;
/** Actions in flight; a background refresh that overlaps one is discarded (it may be stale). */
let busy = 0;
let generation = 0;

const REFRESH_EVERY = 60_000;

/** The account fields that come from the Supabase user (email, pending email change). */
function fromSession(session: Session, prev: StoredAccount | null): StoredAccount {
  const user = session.user;
  const same = prev?.userId === user.id;
  return {
    userId: user.id,
    profile: same ? (prev?.profile ?? null) : null,
    email: str(user.email),
    pendingEmail: str(user.new_email),
  };
}

function sameStored(a: StoredAccount | null, b: StoredAccount | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Keeps the cache in line with supabase-js's session (sign-in by magic link, email confirmed…). */
function onAuthChange(event: string, session: Session | null) {
  const prev = readStored();
  if (!session) {
    if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
      if (prev) writeStored(null, "signed_out");
    }
    return;
  }
  const next = fromSession(session, prev);
  if (prev && prev.userId !== next.userId) {
    writeStored(next, "user_changed");
    void refreshLeagueAccount({ force: true });
  } else if (!prev) {
    // A new session without a known profile (e.g. first sign-in by email): ask the server.
    // During an action (join signs in anonymously) the action itself writes the result.
    if (busy === 0) void refreshLeagueAccount({ force: true });
  } else if (!sameStored(prev, next)) {
    writeStored(next, "updated");
  }
}

/** Loads the client (once) and wires the auth listener. */
async function connect() {
  const client = await getLeagueClient();
  if (!listening) {
    listening = true;
    client.auth.onAuthStateChange((event, session) => {
      // Defer: never call supabase from inside the auth callback (docs: avoid deadlocks).
      window.setTimeout(() => onAuthChange(event, session), 0);
    });
  }
  return client;
}

/** The current session, signing in anonymously when asked and there is none. */
async function currentSession(createAnonymous: boolean): Promise<Session | null> {
  const client = await connect();
  const { data, error } = await client.auth.getSession();
  if (error) throw fromAuthError(error);
  if (data.session || !createAnonymous) return data.session;
  const signIn = await client.auth.signInAnonymously();
  if (signIn.error || !signIn.data.session) throw fromAuthError(signIn.error);
  return signIn.data.session;
}

interface MeResponse {
  profile: { nickname: string; emoji: string; joined_at: string } | null;
}

function toProfile(p: { nickname: string; emoji: string; joined_at: string } | null): LeagueProfile | null {
  return p ? { nickname: p.nickname, emoji: p.emoji, joinedAt: p.joined_at } : null;
}

async function doRefresh() {
  const callback = hasAuthCallbackInUrl();
  const gen = generation;
  try {
    const session = await currentSession(false);
    const result = await authCallbackResult();
    if (result.error) {
      linkError = result.error;
      emit("status");
    }
    const prev = readStored();
    if (!session) {
      if (prev) writeStored(null, "signed_out");
      return;
    }
    const me = await leagueRpc<MeResponse>("league_me", { lang });
    if (busy > 0 || generation !== gen) return;
    const next = { ...fromSession(session, prev), profile: toProfile(me.profile) };
    const change: LeagueAccountChange =
      prev && prev.userId !== next.userId ? "user_changed" : !prev?.profile && next.profile ? "joined" : "updated";
    if (!sameStored(prev, next)) writeStored(next, change);
    lastRefresh = Date.now();
  } catch (error) {
    if (busy > 0 || generation !== gen) return;
    // Background check: keep the cache on network errors; an invalid session means signed out.
    if (isLeagueError(error) && error.code === "not_authenticated" && readStored()) {
      writeStored(null, "signed_out");
    }
    if (callback && !linkError && isLeagueError(error) && error.code !== "offline" && error.code !== "network") {
      linkError = new LeagueError("link_invalid", error.message);
      emit("status");
    }
  }
}

/**
 * Re-reads the account from the server (session + `league_me`). Never throws. Skipped when Liga
 * is disabled, offline, or there is nothing to check (no cache, no session, no magic link), so
 * supabase-js is not loaded for users who never used Liga. Throttled unless `force`.
 */
export function refreshLeagueAccount(options: { force?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined" || !leagueEnabled() || !online()) return Promise.resolve();
  const callback = hasAuthCallbackInUrl();
  if (!callback && !readStored() && !hasStoredSession()) return Promise.resolve();
  if (!options.force && !callback && Date.now() - lastRefresh < REFRESH_EVERY) return Promise.resolve();
  if (refreshing) return refreshing;
  // Only show "loading" when the cache cannot answer yet (a joined user keeps seeing "joined").
  if (!readStored()?.profile) setChecking(true);
  refreshing = doRefresh().finally(() => {
    refreshing = null;
    setChecking(false);
  });
  return refreshing;
}

/**
 * Starts the account layer for a screen (idempotent): sets the pack language used for
 * `league_me`, checks the session in the background (completes a magic-link redirect) and
 * re-checks when the device comes back online.
 */
export function startLeagueAccount(packLang: string = DEFAULT_LANG) {
  if (typeof window === "undefined" || !leagueEnabled()) return;
  lang = packLang;
  if (!started) {
    started = true;
    window.addEventListener("online", () => void refreshLeagueAccount());
    // Synchronously flag the redirect so the screen shows "loading" instead of the join form.
    if (hasAuthCallbackInUrl()) setChecking(true);
  }
  void refreshLeagueAccount();
}

// ---------------------------------------------------------------------------------------------
// Actions (throw LeagueError)

/** Runs an action, marking it in flight so background refreshes do not overwrite its result. */
async function action<T>(run: () => Promise<T>): Promise<T> {
  busy += 1;
  generation += 1;
  try {
    return await run();
  } finally {
    busy -= 1;
    generation += 1;
  }
}

function assertUsable() {
  if (!leagueEnabled()) throw new LeagueError("disabled");
  if (!online()) throw new LeagueError("offline");
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  const value = email.trim().toLowerCase();
  if (!EMAIL.test(value)) throw new LeagueError("email_invalid");
  return value;
}

/**
 * Joins the Liga: signs in anonymously if this device has no session, then creates the profile
 * (`league_set_profile`). When already joined it updates nickname/emoji instead.
 * Errors: `offline`, `network`, `anonymous_disabled`, `nickname_invalid|blocked|taken`, `emoji_invalid`…
 */
export function joinLeague(nickname: string, emoji: string): Promise<LeagueProfile> {
  return action(() => saveProfile(nickname, emoji));
}

async function saveProfile(nickname: string, emoji: string): Promise<LeagueProfile> {
  assertUsable();
  const session = await currentSession(true);
  if (!session) throw new LeagueError("not_authenticated");
  const wasJoined = Boolean(readStored()?.profile);
  const saved = await leagueRpc<{ nickname: string; emoji: string; joined_at: string }>("league_set_profile", {
    nickname,
    emoji,
  });
  const profile = toProfile(saved)!;
  const prev = readStored();
  writeStored({ ...fromSession(session, prev), profile }, wasJoined ? "updated" : "joined");
  lastRefresh = Date.now();
  return profile;
}

/** Changes nickname and/or emoji of a joined account. Same errors as `joinLeague`. */
export async function updateLeagueProfile(nickname: string, emoji: string): Promise<LeagueProfile> {
  if (!readStored()?.profile) throw new LeagueError("not_joined");
  return action(() => saveProfile(nickname, emoji));
}

/**
 * Links an email to the (anonymous) account so it can be recovered on another device: Supabase
 * sends a magic link that confirms it and comes back to `/liga/`. Until then `pendingEmail` is set.
 * Errors: `not_joined`, `offline`, `email_invalid`, `email_taken`, `email_not_authorized`, `rate_limited`.
 */
export function linkLeagueEmail(email: string): Promise<void> {
  return action(() => sendLinkEmail(email));
}

async function sendLinkEmail(email: string): Promise<void> {
  assertUsable();
  const address = normalizeEmail(email);
  const prev = readStored();
  if (!prev?.profile) throw new LeagueError("not_joined");
  const client = await connect();
  const session = await currentSession(false);
  if (!session) throw new LeagueError("not_authenticated");
  const { data, error } = await client.auth.updateUser(
    { email: address },
    { emailRedirectTo: leagueRedirectUrl() },
  );
  if (error) throw fromAuthError(error);
  writeStored(
    { ...prev, email: str(data.user?.email) ?? prev.email, pendingEmail: str(data.user?.new_email) ?? address },
    "updated",
  );
}

/**
 * Sends a magic link to sign in to an existing account that has a linked email (new device).
 * Opening it lands on `/liga/`, which completes the session; the profile then comes from the server.
 * Never creates users. Errors: `offline`, `email_invalid`, `email_not_found`, `email_not_authorized`, `rate_limited`.
 */
export async function signInLeagueWithEmail(email: string): Promise<void> {
  assertUsable();
  const address = normalizeEmail(email);
  const client = await connect();
  const { error } = await client.auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: false, emailRedirectTo: leagueRedirectUrl() },
  });
  if (error) throw fromAuthError(error);
}

/** Removes every supabase-js key of this app from storage (fallback when signOut cannot run). */
function dropStoredSession() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(AUTH_STORAGE_KEY)) window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore: nothing else to do.
  }
}

/**
 * Signs out on this device and forgets the cached account. Works offline. Note: an anonymous
 * account without a linked email cannot be recovered afterwards (its data stays on the server).
 */
export function signOutLeague(): Promise<void> {
  return action(() => signOutLocal("signed_out"));
}

async function signOutLocal(change: LeagueAccountChange): Promise<void> {
  if (!leagueEnabled()) return;
  try {
    if (hasStoredSession() || readStored()) {
      const client = await connect();
      await client.auth.signOut({ scope: "local" });
    }
  } catch {
    // Offline and supabase-js not cached, or the server refused: drop the session locally anyway.
  }
  dropStoredSession();
  linkError = undefined;
  writeStored(null, change);
}

/**
 * "Salir de la Liga y borrar mis datos": deletes profile, membership and XP events on the server
 * (`league_delete_me`), then signs out and clears the cached account. Listeners get `deleted` and
 * must clear their own local Liga state. Errors: `offline`, `network` (nothing deleted).
 */
export function deleteLeagueAccount(): Promise<void> {
  return action(async () => {
    assertUsable();
    const session = await currentSession(false);
    if (session) await leagueRpc<boolean>("league_delete_me");
    await signOutLocal("deleted");
  });
}
