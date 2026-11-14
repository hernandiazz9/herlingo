/**
 * Device storage for Mi entrevista (docs/mock-interview.md "Device"): versioned JSON in
 * localStorage, one change event for the three keys (hooks snapshot the raw string, so unrelated
 * keys never re-render). All three are backup keys: they travel in the Perfil file and the cloud
 * save (`isBackupKey` / `isCloudSaveKey`).
 *
 *   lang-lern:mock-interview:deck      { v: 1, deck, updatedAt, fetchedAt }   the deck, offline
 *   lang-lern:mock-interview:attempts  { v: 1, attempts }                     answers, newest first
 *   lang-lern:mock-interview:reports   { v: 1, reports }                      simulacro reports, newest first
 *
 * Reads are tolerant (`./parse`): an absent, corrupt or other-version value reads as empty, an
 * invalid item is dropped, nothing throws. A value written by a newer version (`v` > 1) is never
 * overwritten.
 */
import { readRaw, readVersioned } from "@/lib/coach/store";

export { readRaw };

export const MOCK_PREFIX = "lang-lern:mock-interview:";
export const MOCK_STORE_VERSION = 1;
const EVENT = "lang-lern:mock-interview-change";

export const MOCK_KEYS = {
  deck: `${MOCK_PREFIX}deck`,
  attempts: `${MOCK_PREFIX}attempts`,
  reports: `${MOCK_PREFIX}reports`,
} as const;

/** The stored object when it is version 1; undefined when absent, corrupt or another version. */
export const readStored = (raw: string): Record<string, unknown> | undefined => readVersioned(raw, MOCK_STORE_VERSION);

/** True when `key` holds a value written by a newer version of the app (left untouched). */
function newerVersion(key: string): boolean {
  try {
    const v: unknown = JSON.parse(readRaw(key) || "null");
    const version = v && typeof v === "object" ? (v as { v?: unknown }).v : undefined;
    return typeof version === "number" && version > MOCK_STORE_VERSION;
  } catch {
    return false;
  }
}

/**
 * Writes `{ v: 1, ...value }` as JSON and notifies subscribers. False when storage is unavailable
 * or full, or when the key holds a newer version's data (never overwritten).
 */
export function writeStored(key: string, value: Record<string, unknown>): boolean {
  if (typeof window === "undefined" || newerVersion(key)) return false;
  let ok = true;
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: MOCK_STORE_VERSION, ...value }));
  } catch {
    ok = false;
  }
  window.dispatchEvent(new Event(EVENT));
  return ok;
}

/** Subscribes to changes of any Mi entrevista key, in this tab and in other tabs (and to a restored backup). */
export function subscribeMock(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(MOCK_PREFIX)) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** A random id (`crypto.randomUUID` only exists in secure contexts, e.g. not on LAN http). */
export function newId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
