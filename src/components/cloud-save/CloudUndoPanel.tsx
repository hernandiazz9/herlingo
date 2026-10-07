"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { backupFileName, serializeBackup } from "@/lib/backup";
import { saveFile } from "@/lib/backup/file";
import { readUndo, subscribeUndo, undoCloudRestore, type UndoCopy } from "@/lib/cloud-save";
import { cloudSaveErrorMessage, formatDay } from "./copy";

export interface CloudUndoPanelProps {
  /** The undo copy just returned by `restoreCloudCopy()`; read from Cache Storage when absent. */
  initial?: UndoCopy | null;
  /** After a successful "Deshacer restauración". */
  onUndone?: () => void;
}

/**
 * "Deshacer restauración" and "Descargar copia anterior" for the last cloud restore, while its undo
 * copy is kept (7 days). Renders nothing when there is none. Used right after a restore (launch
 * prompt) and on Perfil.
 */
export function CloudUndoPanel({ initial, onUndone }: CloudUndoPanelProps) {
  const [undo, setUndo] = useState<UndoCopy | null>(initial ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void readUndo().then((copy) => {
        if (alive) setUndo(copy);
      });
    };
    load();
    const off = subscribeUndo(load);
    return () => {
      alive = false;
      off();
    };
  }, []);

  if (done) {
    return (
      <p role="status" className="rounded-card bg-sea-soft p-4 text-base font-bold text-ink">
        Hecho: tienes otra vez lo que había antes en este móvil. La copia de la nube no ha cambiado.
      </p>
    );
  }
  if (!undo) return null;

  const hasData = Object.keys(undo.backup.data).length > 0;

  const runUndo = async () => {
    setPending(true);
    setError(null);
    try {
      await undoCloudRestore();
      setDone(true);
      onUndone?.();
    } catch (err) {
      setError(cloudSaveErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const download = () => {
    void saveFile(serializeBackup(undo.backup), backupFileName(new Date(undo.savedAt), "anterior"));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Lo que había en este móvil antes de restaurar se guarda hasta el {formatDay(undo.expiresAt)}.
      </p>
      {error ? (
        <p role="alert" className="text-base font-bold text-error-deep">
          {error}
        </p>
      ) : null}
      <Button size="md" variant="secondary" onClick={() => void runUndo()} disabled={pending} aria-busy={pending}>
        {pending ? "Deshaciendo…" : "Deshacer restauración"}
      </Button>
      {hasData ? (
        <Button size="md" variant="secondary" onClick={download} disabled={pending}>
          Descargar copia anterior
        </Button>
      ) : null}
    </div>
  );
}
