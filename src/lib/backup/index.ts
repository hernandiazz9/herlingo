/**
 * Backup of everything the app keeps on the device (Perfil → "Copia de seguridad"), until there
 * are accounts. Framework-free; every function takes the storage as a parameter (`window.localStorage`
 * in the app, a fake in scripts).
 *
 * File: `{ app: "lang-lern", format: 1, exportedAt, data: { <key>: <raw string> } }` with every
 * `lang-lern:*` key except the Prepárate access code, the Liga session (`lang-lern:league-auth*`:
 * a refresh token tied to this device; an old file that has it is imported without it, so the
 * device keeps its own session), the cloud save bookkeeping (`lang-lern:cloud-save`) and transient
 * probe keys (a segment starting with "__", e.g. `lang-lern:progress:__test`). The cloud save
 * (plan 010, `src/lib/cloud-save/`) uses the same format with fewer keys: `isCloudSaveKey`. Values are copied raw, so the stores' own versioned,
 * tolerant parsing reads them back (older backups included). Saved packs' audio lives in Cache
 * Storage, not here: it is fetched again on first play.
 *
 * Import never writes anything that did not validate, and a write that fails half way (storage full)
 * is rolled back to what was there before.
 */

export const BACKUP_APP = "lang-lern";
export const BACKUP_FORMAT = 1;
export const BACKUP_PREFIX = "lang-lern:";

/** Never exported nor imported: a secret, typed again on a new device. */
const ACCESS_KEY = `${BACKUP_PREFIX}coach:access`;
/** supabase-js session (access + refresh token) and its helper keys: never exported nor imported. */
const LEAGUE_AUTH_PREFIX = `${BACKUP_PREFIX}league-auth`;
/** Every Liga key (session, account cache, outbox, groups…): tied to one account, never in the cloud copy. */
const LEAGUE_PREFIX = `${BACKUP_PREFIX}league-`;
/** Cloud save bookkeeping (`src/lib/cloud-save/`): about this device and account, never in a copy. */
export const CLOUD_SAVE_KEY = `${BACKUP_PREFIX}cloud-save`;
/**
 * Mi entrevista's private deck (plan 017): downloaded again from the server with the owner's code,
 * so it never travels in a backup file or the cloud copy (and an import never touches it).
 * The learner's attempts and reports do travel.
 */
const MOCK_DECK_KEY = `${BACKUP_PREFIX}mock-interview:deck`;
/** Kept on the device when the backup lacks them (the theme is overwritten when the file has one). */
const KEEP_ON_IMPORT = new Set([ACCESS_KEY, `${BACKUP_PREFIX}theme`]);

/** localStorage holds about 5 MB per site: anything bigger cannot be one of our backups. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_KEYS = 2000;
const MAX_KEY_LENGTH = 256;

export interface Backup {
  app: typeof BACKUP_APP;
  format: number;
  /** ISO date-time of the export. */
  exportedAt: string;
  data: Record<string, string>;
}

/** The part of `Storage` the backup needs. */
export type KeyValueStore = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };
export type ApplyResult = { ok: true; previous: Backup } | { ok: false; error: string };

export const BACKUP_ERRORS = {
  notBackup: "Este archivo no es una copia de seguridad de la app. No se ha cambiado nada.",
  tooBig: "El archivo es demasiado grande para ser una copia de la app. No se ha cambiado nada.",
  newer: "Esta copia es de una versión más nueva de la app. No se ha cambiado nada: actualiza la app e inténtalo otra vez.",
  empty: "Esta copia está vacía: no tiene progreso que restaurar. No se ha cambiado nada.",
  unreadable: "No se ha podido leer el archivo. No se ha cambiado nada.",
  storage: "No se ha podido guardar la copia en este dispositivo (¿falta espacio?). No se ha cambiado nada.",
} as const;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** True for keys that belong in a backup. */
export function isBackupKey(key: string): boolean {
  if (!key.startsWith(BACKUP_PREFIX) || key === ACCESS_KEY || key === CLOUD_SAVE_KEY || key === MOCK_DECK_KEY) return false;
  if (key.startsWith(LEAGUE_AUTH_PREFIX)) return false;
  return !key.slice(BACKUP_PREFIX.length).split(":").some((segment) => segment.startsWith("__"));
}

/** True for keys that belong in the cloud copy: backup keys minus every `lang-lern:league-*` key. */
export function isCloudSaveKey(key: string): boolean {
  return isBackupKey(key) && !key.startsWith(LEAGUE_PREFIX);
}

/** Which keys a backup covers: the file (`isBackupKey`, default) or the cloud copy (`isCloudSaveKey`). */
export type BackupKeyFilter = (key: string) => boolean;

