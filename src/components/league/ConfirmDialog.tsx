"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DANGER, leagueErrorMessage } from "./copy";

export interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  /** Runs the action. Throws `LeagueError`; the message is shown in the dialog. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
  /** Disable confirming (e.g. offline) with this note. */
  blockedNote?: string;
}

/** Bottom-sheet confirmation (same look as Perfil's "¿Borrar tu progreso?"). Escape cancels. */
export function ConfirmDialog({ title, children, confirmLabel, pendingLabel, onConfirm, onClose, blockedNote }: ConfirmDialogProps) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(leagueErrorMessage(err));
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-backdrop/80 p-4 pb-[calc(var(--safe-bottom)+1rem)]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="flex w-full max-w-[calc(var(--column-width)-2rem)] flex-col gap-4 rounded-card border-2 border-line bg-surface p-5 shadow-[0_12px_40px_-12px_var(--shadow)]"
      >
        <h2 id={`${id}-title`} className="text-2xl font-extrabold text-ink">
          {title}
        </h2>
        <div id={`${id}-desc`} className="flex flex-col gap-2 text-base text-ink-muted">
          {children}
        </div>
        {blockedNote ? (
          <p role="status" className="text-base font-bold text-terracotta-deep">
            {blockedNote}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-base font-bold text-error-deep">
            {error}
          </p>
        ) : null}
        <Button fullWidth autoFocus onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending || Boolean(blockedNote)}
          aria-busy={pending}
          className={cn(DANGER, "min-h-14 w-full text-lg")}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </div>
  );
}
