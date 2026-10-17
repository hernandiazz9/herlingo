"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { ConfirmDialog } from "@/components/coach/ConfirmDialog";
import { Button, Card } from "@/components/ui";
import { PREVIOUS_APP_NAME } from "@/lib/app-config";
import { BACKUP_ERRORS, applyBackup, type Backup } from "@/lib/backup";
import { readBackupFile } from "@/lib/backup/file";
import { backupSummary, formatBackupDate } from "@/lib/backup/summary";
import { leagueEnabled } from "@/lib/league/config";
import { useLegacyHost } from "./use-legacy-host";

/**
 * First launch on the new address: «Traer mis datos» restores a backup file (saved on the old
 * address, or on another phone) and opens the route where it was left. Nothing on an old address.
 */
export function MoveIn() {
  const legacy = useLegacyHost();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (legacy) return null;

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again fires a change.
    e.target.value = "";
    if (!file) return;
    setError(null);
    const result = await readBackupFile(file);
    if (result.ok) setPending(result.backup);
    else setError(result.error);
  };

  const bring = () => {
    if (!pending) return;
    let result: ReturnType<typeof applyBackup>;
    try {
      result = applyBackup(window.localStorage, pending);
    } catch {
      result = { ok: false, error: BACKUP_ERRORS.storage };
    }
    setPending(null);
    if (!result.ok) return setError(result.error);
    // Every store reads the new data from scratch: the route, already onboarded.
    window.location.replace("/");
  };

  const summary = pending ? backupSummary(pending) : "";

  return (
    <Card tone="sea" className="flex flex-col gap-3">
      <p className="text-lg font-bold text-ink">¿Ya usabas {PREVIOUS_APP_NAME}?</p>
      <p className="text-base text-ink">Si guardaste tus datos en un archivo, tráelos y sigue donde lo dejaste.</p>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        onChange={(e) => void pick(e)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button size="md" variant="secondary" onClick={() => input.current?.click()}>
        Traer mis datos
      </Button>
      {leagueEnabled() ? (
        <p className="text-sm text-ink-muted">
          ¿Usabas «Guardado en la nube» con tu email?{" "}
          <Link href="/liga/" className="font-bold text-sea-deep underline">
            Entra en la Liga
          </Link>{" "}
          con el mismo email.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-card bg-error-soft p-4 text-base font-bold text-error-deep">
          {error}
        </p>
      ) : null}
      {pending ? (
        <ConfirmDialog title="¿Traer esta copia?" confirmLabel="Sí, traerla" onConfirm={bring} onCancel={() => setPending(null)}>
          Es la copia del {formatBackupDate(pending.exportedAt)}
          {summary ? ` (${summary})` : ""}. Seguirás donde lo dejaste.
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}
