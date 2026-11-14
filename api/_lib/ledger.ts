/**
 * Spend ledger and limits. Every key starts with `langlern:` (the Upstash database may be shared).
 * Money is stored as integer micro-dollars (1 USD = 1 000 000) and only ever `incrby`'d.
 *
 *   langlern:coach:cap                          Prepárate's monthly cap (micro-USD), set by the owner
 *   langlern:coach:<YYYY-MM>:spend              spent this month, all codes, Prepárate + Mi entrevista
 *   langlern:coach:<YYYY-MM>:spend:<name>       spent this month on Prepárate by one access code
 *   langlern:coach:<YYYY-MM>:tokens:<kind>      input | output | cacheWrite | cacheRead
 *   langlern:coach:<YYYY-MM>:packs              new packs generated (refinements excluded)
 *   langlern:coach:<YYYY-MM>:packSpend          what those packs cost
 *   langlern:coach:<YYYY-MM>:routes             quick routes billed (Modo rápido)
 *   langlern:coach:<YYYY-MM>:routeSpend         what those routes cost
 *   langlern:coach:<YYYY-MM>:episodes           AI episodes billed (Modo deporte)
 *   langlern:coach:<YYYY-MM>:episodeSpend       what those episodes cost
 *   langlern:coach:<YYYY-MM-DD>:gen:<name>      generations today by one code (expires in 2 days)
 *   langlern:coach:<YYYY-MM-DD>:steps:<name>    interview steps today by one code (expires in 2 days)
 *   langlern:coach:<YYYY-MM-DD>:tts:<name>      voice lines today by one code (expires in 2 days)
 *   langlern:coach:<YYYY-MM-DD>:route:<name>    quick routes today by one code (expires in 2 days)
 *   langlern:coach:<YYYY-MM-DD>:episode:<name>  AI episodes today by one code (expires in 2 days)
 *   langlern:coach:pack:<name>:<packId>         a pack this server issued to one code, and its
 *                                               refinements (expires in 180 days)
 *   langlern:coach:mock:deck:<name>             Mi entrevista's deck, one JSON string (deck.ts; not a counter)
 *
 * Mi entrevista (docs/mock-interview.md "Ledger"), its own budget and counters:
 *   langlern:coach:mockCap                      its monthly cap (micro-USD), set by the owner
 *   langlern:coach:<YYYY-MM>:mockSpend          its spend this month (also in `spend`, never in `spend:<name>`)
 *   langlern:coach:<YYYY-MM>:answers            corrected answers billed / answerSpend = their cost
 *   langlern:coach:<YYYY-MM>:turns              interviewer turns billed / turnSpend = their cost
 *   langlern:coach:<YYYY-MM>:reports            simulacro reports billed / reportSpend = their cost
 *   langlern:coach:<YYYY-MM-DD>:mock:<name>     answers + reports today by one code (expires in 2 days)
 *   langlern:coach:<YYYY-MM-DD>:mockturn:<name> interviewer turns today by one code (expires in 2 days)
 *
 * Prepárate's budget is `spend − mockSpend` against `cap`; Mi entrevista's is `mockSpend` against
 * `mockCap`: neither feature's spend blocks the other.
 *
 * A slot (generation, step, refinement, route, episode, answer, turn) is given back only when the call failed
 * before Claude billed anything: once a response has been charged, the slot stays used.
 */
import type { Caller } from "./access.js";
import {
  dailyLimit,
  defaultCapUsd,
  defaultMockCapUsd,
  episodeDailyLimit,
  isFake,
  mockDailyLimit,
  routeDailyLimit,
  timeZone,
  ttsDailyLimit,
} from "./config.js";
import { CoachError } from "./http.js";
import { costMicroUsd, sumUsage, type Charge, type TokenUsage } from "./model.js";
import { LIMITS } from "./schema.js";
import { getStore } from "./store.js";

