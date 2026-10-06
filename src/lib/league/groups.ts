/**
 * Liga groups and the caller's weekly standing (docs/league.md → `league_status`,
 * `league_create_group`, `league_join_group`, `league_leave_group(code)`): up to `max_groups` (10)
 * groups at once, joined by code or by the share link `/liga/unirse/?codigo=XXXXXX`, plus the
 * weekly XP of every language and the rank in the general table. Plain functions plus the
 * `useLeagueGroups()` hook at the bottom.
 *
 * - The last `league_status` answer is cached on the device under `lang-lern:league-groups` (with
 *   the user id it belongs to) so /liga/ and Ruta show it offline. The old one-group cache
 *   `lang-lern:league-group` is no longer read or written (left in place).
 * - An invite code opened while not joined (or before an email sign-in) is kept under
 *   `lang-lern:league-invite` so it survives the join flow and the magic-link redirect.
 * - Every change fires `LEAGUE_GROUP_EVENT` on `window`. Signing out, deleting the account or
 *   switching users drops the cache; joining (or signing in) re-reads it.
 */
import { useEffect, useSyncExternalStore } from "react";
import { subscribeXpAwards } from "@/lib/progress";
import { getLeagueAccount, subscribeLeagueAccount, subscribeLeagueStatus } from "./account";
import { leagueRpc } from "./client";
import { LEAGUE_PATH, leagueEnabled } from "./config";
import { LeagueError } from "./errors";
import { clearCachedBoard } from "./leaderboard";

const KEY = "lang-lern:league-groups";
const INVITE_KEY = "lang-lern:league-invite";
const VERSION = 1;
export const LEAGUE_GROUP_EVENT = "lang-lern:league-group-change";

export const GROUP_NAME_MAX = 30;
export const GROUP_CODE_LENGTH = 6;
/** `league.max_groups()` on the server; the server's answer wins when it differs. */
export const DEFAULT_MAX_GROUPS = 10;
const CODE_CHARS = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
/** Wait after an XP award so the sync has delivered it. */
const AWARD_REFRESH_DELAY = 3_000;
/** Focus / visibility refreshes closer than this to the last one are skipped. */
const MIN_INTERVAL = 8_000;

export interface LeagueGroup {
  code: string;
  name: string;
  members: number;
  /** The caller's rank in this group this week (null until the server says). */
  rank: number | null;
}

/**
 * - `unknown`: not joined, or the status was never fetched on this device yet.
 * - `ready`: the fields below come from the cache or the server.
 */
export interface LeagueGroupsState {
  status: "unknown" | "ready";
  /** The caller's groups, earliest joined first. */
  groups: LeagueGroup[];
  maxGroups: number;
  /** This week's XP, every language together. */
  weeklyXp: number;
  /** Rank in the general table this week (null without XP). */
  globalRank: number | null;
  /** When the week of `weeklyXp` ends (ms since epoch; null if unknown): past it, the numbers are old. */
  weekEnd: number | null;
  /** When the server answer was read (ms since epoch). */
  updatedAt: number | null;
  /** A server check is in flight. */
  refreshing: boolean;
  /** Invite code waiting to be used (link opened before joining). */
  invite: string | null;
}

interface StoredStatus {
  userId: string;
  groups: LeagueGroup[];
  maxGroups: number;
  weeklyXp: number;
  globalRank: number | null;
  weekEnd: number | null;
  updatedAt: number | null;
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
// Parsing (tolerant: bad entries dropped)

const int = (v: unknown, min: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.round(v)) : null;

function parseGroup(v: unknown): LeagueGroup | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.code !== "string" || typeof o.name !== "string" || !o.code || !o.name) return null;
  return { code: o.code, name: o.name, members: int(o.members, 1) ?? 1, rank: int(o.rank, 1) };
}

function parseGroups(v: unknown): LeagueGroup[] {
  if (!Array.isArray(v)) return [];
  const groups: LeagueGroup[] = [];
  for (const raw of v) {
    const group = parseGroup(raw);
    if (group && !groups.some((g) => g.code === group.code)) groups.push(group);
  }
  return groups;
}

const time = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

