/**
 * Cloud save (plan 010): one copy of the Perfil backup blob per Liga account, in Supabase through
 * the `league_save_*` RPCs (docs/league.md). Framework-free; the React hook is in use-cloud-save.ts.
 *
 * - The device stays the source of truth. Active only when Liga is configured (`leagueEnabled()`),
 *   the device has joined the Liga and the switch is on; otherwise nothing runs and no request is
 *   made.
 * - Change detection: a hash of the copy's data (`blob.ts`) compared with the hash last uploaded,
 *   checked on the stores' change events, on hide, on `online`, at start and every 15 s while
 *   visible. A difference sets `dirty`.
 * - Upload: 5 s after the data last changed, at most one put per 30 s, with the last seen `rev`
 *   (optimistic concurrency). Offline or network errors keep it dirty and retry with back-off.
 * - A stale `rev` (another device wrote, or this account's copy was never seen here) never
 *   overwrites: when the cloud data differs, uploads stop and the state becomes `conflict` (or
 *   `restore-available` when this device has no progress) until the learner chooses (T132).
 * - Nothing in the learning flow awaits it and nothing here throws into the UI, except the explicit
 *   actions documented as throwing.
 *
 * Bookkeeping: `lang-lern:cloud-save` (`CLOUD_SAVE_KEY`), never part of a backup.
 */
import { announceStorageReplaced, applyBackup, CLOUD_SAVE_KEY, isCloudSaveKey, type Backup } from "@/lib/backup";
import { getLeagueAccount, refreshLeagueAccount, subscribeLeagueAccount, type LeagueAccountChange } from "@/lib/league/account";
import { leagueRpc } from "@/lib/league/client";
import { leagueEnabled } from "@/lib/league/config";
import { isLeagueError, LeagueError } from "@/lib/league/errors";
import { collectCloudBackup, hashData, isStoreEmpty, toCloudBackup } from "./blob";
import { clearUndo, hasUndoStorage, readUndo, saveUndo, type UndoCopy } from "./undo";

export { summarizeBackup, type BackupSummary } from "./blob";
export { readUndo, subscribeUndo, UNDO_DAYS, type UndoCopy } from "./undo";

const VERSION = 1;
const EVENT = "lang-lern:cloud-save-change";

const DEBOUNCE = 5_000;
const MIN_PUT_INTERVAL = 30_000;
const POLL = 15_000;
const BACKOFF_MIN = 5_000;
const BACKOFF_MAX = 10 * 60_000;
/** After `save_rate_limited` (server window: 120 writes per hour). */
const RATE_LIMIT_WAIT = 15 * 60_000;

/** Store change events that may change the copy's data (plus `storage` from other tabs). */
const CHANGE_EVENTS = [
  "lang-lern:progress-change",
  "lang-lern:settings-change",
  "lang-lern:activity-change",
  "lang-lern:active-lang-change",
  "lang-lern:level-change",
  "lang-lern:favorites-change",
  "lang-lern:game-change",
  "lang-lern:stories-change",
  "lang-lern:coach-change",
];

/** Server tokens of the save RPCs (they reach the client as the `LeagueError` message). */
export const CLOUD_SAVE_ERROR_TOKENS = ["save_invalid", "save_too_large", "save_rate_limited"] as const;
export type CloudSaveErrorToken = (typeof CLOUD_SAVE_ERROR_TOKENS)[number];

/** Spain Spanish copy for `lastError` (Perfil). */
export const CLOUD_SAVE_ERRORS: Record<CloudSaveErrorToken, string> = {
  save_invalid: "No se ha podido guardar en la nube: la copia no es válida.",
  save_too_large: "Tus datos ocupan demasiado para guardarlos en la nube (máximo 2 MB).",
  save_rate_limited: "Se ha guardado demasiadas veces en poco tiempo. Lo intentaremos más tarde.",
};

// ---------------------------------------------------------------------------------------------
// Bookkeeping (`lang-lern:cloud-save`, tolerant parsing)

