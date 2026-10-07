/**
 * The cloud copy's content (plan 010): the Perfil backup format limited to `isCloudSaveKey`, its
 * change-detection hash, and a summary for the conflict dialog. Framework-free.
 */
import {
  BACKUP_APP,
  BACKUP_FORMAT,
  collectBackup,
  isCloudSaveKey,
  type Backup,
  type KeyValueStore,
} from "@/lib/backup";
import { parseProgress } from "@/lib/progress";

const PROGRESS_KEY = /^lang-lern:progress:[^:]+$/;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The device's data as a cloud copy (backup format, cloud keys only, key-sorted). */
export function collectCloudBackup(store: KeyValueStore, now: Date = new Date()): Backup {
  return collectBackup(store, now, isCloudSaveKey);
}

/** cyrb53: fast 53-bit string hash (not cryptographic: only detects changes). */
function cyrb53(text: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Hash of a copy's `data` (cloud keys only, key-sorted; `exportedAt` is not part of it), so the
 * same data gives the same hash on every device.
 */
export function hashData(data: Record<string, unknown>): string {
  const entries = Object.keys(data)
    .filter((key) => isCloudSaveKey(key) && typeof data[key] === "string")
    .sort()
    .map((key) => [key, data[key]]);
  const text = JSON.stringify(entries);
  return `${cyrb53(text, 1).toString(16)}-${cyrb53(text, 2).toString(16)}`;
}

/**
 * A cloud copy (`league_save_get().data`) as a backup, or null when it is not one this app can
 * read (wrong app, newer format, no data object). Keeps only cloud keys with string values; an
 * empty `data` is valid (a copy made before any progress).
 */
export function toCloudBackup(value: unknown): Backup | null {
  if (!isObject(value) || value.app !== BACKUP_APP || !isObject(value.data)) return null;
  const { format, exportedAt } = value;
  if (typeof format !== "number" || !Number.isInteger(format) || format < 1 || format > BACKUP_FORMAT) return null;
  const data: Record<string, string> = {};
  for (const key of Object.keys(value.data).sort()) {
    const raw = value.data[key];
    if (isCloudSaveKey(key) && typeof raw === "string") data[key] = raw;
  }
  return {
    app: BACKUP_APP,
    format,
    exportedAt: typeof exportedAt === "string" && !Number.isNaN(Date.parse(exportedAt)) ? exportedAt : new Date(0).toISOString(),
    data,
  };
}

export interface BackupSummary {
  /** Total XP over every language. */
  xp: number;
  /** Lessons done over every language. */
  lessonsDone: number;
  /** Latest active day ("YYYY-MM-DD", local), null = never. */
  lastActivity: string | null;
}

function summarize(raws: Iterable<string>): BackupSummary {
  const out: BackupSummary = { xp: 0, lessonsDone: 0, lastActivity: null };
  for (const raw of raws) {
    const p = parseProgress(raw);
    out.xp += p.xp;
    out.lessonsDone += Object.keys(p.lessons).length;
    if (p.streak.last && (!out.lastActivity || p.streak.last > out.lastActivity)) out.lastActivity = p.streak.last;
  }
  return out;
}

/** Totals of a copy for the "¿Qué copia quieres conservar?" dialog (every `lang-lern:progress:<lang>`). */
export function summarizeBackup(backup: Pick<Backup, "data">): BackupSummary {
  return summarize(
    Object.entries(backup.data)
      .filter(([key]) => PROGRESS_KEY.test(key))
      .map(([, raw]) => raw),
  );
}

function storedProgress(store: KeyValueStore): string[] {
  const raws: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key === null || !PROGRESS_KEY.test(key) || !isCloudSaveKey(key)) continue;
    const raw = store.getItem(key);
    if (raw !== null) raws.push(raw);
  }
  return raws;
}

/** True when the device has no progress (no language with XP or a lesson done). */
export function isStoreEmpty(store: KeyValueStore): boolean {
  const s = summarize(storedProgress(store));
  return s.xp === 0 && s.lessonsDone === 0;
}
