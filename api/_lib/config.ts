/** Environment of the coach functions. Read lazily so the local dev server can set env first. */
import { CoachError } from "./http";

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

export const DEFAULT_CAP_USD = 5;
export const DAILY_GENERATIONS = 10;
export const DAILY_TTS_LINES = 500;

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
