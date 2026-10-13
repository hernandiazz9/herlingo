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
 *   langlern:coach:<YYYY-MM>:routes             quick routes billed (Modo rápido)
 *   langlern:coach:<YYYY-MM>:routeSpend         what those routes cost
 *   langlern:coach:<YYYY-MM-DD>:gen:<name>      generations today by one code (expires in 2 days)
 *   langlern:coach:<YYYY-MM-DD>:steps:<name>    interview steps today by one code (expires in 2 days)
 *   langlern:coach:<YYYY-MM-DD>:tts:<name>      voice lines today by one code (expires in 2 days)
 *   langlern:coach:<YYYY-MM-DD>:route:<name>    quick routes today by one code (expires in 2 days)
 *   langlern:coach:pack:<name>:<packId>         a pack this server issued to one code, and its
 *                                               refinements (expires in 180 days)
 *
 * A slot (generation, step, refinement, route) is given back only when the call failed before Claude
 * billed anything: once a response has been charged, the slot stays used.
 */
import type { Caller } from "./access.js";
import { dailyLimit, defaultCapUsd, routeDailyLimit, timeZone, ttsDailyLimit } from "./config.js";
import { CoachError } from "./http.js";
import { costMicroUsd, sumUsage, type Charge } from "./model.js";
import { LIMITS } from "./schema.js";
import { getStore } from "./store.js";

const PREFIX = "langlern:coach";
const MICRO = 1_000_000;
const DAY_TTL = 2 * 24 * 3600;
const REFINE_TTL = 180 * 24 * 3600;
const TOKEN_KINDS = ["input", "output", "cacheWrite", "cacheRead"] as const;

export type CallKind = "pack" | "refine" | "interview" | "route";

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
  routes: (month: string) => `${PREFIX}:${month}:routes`,
  routeSpend: (month: string) => `${PREFIX}:${month}:routeSpend`,
  generations: (day: string, name: string) => `${PREFIX}:${day}:gen:${name}`,
  steps: (day: string, name: string) => `${PREFIX}:${day}:steps:${name}`,
  tts: (day: string, name: string) => `${PREFIX}:${day}:tts:${name}`,
  route: (day: string, name: string) => `${PREFIX}:${day}:route:${name}`,
  pack: (name: string, packId: string) => `${PREFIX}:pack:${name}:${packId}`,
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

export type Refund = () => Promise<void>;

const DAILY_LIMIT_MESSAGE = "Has llegado al límite de hoy. Vuelve mañana.";

/** `incrby` a counter by one; over `limit` → undo + 429. Returns the new count and its undo. */
async function take(key: string, limit: number, ttl: number, error: () => CoachError): Promise<{ count: number; refund: Refund }> {
  const store = getStore();
  const count = await store.incrby(key, 1, ttl);
  const refund = async () => void (await store.incrby(key, -1));
  if (count > limit) {
    await refund();
    throw error();
  }
  return { count, refund };
}

const dailyLimitError = () => new CoachError(429, "daily_limit", DAILY_LIMIT_MESSAGE);

/** Takes one of today's generations for this code (429 when none is left). Returns a refund. */
export async function reserveGeneration(caller: Caller): Promise<Refund> {
  return (await take(keys.generations(periods().day, caller.name), dailyLimit(), DAY_TTL, dailyLimitError)).refund;
}

/**
 * Takes one of today's quick routes for this code (its own counter: routes never use the
 * generations). 429 `daily_limit` when none is left. Returns a refund.
 */
export async function reserveRoute(caller: Caller): Promise<Refund> {
  return (
    await take(keys.route(periods().day, caller.name), routeDailyLimit(), DAY_TTL, () => {
      return new CoachError(429, "daily_limit", "Has llegado al límite de rutas de hoy. Vuelve mañana.");
    })
  ).refund;
}

/** Billed interview steps a code may take per day: one whole interview (questions + assessment) per generation. */
export const interviewStepsPerDay = (): number => dailyLimit() * (LIMITS.interviewTurns + 1);

/**
 * Takes one of today's interview steps for this code, whatever `history` the client sends: every
 * step is a billed Claude call. 429 when none is left. Returns a refund.
 */
export async function reserveInterviewStep(caller: Caller): Promise<Refund> {
  return (await take(keys.steps(periods().day, caller.name), interviewStepsPerDay(), DAY_TTL, dailyLimitError)).refund;
}

/** Records a pack id this server just issued to the code: only those can be refined. */
export async function registerPack(caller: Caller, packId: string): Promise<void> {
  await getStore().set(keys.pack(caller.name, packId), 0, REFINE_TTL);
}

/**
 * Takes one of the refinements of a pack this server issued to the code. Unknown id (never issued
 * to this code, or older than 180 days) → 409 `unknown_pack`; over the limit → 429. Returns the
 * refinement number it took (1–3) and a refund. The count sent by the client is never trusted.
 */
export async function reserveRefinement(caller: Caller, packId: string): Promise<{ count: number; refund: Refund }> {
  const key = keys.pack(caller.name, packId);
  if ((await getStore().get(key)) === null) {
    throw new CoachError(409, "unknown_pack", "No puedo ajustar esta situación. Prepara una nueva.");
  }
  return take(
    key,
    LIMITS.refinementsPerPack,
    REFINE_TTL,
    () => new CoachError(429, "refine_limit", `Ya has ajustado esta situación ${LIMITS.refinementsPerPack} veces.`),
  );
}

/** Counts one voice line for the code today (429 `tts_limit` when the day's allowance is used up). */
export async function reserveTts(caller: Caller): Promise<void> {
  await take(keys.tts(periods().day, caller.name), ttsDailyLimit(), DAY_TTL, () => {
    return new CoachError(429, "tts_limit", "Has llegado al límite de audio de hoy. Vuelve mañana.");
  });
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
  if (kind === "route") writes.push(store.incrby(keys.routes(month), 1), store.incrby(keys.routeSpend(month), cost));
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
  /** The caller's generations today (packs, refinements, first interview steps); routes not included. */
  today: { used: number; limit: number };
  /** Quick routes billed this month (a failed attempt counts, since it was paid) and their average cost. */
  routes: number;
  avgRouteUsd: number;
  /** The caller's quick routes today (their own counter). */
  routesToday: { used: number; limit: number };
  isOwner: boolean;
  /** Spent this month by the caller's own code. */
  mineUsd: number;
}

export async function readUsage(caller: Caller): Promise<UsageSummary> {
  const store = getStore();
  const { month, day } = periods();
  const [spent, mine, input, output, cacheWrite, cacheRead, packs, packSpend, used, routes, routeSpend, routesUsed] = (
    await store.mget([
      keys.spend(month),
      keys.spendBy(month, caller.name),
      ...TOKEN_KINDS.map((k) => keys.tokens(month, k)),
      keys.packs(month),
      keys.packSpend(month),
      keys.generations(day, caller.name),
      keys.routes(month),
      keys.routeSpend(month),
      keys.route(day, caller.name),
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
    routes,
    avgRouteUsd: routes > 0 ? toUsd(routeSpend / routes) : 0,
    routesToday: { used: Math.min(routesUsed, routeDailyLimit()), limit: routeDailyLimit() },
    isOwner: caller.isOwner,
    mineUsd: toUsd(mine),
  };
}
