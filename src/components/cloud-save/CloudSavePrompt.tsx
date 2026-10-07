"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import {
  dismissCloudPrompt,
  keepLocalCopy,
  loadPendingCloudCopy,
  restoreCloudCopy,
  summarizeBackup,
  type BackupSummary,
  type CloudCopy,
  type UndoCopy,
} from "@/lib/cloud-save";
import { collectCloudBackup } from "@/lib/cloud-save/blob";
import { useCloudSave } from "@/lib/cloud-save/use-cloud-save";
import { CloudUndoPanel } from "./CloudUndoPanel";
import { cloudSaveErrorMessage, formatActivity, formatDateTime, lessonsLabel, summaryLine } from "./copy";

type Loaded = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; copy: CloudCopy };
type Busy = "restore" | "keep" | null;

/**
 * Launch prompt of the cloud save (plan 010, "Conflict/restore"): when the account's cloud copy
 * differs from this device, offers to restore it (device without progress) or asks "¿Qué copia
 * quieres conservar?" with both sides' XP, lessons and last activity. After a restore, offers
 * "Deshacer restauración" / "Descargar copia anterior". "Decidir luego" / "Ahora no" hides it on
 * this page and nothing is uploaded until the learner chooses.
 */
export function CloudSavePrompt() {
  const state = useCloudSave();
  const [restored, setRestored] = useState<UndoCopy | null>(null);
  const asking = (state.status === "conflict" || state.status === "restore-available") && !state.promptDismissed;

  if (restored) return <RestoredSheet undo={restored} onClose={() => setRestored(null)} />;
  if (!asking) return null;
  return <ChoiceSheet key={state.status} kind={state.status === "conflict" ? "conflict" : "restore"} onRestored={setRestored} />;
}

