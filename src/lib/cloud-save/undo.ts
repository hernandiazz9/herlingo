/**
 * Undo copy of a cloud restore (plan 010): before a cloud copy replaces this device's data, the
 * replaced data (cloud keys only, backup format) is kept in Cache Storage `lang-lern-cloud-undo`
 * (one entry: the last replaced copy, with its date) and offered as "Deshacer restauración" /
 * "Descargar copia anterior" for 7 days. The page removes it when it expires or is used; the
 * service worker keeps this cache across updates (scripts/pwa/sw.template.js, KEEP). Browser only.
 */
import { BACKUP_APP, type Backup } from "@/lib/backup";
import { toCloudBackup } from "./blob";

export const UNDO_CACHE = "lang-lern-cloud-undo";
/** Same origin, never requested over the network (the SW does not serve it). */
const UNDO_URL = "/cloud-undo/previous.json";
export const UNDO_DAYS = 7;
const UNDO_MS = UNDO_DAYS * 24 * 60 * 60 * 1000;
const EVENT = "lang-lern:cloud-undo-change";

export interface UndoCopy {
  /** ISO date-time when this data was replaced by the cloud copy. */
  savedAt: string;
  /** Last day it is offered (ISO date-time). */
  expiresAt: string;
  /** The replaced data. */
  backup: Backup;
}

export function hasUndoStorage(): boolean {
  return typeof caches !== "undefined";
}

function emit() {
  window.dispatchEvent(new Event(EVENT));
}

/** Calls `onChange` when the undo copy is saved, used or removed (this page). */
export function subscribeUndo(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** Keeps `backup` as the undo copy (replaces the previous one). Throws when it cannot be stored. */
export async function saveUndo(backup: Backup, now: Date = new Date()): Promise<void> {
  const cache = await caches.open(UNDO_CACHE);
  const body = JSON.stringify({ app: BACKUP_APP, savedAt: now.toISOString(), backup });
  await cache.put(UNDO_URL, new Response(body, { headers: { "Content-Type": "application/json" } }));
  // Read it back: a restore must never go ahead without its undo copy.
  const check = await cache.match(UNDO_URL);
  if (!check) throw new Error("undo copy not stored");
  emit();
}

/** The undo copy while it is offered (7 days), else null. An expired or unreadable one is removed. */
export async function readUndo(now: Date = new Date()): Promise<UndoCopy | null> {
  if (!hasUndoStorage()) return null;
  try {
    const cache = await caches.open(UNDO_CACHE);
    const res = await cache.match(UNDO_URL);
    if (!res) return null;
    const value = (await res.json()) as { app?: unknown; savedAt?: unknown; backup?: unknown };
    const savedAt = typeof value.savedAt === "string" ? Date.parse(value.savedAt) : NaN;
    const backup = value.app === BACKUP_APP ? toCloudBackup(value.backup) : null;
    if (!backup || Number.isNaN(savedAt) || now.getTime() - savedAt > UNDO_MS) {
      await cache.delete(UNDO_URL);
      return null;
    }
    return {
      savedAt: new Date(savedAt).toISOString(),
      expiresAt: new Date(savedAt + UNDO_MS).toISOString(),
      backup,
    };
  } catch {
    return null;
  }
}

/** Removes the undo copy (after "Deshacer restauración"). Best effort. */
export async function clearUndo(): Promise<void> {
  if (!hasUndoStorage()) return;
  try {
    const cache = await caches.open(UNDO_CACHE);
    await cache.delete(UNDO_URL);
  } catch {
    // Nothing to remove.
  }
  emit();
}