/** A `league_status` answer → what the device keeps. */
function fromServer(userId: string, value: unknown): StoredStatus | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const week = (o.week && typeof o.week === "object" ? o.week : {}) as Record<string, unknown>;
  const rank = (o.rank && typeof o.rank === "object" ? o.rank : {}) as Record<string, unknown>;
  return {
    userId,
    groups: parseGroups(o.groups),
    maxGroups: int(o.max_groups, 1) ?? DEFAULT_MAX_GROUPS,
    weeklyXp: int(o.weekly_xp, 0) ?? 0,
    globalRank: int(rank.global, 1),
    weekEnd: time(week.end),
    updatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------------------------
// Storage (versioned)

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

function parseStored(raw: string | null): StoredStatus | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object" || o.v !== VERSION || typeof o.userId !== "string") return null;
    return {
      userId: o.userId,
      groups: parseGroups(o.groups),
      maxGroups: int(o.maxGroups, 1) ?? DEFAULT_MAX_GROUPS,
      weeklyXp: int(o.weeklyXp, 0) ?? 0,
      globalRank: int(o.globalRank, 1),
      weekEnd: time(o.weekEnd),
      updatedAt: time(o.updatedAt),
    };
  } catch {
    return null;
  }
}

function emit() {
  window.dispatchEvent(new Event(LEAGUE_GROUP_EVENT));
}

function store(status: StoredStatus) {
  write(KEY, JSON.stringify({ v: VERSION, ...status }));
  const invite = read(INVITE_KEY);
  if (invite && status.groups.some((g) => g.code === invite)) write(INVITE_KEY, null);
  emit();
}

/** The cached status of `userId` (an empty one when none is cached for that user). */
function storedFor(userId: string): StoredStatus {
  const stored = parseStored(read(KEY));
  if (stored && stored.userId === userId) return stored;
  return {
    userId,
    groups: [],
    maxGroups: DEFAULT_MAX_GROUPS,
    weeklyXp: 0,
    globalRank: null,
    weekEnd: null,
    updatedAt: null,
  };
}

