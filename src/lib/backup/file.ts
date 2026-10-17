/**
 * Hands a backup file to the user (browser only). On phones (installed iOS app: downloads go
 * nowhere useful) the share sheet when it accepts files, so it can be saved to Archivos; elsewhere,
 * or if the share sheet fails, a normal download. `exportBackupFile` / `readBackupFile` are the
 * whole save and read steps (Perfil "Copia de seguridad", "Herlingo se muda", "Traer mis datos").
 */
import {
  BACKUP_ERRORS,
  MAX_BACKUP_BYTES,
  backupFileName,
  collectBackup,
  parseBackup,
  serializeBackup,
  type ParseResult,
} from "./index";

export type SaveOutcome = "shared" | "downloaded" | "cancelled";

export const EXPORT_READ_ERROR = "No se ha podido leer el progreso de este dispositivo.";

/** Saves everything on the device to a backup file; null when the device's data cannot be read. */
export async function exportBackupFile(): Promise<{ outcome: SaveOutcome; fileName: string } | null> {
  let text: string;
  try {
    text = serializeBackup(collectBackup(window.localStorage));
  } catch {
    return null;
  }
  const fileName = backupFileName();
  return { outcome: await saveFile(text, fileName), fileName };
}

/** What to tell after `exportBackupFile` (null when the share sheet was cancelled). */
export function exportedMessage(saved: { outcome: SaveOutcome; fileName: string }): string | null {
  if (saved.outcome === "downloaded") return `Copia descargada: ${saved.fileName}. Guárdala en un sitio seguro.`;
  if (saved.outcome === "shared") return "Copia lista. Comprueba que se ha guardado donde elegiste.";
  return null;
}

/** Reads and validates a chosen backup file. Nothing is written. */
export async function readBackupFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_BACKUP_BYTES) return { ok: false, error: BACKUP_ERRORS.tooBig };
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: BACKUP_ERRORS.unreadable };
  }
  return parseBackup(text);
}

export async function saveFile(text: string, fileName: string): Promise<SaveOutcome> {
  const file = new File([text], fileName, { type: "application/json" });
  const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (touch && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Share sheet unavailable after all: fall back to a download.
    }
  }
  download(file);
  return "downloaded";
}

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
