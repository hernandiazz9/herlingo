/** «Exportar intentos»: the attempts and reports as a JSON file, through the backup's save step. */
import { BACKUP_APP } from "@/lib/backup";
import { saveFile, type SaveOutcome } from "@/lib/backup/file";
import { getAttempts } from "./attempts";
import { getReports } from "./reports";

/** `herlingo-entrevista-intentos-YYYY-MM-DD.json` (local date). */
export function attemptsFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `herlingo-entrevista-intentos-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/**
 * «Exportar intentos»: every attempt and simulacro report in a JSON file, through the backup's
 * save step (share sheet on phones, else a download). Call it straight from the tap (the share
 * sheet needs the gesture). Null when the device's data cannot be read. Nothing is deleted.
 */
export async function exportAttempts(): Promise<{ outcome: SaveOutcome; fileName: string; attempts: number } | null> {
  let text: string;
  let count: number;
  try {
    const attempts = getAttempts();
    count = attempts.length;
    const file = {
      app: BACKUP_APP,
      kind: "mock-interview-attempts",
      format: 1,
      exportedAt: new Date().toISOString(),
      attempts,
      reports: getReports(),
    };
    text = `${JSON.stringify(file, null, 2)}\n`;
  } catch {
    return null;
  }
  const fileName = attemptsFileName();
  return { outcome: await saveFile(text, fileName), fileName, attempts: count };
}
