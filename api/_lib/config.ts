/** Environment of the coach functions. Read lazily so the local dev server can set env first. */
import { CoachError } from "./http.js";
import { FEEDBACK_MODEL, INTERVIEWER_MODEL, isPriced } from "./model.js";

export interface AccessEntry {
  name: string;
  code: string;
}

/** Set by `npm run dev:coach` (scripts/coach/dev.ts); never on Vercel. */
export function isLocalDev(): boolean {
  return process.env.COACH_DEV === "1";
}

/** Canned data, no network: `COACH_FAKE=1`, or no Anthropic key while developing locally. */
export function isFake(): boolean {
  return process.env.COACH_FAKE === "1" || (isLocalDev() && !process.env.ANTHROPIC_API_KEY);
}

export function accessEntries(): AccessEntry[] {
  return (process.env.COACH_ACCESS_CODES ?? "")
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .flatMap((pair) => {
      const i = pair.indexOf(":");
      const name = pair.slice(0, i).trim();
      const code = pair.slice(i + 1).trim();
      return i > 0 && name && code ? [{ name, code }] : [];
    });
}

export function ownerName(): string | undefined {
  return process.env.COACH_OWNER?.trim() || undefined;
}

/** The owner entry's code (`npm run deck:push` uploads with it); undefined unless both variables name it. */
export function ownerCode(): string | undefined {
  const owner = ownerName();
  return owner ? accessEntries().find((entry) => entry.name === owner)?.code : undefined;
}

export const DEFAULT_CAP_USD = 5;
export const DAILY_GENERATIONS = 10;
export const DAILY_TTS_LINES = 2000;
export const DAILY_ROUTES = 20;
export const DAILY_EPISODES = 5;
/** Mi entrevista (docs/mock-interview.md "Budget"): its own monthly cap and answers per day. */
export const DEFAULT_MOCK_CAP_USD = 10;
export const DAILY_MOCK_ANSWERS = 60;

/** Initial monthly cap until the owner changes it from the app. */
export function defaultCapUsd(): number {
  const value = Number(process.env.COACH_MONTHLY_CAP_USD);
  return Number.isFinite(value) && value >= 0 && process.env.COACH_MONTHLY_CAP_USD ? value : DEFAULT_CAP_USD;
}

export function dailyLimit(): number {
  const value = Number(process.env.COACH_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DAILY_GENERATIONS;
}

/** Lines the voice endpoint reads per day per code (it costs nothing, but must not be abused). */
export function ttsDailyLimit(): number {
  const value = Number(process.env.COACH_TTS_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DAILY_TTS_LINES;
}

/** Quick routes (Modo rápido) per day per code: their own counter, apart from the generations. */
export function routeDailyLimit(): number {
  const value = Number(process.env.COACH_ROUTE_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DAILY_ROUTES;
}

/** AI episodes (Modo deporte) per day per code: their own counter, apart from generations and routes. */
export function episodeDailyLimit(): number {
  const value = Number(process.env.COACH_EPISODE_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DAILY_EPISODES;
}

/** Mi entrevista's initial monthly cap (apart from Prepárate's) until the owner changes it. */
export function defaultMockCapUsd(): number {
  const value = Number(process.env.COACH_MOCK_MONTHLY_CAP_USD);
  return Number.isFinite(value) && value >= 0 && process.env.COACH_MOCK_MONTHLY_CAP_USD ? value : DEFAULT_MOCK_CAP_USD;
}

/** Mi entrevista's corrected answers + reports per day per code (interviewer turns: 2 × this). */
export function mockDailyLimit(): number {
  const value = Number(process.env.COACH_MOCK_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DAILY_MOCK_ANSWERS;
}

/**
 * The model of a Mi entrevista role: the variable, else the default. One the price table does not
 * list could not be billed exactly, so it is refused: 503 `not_configured`.
 */
function mockModel(variable: "COACH_INTERVIEWER_MODEL" | "COACH_FEEDBACK_MODEL", fallback: string): string {
  const model = process.env[variable]?.trim() || fallback;
  if (!isPriced(model)) {
    console.error(`[coach] ${variable} is not in the price table`, model);
    throw new CoachError(503, "not_configured", "Mi entrevista no está configurada todavía.");
  }
  return model;
}

/** The interviewer (follow-up turns): `COACH_INTERVIEWER_MODEL`, default Haiku 5.5. */
export const interviewerModel = (): string => mockModel("COACH_INTERVIEWER_MODEL", INTERVIEWER_MODEL);

/** The corrector (an answer's feedback and the simulacro report): `COACH_FEEDBACK_MODEL`, default Sonnet 5.5. */
export const feedbackModel = (): string => mockModel("COACH_FEEDBACK_MODEL", FEEDBACK_MODEL);

/** Days and months of the limits and the ledger are counted in this time zone. */
export function timeZone(): string {
  return process.env.COACH_TIMEZONE?.trim() || "Europe/Madrid";
}

export function upstashConfig(): { url: string; token: string } | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : undefined;
}

export function requireAnthropicKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new CoachError(503, "not_configured", "Prepárate no está configurado todavía.");
  }
}
