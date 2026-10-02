"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
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
  /** Where focus goes on close when the control that opened the dialog is gone (e.g. the deleted row). */
  fallbackFocus?: () => HTMLElement | null;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet asking to confirm a destructive action (same look as /perfil's reset). Focus starts
 * on "Cancelar", Tab stays inside, Escape cancels, and on close focus returns to the control that
 * opened it (or `fallbackFocus` when that control is gone).
 */
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel, fallbackFocus }: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  // The control that opened the dialog: read while rendering, before focus moves into the dialog.
  // Safari/iOS does not focus a tapped button, so the active element is `<body>`: that is no
  // trigger (focus then goes to `fallbackFocus`).
  const [trigger] = useState(() => {
    if (typeof document === "undefined") return null;
    const active = document.activeElement;
    return active instanceof HTMLElement && active !== document.body ? active : null;
  });
  const fallback = useRef(fallbackFocus);
  useEffect(() => {
    fallback.current = fallbackFocus;
  });

  useEffect(() => {
    const node = dialog.current;
    cancel.current?.focus();
    return () => {
      // Once React has removed the dialog (and maybe the trigger's row); not on a dev re-mount.
      requestAnimationFrame(() => {
        if (node?.isConnected) return;
        const target = trigger?.isConnected ? trigger : fallback.current?.();
        target?.focus({ preventScroll: true });
      });
    };
  }, [trigger]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !dialog.current) return;
    const items = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const inside = dialog.current.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-backdrop/80 p-4 pb-[calc(var(--safe-bottom)+1rem)]">
      <div
        ref={dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="flex w-full max-w-[calc(var(--column-width)-2rem)] flex-col gap-4 rounded-card border-2 border-line bg-surface p-5 shadow-[0_12px_40px_-12px_var(--shadow)]"
      >
        <h2 id={titleId} className="text-2xl font-extrabold text-ink">
          {title}
        </h2>
        <p id={descId} className="text-base text-ink-muted">
          {children}
        </p>
        <Button ref={cancel} fullWidth onClick={onCancel}>
          Cancelar
        </Button>
        <button type="button" onClick={onConfirm} className={cn(DANGER, "min-h-14 w-full text-lg")}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
