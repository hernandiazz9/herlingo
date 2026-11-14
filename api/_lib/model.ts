/**
 * The Claude models used by Prepárate and Mi entrevista and their price table: the only place
 * either is defined.
 *
 * Prices in USD per million tokens, Claude API first-party rates.
 * Source: https://platform.claude.com/docs/en/about-claude/pricing
 * Reviewed: 2026-11-14 (every row checked against that page). Cache write = 5-minute TTL
 * (1.25 × input); cache read = "Cache hits and refreshes" column: 0.1 × input, except Opus 5.5 and
 * Sonnet 5.5 at 0.05 × input (a footnote there), so their 0.2 and 0.1 are right. Haiku 5.5 is
 * priced by prompt length: a request whose prompt (input + cache write + cache read) is over
 * 100 000 tokens pays its `longPrompt` prices for every token of that request.
 */
export const COACH_MODEL = "claude-sonnet-5-5";

/**
 * Mi entrevista's two roles (docs/mock-interview.md "Models"): the defaults of
 * `COACH_INTERVIEWER_MODEL` (follow-up turns) and `COACH_FEEDBACK_MODEL` (corrections, reports).
 */
export const INTERVIEWER_MODEL = "claude-haiku-5-5";
export const FEEDBACK_MODEL = "claude-sonnet-5-5";

export interface Rates {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface ModelPrice extends Rates {
  /** Prices of a request whose whole prompt is over `overTokens` (Haiku 5.5). */
  longPrompt?: Rates & { overTokens: number };
}

export const PRICES: Record<string, ModelPrice> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 }, // cache read 0.05 × input (official)
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
    longPrompt: { overTokens: 100_000, input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 },
  },
  // Possible server-side fallback targets (`fallbacks: "default"`), so a rescued call is not undercounted.
  // Sonnet 5.5 falls back to Sonnet 5 for "cyber" and "frontier_llm" declines.
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 }, // cache read 0.05 × input (official)
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
};

/** A model id the ledger can price exactly (Mi entrevista refuses to call any other: 503). */
export function isPriced(model: string): boolean {
  return Object.hasOwn(PRICES, model);
}

/**
 * Models that accept server-side fallbacks (`fallbacks: "default"`, beta
 * `server-side-fallback-2026-07-01`; the claude-api skill's model notes, 2026-11-03). Haiku 5.5
 * has none: a decline there is a plain refusal, and sending the parameter would be an error.
 */
const FALLBACK_MODELS: ReadonlySet<string> = new Set([
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-fable-5-1",
  "claude-fable-5-2",
]);

export function supportsFallback(model: string): boolean {
  return FALLBACK_MODELS.has(model);
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** Tokens one model attempt used (a response rescued by a fallback model has several). */
export interface Charge {
  model: string;
  usage: TokenUsage;
}

export function sumUsage(charges: Charge[]): TokenUsage {
  const total: TokenUsage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  for (const { usage } of charges) {
    total.input += usage.input;
    total.output += usage.output;
    total.cacheWrite += usage.cacheWrite;
    total.cacheRead += usage.cacheRead;
  }
  return total;
}

/** Unknown model ids are priced at the most expensive entry, so the ledger never under-reports. */
function priceFor(model: string): ModelPrice {
  if (isPriced(model)) return PRICES[model];
  return Object.values(PRICES).reduce((a, b) => (b.output > a.output ? b : a));
}

/** Cost in micro-dollars (1 USD = 1 000 000), rounded up. */
export function costMicroUsd(model: string, usage: TokenUsage): number {
  const price = priceFor(model);
  const prompt = usage.input + usage.cacheWrite + usage.cacheRead;
  const p = price.longPrompt && prompt > price.longPrompt.overTokens ? price.longPrompt : price;
  // USD per MTok × tokens = micro-dollars.
  const micro =
    usage.input * p.input + usage.output * p.output + usage.cacheWrite * p.cacheWrite + usage.cacheRead * p.cacheRead;
  return Math.ceil(micro);
}
