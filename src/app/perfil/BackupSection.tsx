"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ConfirmDialog } from "@/components/coach/ConfirmDialog";
import { Button, Card } from "@/components/ui";
import { BACKUP_ERRORS, announceStorageReplaced, applyBackup, backupFileName, serializeBackup, type Backup } from "@/lib/backup";
import { EXPORT_READ_ERROR, exportBackupFile, exportedMessage, readBackupFile, saveFile } from "@/lib/backup/file";
import { backupSummary, formatBackupDate } from "@/lib/backup/summary";
import { leagueEnabled } from "@/lib/league/config";

type Notice = { kind: "error" | "info"; text: string } | { kind: "restored"; previous: Backup };

/** Perfil → "Copia de seguridad": save everything on the device to a file, or restore one. */
export function BackupSection() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const exportNow = async () => {
    const saved = await exportBackupFile();
    if (!saved) {
      setNotice({ kind: "error", text: EXPORT_READ_ERROR });
      return;
    }
    const text = exportedMessage(saved);
    if (text) setNotice({ kind: "info", text });
  };

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again fires a change.
    e.target.value = "";
    if (!file) return;
    setNotice(null);
    const result = await readBackupFile(file);
    if (result.ok) setPending(result.backup);
    else setNotice({ kind: "error", text: result.error });
  };

  const restore = () => {
    if (!pending) return;
    let result: ReturnType<typeof applyBackup>;
    try {
      result = applyBackup(window.localStorage, pending);
    } catch {
      result = { ok: false, error: BACKUP_ERRORS.storage };
    }
    setPending(null);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    announceStorageReplaced();
    setNotice({ kind: "restored", previous: result.previous });
  };

  const downloadPrevious = (previous: Backup) => {
    void saveFile(serializeBackup(previous), backupFileName(new Date(previous.exportedAt), "anterior"));
  };

  const pendingSummary = pending ? backupSummary(pending) : "";

  return (
    <section aria-labelledby="backup-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="backup-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Copia de seguridad
        </h2>
        <p className="text-sm text-ink-muted">
          {leagueEnabled()
            ? "Además de «Guardado en la nube» (arriba), puedes guardar una copia en un archivo."
            : "Tu progreso solo está en este dispositivo. Hasta que haya cuentas, esta copia es la única forma de no perderlo."}
        </p>
      </div>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-ink">Guardar una copia</h3>
            <p className="text-sm text-ink-muted">
              Un archivo con tu progreso, ajustes y situaciones de Prepárate. Guárdalo en Archivos o en otro sitio seguro. El
              código de acceso de Prepárate no se incluye.
            </p>
          </div>
          <Button size="md" onClick={() => void exportNow()}>
            Guardar copia
          </Button>
        </div>
        <div className="h-0.5 bg-line" />
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-ink">Restaurar una copia</h3>
            <p className="text-sm text-ink-muted">
              Reemplaza lo de este dispositivo por lo del archivo. El audio de tus situaciones se vuelve a descargar la primera
              vez que lo escuches (con internet).
            </p>
          </div>
          <input ref={input} type="file" accept=".json,application/json" onChange={(e) => void pick(e)} className="sr-only" tabIndex={-1} aria-hidden="true" />
          <Button size="md" variant="secondary" onClick={() => input.current?.click()}>
            Elegir archivo de copia
          </Button>
        </div>

        {notice?.kind === "error" ? (
          <p role="alert" className="rounded-card bg-error-soft p-4 text-base font-bold text-error-deep">
            {notice.text}
          </p>
        ) : null}
        {notice?.kind === "info" ? (
          <p role="status" className="rounded-card bg-sea-soft p-4 text-base text-ink">
            {notice.text}
          </p>
        ) : null}
        {notice?.kind === "restored" ? (
          <div role="status" className="flex flex-col gap-3 rounded-card bg-success-soft p-4">
            <p className="text-base font-bold text-success-deep">Copia restaurada.</p>
            {Object.keys(notice.previous.data).length > 0 ? (
              <>
                <p className="text-sm text-ink">
                  Si te has equivocado de archivo, descarga lo que había antes en este dispositivo y restáuralo. Esta opción
                  desaparece al salir de esta página.
                </p>
                <Button size="md" variant="secondary" onClick={() => downloadPrevious(notice.previous)}>
                  Descargar la copia anterior
                </Button>
              </>
            ) : (
              <p className="text-sm text-ink">Este dispositivo no tenía progreso guardado antes.</p>
            )}
          </div>
        ) : null}
      </Card>

      {pending ? (
        <ConfirmDialog title="¿Restaurar esta copia?" confirmLabel="Sí, reemplazar" onConfirm={restore} onCancel={() => setPending(null)}>
          Esto reemplazará el progreso de este dispositivo por la copia del {formatBackupDate(pending.exportedAt)}
          {pendingSummary ? ` (${pendingSummary})` : ""}. Podrás descargar lo que hay ahora justo después.
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
