/**
 * Liga groups (docs/league.md → `league_create_group`, `league_join_group`, `league_leave_group`):
 * one group per person, joined by code or by the share link `/liga/unirse/?codigo=XXXXXX`.
 * Plain functions plus the `useLeagueGroup()` hook at the bottom.
 *
 * - The caller's group is cached on the device under `lang-lern:league-group` (with the user id it
 *   belongs to) so /liga/ shows it offline; `refreshLeagueGroup()` re-reads it from `league_me`.
 * - An invite code opened while not joined (or before an email sign-in) is kept under
 *   `lang-lern:league-invite` so it survives the join flow and the magic-link redirect.
 * - Every change fires `LEAGUE_GROUP_EVENT` on `window`. Signing out, deleting the account or
 *   switching users drops the cache; joining (or signing in) re-reads it.
 */
import { useEffect, useSyncExternalStore } from "react";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { getLeagueAccount, subscribeLeagueAccount } from "./account";
import { leagueRpc } from "./client";
import { LEAGUE_PATH, leagueEnabled } from "./config";
import { isLeagueError, LeagueError } from "./errors";
import { leagueLang } from "./lang";

const KEY = "lang-lern:league-group";
const INVITE_KEY = "lang-lern:league-invite";
const VERSION = 1;
export const LEAGUE_GROUP_EVENT = "lang-lern:league-group-change";

export const GROUP_NAME_MAX = 30;
export const GROUP_CODE_LENGTH = 6;
const CODE_CHARS = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export interface LeagueGroup {
  code: string;
  name: string;
  members: number;
}

/**
 * - `unknown`: not joined, or the group was never fetched on this device yet.
 * - `ready`: `group` is the caller's group (`null` = in no group), from the cache or the server.
 */
export interface LeagueGroupState {
  status: "unknown" | "ready";
  group: LeagueGroup | null;
  /** A server check is in flight. */
  refreshing: boolean;
  /** Invite code waiting to be used (link opened before joining). */
  invite: string | null;
}

interface StoredGroup {
  userId: string;
  group: LeagueGroup | null;
}

// ---------------------------------------------------------------------------------------------
// Codes and names

/** Upper case without spaces, as the server reads codes. */
export function normalizeGroupCode(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase();
}

export function isGroupCode(raw: string): boolean {
  return CODE_CHARS.test(normalizeGroupCode(raw));
}

/** Trims and collapses inner spaces, as the server does before checking and saving. */
export function cleanGroupName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Absolute share link of a group (current origin). */
export function groupShareUrl(code: string): string {
  const url = new URL(`${LEAGUE_PATH}unirse/`, window.location.origin);
  url.searchParams.set("codigo", code);
  return url.toString();
}

// ---------------------------------------------------------------------------------------------
// Storage (tolerant parsing, versioned)

function parseGroup(v: unknown): LeagueGroup | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.code !== "string" || typeof o.name !== "string") return null;
  const members = typeof o.members === "number" && Number.isFinite(o.members) ? Math.max(1, Math.round(o.members)) : 1;
  return o.code && o.name ? { code: o.code, name: o.name, members } : null;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked: this page keeps working from memory.
  }
}

function parseStored(raw: string | null): StoredGroup | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object" || o.v !== VERSION || typeof o.userId !== "string") return null;
    return { userId: o.userId, group: parseGroup(o.group) };
  } catch {
    return null;
  }
}

function emit() {
  window.dispatchEvent(new Event(LEAGUE_GROUP_EVENT));
}

function storeGroup(userId: string, group: LeagueGroup | null) {
  write(KEY, JSON.stringify({ v: VERSION, userId, group }));
  if (group && read(INVITE_KEY) === group.code) write(INVITE_KEY, null);
  emit();
}

function clearGroup() {
  if (read(KEY) === null) return;
  write(KEY, null);
  emit();
}

/** Keeps a valid invite code for later (cleared once used). */
export function rememberGroupInvite(code: string) {
  const value = normalizeGroupCode(code);
  if (!CODE_CHARS.test(value) || read(INVITE_KEY) === value) return;
  write(INVITE_KEY, value);
  emit();
}

export function forgetGroupInvite() {
  if (read(INVITE_KEY) === null) return;
  write(INVITE_KEY, null);
  emit();
}

// ---------------------------------------------------------------------------------------------
// Snapshot (stable identity while nothing changes, for useSyncExternalStore)

let refreshing = false;
let lastKey = "";
let lastSnapshot: LeagueGroupState | null = null;

const SERVER_SNAPSHOT: LeagueGroupState = { status: "unknown", group: null, refreshing: false, invite: null };

/** Joined user id from the cached account, else null. */
function joinedUser(): string | null {
  const account = getLeagueAccount();
  return account.status === "joined" && account.userId ? account.userId : null;
}

export function getLeagueGroup(): LeagueGroupState {
  if (typeof window === "undefined" || !leagueEnabled()) return SERVER_SNAPSHOT;
  const raw = read(KEY);
  const invite = read(INVITE_KEY);
  const userId = joinedUser();
  const key = `${raw}|${invite}|${userId}|${refreshing}`;
  if (lastSnapshot && key === lastKey) return lastSnapshot;

  const stored = parseStored(raw);
  const mine = userId !== null && stored?.userId === userId;
  lastKey = key;
  lastSnapshot = {
    status: mine ? "ready" : "unknown",
    group: mine ? (stored?.group ?? null) : null,
    refreshing,
    invite: invite && CODE_CHARS.test(invite) ? invite : null,
  };
  return lastSnapshot;
}