function clearStored() {
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
let lastSnapshot: LeagueGroupsState | null = null;

const SERVER_SNAPSHOT: LeagueGroupsState = {
  status: "unknown",
  groups: [],
  maxGroups: DEFAULT_MAX_GROUPS,
  weeklyXp: 0,
  globalRank: null,
  weekEnd: null,
  updatedAt: null,
  refreshing: false,
  invite: null,
};

/** Joined user id from the cached account, else null. */
function joinedUser(): string | null {
  const account = getLeagueAccount();
  return account.status === "joined" && account.userId ? account.userId : null;
}

export function getLeagueGroups(): LeagueGroupsState {
  if (typeof window === "undefined" || !leagueEnabled()) return SERVER_SNAPSHOT;
  const raw = read(KEY);
  const invite = read(INVITE_KEY);
  const userId = joinedUser();
  const key = `${raw}|${invite}|${userId}|${refreshing}`;
  if (lastSnapshot && key === lastKey) return lastSnapshot;

  const stored = parseStored(raw);
  const mine = userId !== null && stored?.userId === userId ? stored : null;
  lastKey = key;
  const live = { refreshing, invite: invite && CODE_CHARS.test(invite) ? invite : null };
  lastSnapshot = mine
    ? {
        status: "ready",
        groups: mine.groups,
        maxGroups: mine.maxGroups,
        weeklyXp: mine.weeklyXp,
        globalRank: mine.globalRank,
        weekEnd: mine.weekEnd,
        updatedAt: mine.updatedAt,
        ...live,
      }
    : { ...SERVER_SNAPSHOT, ...live };
  return lastSnapshot;
}

export function subscribeLeagueGroups(onChange: () => void): () => void {
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

let started = false;
let pending: Promise<void> | null = null;
let lastRun = 0;
/** Bumped by every action so a background refresh that overlaps one is discarded. */
let generation = 0;

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/**
 * Re-reads the caller's groups, weekly XP and rank (`league_status`). Never throws; skipped offline
 * or when not joined. Without `force`, skipped when the last read was a few seconds ago.
 */
export function refreshLeagueGroups(force = true): Promise<void> {
  if (typeof window === "undefined" || !leagueEnabled() || !online() || !joinedUser()) return Promise.resolve();
  if (pending) return pending;
  if (!force && Date.now() - lastRun < MIN_INTERVAL) return Promise.resolve();
  const gen = generation;
  lastRun = Date.now();
  setRefreshing(true);
  pending = (async () => {
    try {
      const userId = joinedUser();
      const status = await leagueRpc<unknown>("league_status");
      if (gen !== generation || !userId || joinedUser() !== userId) return;
      const next = fromServer(userId, status);
      if (next) store(next);
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
 * Starts the groups layer for a screen (idempotent): follows account changes (drops the cache on
 * sign-out/delete/user change, re-reads after joining), stores the account refresh's
 * `league_status`, and refreshes now, when back online, when the app is visible again and shortly
 * after each XP award.
 */
export function startLeagueGroups() {
  if (typeof window === "undefined" || !leagueEnabled()) return;
  if (!started) {
    started = true;
    subscribeLeagueAccount((change) => {
      if (change === "deleted" || change === "signed_out" || change === "user_changed") {
        generation += 1;
        clearStored();
      }
      if (change === "joined" || change === "user_changed") void refreshLeagueGroups();
    });
    subscribeLeagueStatus((userId, status) => {
      if (pending || joinedUser() !== userId) return;
      const next = fromServer(userId, status);
      if (next) {
        lastRun = Date.now();
        store(next);
      }
    });
    let awardTimer: ReturnType<typeof setTimeout> | undefined;
    subscribeXpAwards(() => {
      if (awardTimer !== undefined) clearTimeout(awardTimer);
      awardTimer = setTimeout(() => void refreshLeagueGroups(), AWARD_REFRESH_DELAY);
    });
    window.addEventListener("online", () => void refreshLeagueGroups());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void refreshLeagueGroups(false);
    });
  }
  void refreshLeagueGroups(false);
}

function assertUsable(): string {
  if (!leagueEnabled()) throw new LeagueError("disabled");
  const userId = joinedUser();
  if (!userId) throw new LeagueError("not_joined");
  if (!online()) throw new LeagueError("offline");
  return userId;
}

/** Runs a group action, applies its result to the cache, then re-reads ranks in the background. */
async function groupAction<T>(
  run: (current: StoredStatus) => Promise<T>,
  apply: (current: StoredStatus, result: T) => LeagueGroup[],
): Promise<T> {
  const userId = assertUsable();
  generation += 1;
  try {
    const result = await run(storedFor(userId));
    if (joinedUser() === userId) {
      // `updatedAt` stays: ranks are not fresh until the refresh below.
      const current = storedFor(userId);
      store({ ...current, groups: apply(current, result) });
    }
    return result;
  } finally {
    // Ranks, member counts and the limit come from the server (also after a failure: the cache may be stale).
    // A refresh started before the action is discarded (generation): read again once it settles.
    void (pending ?? Promise.resolve()).then(() => refreshLeagueGroups());
  }
}

/** Adds (or updates) `group` in the list, keeping the server's order (new ones last). */
function withGroup(groups: LeagueGroup[], group: LeagueGroup): LeagueGroup[] {
  const known = groups.find((g) => g.code === group.code);
  return known ? groups.map((g) => (g.code === group.code ? { ...group, rank: g.rank } : g)) : [...groups, group];
}

/**
 * Creates a group and joins it (other groups are kept). Errors: `not_joined`, `offline`, `network`,
 * `group_name_invalid`, `group_name_blocked`, `too_many_groups`, `try_again`.
 */
export function createLeagueGroup(name: string): Promise<LeagueGroup> {
  return groupAction(
    async (current) => {
      const value = cleanGroupName(name);
      if (!value || [...value].length > GROUP_NAME_MAX) throw new LeagueError("group_name_invalid");
      if (current.groups.length >= current.maxGroups) throw new LeagueError("too_many_groups");
      const group = parseGroup(await leagueRpc<unknown>("league_create_group", { name: value }));
      if (!group) throw new LeagueError("unknown");
      return group;
    },
    (current, group) => withGroup(current.groups, group),
  );
}

/**
 * Joins the group with that code without leaving the others (no-op if already in it).
 * Errors: `group_not_found`, `too_many_groups`, `not_joined`, `offline`, `network`.
 */
export function joinLeagueGroup(code: string): Promise<LeagueGroup> {
  return groupAction(
    async (current) => {
      const value = normalizeGroupCode(code);
      if (!CODE_CHARS.test(value)) throw new LeagueError("group_not_found");
      const inIt = current.groups.some((g) => g.code === value);
      if (!inIt && current.groups.length >= current.maxGroups) throw new LeagueError("too_many_groups");
      const group = parseGroup(await leagueRpc<unknown>("league_join_group", { code: value }));
      if (!group) throw new LeagueError("unknown");
      return group;
    },
    (current, group) => withGroup(current.groups, group),
  );
}

/** Leaves one group (works when already out of it). Errors: `not_joined`, `offline`, `network`. */
export async function leaveLeagueGroup(code: string): Promise<void> {
  const value = normalizeGroupCode(code);
  await groupAction(
    async () => {
      await leagueRpc<boolean>("league_leave_group", { code: value });
    },
    (current) => current.groups.filter((g) => g.code !== value),
  );
  clearCachedBoard({ scope: "group", code: value });
}

// ---------------------------------------------------------------------------------------------
// Hook

/** The caller's groups and weekly standing, live (cached, refreshed in the background). */
export function useLeagueGroups(): LeagueGroupsState {
  const state = useSyncExternalStore(subscribeLeagueGroups, getLeagueGroups, () => SERVER_SNAPSHOT);
  useEffect(() => {
    startLeagueGroups();
  }, []);
  return state;
}