interface Bookkeeping {
  v: typeof VERSION;
  enabled: boolean;
  /** Account the `rev`/`hash` belong to. */
  userId: string | null;
  /** Cloud revision this device last wrote or adopted (null = never seen a cloud copy). */
  rev: number | null;
  /** Hash of the data last uploaded or adopted. */
  hash: string | null;
  /** The device's data differs from `hash`: an upload is pending. */
  dirty: boolean;
  /** ISO date-time of the last successful upload or adoption. */
  lastSyncAt: string | null;
  /** Last persistent server error (`CloudSaveErrorToken`), cleared by the next success. */
  lastError: string | null;
}

const DEFAULTS: Bookkeeping = {
  v: VERSION,
  enabled: true,
  userId: null,
  rev: null,
  hash: null,
  dirty: false,
  lastSyncAt: null,
  lastError: null,
};

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

function parseBookkeeping(raw: string | null): Bookkeeping {
  if (!raw) return { ...DEFAULTS };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object" || Array.isArray(o)) return { ...DEFAULTS };
    const rev = typeof o.rev === "number" && Number.isInteger(o.rev) && o.rev >= 1 ? o.rev : null;
    return {
      v: VERSION,
      enabled: o.enabled !== false,
      userId: str(o.userId),
      rev,
      hash: str(o.hash),
      dirty: o.dirty === true,
      lastSyncAt: str(o.lastSyncAt),
      lastError: str(o.lastError),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CLOUD_SAVE_KEY);
  } catch {
    return null;
  }
}

function readBook(): Bookkeeping {
  return parseBookkeeping(readRaw());
}

function emit() {
  window.dispatchEvent(new Event(EVENT));
}

function writeBook(patch: Partial<Bookkeeping>): Bookkeeping {
  const next = { ...readBook(), ...patch, v: VERSION } as Bookkeeping;
  try {
    window.localStorage.setItem(CLOUD_SAVE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: retried on the next check.
  }
  emit();
  return next;
}

// ---------------------------------------------------------------------------------------------
// State

export type CloudSaveStatus =
  | "off"
  | "no-account"
  | "idle"
  | "dirty"
  | "uploading"
  | "offline"
  | "error"
  | "conflict"
  | "restore-available";

export interface CloudSaveState {
  status: CloudSaveStatus;
  /** ISO date-time of the last successful upload (or adoption of the cloud copy). */
  lastSyncAt: string | null;
  /** Persistent error token (`CLOUD_SAVE_ERRORS` has the copy), else null. */
  lastError: string | null;
  /** Size in bytes of the cloud copy, when known on this page. */
  size: number | null;
  /** Joined without a linked email: the copy cannot be recovered on another phone. */
  needsEmail: boolean;
  /** The switch (Perfil). */
  enabled: boolean;
  /**
   * The learner chose "Decidir luego" (or undid a restore) on this page: the launch prompt stays
   * hidden while `status` stays `conflict` / `restore-available` (no uploads). Next launch asks again.
   */
  promptDismissed: boolean;
}

type Mismatch = "conflict" | "restore-available" | null;

/** The cloud copy as last seen by this page (head, get or put). */
let cloudSize: number | null = null;
let mismatch: Mismatch = null;
let uploading = false;
let dismissed = false;
/** The cloud copy read when the mismatch was found (conflict dialog summary; restore reuses it if still current). */
let pendingCopy: CloudCopy | null = null;

const OFF: CloudSaveState = {
  status: "off",
  lastSyncAt: null,
  lastError: null,
  size: null,
  needsEmail: false,
  enabled: true,
  promptDismissed: false,
};

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Signed-in, joined Liga user id (cached account), else null. */
function joinedUser(): string | null {
  const account = getLeagueAccount();
  return account.status === "joined" && account.userId ? account.userId : null;
}

let lastKey = "";
let lastState: CloudSaveState = OFF;

/** Server render and hydration. */
export function getServerCloudSaveState(): CloudSaveState {
  return OFF;
}

/** Current state, synchronous (stable identity while nothing changes). */
export function getCloudSaveState(): CloudSaveState {
  if (typeof window === "undefined" || !leagueEnabled()) return OFF;
  const raw = readRaw();
  const account = getLeagueAccount();
  const isOnline = online();
  const key = `${raw}|${account.status}|${account.userId ?? ""}|${account.email ?? ""}|${isOnline}|${mismatch}|${uploading}|${cloudSize}|${dismissed}`;
  if (key === lastKey) return lastState;
  const book = parseBookkeeping(raw);
  const joined = account.status === "joined" && Boolean(account.userId);
  const mine = joined && book.userId === account.userId;
  let status: CloudSaveStatus;
  if (!book.enabled) status = "off";
  else if (!joined) status = "no-account";
  else if (mismatch) status = mismatch;
  else if (uploading) status = "uploading";
  else if (mine && book.lastError) status = "error";
  else if (!mine || book.dirty) status = isOnline ? "dirty" : "offline";
  else status = "idle";
  lastKey = key;
  lastState = {
    status,
    lastSyncAt: mine ? book.lastSyncAt : null,
    lastError: mine ? book.lastError : null,
    size: joined ? cloudSize : null,
    needsEmail: joined && !account.email,
    enabled: book.enabled,
    promptDismissed: dismissed,
  };
  return lastState;
}

/**
 * Calls `onChange` whenever the state may have changed (this module, other tabs, the Liga
 * account, connectivity). Returns the unsubscribe.
 */
export function subscribeCloudSave(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CLOUD_SAVE_KEY || e.key === null) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  const offAccount = subscribeLeagueAccount(onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    offAccount();
  };
}

