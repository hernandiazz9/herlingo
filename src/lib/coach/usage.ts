/**
 * The last usage summary seen (`GET /api/coach/usage/`), kept on the device so the budget line
 * shows at once and offline. Generation responses patch it until the next refresh.
 */
import { parseUsage } from "./parse";
import { COACH_KEYS, readRaw, readVersioned, writeJson } from "./store";
import type { CoachUsage, GenerationUsage } from "./types";

const VERSION = 1;

export interface StoredUsage {
  usage: CoachUsage;
  /** Epoch ms it was received. */
  at: number;
}

export const readUsageRaw = (): string => readRaw(COACH_KEYS.usage);

export function parseStoredUsage(raw: string): StoredUsage | null {
  const v = readVersioned(raw, VERSION);
  const usage = parseUsage(v?.usage);
  if (!v || !usage) return null;
  return { usage, at: typeof v.at === "number" && Number.isFinite(v.at) ? v.at : 0 };
}

export function getStoredUsage(): StoredUsage | null {
  if (typeof window === "undefined") return null;
  return parseStoredUsage(readUsageRaw());
}

export function storeUsage(usage: CoachUsage): void {
  writeJson(COACH_KEYS.usage, { v: VERSION, at: Date.now(), usage });
}

/** Applies a generation's cost and the server's remaining budget / daily count to the stored summary. */
export function noteGeneration(g: GenerationUsage, newPack: boolean): void {
  const stored = getStoredUsage();
  if (!stored) return;
  const u = stored.usage;
  storeUsage({
    ...u,
    spentUsd: u.spentUsd + g.costUsd,
    mineUsd: u.mineUsd + g.costUsd,
    remainingUsd: g.remainingUsd,
    today: g.today.limit > 0 ? g.today : u.today,
    packs: u.packs + (newPack ? 1 : 0),
  });
}

/**
 * Applies a quick route's cost, the remaining budget and the route counter (`g.today` of a route
 * response) to the stored summary; the generations counter (`today`) is left as it is.
 */
export function noteRoute(g: GenerationUsage): void {
  const stored = getStoredUsage();
  if (!stored) return;
  const u = stored.usage;
  const before = u.routes ?? 0;
  const routes = before + 1;
  const routesToday = g.today.limit > 0 ? g.today : u.routesToday;
  storeUsage({
    ...u,
    spentUsd: u.spentUsd + g.costUsd,
    mineUsd: u.mineUsd + g.costUsd,
    remainingUsd: g.remainingUsd,
    routes,
    avgRouteUsd: ((u.avgRouteUsd ?? 0) * before + g.costUsd) / routes,
    ...(routesToday ? { routesToday } : {}),
  });
}

/**
 * Applies an AI episode's cost, the remaining budget and the episode counter (`g.today` of an
 * episode response) to the stored summary; the other counters are left as they are.
 */
export function noteEpisode(g: GenerationUsage): void {
  const stored = getStoredUsage();
  if (!stored) return;
  const u = stored.usage;
  const before = u.episodes ?? 0;
  const episodes = before + 1;
  const episodesToday = g.today.limit > 0 ? g.today : u.episodesToday;
  storeUsage({
    ...u,
    spentUsd: u.spentUsd + g.costUsd,
    mineUsd: u.mineUsd + g.costUsd,
    remainingUsd: g.remainingUsd,
    episodes,
    avgEpisodeUsd: ((u.avgEpisodeUsd ?? 0) * before + g.costUsd) / episodes,
    ...(episodesToday ? { episodesToday } : {}),
  });
}

/** What `noteMockCall` reads of a Mi entrevista response's `usage` (`MockCallUsage` in `@/lib/mock-interview`). */
export interface MockCallNote {
  costUsd: number;
  /** Null when no call was made (the interviewer's canned move-on): nothing billed, nothing counted. */
  model: string | null;
  remainingUsd: number;
  today: { used: number; limit: number };
}

const MOCK_COUNTS = {
  turn: ["turns", "avgTurnUsd"],
  answer: ["answers", "avgAnswerUsd"],
  report: ["reports", "avgReportUsd"],
} as const;

/**
 * Applies a Mi entrevista call (`kind` as billed: an interviewer turn, an answer's feedback or a
 * report) to the stored summary's `mock` block: its spend, count and average, the remaining budget
 * and today's answers. Prepárate's figures are left as they are; nothing happens without a stored
 * `mock` block (not the owner, or never fetched).
 */
export function noteMockCall(call: MockCallNote, kind: keyof typeof MOCK_COUNTS): void {
  const stored = getStoredUsage();
  const mock = stored?.usage.mock;
  if (!stored || !mock) return;
  const today = call.today.limit > 0 ? call.today : mock.today;
  if (call.model === null) {
    storeUsage({ ...stored.usage, mock: { ...mock, remainingUsd: call.remainingUsd, today } });
    return;
  }
  const [count, avg] = MOCK_COUNTS[kind];
  const before = mock[count];
  storeUsage({
    ...stored.usage,
    mock: {
      ...mock,
      spentUsd: mock.spentUsd + call.costUsd,
      remainingUsd: call.remainingUsd,
      today,
      [count]: before + 1,
      [avg]: (mock[avg] * before + call.costUsd) / (before + 1),
    },
  });
}

/** "3,20 $": Spain Spanish amount in US dollars. */
export function formatUsd(amount: number, decimals = 2): string {
  const n = amount.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${n} $`;
}
