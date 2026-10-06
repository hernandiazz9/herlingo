/**
 * Liga XP sync (docs/league.md → "Sync"): queues every XP award made while joined in the outbox
 * and sends it, with the device's profile stats, to `league_record_xp`. Started once per page by
 * `<LeagueSync />` (root layout), which loads this module lazily and only when Liga is configured.
 *
 * Flushes on start, on join (or signing in to another account), when the device comes back
 * online, when the app becomes visible again and shortly after each award. Ids make resends
 * harmless; only events listed in the server's `results` leave the outbox; failures back off
 * exponentially. Nothing here throws: the offline app never waits for or notices the sync.
 */
import { listLangs } from "@/lib/content";
import { getGlobalStreak, getProgress, subscribeXpAwards } from "@/lib/progress";
import { getLeagueAccount, refreshLeagueAccount, subscribeLeagueAccount, type LeagueAccountChange } from "./account";
import { leagueRpc } from "./client";
import { leagueEnabled } from "./config";
import { isLeagueError, LeagueError } from "./errors";
import { leagueLang } from "./lang";
import { acknowledge, clearOutboxes, enqueueXp, outboxLangs, pendingEvents, sentStats, type OutboxEvent } from "./outbox";

/** `league.max_batch()` on the server. */
const MAX_BATCH = 200;
/** Wait after an award before sending it (several quick awards go in one call). */
const AWARD_DELAY = 1_000;
const BACKOFF_MIN = 5_000;
const BACKOFF_MAX = 10 * 60_000;

/** `stats` argument of `league_record_xp`. */
interface LeagueStats {
  lang: string;
  total_xp: number;
  streak_count: number;
  streak_best: number;
}

interface RecordXpResponse {
  results?: { id?: unknown; status?: unknown; amount?: unknown }[];
  xp_added?: number;
}

let started = false;
let running: Promise<void> | null = null;
let again = false;
/** Send the stats even if unchanged (join / account change); kept until a flush succeeds. */
let forceStats = false;
let failures = 0;
let retryAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Supabase user id when this device has joined (cached account), else null. */
function joinedUser(): string | null {
  const account = getLeagueAccount();
  return account.status === "joined" && account.userId ? account.userId : null;
}

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/**
 * The device's totals for `lang`: its total XP, and the global streak (any language; 0 once
 * lapsed) and global best, the same in every language's stats.
 */
function statsFor(lang: string): LeagueStats {
  const p = getProgress(lang);
  const streak = getGlobalStreak();
  return { lang, total_xp: p.xp, streak_count: streak.count, streak_best: streak.best };
}

const signature = (s: LeagueStats) => `${s.total_xp}|${s.streak_count}|${s.streak_best}`;

/** Packs with progress on this device, the default pack, and any pack with queued events. */
function langsToSync(): string[] {
  const langs = new Set([leagueLang(), ...outboxLangs()]);
  for (const lang of listLangs()) {
    const p = getProgress(lang);
    if (p.xp > 0 || p.streak.best > 0) langs.add(lang);
  }
  return [...langs];
}

const toWire = (e: OutboxEvent) => ({ id: e.id, lang: e.lang, amount: e.amount, source: e.source, earned_at: e.earnedAt });