export function subscribeLeagueGroup(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === INVITE_KEY || e.key === null) onChange();
  };
  const stopAccount = subscribeLeagueAccount(onChange);
  window.addEventListener(LEAGUE_GROUP_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    stopAccount();
    window.removeEventListener(LEAGUE_GROUP_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setRefreshing(value: boolean) {
  if (refreshing === value) return;
  refreshing = value;
  emit();
}

// ---------------------------------------------------------------------------------------------
// Server

interface MeGroupResponse {
  group: unknown;
}

let started = false;
let pending: Promise<void> | null = null;
/** Bumped by every action so a background refresh that overlaps one is discarded. */
let generation = 0;

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Re-reads the caller's group (`league_me`). Never throws; skipped offline or when not joined. */
export function refreshLeagueGroup(): Promise<void> {
  if (typeof window === "undefined" || !leagueEnabled() || !online() || !joinedUser()) return Promise.resolve();
  if (pending) return pending;
  const gen = generation;
  setRefreshing(true);
  pending = (async () => {
    try {
      const userId = joinedUser();
      const me = await leagueRpc<MeGroupResponse>("league_me", { lang: leagueLang() });
      if (gen !== generation || !userId || joinedUser() !== userId) return;
      storeGroup(userId, parseGroup(me.group));
    } catch {
      // Keep the cache: offline, network or an expired session (the account layer handles that).
    }
  })().finally(() => {
    pending = null;
    setRefreshing(false);
  });
  return pending;
}

/**
 * Starts the group layer for a screen (idempotent): follows account changes (drops the cache on
 * sign-out/delete/user change, re-reads after joining) and refreshes now and when back online.
 */
export function startLeagueGroup() {
  if (typeof window === "undefined" || !leagueEnabled()) return;
  if (!started) {
    started = true;
    subscribeLeagueAccount((change) => {
      if (change === "deleted" || change === "signed_out" || change === "user_changed") {
        generation += 1;
        clearGroup();
      }
      if (change === "joined" || change === "user_changed") void refreshLeagueGroup();
    });
    window.addEventListener("online", () => void refreshLeagueGroup());
  }
  void refreshLeagueGroup();
}

function assertUsable(): string {
  if (!leagueEnabled()) throw new LeagueError("disabled");
  const userId = joinedUser();
  if (!userId) throw new LeagueError("not_joined");
  if (!online()) throw new LeagueError("offline");
  return userId;
}

async function groupAction<T extends LeagueGroup | null>(run: () => Promise<T>): Promise<T> {
  const userId = assertUsable();
  generation += 1;
  try {
    const group = await run();
    storeGroup(userId, group);
    return group;
  } catch (error) {
    // The cache was stale (e.g. joined a group on another device): show the truth.
    if (isLeagueError(error) && error.code === "already_in_group") void refreshLeagueGroup();
    throw error;
  }
}

/**
 * Creates a group and joins it. Errors: `not_joined`, `offline`, `network`, `group_name_invalid`,
 * `group_name_blocked`, `already_in_group`, `try_again`.
 */
export function createLeagueGroup(name: string): Promise<LeagueGroup> {
  return groupAction(async () => {
    const value = cleanGroupName(name);
    if (!value || [...value].length > GROUP_NAME_MAX) throw new LeagueError("group_name_invalid");
    const group = parseGroup(await leagueRpc<unknown>("league_create_group", { name: value }));
    if (!group) throw new LeagueError("unknown");
    return group;
  });
}

/** Joins the group with that code (no-op if already in it). Errors: `group_not_found`, `already_in_group`… */
export function joinLeagueGroup(code: string): Promise<LeagueGroup> {
  return groupAction(async () => {
    const value = normalizeGroupCode(code);
    if (!CODE_CHARS.test(value)) throw new LeagueError("group_not_found");
    const group = parseGroup(await leagueRpc<unknown>("league_join_group", { code: value }));
    if (!group) throw new LeagueError("unknown");
    return group;
  });
}

/** Leaves the caller's group (works when already out). Errors: `not_joined`, `offline`, `network`. */
export async function leaveLeagueGroup(): Promise<void> {
  await groupAction(async (): Promise<null> => {
    await leagueRpc<boolean>("league_leave_group");
    return null;
  });
}

/** Leaves the current group, then joins the one with `code` (invite while in another group). */
export async function switchLeagueGroup(code: string): Promise<LeagueGroup> {
  await leaveLeagueGroup();
  return joinLeagueGroup(code);
}

// ---------------------------------------------------------------------------------------------
// Hook

/** The caller's group, live (cached, refreshed in the background). */
export function useLeagueGroup(): LeagueGroupState {
  const lang = useScreenLang();
  const state = useSyncExternalStore(subscribeLeagueGroup, getLeagueGroup, () => SERVER_SNAPSHOT);
  useEffect(() => {
    // Again after a language switch: `league_me` is per language.
    if (lang) startLeagueGroup();
  }, [lang]);
  return state;
}
