/** Local-time-zone calendar days ("YYYY-MM-DD"), for streaks and SRS due dates. */

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar day of `date` in the device's time zone. */
export function dayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Day key `n` days after `key` (negative = before). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** Epoch ms of local midnight, `n` days after the day of `now`. */
export function startOfDay(now: number, n = 0): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
