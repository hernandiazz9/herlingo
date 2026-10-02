/** The access code (sent as `x-coach-code`), stored once on the device for every language. */
import { COACH_KEYS, readRaw, readVersioned, removeKey, writeJson } from "./store";

const VERSION = 1;

export const readAccessRaw = (): string => readRaw(COACH_KEYS.access);

export function parseAccessCode(raw: string): string | null {
  const code = readVersioned(raw, VERSION)?.code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

export function getAccessCode(): string | null {
  if (typeof window === "undefined") return null;
  return parseAccessCode(readAccessRaw());
}

/** Stores the code (trimmed). Another code than before also forgets the last usage seen. */
export function setAccessCode(code: string): boolean {
  const next = code.trim();
  if (!next) return false;
  if (next !== getAccessCode()) removeKey(COACH_KEYS.usage);
  return writeJson(COACH_KEYS.access, { v: VERSION, code: next });
}

/** Forgets the code (and the usage seen with it): the app asks for it again. */
export function clearAccessCode(): void {
  removeKey(COACH_KEYS.access);
  removeKey(COACH_KEYS.usage);
}
