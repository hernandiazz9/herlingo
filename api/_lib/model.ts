/**
 * The Claude model used by Prepárate and its price table: the only place either is defined.
 *
 * Prices in USD per million tokens, Claude API first-party rates.
 * Source: https://platform.claude.com/docs/en/about-claude/pricing
 * Reviewed: 2026-10-02. Cache write = 5-minute TTL (1.25 × input); cache read as listed there.
 */
export const COACH_MODEL = "claude-sonnet-5-5";

export interface ModelPrice {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const PRICES: Record<string, ModelPrice> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  // Possible server-side fallback targets (`fallbacks: "default"`), so a rescued call is not undercounted.
  // Sonnet 5.5 falls back to Sonnet 5 for "cyber" and "frontier_llm" declines.
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
};

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
  const known = PRICES[model];
  if (known) return known;
  return Object.values(PRICES).reduce((a, b) => (b.output > a.output ? b : a));
}

/** Cost in micro-dollars (1 USD = 1 000 000), rounded up. */
export function costMicroUsd(model: string, usage: TokenUsage): number {
  const p = priceFor(model);
  // USD per MTok × tokens = micro-dollars.
  const micro =
    usage.input * p.input + usage.output * p.output + usage.cacheWrite * p.cacheWrite + usage.cacheRead * p.cacheRead;
  return Math.ceil(micro);
}
