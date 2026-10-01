/**
 * Liga XP outbox (docs/league.md → "Sync"): XP awards earned while joined, waiting to be sent to
 * `league_record_xp`. One per language pack in localStorage under `lang-lern:league-outbox:<lang>`
 * (`{ v: 1, userId, events, sentStats }`), so awards survive offline periods and reloads.
 * Framework-free, no supabase-js import. Parsing is tolerant (bad entries are dropped) and
 * nothing here throws.
 */

const PREFIX = "lang-lern:league-outbox:";
const VERSION = 1;
/** Oldest events are dropped beyond this (≈ months of play; the server rejects > 8 days anyway). */
export const OUTBOX_MAX_EVENTS = 500;
/** The server answers `too_old` for events older than 8 days: no point keeping them. */
const MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;

const LANG = /^[a-z]{2,3}$/;
const SOURCE = /^[a-z][a-z_-]{0,19}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** One XP award waiting to be sent. */
export interface OutboxEvent {
  /** uuid generated on the device: a resend is a server-side duplicate. */
  id: string;
  lang: string;
  amount: number;
  source: string;
  /** ISO timestamp. */
  earnedAt: string;
}

export interface Outbox {
  /** Supabase user the events belong to (events of another user are never sent). */
  userId: string | null;
  events: OutboxEvent[];
  /** Signature of the last stats acknowledged by the server (see sync.ts). */
  sentStats: string | null;
}

const key = (lang: string) => PREFIX + lang;

function emptyOutbox(): Outbox {
  return { userId: null, events: [], sentStats: null };
}

function parseEvent(v: unknown): OutboxEvent | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const { id, lang, amount, source, earnedAt } = o;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  if (typeof lang !== "string" || !LANG.test(lang)) return null;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) return null;
  if (typeof source !== "string" || !SOURCE.test(source)) return null;
  if (typeof earnedAt !== "string" || Number.isNaN(Date.parse(earnedAt))) return null;
  return { id, lang, amount, source, earnedAt };
}

export function parseOutbox(raw: string | null): Outbox {
  const out = emptyOutbox();
  if (!raw) return out;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!v || typeof v !== "object") return out;
  const o = v as Record<string, unknown>;
  if (o.v !== VERSION) return out;
  out.userId = typeof o.userId === "string" && o.userId ? o.userId : null;
  out.sentStats = typeof o.sentStats === "string" ? o.sentStats : null;
  if (Array.isArray(o.events)) {
    const seen = new Set<string>();
    for (const e of o.events) {
      const event = parseEvent(e);
      if (!event || seen.has(event.id)) continue;
      seen.add(event.id);
      out.events.push(event);
    }
  }
  return out;
}

/** Drops events the server would reject as too old, and the oldest beyond the cap. */
function trim(events: OutboxEvent[], now = Date.now()): OutboxEvent[] {
  const fresh = events.filter((e) => now - Date.parse(e.earnedAt) <= MAX_AGE_MS);
  return fresh.length > OUTBOX_MAX_EVENTS ? fresh.slice(fresh.length - OUTBOX_MAX_EVENTS) : fresh;
}

export function readOutbox(lang: string): Outbox {
  if (typeof window === "undefined") return emptyOutbox();
  try {
    return parseOutbox(window.localStorage.getItem(key(lang)));
  } catch {
    return emptyOutbox();
  }
}

function writeOutbox(lang: string, outbox: Outbox): void {
  try {
    if (!outbox.userId && outbox.events.length === 0 && !outbox.sentStats) {
      window.localStorage.removeItem(key(lang));
      return;
    }
    window.localStorage.setItem(key(lang), JSON.stringify({ v: VERSION, ...outbox, events: trim(outbox.events) }));
  } catch {
    // Storage full or blocked: the award simply is not queued.
  }
}

/** The outbox of `lang` for `userId`: another user's events and stats are dropped. */
function outboxFor(lang: string, userId: string): Outbox {
  const outbox = readOutbox(lang);
  return outbox.userId === userId ? outbox : { userId, events: [], sentStats: null };
}

/** A random v4 uuid (`crypto.randomUUID` only exists in secure contexts, e.g. not on LAN http). */
export function newEventId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Queues one award for `userId`. Returns the queued event, or null when it is not valid. */
export function enqueueXp(
  userId: string,
  award: { lang: string; amount: number; source: string; earnedAt: number },
): OutboxEvent | null {
  const event = parseEvent({
    id: newEventId(),
    lang: award.lang,
    amount: Math.round(award.amount),
    source: award.source,
    earnedAt: new Date(award.earnedAt).toISOString(),
  });
  if (!event) return null;
  const outbox = outboxFor(event.lang, userId);
  outbox.events.push(event);
  writeOutbox(event.lang, outbox);
  return event;
}

/** Events of `lang` waiting for `userId`, oldest first (expired ones dropped). */
export function pendingEvents(lang: string, userId: string): OutboxEvent[] {
  const outbox = readOutbox(lang);
  return outbox.userId === userId ? trim(outbox.events) : [];
}

/** Removes the events the server acknowledged (any status) and remembers the stats it stored. */
export function acknowledge(lang: string, userId: string, ids: Iterable<string>, sentStats?: string): void {
  const done = new Set(Array.from(ids, (id) => id.toLowerCase()));
  const outbox = outboxFor(lang, userId);
  outbox.events = outbox.events.filter((e) => !done.has(e.id.toLowerCase()));
  if (sentStats !== undefined) outbox.sentStats = sentStats;
  writeOutbox(lang, outbox);
}

/** Signature of the last stats the server stored for `userId` in `lang` (null = never / unknown). */
export function sentStats(lang: string, userId: string): string | null {
  const outbox = readOutbox(lang);
  return outbox.userId === userId ? outbox.sentStats : null;
}

/** Languages that have an outbox on this device. */
export function outboxLangs(): string[] {
  const langs: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX) && LANG.test(k.slice(PREFIX.length))) langs.push(k.slice(PREFIX.length));
    }
  } catch {
    // Storage blocked: no outboxes.
  }
  return langs;
}

/** Deletes every outbox (signed out, other user, data deleted). */
export function clearOutboxes(): void {
  for (const lang of outboxLangs()) {
    try {
      window.localStorage.removeItem(key(lang));
    } catch {
      // Ignore.
    }
  }
}
