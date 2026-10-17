/** How a backup is described before it is restored (Perfil, "Traer mis datos"). */
import { languageName, listPacks } from "@/lib/content";
import { parseProgress } from "@/lib/progress";
import type { Backup } from "./index";

const dateFormat = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Every language with progress in the backup: "italiano: 1200 XP, francés: 40 XP". */
export function backupSummary(backup: Backup): string {
  return listPacks()
    .flatMap((meta) => {
      const raw = backup.data[`lang-lern:progress:${meta.lang}`];
      if (!raw) return [];
      const p = parseProgress(raw);
      if (!p.onboarded && p.xp === 0) return [];
      return [`${languageName(meta.lang)}: ${p.xp} XP`];
    })
    .join(", ");
}

/** "15 de octubre de 2026, 9:30" (the ISO string as is when it cannot be formatted). */
export function formatBackupDate(iso: string): string {
  try {
    return dateFormat.format(new Date(iso));
  } catch {
    return iso;
  }
}