function setUploading(value: boolean) {
  if (uploading === value) return;
  uploading = value;
  emit();
}

function setMismatch(value: Mismatch) {
  if (!value) pendingCopy = null;
  if (mismatch === value) return;
  mismatch = value;
  if (!value) dismissed = false;
  emit();
}

function setSize(value: number | null) {
  if (cloudSize === value) return;
  cloudSize = value;
  emit();
}

// ---------------------------------------------------------------------------------------------
// Local data

function localBackup(): Backup {
  return collectCloudBackup(window.localStorage);
}

function localHash(): string {
  return hashData(localBackup().data);
}

/** True when this device has no progress (no language with XP or a lesson done). */
export function isLocalEmpty(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return isStoreEmpty(window.localStorage);
  } catch {
    return true;
  }
}

/** The user the sync works for (joined, switch on, Liga configured), else null. */
function activeUser(): string | null {
  if (typeof window === "undefined" || !leagueEnabled()) return null;
  if (!readBook().enabled) return null;
  return joinedUser();
}

/** `rev`/`hash` belong to one account: another signed-in user starts from scratch (keeps `enabled`). */
function ensureUser(userId: string): Bookkeeping {
  const book = readBook();
  if (book.userId === userId) return book;
  mismatch = null;
  dismissed = false;
  pendingCopy = null;
  cloudSize = null;
  checkedFor = null;
  return writeBook({ userId, rev: null, hash: null, dirty: true, lastSyncAt: null, lastError: null });
}

/** Hash seen at the previous check (in memory): tells a fresh change from a pending one. */
let lastSeenHash: string | null = null;
/** Hash the server refused as invalid or too large: not retried until the data changes. */
let refusedHash: string | null = null;

/**
 * Compares the device's data with the last upload and updates `dirty`. Returns true when the data
 * changed since the previous check (a fresh change: debounce before uploading).
 */
function detect(userId: string): boolean {
  const book = ensureUser(userId);
  const hash = localHash();
  const fresh = lastSeenHash !== null && hash !== lastSeenHash;
  lastSeenHash = hash;
  const dirty = hash !== book.hash;
  // Back to the uploaded data (e.g. the too-large data was removed): the error no longer applies.
  if (!dirty && book.lastError) writeBook({ dirty, lastError: null });
  else if (dirty !== book.dirty) writeBook({ dirty });
  return fresh;
}

// ---------------------------------------------------------------------------------------------
// Server calls

interface Head {
  rev: number;
  size: number;
  updated_at: string;
}

interface PutResponse {
  status: "ok" | "conflict";
  rev: number | null;
  size: number | null;
  updated_at: string | null;
}