const PREFIX = "langlern:coach";
const MICRO = 1_000_000;
const DAY_TTL = 2 * 24 * 3600;
const REFINE_TTL = 180 * 24 * 3600;
const TOKEN_KINDS = ["input", "output", "cacheWrite", "cacheRead"] as const;

export type CallKind = "pack" | "refine" | "interview" | "route" | "episode" | MockCallKind;
/** Mi entrevista's calls: an interviewer turn, an answer's feedback, a simulacro report. */
export type MockCallKind = "turn" | "answer" | "report";

const isMock = (kind: CallKind): kind is MockCallKind => kind === "turn" || kind === "answer" || kind === "report";

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
  episodes: (month: string) => `${PREFIX}:${month}:episodes`,
  episodeSpend: (month: string) => `${PREFIX}:${month}:episodeSpend`,
  generations: (day: string, name: string) => `${PREFIX}:${day}:gen:${name}`,
  steps: (day: string, name: string) => `${PREFIX}:${day}:steps:${name}`,
  tts: (day: string, name: string) => `${PREFIX}:${day}:tts:${name}`,
  route: (day: string, name: string) => `${PREFIX}:${day}:route:${name}`,
  episode: (day: string, name: string) => `${PREFIX}:${day}:episode:${name}`,
  pack: (name: string, packId: string) => `${PREFIX}:pack:${name}:${packId}`,
  mockCap: () => `${PREFIX}:mockCap`,
  mockSpend: (month: string) => `${PREFIX}:${month}:mockSpend`,
  /** Per Mi entrevista call kind: billed calls this month and their cost. */
  mockCount: (month: string, kind: MockCallKind) => `${PREFIX}:${month}:${kind}s`,
  mockKindSpend: (month: string, kind: MockCallKind) => `${PREFIX}:${month}:${kind}Spend`,
  mock: (day: string, name: string) => `${PREFIX}:${day}:mock:${name}`,
  mockTurn: (day: string, name: string) => `${PREFIX}:${day}:mockturn:${name}`,
};

const toUsd = (micro: number) => Math.round(micro) / MICRO;

async function capMicro(): Promise<number> {
  return (await getStore().get(keys.cap())) ?? Math.round(defaultCapUsd() * MICRO);
}

export async function setCapUsd(capUsd: number): Promise<void> {
  await getStore().set(keys.cap(), Math.round(capUsd * MICRO));
}

async function mockCapMicro(): Promise<number> {
  return (await getStore().get(keys.mockCap())) ?? Math.round(defaultMockCapUsd() * MICRO);
}

export async function setMockCapUsd(capUsd: number): Promise<void> {
  await getStore().set(keys.mockCap(), Math.round(capUsd * MICRO));
}

/** Prepárate: 429 once this month's spend without Mi entrevista's has reached the cap. */
export async function assertBudget(): Promise<void> {
  const { month } = periods();
  const [[spent, mock], cap] = await Promise.all([getStore().mget([keys.spend(month), keys.mockSpend(month)]), capMicro()]);
  if ((spent ?? 0) - (mock ?? 0) >= cap) {
    throw new CoachError(429, "budget", "Se ha agotado el presupuesto de este mes.");
  }
}

