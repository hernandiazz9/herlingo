import { timingSafeEqual } from "node:crypto";
import { accessEntries, ownerName } from "./config.js";
import { CoachError } from "./http.js";

export interface Caller {
  /** Name of the `COACH_ACCESS_CODES` entry; keys the per-code ledger and daily limit. */
  name: string;
  isOwner: boolean;
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checks the `x-coach-code` header. Missing or wrong code → 401 (the app asks for it again). */
export function authenticate(request: Request): Caller {
  const entries = accessEntries();
  if (entries.length === 0) {
    throw new CoachError(503, "not_configured", "Prepárate no está configurado todavía.");
  }
  const code = request.headers.get("x-coach-code")?.trim();
  if (!code) throw new CoachError(401, "unauthorized", "Escribe tu código de acceso.");
  const entry = entries.find((e) => same(e.code, code));
  if (!entry) throw new CoachError(401, "unauthorized", "Ese código de acceso no es válido.");
  return { name: entry.name, isOwner: entry.name === ownerName() };
}