/** Token of a save RPC refusal (`save_too_large`…), else null. */
function saveErrorToken(error: unknown): CloudSaveErrorToken | null {
  if (!isLeagueError(error)) return null;
  return (CLOUD_SAVE_ERROR_TOKENS as readonly string[]).includes(error.message)
    ? (error.message as CloudSaveErrorToken)
    : null;
}

function put(backup: Backup, baseRev: number | null): Promise<PutResponse> {
  return leagueRpc<PutResponse>("league_save_put", { p_data: backup, p_base_rev: baseRev });
}

/** Records a successful put: the uploaded data is now the synced one. */
function noteUploaded(res: PutResponse, hash: string) {
  writeBook({
    rev: res.rev,
    hash,
    dirty: localHash() !== hash,
    lastSyncAt: res.updated_at ?? new Date().toISOString(),
    lastError: null,
  });
  refusedHash = null;
  setSize(res.size);
}

/**
 * The cloud copy's revision is not ours. Same data → adopt its revision; otherwise stop uploading
 * and ask the learner (conflict, or restore when this device has no progress). No copy any more →
 * forget the revision (the next upload creates it).
 */
async function resolveMismatch(userId: string): Promise<void> {
  const copy = await leagueRpc<(Head & { data: unknown }) | null>("league_save_get");
  if (activeUser() !== userId) return;
  if (!copy) {
    writeBook({ rev: null, dirty: true });
    setSize(null);
    return;
  }
  setSize(copy.size);
  const backup = toCloudBackup(copy.data);
  const hash = localHash();
  if (backup && hashData(backup.data) === hash) {
    writeBook({ rev: copy.rev, hash, dirty: false, lastSyncAt: copy.updated_at, lastError: null });
    setMismatch(null);
    return;
  }
  pendingCopy = backup ? { rev: copy.rev, updated_at: copy.updated_at, size: copy.size, backup } : null;
  setMismatch(isLocalEmpty() ? "restore-available" : "conflict");
}

// ---------------------------------------------------------------------------------------------
// Sync loop

let started = false;
let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let failures = 0;
let retryAt = 0;
let lastPutAt = 0;
/** User whose cloud head was checked on this page (null = check before the next upload). */
let checkedFor: string | null = null;

function schedule(ms: number) {
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void flushCloudSave();
  }, Math.max(0, ms));
}

function backOff(error: unknown) {
  failures += 1;
  const delay = Math.min(BACKOFF_MAX, BACKOFF_MIN * 2 ** (failures - 1));
  const jittered = Math.round(delay * (0.8 + Math.random() * 0.4));
  retryAt = Date.now() + jittered;
  schedule(jittered);
  if (isLeagueError(error) && (error.code === "not_authenticated" || error.code === "no_profile")) {
    void refreshLeagueAccount({ force: true });
  }
}

/** One pass: head check (once per page and account), then upload when dirty. */
async function run(force: boolean): Promise<void> {
  const userId = activeUser();
  if (!userId || mismatch || !online()) return;
  const now = Date.now();
  if (!force && retryAt > now) {
    schedule(retryAt - now);
    return;
  }
  try {
    if (checkedFor !== userId) {
      const head = await leagueRpc<Head | null>("league_save_head");
      if (activeUser() !== userId) return;
      checkedFor = userId;
      const book = readBook();
      if (!head) {
        setSize(null);
        if (book.rev !== null) writeBook({ rev: null, dirty: true });
      } else {
        setSize(head.size);
        if (head.rev !== book.rev) {
          await resolveMismatch(userId);
          if (mismatch || activeUser() !== userId) return;
        }
      }
    }

    detect(userId);
    const book = readBook();
    if (!book.dirty) return;
    const backup = localBackup();
    const hash = hashData(backup.data);
    if (!force && hash === refusedHash) return;
    const wait = lastPutAt + MIN_PUT_INTERVAL - Date.now();
    if (!force && wait > 0) {
      schedule(wait);
      return;
    }

    setUploading(true);
    lastPutAt = Date.now();
    let res: PutResponse;
    try {
      res = await put(backup, book.rev);
    } finally {
      setUploading(false);
    }
    if (activeUser() !== userId) return;
    failures = 0;
    retryAt = 0;
    if (res.status === "ok") noteUploaded(res, hash);
    else await resolveMismatch(userId);
  } catch (error) {
    const token = saveErrorToken(error);
    if (token) {
      writeBook({ lastError: token });
      if (token === "save_rate_limited") {
        retryAt = Date.now() + RATE_LIMIT_WAIT;
        schedule(RATE_LIMIT_WAIT);
      } else {
        refusedHash = localHash();
      }
      return;
    }
    backOff(error);
  }
}

