/**
 * Spend ledger and limits. Every key starts with `langlern:` (the Upstash database may be shared).
 * Money is stored as integer micro-dollars (1 USD = 1 000 000) and only ever `incrby`'d.
 *
 *   langlern:coach:cap                          monthly cap (micro-USD), set by the owner
 *   langlern:coach:<YYYY-MM>:spend              spent this month, all codes
 *   langlern:coach:<YYYY-MM>:spend:<name>       spent this month by one access code
 *   langlern:coach:<YYYY-MM>:tokens:<kind>      input | output | cacheWrite | cacheRead
 *   langlern:coach:<YYYY-MM>:packs              new packs generated (refinements excluded)
 *   langlern:coach:<YYYY-MM>:packSpend          what those packs cost
 *   langlern:coach:<YYYY-MM-DD>:gen:<name>      generations today by one code (expires in 2 days)
 *   langlern:coach:refine:<packId>              refinements of one pack (expires in 180 days)
 */
import type { Caller } from "./access";
import { dailyLimit, defaultCapUsd, timeZone } from "./config";
import { CoachError } from "./http";
import { costMicroUsd, sumUsage, type Charge } from "./model";
import { LIMITS } from "./schema";
import { getStore } from "./store";

const PREFIX = "langlern:coach";
const MICRO = 1_000_000;
const DAY_TTL = 2 * 24 * 3600;
const REFINE_TTL = 180 * 24 * 3600;
const TOKEN_KINDS = ["input", "output", "cacheWrite", "cacheRead"] as const;

export type CallKind = "pack" | "refine" | "interview";

function periods(now = new Date()): { month: string; day: string } {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { month: day.slice(0, 7), day };
}

const keys = {
  cap: () => `${PREFIX}:cap`,
  spend: (month: string) => `${PREFIX}:${month}:spend`,
  spendBy: (month: string, name: string) => `${PREFIX}:${month}:spend:${name}`,
  tokens: (month: string, kind: string) => `${PREFIX}:${month}:tokens:${kind}`,
  packs: (month: string) => `${PREFIX}:${month}:packs`,
  packSpend: (month: string) => `${PREFIX}:${month}:packSpend`,
  generations: (day: string, name: string) => `${PREFIX}:${day}:gen:${name}`,
  refinements: (packId: string) => `${PREFIX}:refine:${packId}`,
};

const toUsd = (micro: number) => Math.round(micro) / MICRO;

async function capMicro(): Promise<number> {
  return (await getStore().get(keys.cap())) ?? Math.round(defaultCapUsd() * MICRO);
}

export async function setCapUsd(capUsd: number): Promise<void> {
  await getStore().set(keys.cap(), Math.round(capUsd * MICRO));
}

/** 429 once this month's spend has reached the cap. */
export async function assertBudget(): Promise<void> {
  const store = getStore();
  const [spent, cap] = await Promise.all([store.get(keys.spend(periods().month)), capMicro()]);
  if ((spent ?? 0) >= cap) {
    throw new CoachError(429, "budget", "Se ha agotado el presupuesto de este mes.");
  }
}

/** Takes one of today's generations for this code (429 when none is left). Returns a refund. */
export async function reserveGeneration(caller: Caller): Promise<() => Promise<void>> {
  const store = getStore();
  const key = keys.generations(periods().day, caller.name);
  const used = await store.incrby(key, 1, DAY_TTL);
  const refund = async () => void (await store.incrby(key, -1));
  if (used > dailyLimit()) {
    await refund();
    throw new CoachError(429, "daily_limit", "Has llegado al límite de hoy. Vuelve mañana.");
  }
  return refund;
}

/** Takes one of the pack's refinements (server count, or the pack's own if higher). */
export async function reserveRefinement(packId: string, previousCount: number): Promise<() => Promise<void>> {
  const store = getStore();
  const key = keys.refinements(packId);
  const stored = await store.incrby(key, 1, REFINE_TTL);
  const refund = async () => void (await store.incrby(key, -1));
  if (Math.max(stored, previousCount + 1) > LIMITS.refinementsPerPack) {
    await refund();
    throw new CoachError(429, "refine_limit", "Ya has ajustado esta situación 3 veces.");
  }
  return refund;
}

/** Adds one Claude call (every model attempt in it) to the ledger. Returns its cost in micro-dollars. */
export async function recordCall(caller: Caller, kind: CallKind, charges: Charge[]): Promise<number> {
  const store = getStore();
  const { month } = periods();
  const cost = charges.reduce((sum, c) => sum + costMicroUsd(c.model, c.usage), 0);
  const usage = sumUsage(charges);
  const writes: Promise<number>[] = [
    store.incrby(keys.spend(month), cost),
    store.incrby(keys.spendBy(month, caller.name), cost),
    ...TOKEN_KINDS.filter((k) => usage[k] > 0).map((k) => store.incrby(keys.tokens(month, k), usage[k])),
  ];
  if (kind === "pack") writes.push(store.incrby(keys.packs(month), 1), store.incrby(keys.packSpend(month), cost));
  await Promise.all(writes);
  return cost;
}

export interface UsageSummary {
  month: string;
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  packs: number;
  avgPackUsd: number;
  today: { used: number; limit: number };
  isOwner: boolean;
  /** Spent this month by the caller's own code. */
  mineUsd: number;
}

export async function readUsage(caller: Caller): Promise<UsageSummary> {
  const store = getStore();
  const { month, day } = periods();
  const [spent, mine, input, output, cacheWrite, cacheRead, packs, packSpend, used] = (
    await store.mget([
      keys.spend(month),
      keys.spendBy(month, caller.name),
      ...TOKEN_KINDS.map((k) => keys.tokens(month, k)),
      keys.packs(month),
      keys.packSpend(month),
      keys.generations(day, caller.name),
    ])
  ).map((v) => v ?? 0);
  const cap = await capMicro();
  return {
    month,
    spentUsd: toUsd(spent),
    capUsd: toUsd(cap),
    remainingUsd: toUsd(Math.max(cap - spent, 0)),
    tokens: { input, output, cacheRead, cacheWrite },
    packs,
    avgPackUsd: packs > 0 ? toUsd(packSpend / packs) : 0,
    today: { used: Math.min(used, dailyLimit()), limit: dailyLimit() },
    isOwner: caller.isOwner,
    mineUsd: toUsd(mine),
  };
}
