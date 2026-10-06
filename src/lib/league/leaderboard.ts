/**
 * Liga weekly leaderboards (docs/league.md → `league_ranking`, `league_podium`): the general table
 * and one per group, XP summed over every language.
 *
 * `fetchBoard()` reads the current ranking and last week's podium for one tab; the last good
 * answer is cached on the device (`lang-lern:league-ranking:global`,
 * `lang-lern:league-ranking:group:<code>`, tied to the user id) so /liga/ still shows it offline.
 * The old per-language caches `lang-lern:league-board:<lang>:<scope>` are no longer read (left in
 * place). `useLeaderboard()` keeps it fresh: on mount, on focus / when the
 * app becomes visible, when the device comes back online, shortly after an XP award (the sync of
 * `sync.ts` flushes 1 s after it) and when the week resets. Also the Madrid week helpers.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeXpAwards } from "@/lib/progress";
import { getLeagueAccount, subscribeLeagueAccount } from "./account";
import { leagueRpc } from "./client";

export type LeaderboardScope = "group" | "global";

/** One table: the general one, or one of the caller's groups. */
export type BoardTab = { scope: "global" } | { scope: "group"; code: string };

export const GLOBAL_TAB: BoardTab = { scope: "global" };

/** Stable id of a tab ("global", "group:K7PX2M"). */
export const tabKey = (tab: BoardTab) => (tab.scope === "global" ? "global" : `group:${tab.code}`);

export interface LeaderboardRow {
  rank: number;
  nickname: string;
  emoji: string;
  weeklyXp: number;
  streak: number;
  isMe: boolean;
}

export interface Board {
  /** This week's ranking: top 50 plus the caller's own row when outside them. */
  rows: LeaderboardRow[];
  /** Last week's top 3 (players with XP only). */
  lastWeek: LeaderboardRow[];
  /** When this answer was read from the server (ms since epoch). */
  updatedAt: number;
}

const PREFIX = "lang-lern:league-ranking:";
const VERSION = 1;
const TIME_ZONE = "Europe/Madrid";
const DAY = 86_400_000;
/** Wait after an XP award so the sync has delivered it. */
const AWARD_REFRESH_DELAY = 3_000;
/** Focus / visibility refreshes closer than this to the last one are skipped. */
const MIN_INTERVAL = 8_000;

// ---------------------------------------------------------------------------------------------
// Week (Monday 00:00 Europe/Madrid)

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  weekday: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function madrid(ms: number) {
  const get: Record<string, string> = {};
  for (const p of PARTS.formatToParts(new Date(ms))) get[p.type] = p.value;
  const wall = Date.UTC(+get.year, +get.month - 1, +get.day, +get.hour, +get.minute, +get.second);
  return {
    year: +get.year,
    month: +get.month,
    day: +get.day,
    /** 1 = Monday … 7 = Sunday. */
    weekday: WEEKDAYS.indexOf(get.weekday) + 1,
    /** Madrid's offset from UTC at `ms`. */
    offset: wall - Math.floor(ms / 1000) * 1000,
  };
}

/** The next Monday 00:00 in Madrid after `now` (ms since epoch): when this week's XP resets. */
export function nextWeekReset(now: number = Date.now()): number {
  const m = madrid(now);
  const wall = Date.UTC(m.year, m.month - 1, m.day + (8 - m.weekday), 0, 0, 0);
  let t = wall - madrid(wall).offset;
  t = wall - madrid(t).offset; // settles the guess across a DST change
  return t;
}

/** "Quedan 3 d 4 h", "Quedan 4 h 12 min", "Quedan 12 min". */
export function countdownLabel(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `Quedan ${days} d ${hours} h`;
  if (hours > 0) return `Quedan ${hours} h ${mins} min`;
  return `Quedan ${mins} min`;
}

/** "hace un momento", "hace 5 min", "hace 3 h", "hace 2 d". */
export function agoLabel(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

// ---------------------------------------------------------------------------------------------
// Parsing and cache

function parseRows(value: unknown): LeaderboardRow[] {
  if (!Array.isArray(value)) return [];
  const rows: LeaderboardRow[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.nickname !== "string" || typeof r.rank !== "number") continue;
    rows.push({
      rank: r.rank,
      nickname: r.nickname,
      emoji: typeof r.emoji === "string" ? r.emoji : "",
      weeklyXp: typeof r.weekly_xp === "number" ? r.weekly_xp : 0,
      streak: typeof r.streak === "number" ? r.streak : 0,
      isMe: r.is_me === true,
    });
  }
  return rows;
}

const cacheKey = (tab: BoardTab) => `${PREFIX}${tabKey(tab)}`;

/** The cached board of this user, or null (none, another user's, bad data, or from a past week). */
export function readCachedBoard(tab: BoardTab, userId: string | undefined): Board | null {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(tab));
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      v?: unknown;
      userId?: unknown;
      updatedAt?: unknown;
      rows?: unknown;
      lastWeek?: unknown;
    };
    if (!data || data.v !== VERSION || data.userId !== userId || typeof data.updatedAt !== "number") return null;
    // Totals of a finished week are no longer "this week" (1 h of slack for DST).
    if (data.updatedAt < nextWeekReset() - 7 * DAY - 3_600_000) return null;
    return { rows: parseRows(data.rows), lastWeek: parseRows(data.lastWeek), updatedAt: data.updatedAt };
  } catch {
    return null;
  }
}