/** Every backup key currently stored (key-sorted), with its raw value. */
function snapshot(store: KeyValueStore, filter: BackupKeyFilter): Record<string, string> {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key !== null && filter(key)) keys.push(key);
  }
  const data: Record<string, string> = {};
  for (const key of keys.sort()) {
    const value = store.getItem(key);
    if (value !== null) data[key] = value;
  }
  return data;
}

/** Builds a backup of the device's data (`filter`: `isCloudSaveKey` for the cloud copy). */
export function collectBackup(store: KeyValueStore, now: Date = new Date(), filter: BackupKeyFilter = isBackupKey): Backup {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now.toISOString(), data: snapshot(store, filter) };
}

export function serializeBackup(backup: Backup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

/** `herlingo-copia-YYYY-MM-DD.json` (local date); `label` goes after "copia" ("anterior"). */
export function backupFileName(date: Date = new Date(), label?: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `herlingo-copia-${label ? `${label}-` : ""}${day}.json`;
}

/** Validates a backup file's text. Nothing is written. */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: BACKUP_ERRORS.tooBig };
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, error: BACKUP_ERRORS.notBackup };
  }
  if (!isObject(v) || v.app !== BACKUP_APP || !isObject(v.data)) return { ok: false, error: BACKUP_ERRORS.notBackup };
  const { format, exportedAt } = v;
  if (typeof format !== "number" || !Number.isInteger(format) || format < 1) return { ok: false, error: BACKUP_ERRORS.notBackup };
  if (format > BACKUP_FORMAT) return { ok: false, error: BACKUP_ERRORS.newer };
  if (typeof exportedAt !== "string" || Number.isNaN(Date.parse(exportedAt))) return { ok: false, error: BACKUP_ERRORS.notBackup };

  const entries = Object.entries(v.data);
  if (entries.length > MAX_KEYS) return { ok: false, error: BACKUP_ERRORS.notBackup };
  const data: Record<string, string> = {};
  for (const [key, value] of entries) {
    // Every key must be ours and every value a raw string, or the whole file is rejected.
    if (!key.startsWith(BACKUP_PREFIX) || key.length > MAX_KEY_LENGTH || typeof value !== "string") {
      return { ok: false, error: BACKUP_ERRORS.notBackup };
    }
    // The access code and probe keys are never restored, even from a hand-edited file.
    if (isBackupKey(key)) data[key] = value;
  }
  if (Object.keys(data).length === 0) return { ok: false, error: BACKUP_ERRORS.empty };
  return { ok: true, backup: { app: BACKUP_APP, format, exportedAt, data } };
}

/**
 * Replaces the device's data with a validated backup: writes its keys and removes local backup keys
 * it lacks (except the access code and theme). Returns the data as it was before, for "Descargar la
 * copia anterior". On any storage error everything is put back as it was. `filter` limits both the
 * keys written and the keys removed (`isCloudSaveKey` for a cloud copy: Liga keys stay untouched).
 */
export function applyBackup(
  store: KeyValueStore,
  backup: Backup,
  now: Date = new Date(),
  filter: BackupKeyFilter = isBackupKey,
): ApplyResult {
  const previous = collectBackup(store, now, filter);
  const before = previous.data;
  const incoming = Object.entries(backup.data).filter(([key]) => filter(key));
  try {
    // Removals first: they free space for the writes.
    for (const key of Object.keys(before)) {
      if (!(key in backup.data) && !KEEP_ON_IMPORT.has(key)) store.removeItem(key);
    }
    for (const [key, value] of incoming) store.setItem(key, value);
  } catch {
    restore(store, before, incoming.map(([key]) => key));
    return { ok: false, error: BACKUP_ERRORS.storage };
  }
  return { ok: true, previous };
}

/** Puts `before` back: drops keys written since, then rewrites the old values. Best effort. */
function restore(store: KeyValueStore, before: Record<string, string>, written: string[]): void {
  for (const key of written) {
    if (!(key in before)) {
      try {
        store.removeItem(key);
      } catch {
        // Nothing to remove.
      }
    }
  }
  for (const [key, value] of Object.entries(before)) {
    try {
      if (store.getItem(key) !== value) store.setItem(key, value);
    } catch {
      // Storage refused: keep restoring the rest.
    }
  }
}

/**
 * Tells every store hook to re-read: a `storage` event with a null key, which each subscriber
 * (progress, settings, game, stories, favorites, phrasebook view, theme, coach) treats as "all keys
 * changed". Browser only.
 */
export function announceStorageReplaced(): void {
  window.dispatchEvent(new StorageEvent("storage", { key: null }));
}