/**
 * Checks and uploads now if needed (no-op when inactive, offline, backing off, in conflict).
 * `force`: ignore the back-off, the 30 s spacing and a refused copy. Never rejects.
 */
function flushCloudSave(force = false): Promise<void> {
  if (typeof window === "undefined" || !leagueEnabled()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = run(force)
    .catch(() => {
      // Never surface sync errors.
    })
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void flushCloudSave();
      }
    });
  return running;
}

/** A store changed or a periodic check: upload after the debounce, or now if already pending. */
function check() {
  const userId = activeUser();
  if (!userId || mismatch) return;
  try {
    const fresh = detect(userId);
    if (fresh) schedule(Math.max(DEBOUNCE, retryAt - Date.now()));
    else if (readBook().dirty && timer === undefined) void flushCloudSave();
  } catch {
    // Storage unreadable: try again on the next check.
  }
}

function onAccount(change: LeagueAccountChange) {
  if (change === "deleted") {
    // The server deleted the copy with the account: forget it here too (keep the switch).
    writeBook({ userId: null, rev: null, hash: null, dirty: false, lastSyncAt: null, lastError: null });
  }
  if (change === "signed_out" || change === "deleted" || change === "user_changed" || change === "joined") {
    checkedFor = null;
    lastSeenHash = null;
    refusedHash = null;
    setMismatch(null);
    setSize(null);
    failures = 0;
    retryAt = 0;
  }
  if (change === "joined" || change === "user_changed") void flushCloudSave();
}

/** Starts the cloud save for this page (idempotent; does nothing when Liga is not configured). */
export function startCloudSave(): void {
  if (started || typeof window === "undefined" || !leagueEnabled()) return;
  started = true;
  try {
    for (const name of CHANGE_EVENTS) window.addEventListener(name, check);
    window.addEventListener("storage", (e) => {
      if (e.key !== CLOUD_SAVE_KEY) check();
    });
    subscribeLeagueAccount(onAccount);
    window.addEventListener("online", () => {
      failures = 0;
      retryAt = 0;
      void flushCloudSave();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        const userId = activeUser();
        if (!userId || mismatch) return;
        detect(userId);
        if (readBook().dirty) void flushCloudSave();
      } else {
        check();
      }
    });
    setInterval(() => {
      if (document.visibilityState === "visible") check();
    }, POLL);
    void flushCloudSave();
  } catch {
    // Storage or events unavailable: no cloud save on this page.
  }
}

// ---------------------------------------------------------------------------------------------
// Actions (Perfil, conflict dialog)

/** The switch: off stops uploads (the cloud copy stays); on checks and uploads. */
export function setCloudSaveEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  writeBook({ enabled: on });
  checkedFor = null;
  setMismatch(null);
  if (on) void flushCloudSave(true);
}

/** "Guardar ahora": checks and uploads now, ignoring the spacing and back-off. Never rejects. */
export function syncNow(): Promise<void> {
  const userId = activeUser();
  if (!userId) return Promise.resolve();
  try {
    // No known cloud copy (e.g. after "Borrar copia de la nube"): upload even without a change. A
    // copy that does exist makes the put a conflict, handled as usual (never overwritten).
    if (readBook().rev === null) writeBook({ hash: null });
    detect(userId);
  } catch {
    // Checked again inside the flush.
  }
  return flushCloudSave(true);
}

