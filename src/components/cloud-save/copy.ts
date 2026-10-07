/** Cloud save UI helpers: Spain Spanish copy for errors, dates and copy summaries. */
import { leagueErrorMessage } from "@/components/league/copy";
import { CLOUD_SAVE_ERRORS, CloudRestoreError, type BackupSummary } from "@/lib/cloud-save";
import { isLeagueError } from "@/lib/league/errors";

const dateTime = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" });

/** "8 de octubre de 2026, 10:42" (ISO date-time). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTime.format(d);
}

/** "8 de octubre de 2026" (ISO date-time). */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : day.format(d);
}

/** "8 de octubre de 2026" from a local "YYYY-MM-DD" day; "nunca" when null. */
export function formatActivity(value: string | null): string {
  if (!value) return "nunca";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return day.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** "1 lección", "12 lecciones". */
export function lessonsLabel(count: number): string {
  return `${count} ${count === 1 ? "lección" : "lecciones"}`;
}

/** "1200 XP · 12 lecciones". */
export function summaryLine(summary: BackupSummary): string {
  return `${summary.xp} XP · ${lessonsLabel(summary.lessonsDone)}`;
}

/** Copy for anything the cloud save actions throw. */
export function cloudSaveErrorMessage(error: unknown): string {
  if (error instanceof CloudRestoreError) return error.message;
  if (isLeagueError(error)) {
    const token = error.message as keyof typeof CLOUD_SAVE_ERRORS;
    if (Object.hasOwn(CLOUD_SAVE_ERRORS, token)) return CLOUD_SAVE_ERRORS[token];
    if (error.code === "try_again") return "La copia de la nube acaba de cambiar. Vuelve a intentarlo.";
    if (error.code === "unknown" && error.message === "cloud copy unreadable") {
      return "La copia de la nube es de una versión más nueva de la app. Actualiza la app e inténtalo otra vez.";
    }
  }
  return leagueErrorMessage(error);
}