function writeCachedBoard(tab: BoardTab, userId: string, board: Board) {
  try {
    const wire = (rows: LeaderboardRow[]) =>
      rows.map((r) => ({
        rank: r.rank,
        nickname: r.nickname,
        emoji: r.emoji,
        weekly_xp: r.weeklyXp,
        streak: r.streak,
        is_me: r.isMe,
      }));
    window.localStorage.setItem(
      cacheKey(tab),
      JSON.stringify({
        v: VERSION,
        userId,
        updatedAt: board.updatedAt,
        rows: wire(board.rows),
        lastWeek: wire(board.lastWeek),
      }),
    );
  } catch {
    // Storage full or unavailable: the board just is not cached.
  }
}

/** Drops one cached board (after leaving that group). */
export function clearCachedBoard(tab: BoardTab) {
  try {
    window.localStorage.removeItem(cacheKey(tab));
  } catch {
    // Nothing to clear.
  }
}

/** Drops every cached board (sign-out, deletion, another user). */
export function clearCachedBoards() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

/** Reads this week's ranking and last week's podium from the server. Throws `LeagueError`. */
export async function fetchBoard(tab: BoardTab): Promise<Board> {
  const args = tab.scope === "global" ? { scope: "global" } : { scope: "group", code: tab.code };
  const [rows, lastWeek] = await Promise.all([
    leagueRpc<unknown>("league_ranking", args),
    leagueRpc<unknown>("league_podium", args),
  ]);
  return { rows: parseRows(rows), lastWeek: parseRows(lastWeek), updatedAt: Date.now() };
}

// ---------------------------------------------------------------------------------------------
// Hook

function tabFromKey(key: string): BoardTab {
  return key.startsWith("group:") ? { scope: "group", code: key.slice(6) } : GLOBAL_TAB;
}

export interface LeaderboardState {
  board: Board | null;
  /** First load, nothing cached to show yet. */
  loading: boolean;
  /** A request is in flight (also when a board is already shown). */
  refreshing: boolean;
  /** The last request failed (offline or server): `board`, if any, is the cached one. */
  failed: boolean;
  /** Milliseconds since epoch, refreshed every 30 s (drives the countdown and "hace …"). */
  now: number;
  refresh: () => void;
}

/**
 * The board of `tab`, cached and kept fresh. `enabled` = joined and the tab usable (e.g. false for
 * a group the caller is no longer in).
 */
export function useLeaderboard(tab: BoardTab, enabled: boolean): LeaderboardState {
  const key = tabKey(tab);
  /** The latest server answer (or failure) and which board it was for. */
  const [result, setResult] = useState<{ key: string; board: Board | null; failed: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const request = useRef(0);
  const lastRun = useRef(0);
  const inFlight = useRef(false);

  // The cached board shows straight away (this component only mounts on the client, joined).
  const cached = useMemo(
    () => (enabled ? readCachedBoard(tabFromKey(key), getLeagueAccount().userId) : null),
    [key, enabled],
  );
  const current = result?.key === key ? result : null;
  const board = current?.board ?? cached;
  const failed = current?.failed ?? false;
  const loading = enabled && !board && !failed;

  const load = useCallback(
    async (force: boolean) => {
      const account = getLeagueAccount();
      const userId = account.userId;
      if (!enabled || account.status !== "joined" || !userId) return;
      if (!force && (inFlight.current || Date.now() - lastRun.current < MIN_INTERVAL)) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setResult((r) => ({ key, board: r?.key === key ? r.board : null, failed: true }));
        return;
      }
      const id = ++request.current;
      inFlight.current = true;
      lastRun.current = Date.now();
      setRefreshing(true);
      try {
        const fresh = await fetchBoard(tabFromKey(key));
        if (id !== request.current || getLeagueAccount().userId !== userId) return;
        writeCachedBoard(tabFromKey(key), userId, fresh);
        setResult({ key, board: fresh, failed: false });
      } catch {
        if (id !== request.current) return;
        setResult((r) => ({ key, board: r?.key === key ? r.board : null, failed: true }));
      } finally {
        if (id === request.current) {
          inFlight.current = false;
          setRefreshing(false);
        }
      }
    },
    [enabled, key],
  );

  // New tab: read the server (the answer of the previous one is ignored).
  useEffect(() => {
    inFlight.current = false;
    lastRun.current = 0;
    const start = setTimeout(() => void load(true), 0);
    return () => {
      clearTimeout(start);
      request.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    let awardTimer: ReturnType<typeof setTimeout> | undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    const onFocus = () => void load(false);
    const onOnline = () => void load(true);
    const unsubscribeXp = subscribeXpAwards(() => {
      if (awardTimer !== undefined) clearTimeout(awardTimer);
      awardTimer = setTimeout(() => void load(true), AWARD_REFRESH_DELAY);
    });
    // Another user (or leaving) invalidates what is shown; joining reads the table again.
    const unsubscribeAccount = subscribeLeagueAccount((change) => {
      if (change === "signed_out" || change === "deleted" || change === "user_changed") {
        clearCachedBoards();
        setResult(null);
      }
      if (change === "joined" || change === "user_changed") void load(true);
    });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      // The week rolled over since the last read: the table is a new one.
      if (lastRun.current && nextWeekReset(lastRun.current) <= t) void load(true);
    }, 30_000);
    return () => {
      if (awardTimer !== undefined) clearTimeout(awardTimer);
      unsubscribeXp();
      unsubscribeAccount();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      clearInterval(tick);
    };
  }, [enabled, load]);

  const refresh = useCallback(() => void load(true), [load]);
  return { board, loading, refreshing, failed, now, refresh };
}