/**
 * "Borrar copia de la nube": deletes this account's cloud copy (`league_save_delete`); the data on
 * this device is not touched and the switch keeps its value. Switch on: nothing is uploaded until
 * the data changes again (or "Guardar ahora"), which creates a new copy. Switch off: nothing is
 * uploaded; turning it on later uploads a new copy. Throws `LeagueError` (`offline`, `network`,
 * `not_joined`…).
 */
export async function deleteCloudCopy(): Promise<void> {
  const userId = typeof window !== "undefined" && leagueEnabled() ? joinedUser() : null;
  if (!userId) throw new LeagueError("not_joined");
  await leagueRpc<null>("league_save_delete");
  if (joinedUser() !== userId) return;
  ensureUser(userId);
  let hash: string | null = null;
  if (readBook().enabled) {
    try {
      hash = localHash();
    } catch {
      hash = null;
    }
  }
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  lastSeenHash = hash;
  refusedHash = null;
  checkedFor = userId;
  failures = 0;
  retryAt = 0;
  writeBook({ rev: null, hash, dirty: false, lastSyncAt: null, lastError: null });
  setMismatch(null);
  setSize(null);
}

export interface CloudCopy {
  rev: number;
  updated_at: string;
  size: number;
  backup: Backup;
}

/**
 * The account's cloud copy, or null when there is none. Throws `LeagueError` (`offline`,
 * `network`, `not_authenticated`…, `disabled` without Liga) or `unknown` when the copy is not
 * one this app can read (newer format).
 */
export async function fetchCloudCopy(): Promise<CloudCopy | null> {
  const copy = await leagueRpc<(Head & { data: unknown }) | null>("league_save_get");
  if (!copy) {
    setSize(null);
    return null;
  }
  setSize(copy.size);
  const backup = toCloudBackup(copy.data);
  if (!backup) throw new LeagueError("unknown", "cloud copy unreadable");
  return { rev: copy.rev, updated_at: copy.updated_at, size: copy.size, backup };
}

/**
 * "Esta del móvil": uploads this device's data over the cloud copy after an explicit choice
 * (put with the cloud's current revision). Throws `LeagueError` (the copy changed again in
 * between → `try_again`; `save_too_large`… come back as their token in the message).
 */
export async function keepLocalCopy(): Promise<void> {
  const userId = activeUser();
  if (!userId) throw new LeagueError("not_joined");
  ensureUser(userId);
  const head = await leagueRpc<Head | null>("league_save_head");
  const backup = localBackup();
  const hash = hashData(backup.data);
  setUploading(true);
  let res: PutResponse;
  try {
    res = await put(backup, head?.rev ?? null);
  } catch (error) {
    const token = saveErrorToken(error);
    if (token) writeBook({ lastError: token });
    throw error;
  } finally {
    setUploading(false);
  }
  if (res.status !== "ok") throw new LeagueError("try_again", "cloud copy changed");
  lastPutAt = Date.now();
  checkedFor = userId;
  noteUploaded(res, hash);
  setMismatch(null);
}

/**
 * After the cloud copy `rev` has been applied to this device (T132's restore): the device's data
 * is now that revision. Clears the conflict; nothing is uploaded.
 */
export function markCloudCopyApplied(rev: number): void {
  const userId = activeUser();
  if (!userId) return;
  ensureUser(userId);
  const hash = localHash();
  lastSeenHash = hash;
  checkedFor = userId;
  writeBook({ rev, hash, dirty: false, lastSyncAt: new Date().toISOString(), lastError: null });
  setMismatch(null);
}

// ---------------------------------------------------------------------------------------------
// Conflict and restore (T132)

/** "Decidir luego": hides the launch prompt on this page; stays in conflict, nothing is uploaded. */
export function dismissCloudPrompt(): void {
  if (dismissed) return;
  dismissed = true;
  emit();
}

/** Shows the launch prompt again (Perfil's "elige qué copia conservar"), if there is a choice to make. */
export function reopenCloudPrompt(): void {
  if (!dismissed) return;
  dismissed = false;
  emit();
}

/**
 * The cloud copy behind a `conflict` / `restore-available` prompt (read once when the mismatch was
 * found; fetched again if this page does not have it). Throws like `fetchCloudCopy`.
 */