function ChoiceSheet({ kind, onRestored }: { kind: "conflict" | "restore"; onRestored: (undo: UndoCopy) => void }) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [local] = useState<BackupSummary | null>(() => {
    try {
      return summarizeBackup(collectCloudBackup(window.localStorage));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let alive = true;
    loadPendingCloudCopy().then(
      (copy) => {
        if (!alive) return;
        // The copy is gone (deleted elsewhere): nothing to choose; the sync uploads this device.
        if (!copy) dismissCloudPrompt();
        else setLoaded({ kind: "ready", copy });
      },
      (err: unknown) => {
        if (alive) setLoaded({ kind: "error", message: cloudSaveErrorMessage(err) });
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  const restore = async () => {
    setBusy("restore");
    setError(null);
    try {
      onRestored(await restoreCloudCopy());
    } catch (err) {
      setError(cloudSaveErrorMessage(err));
      setBusy(null);
    }
  };

  const keep = async () => {
    setBusy("keep");
    setError(null);
    try {
      await keepLocalCopy();
    } catch (err) {
      setError(cloudSaveErrorMessage(err));
      setBusy(null);
    }
  };

  const later = () => dismissCloudPrompt();
  const disabled = busy !== null || loaded.kind !== "ready";
  const copy = loaded.kind === "ready" ? loaded.copy : null;
  const cloud = copy ? summarizeBackup(copy.backup) : null;

  const status =
    loaded.kind === "loading" ? (
      <p role="status" className="text-base text-ink-muted">
        Leyendo la copia de la nube…
      </p>
    ) : loaded.kind === "error" ? (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-base font-bold text-error-deep">
          {loaded.message}
        </p>
        <Button
          size="md"
          variant="secondary"
          onClick={() => {
            setLoaded({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Reintentar
        </Button>
      </div>
    ) : null;

  const errorLine = error ? (
    <p role="alert" className="text-base font-bold text-error-deep">
      {error}
    </p>
  ) : null;

  if (kind === "restore") {
    return (
      <Sheet title="Tienes una copia en la nube">
        {status}
        {copy && cloud ? (
          <>
            <p className="text-base text-ink">Tienes una copia en la nube del {formatDateTime(copy.updated_at)}. ¿Restaurarla?</p>
            <p className="text-sm text-ink-muted">
              {summaryLine(cloud)} · última actividad: {formatActivity(cloud.lastActivity)}
            </p>
          </>
        ) : null}
        {errorLine}
        <Button fullWidth autoFocus onClick={() => void restore()} disabled={disabled} aria-busy={busy === "restore"}>
          {busy === "restore" ? "Restaurando…" : "Restaurar"}
        </Button>
        <Button fullWidth variant="secondary" onClick={later} disabled={busy !== null}>
          Ahora no
        </Button>
      </Sheet>
    );
  }

  return (
    <Sheet title="¿Qué copia quieres conservar?">
      <p className="text-base text-ink-muted">
        Este móvil y tu copia de la nube tienen progreso distinto. La copia que no elijas se sustituye por la otra.
      </p>
      {status}
      {copy && cloud ? (
        <div className="grid grid-cols-2 gap-3">
          <Side title="Este móvil" summary={local} />
          <Side title="La nube" summary={cloud} note={`Guardada el ${formatDateTime(copy.updated_at)}`} />
        </div>
      ) : null}
      {errorLine}
      <Button fullWidth variant="secondary" onClick={() => void keep()} disabled={disabled} aria-busy={busy === "keep"}>
        {busy === "keep" ? "Guardando…" : "Esta del móvil"}
      </Button>
      <Button fullWidth variant="secondary" onClick={() => void restore()} disabled={disabled} aria-busy={busy === "restore"}>
        {busy === "restore" ? "Restaurando…" : "La de la nube"}
      </Button>
      <p className="text-sm text-ink-muted">Si eliges la de la nube, podrás deshacerlo durante 7 días.</p>
      <Button fullWidth autoFocus onClick={later} disabled={busy !== null}>
        Decidir luego
      </Button>
    </Sheet>
  );
}

function Side({ title, summary, note }: { title: string; summary: BackupSummary | null; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border-2 border-line bg-cream p-3">
      <h3 className="text-base font-extrabold text-ink">{title}</h3>
      {summary ? (
        <dl className="flex flex-col gap-1 text-sm text-ink">
          <div>
            <dt className="sr-only">XP total</dt>
            <dd className="text-xl font-extrabold text-sea-deep">{summary.xp} XP</dd>
          </div>
          <div>
            <dt className="sr-only">Lecciones hechas</dt>
            <dd>{lessonsLabel(summary.lessonsDone)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Última actividad</dt>
            <dd>{formatActivity(summary.lastActivity)}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-ink-muted">No se ha podido leer.</p>
      )}
      {note ? <p className="text-xs text-ink-muted">{note}</p> : null}
    </div>
  );
}

function RestoredSheet({ undo, onClose }: { undo: UndoCopy; onClose: () => void }) {
  const [undone, setUndone] = useState(false);
  return (
    <Sheet title={undone ? "Restauración deshecha" : "Copia restaurada"} onEscape={onClose}>
      {undone ? null : <p className="text-base text-ink">Ya tienes en este móvil tu progreso de la nube.</p>}
      <CloudUndoPanel initial={undo} onUndone={() => setUndone(true)} />
      <Button fullWidth autoFocus onClick={onClose}>
        Cerrar
      </Button>
    </Sheet>
  );
}

/** Bottom sheet over the app (same look as the Liga and Perfil confirmations). */
function Sheet({ title, children, onEscape }: { title: string; children: ReactNode; onEscape?: () => void }) {
  const id = useId();

  useEffect(() => {
    if (!onEscape) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-backdrop/80 p-4 pb-[calc(var(--safe-bottom)+1rem)]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="flex w-full max-w-[calc(var(--column-width)-2rem)] flex-col gap-4 rounded-card border-2 border-line bg-surface p-5 shadow-[0_12px_40px_-12px_var(--shadow)]"
      >
        <h2 id={`${id}-title`} className="text-2xl font-extrabold text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