/** Sends the queued events of one pack in batches, with its stats. Throws `LeagueError`. */
async function flushLang(lang: string, userId: string, force: boolean): Promise<void> {
  const stats = statsFor(lang);
  const sig = signature(stats);
  /** A call with `events: []` is only worth it when the stats changed (or on join). */
  let statsDue = force || sentStats(lang, userId) !== sig;
  /** False once the server refused these stats (`stats_invalid`): send the events without them. */
  let withStats = true;
  for (;;) {
    const batch = pendingEvents(lang, userId).slice(0, MAX_BATCH);
    if (batch.length === 0 && !(statsDue && withStats)) return;
    let response: RecordXpResponse;
    try {
      // Every call carries the device's current stats (docs/league.md: on join and with each flush).
      response = await leagueRpc<RecordXpResponse>("league_record_xp", {
        events: batch.map(toWire),
        stats: withStats ? stats : null,
      });
    } catch (error) {
      if (withStats && isLeagueError(error) && error.code === "stats_invalid") {
        // Never block the events on stats the server refuses: remember them as handled.
        acknowledge(lang, userId, [], sig);
        withStats = false;
        statsDue = false;
        continue;
      }
      throw error;
    }
    // The account changed while the call was in flight: its outbox is no longer ours.
    if (joinedUser() !== userId) return;
    const ids = new Set<string>();
    for (const r of Array.isArray(response?.results) ? response.results : []) {
      if (typeof r?.id === "string") ids.add(r.id.toLowerCase());
    }
    acknowledge(lang, userId, ids, withStats ? sig : undefined);
    statsDue = false;
    // Every status is final, so each sent id comes back; if none did, stop instead of looping.
    if (batch.length > 0 && !batch.some((e) => ids.has(e.id.toLowerCase()))) {
      throw new LeagueError("unknown", "league_record_xp acknowledged no event");
    }
  }
}

function schedule(ms: number) {
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void flushLeague();
  }, Math.max(0, ms));
}

function backOff(error: unknown) {
  failures += 1;
  const delay = Math.min(BACKOFF_MAX, BACKOFF_MIN * 2 ** (failures - 1));
  const jittered = Math.round(delay * (0.8 + Math.random() * 0.4));
  retryAt = Date.now() + jittered;
  schedule(jittered);
  // The server no longer knows this session or profile: re-check the account (it may sign out,
  // which clears the outbox through the account listener).
  if (isLeagueError(error) && (error.code === "not_authenticated" || error.code === "no_profile")) {
    void refreshLeagueAccount({ force: true });
  }
}

async function run(): Promise<void> {
  const userId = joinedUser();
  if (!userId || !online()) return;
  const wait = retryAt - Date.now();
  if (wait > 0) {
    schedule(wait);
    return;
  }
  const force = forceStats;
  forceStats = false;
  try {
    for (const lang of langsToSync()) await flushLang(lang, userId, force);
    failures = 0;
    retryAt = 0;
  } catch (error) {
    if (force) forceStats = true;
    backOff(error);
  }
}

/**
 * Sends what is queued now (no-op when Liga is disabled, not joined, offline or backing off).
 * `stats`: send the profile stats even if unchanged. `reset`: forget the back-off (connectivity
 * came back, account changed). Concurrent calls coalesce. Never rejects.
 */
export function flushLeague(options: { stats?: boolean; reset?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined" || !leagueEnabled()) return Promise.resolve();
  if (options.stats) forceStats = true;
  if (options.reset) {
    failures = 0;
    retryAt = 0;
  }
  if (running) {
    again = true;
    return running;
  }
  running = run()
    .catch(() => {
      // Never surface sync errors.
    })
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void flushLeague();
      }
    });
  return running;
}

/**
 * Applies an account change: signing out, deleting the data or switching user drops the queued
 * events (they belong to the previous user); joining (or signing in to an account with a profile)
 * flushes with the stats. Transient changes (`status`, `updated`) never clear the outbox.
 */
function onAccount(change: LeagueAccountChange) {
  if (change === "signed_out" || change === "deleted" || change === "user_changed") clearOutboxes();
  if (!joinedUser()) return;
  if (change === "joined" || change === "user_changed") void flushLeague({ stats: true, reset: true });
}

/** Starts the sync for this page (idempotent; does nothing when Liga is not configured). */
export function startLeagueSync(): void {
  if (started || typeof window === "undefined" || !leagueEnabled()) return;
  started = true;
  try {
    subscribeXpAwards((award) => {
      const userId = joinedUser();
      if (!userId || !enqueueXp(userId, award)) return;
      if (Date.now() >= retryAt) schedule(AWARD_DELAY);
    });
    subscribeLeagueAccount(onAccount);
    window.addEventListener("online", () => void flushLeague({ reset: true }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void flushLeague();
    });
    if (joinedUser()) void flushLeague();
    else clearOutboxes();
  } catch {
    // Storage or events unavailable: Liga simply does not sync on this page.
  }
}