export async function loadPendingCloudCopy(): Promise<CloudCopy | null> {
  if (pendingCopy) return pendingCopy;
  const copy = await fetchCloudCopy();
  if (copy && mismatch) pendingCopy = copy;
  return copy;
}

/** A restore or undo that failed on this device (nothing was changed). `message` is UI copy. */
export class CloudRestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudRestoreError";
  }
}

export const CLOUD_RESTORE_ERRORS = {
  noCopy: "No hay ninguna copia en la nube. No se ha cambiado nada.",
  noUndoStorage: "Este navegador no puede guardar una copia de lo que tienes ahora, así que no se ha cambiado nada.",
  undoNotSaved: "No se ha podido guardar una copia de lo que tienes ahora (¿falta espacio?). No se ha cambiado nada.",
  noUndo: "Ya no hay ninguna copia anterior que recuperar.",
} as const;

/**
 * "La de la nube" / "Restaurar": replaces this device's data (cloud keys only: Liga keys, the
 * theme when the copy has none and the coach access code stay) with the account's cloud copy.
 * Before writing, the replaced data is kept as the undo copy (Cache Storage, 7 days); if that
 * cannot be stored, nothing changes. Uses `applyBackup` (rolls back on a storage error).
 * Afterwards every store re-reads, `rev`/`hash` are the cloud's and nothing is pending. Returns
 * the undo copy. Throws `LeagueError` (network, account) or `CloudRestoreError` (this device;
 * nothing changed).
 */
export async function restoreCloudCopy(): Promise<UndoCopy> {
  const userId = activeUser();
  if (!userId) throw new LeagueError("not_joined");
  if (!hasUndoStorage()) throw new CloudRestoreError(CLOUD_RESTORE_ERRORS.noUndoStorage);
  // Reuse the copy read for the prompt when the cloud has not changed since; else read it again.
  let copy: CloudCopy | null = pendingCopy;
  if (copy) {
    const head = await leagueRpc<Head | null>("league_save_head");
    if (!head || head.rev !== copy.rev) copy = null;
  }
  copy ??= await fetchCloudCopy();
  if (!copy) throw new CloudRestoreError(CLOUD_RESTORE_ERRORS.noCopy);
  if (activeUser() !== userId) throw new LeagueError("not_joined");

  const now = new Date();
  const store = window.localStorage;
  const previous = collectCloudBackup(store, now);
  try {
    await saveUndo(previous, now);
  } catch {
    throw new CloudRestoreError(CLOUD_RESTORE_ERRORS.undoNotSaved);
  }
  const result = applyBackup(store, copy.backup, now, isCloudSaveKey);
  if (!result.ok) throw new CloudRestoreError(result.error);
  markCloudCopyApplied(copy.rev);
  announceStorageReplaced();
  return (await readUndo(now)) ?? { savedAt: now.toISOString(), expiresAt: now.toISOString(), backup: previous };
}

/**
 * "Deshacer restauración": puts back the data the last cloud restore replaced (cloud keys only)
 * and removes the undo copy. The cloud copy is not touched: this device forgets which revision it
 * has, so the next check finds the difference and asks again (never a silent upload); the prompt
 * stays hidden on this page. Throws `CloudRestoreError` (nothing changed).
 */
export async function undoCloudRestore(): Promise<void> {
  const undo = await readUndo();
  if (!undo) throw new CloudRestoreError(CLOUD_RESTORE_ERRORS.noUndo);
  const result = applyBackup(window.localStorage, undo.backup, new Date(), isCloudSaveKey);
  if (!result.ok) throw new CloudRestoreError(result.error);
  await clearUndo();
  const userId = activeUser();
  if (userId) ensureUser(userId);
  // Unknown revision: the head check runs before any upload and raises the choice again.
  writeBook({ rev: null, hash: null, dirty: true });
  checkedFor = null;
  lastSeenHash = null;
  refusedHash = null;
  dismissed = true;
  emit();
  announceStorageReplaced();
  void flushCloudSave(true);
}
