/**
 * Spaced repetition (Leitner boxes), framework-free.
 *
 * - Box 0: seen in a finished lesson but not practised yet (a session samples 10–12 exercises
 *   from lessons of up to ~30 items). Due at once, so /repaso covers the rest of the lesson.
 * - A wrong answer (any mistake on the item in a session) sends it to box 1, due at once.
 * - A right answer moves it up one box; it comes back at local midnight `INTERVAL_DAYS[box]`
 *   days later. Box 5 is the top.
 */
import { startOfDay } from "@/lib/progress/dates";

export { dedupeByText, textKey, type Deduped } from "./dedupe";

export interface SrsEntry {
  /** 0 = new (not practised), 1–5 = Leitner box. */
  box: number;
  /** Epoch ms from which the item is due. */
  due: number;
  /** Times answered wrong in total. */
  lapses: number;
  /** Epoch ms of the last practice (0 = never). */
  seen: number;
}

export const MAX_BOX = 5;
/** Days until the next review, by box (index = box). */
export const INTERVAL_DAYS = [0, 1, 2, 4, 7, 14] as const;
/** Items per review session. */
export const REVIEW_SIZE = 10;

export function newEntry(now: number): SrsEntry {
  return { box: 0, due: now, lapses: 0, seen: 0 };
}

/** Next state after practising an item in a session. */
export function schedule(prev: SrsEntry | undefined, correct: boolean, now: number): SrsEntry {
  const entry = prev ?? newEntry(now);
  if (!correct) return { box: 1, due: now, lapses: entry.lapses + 1, seen: now };
  const box = Math.min(MAX_BOX, Math.max(1, entry.box + 1));
  return { box, due: startOfDay(now, INTERVAL_DAYS[box]), lapses: entry.lapses, seen: now };
}

export function isDue(entry: SrsEntry, now: number): boolean {
  return entry.due <= now;
}

/**
 * Due item ids, most urgent first: items answered wrong, then the oldest due, then new ones.
 * `keep` filters out ids that no longer exist in the content.
 */
export function dueIds(srs: Record<string, SrsEntry>, now: number, keep: (id: string) => boolean = () => true): string[] {
  const rank = (e: SrsEntry) => (e.box === 0 ? 1 : 0);
  return Object.entries(srs)
    .filter(([id, e]) => isDue(e, now) && keep(id))
    .sort(([a, x], [b, y]) => rank(x) - rank(y) || x.due - y.due || a.localeCompare(b))
    .map(([id]) => id);
}

/** Epoch ms of the next item that becomes due after `now` (undefined when none). */
export function nextDue(srs: Record<string, SrsEntry>, now: number): number | undefined {
  let next: number | undefined;
  for (const e of Object.values(srs)) if (e.due > now && (next === undefined || e.due < next)) next = e.due;
  return next;
}

/** Tolerant parse of a stored entry. */
export function parseEntry(value: unknown): SrsEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const o = value as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const box = num(o.box);
  const due = num(o.due);
  if (box === undefined || due === undefined) return undefined;
  return {
    box: Math.min(MAX_BOX, Math.max(0, Math.round(box))),
    due,
    lapses: Math.max(0, num(o.lapses) ?? 0),
    seen: Math.max(0, num(o.seen) ?? 0),
  };
}