/** Mi entrevista: 429 once its own spend this month has reached its own cap. */
export async function assertMockBudget(): Promise<void> {
  const [spent, cap] = await Promise.all([getStore().get(keys.mockSpend(periods().month)), mockCapMicro()]);
  if ((spent ?? 0) >= cap) {
    throw new CoachError(429, "budget", "Se ha agotado el presupuesto de Mi entrevista de este mes.");
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

/**
 * Takes one of today's AI episodes (Modo deporte) for this code (its own counter: episodes never
 * use the generations or the routes). 429 `daily_limit` when none is left. Returns a refund.
 */
export async function reserveEpisode(caller: Caller): Promise<Refund> {
  return (
    await take(keys.episode(periods().day, caller.name), episodeDailyLimit(), DAY_TTL, () => {
      return new CoachError(429, "daily_limit", "Has llegado al límite de episodios de hoy. Vuelve mañana.");
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

const MOCK_DAILY_MESSAGE = "Has llegado al límite de respuestas de hoy. Vuelve mañana.";

/**
 * Takes one of today's Mi entrevista answers for this code: an answer's feedback or a simulacro
 * report. 429 `daily_limit` when none is left. Returns a refund.
 */
export async function reserveMockAnswer(caller: Caller): Promise<Refund> {
  return (
    await take(keys.mock(periods().day, caller.name), mockDailyLimit(), DAY_TTL, () => {
      return new CoachError(429, "daily_limit", MOCK_DAILY_MESSAGE);
    })
  ).refund;
}

/** Interviewer turns a code may take per day: two per answer. */
export const mockTurnsPerDay = (): number => mockDailyLimit() * 2;

/** Takes one of today's interviewer turns for this code (429 `daily_limit` when none is left). Returns a refund. */
export async function reserveMockTurn(caller: Caller): Promise<Refund> {
  return (
    await take(keys.mockTurn(periods().day, caller.name), mockTurnsPerDay(), DAY_TTL, () => {
      return new CoachError(429, "daily_limit", MOCK_DAILY_MESSAGE);
    })
  ).refund;
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

/**
 * Counts one voice line for the code today (429 `tts_limit` when the day's allowance is used up).
 * Returns a refund for a line the voice could not read.
 */
export async function reserveTts(caller: Caller): Promise<Refund> {
  return (
    await take(keys.tts(periods().day, caller.name), ttsDailyLimit(), DAY_TTL, () => {
      return new CoachError(429, "tts_limit", "Has llegado al límite de audio de hoy. Vuelve mañana.");
    })
  ).refund;
}

/**
 * Adds one Claude call (every model attempt in it) to the ledger. Returns its cost in micro-dollars.
 * A Mi entrevista call goes to `spend` and `mockSpend` (never to `spend:<name>`, Prepárate's per
 * code); `mockSpend` is written first, so Prepárate's `spend − mockSpend` never counts it, even for a moment.
 */
export async function recordCall(caller: Caller, kind: CallKind, charges: Charge[]): Promise<number> {
  const store = getStore();
  const { month } = periods();
  const cost = charges.reduce((sum, c) => sum + costMicroUsd(c.model, c.usage), 0);
  const usage = sumUsage(charges);
  if (isMock(kind)) await store.incrby(keys.mockSpend(month), cost);
  const writes: Promise<number>[] = [
    store.incrby(keys.spend(month), cost),
    ...(isMock(kind)
      ? [store.incrby(keys.mockCount(month, kind), 1), store.incrby(keys.mockKindSpend(month, kind), cost)]
      : [store.incrby(keys.spendBy(month, caller.name), cost)]),
    ...TOKEN_KINDS.filter((k) => usage[k] > 0).map((k) => store.incrby(keys.tokens(month, k), usage[k])),
  ];
  if (kind === "pack") writes.push(store.incrby(keys.packs(month), 1), store.incrby(keys.packSpend(month), cost));
  if (kind === "route") writes.push(store.incrby(keys.routes(month), 1), store.incrby(keys.routeSpend(month), cost));
  if (kind === "episode") writes.push(store.incrby(keys.episodes(month), 1), store.incrby(keys.episodeSpend(month), cost));
  await Promise.all(writes);
  return cost;
}

/** Mi entrevista's part of `GET /usage/` (owner only): its own budget, averages and today's answers. */
export interface MockUsage {
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  /** Billed this month (a failed attempt counts, since it was paid) and their average cost. */
  answers: number;
  avgAnswerUsd: number;
  turns: number;
  avgTurnUsd: number;
  reports: number;
  avgReportUsd: number;
  /** The caller's answers + reports today (interviewer turns have their own, larger counter). */
  today: { used: number; limit: number };
}

export interface UsageSummary {
  month: string;
  /** Prepárate's: spend, cap and remaining leave Mi entrevista out (it has its own, in `mock`). */
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  /** Every Claude call this month, both features. */
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  packs: number;
  avgPackUsd: number;
  /** The caller's generations today (packs, refinements, first interview steps); routes and episodes not included. */
  today: { used: number; limit: number };
  /** Quick routes billed this month (a failed attempt counts, since it was paid) and their average cost. */
  routes: number;
  avgRouteUsd: number;
  /** The caller's quick routes today (their own counter). */
  routesToday: { used: number; limit: number };
  /** AI episodes (Modo deporte) billed this month (a failed attempt counts, since it was paid) and their average cost. */
  episodes: number;
  avgEpisodeUsd: number;
  /** The caller's AI episodes today (their own counter). */
  episodesToday: { used: number; limit: number };
  isOwner: boolean;
  /** Spent on Prepárate this month by the caller's own code. */
  mineUsd: number;
  /** Mi entrevista (owner only, like the feature): absent for any other code. */
  mock?: MockUsage;
}

const average = (spend: number, count: number) => (count > 0 ? toUsd(spend / count) : 0);

async function readMockUsage(caller: Caller, month: string, day: string): Promise<MockUsage> {
  const [spent, answers, answerSpend, turns, turnSpend, reports, reportSpend, used] = (
    await getStore().mget([
      keys.mockSpend(month),
      keys.mockCount(month, "answer"),
      keys.mockKindSpend(month, "answer"),
      keys.mockCount(month, "turn"),
      keys.mockKindSpend(month, "turn"),
      keys.mockCount(month, "report"),
      keys.mockKindSpend(month, "report"),
      keys.mock(day, caller.name),
    ])
  ).map((v) => v ?? 0);
  const cap = await mockCapMicro();
  return {
    spentUsd: toUsd(spent),
    capUsd: toUsd(cap),
    remainingUsd: toUsd(Math.max(cap - spent, 0)),
    answers,
    avgAnswerUsd: average(answerSpend, answers),
    turns,
    avgTurnUsd: average(turnSpend, turns),
    reports,
    avgReportUsd: average(reportSpend, reports),
    today: { used: Math.min(used, mockDailyLimit()), limit: mockDailyLimit() },
  };
}

export async function readUsage(caller: Caller): Promise<UsageSummary> {
  const store = getStore();
  const { month, day } = periods();
  const [
    total,
    mockSpent,
    mine,
    input,
    output,
    cacheWrite,
    cacheRead,
    packs,
    packSpend,
    used,
    routes,
    routeSpend,
    routesUsed,
    episodes,
    episodeSpend,
    episodesUsed,
  ] = (
    await store.mget([
      keys.spend(month),
      keys.mockSpend(month),
      keys.spendBy(month, caller.name),
      ...TOKEN_KINDS.map((k) => keys.tokens(month, k)),
      keys.packs(month),
      keys.packSpend(month),
      keys.generations(day, caller.name),
      keys.routes(month),
      keys.routeSpend(month),
      keys.route(day, caller.name),
      keys.episodes(month),
      keys.episodeSpend(month),
      keys.episode(day, caller.name),
    ])
  ).map((v) => v ?? 0);
  const [cap, mock] = await Promise.all([capMicro(), caller.isOwner ? readMockUsage(caller, month, day) : undefined]);
  const spent = Math.max(total - mockSpent, 0);
  return {
    month,
    spentUsd: toUsd(spent),
    capUsd: toUsd(cap),
    remainingUsd: toUsd(Math.max(cap - spent, 0)),
    tokens: { input, output, cacheRead, cacheWrite },
    packs,
    avgPackUsd: average(packSpend, packs),
    today: { used: Math.min(used, dailyLimit()), limit: dailyLimit() },
    routes,
    avgRouteUsd: average(routeSpend, routes),
    routesToday: { used: Math.min(routesUsed, routeDailyLimit()), limit: routeDailyLimit() },
    episodes,
    avgEpisodeUsd: average(episodeSpend, episodes),
    episodesToday: { used: Math.min(episodesUsed, episodeDailyLimit()), limit: episodeDailyLimit() },
    isOwner: caller.isOwner,
    mineUsd: toUsd(mine),
    ...(mock ? { mock } : {}),
  };
}

// ---- Mi entrevista's calls (docs/mock-interview.md "API") ----

/** The `usage` of a Mi entrevista endpoint (`/interviewer/`, `/feedback/`). */
export interface MockCallUsage {
  costUsd: number;
  /** The model that answered (the role's, or a server-side fallback); null when no call was made. */
  model: string | null;
  /** From the request to Claude until its response; 0 when no call was made. */
  latencyMs: number;
  tokens: TokenUsage;
  /** The caller's answers + reports today: the same figure as `/usage/` `mock.today`, for every kind. */
  today: { used: number; limit: number };
  /** What is left of Mi entrevista's budget this month. */
  remainingUsd: number;
}

async function mockCallUsage(caller: Caller, call: Omit<MockCallUsage, "today" | "remainingUsd">): Promise<MockCallUsage> {
  const { month, day } = periods();
  const { today, remainingUsd } = await readMockUsage(caller, month, day);
  return { ...call, today, remainingUsd };
}

/** The `usage` of an answer given without Claude (the interviewer's canned move-on): nothing spent. */
export function noMockCall(caller: Caller): Promise<MockCallUsage> {
  return mockCallUsage(caller, { costUsd: 0, model: null, latencyMs: 0, tokens: sumUsage([]) });
}

const tokensLine = (u: TokenUsage) =>
  `${u.output} output tokens (${u.input + u.cacheWrite + u.cacheRead} input, ${u.cacheRead} cache read, ${u.cacheWrite} cache write)`;

/**
 * One billed Mi entrevista call, after the endpoint's own checks (code, owner, body, model, deck and
 * card): its budget (`assertMockBudget`) → its daily counter (`turn` → interviewer turns; `answer`,
 * `report` → answers) → `call` on the role's `model`, whose `onUsage` bills it as `kind` → the slot
 * back only when nothing was billed. Every real call logs one line, never text:
 * `[coach] mock <kind> <ok|failed> <ms> ms, <tokens>, model <id>` (`ms` until the response or the
 * failure; the model that answered, else the one asked).
 */
export async function runMockCall<T>(
  caller: Caller,
  kind: MockCallKind,
  model: string,
  call: (onUsage: (charges: Charge[]) => Promise<void>) => Promise<T>,
): Promise<{ result: T; usage: MockCallUsage }> {
  await assertMockBudget();
  const refund = await (kind === "turn" ? reserveMockTurn(caller) : reserveMockAnswer(caller));
  const started = Date.now();
  let answeredMs: number | undefined;
  let charges: Charge[] = [];
  let costMicro = 0;
  let charged = false;
  let outcome = "failed";
  try {
    const result = await call(async (billed) => {
      answeredMs ??= Date.now() - started;
      charged = true;
      charges = billed;
      costMicro += await recordCall(caller, kind, billed);
    });
    outcome = "ok";
    const usage = await mockCallUsage(caller, {
      costUsd: costMicro / MICRO,
      model: charges.at(-1)?.model ?? model,
      latencyMs: answeredMs ?? Date.now() - started,
      tokens: sumUsage(charges),
    });
    return { result, usage };
  } catch (error) {
    // A billed call keeps its slot: only a call that cost nothing (no response) gives it back.
    if (!charged) await refund();
    throw error;
  } finally {
    if (!isFake()) {
      const ms = answeredMs ?? Date.now() - started;
      console.log(`[coach] mock ${kind} ${outcome} ${ms} ms, ${tokensLine(sumUsage(charges))}, model ${charges.at(-1)?.model ?? model}`);
    }
  }
}
