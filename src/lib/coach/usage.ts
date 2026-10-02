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

/** "3,20 $": Spain Spanish amount in US dollars. */
export function formatUsd(amount: number, decimals = 2): string {
  const n = amount.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${n} $`;
}
