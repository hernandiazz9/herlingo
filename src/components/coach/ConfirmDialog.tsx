"use client";

import { useEffect, useId, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DANGER } from "./shared";

export interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  /** Label of the destructive action ("Sí, borrar"). */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Bottom sheet asking to confirm a destructive action (same look as /perfil's reset); Escape cancels. */
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-backdrop/80 p-4 pb-[calc(var(--safe-bottom)+1rem)]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex w-full max-w-[calc(var(--column-width)-2rem)] flex-col gap-4 rounded-card border-2 border-line bg-surface p-5 shadow-[0_12px_40px_-12px_var(--shadow)]"
      >
        <h2 id={titleId} className="text-2xl font-extrabold text-ink">
          {title}
        </h2>
        <p id={descId} className="text-base text-ink-muted">
          {children}
        </p>
        <Button fullWidth autoFocus onClick={onCancel}>
          Cancelar
        </Button>
        <button type="button" onClick={onConfirm} className={cn(DANGER, "min-h-14 w-full text-lg")}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
