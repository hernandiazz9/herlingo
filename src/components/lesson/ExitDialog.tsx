"use client";

import { Button } from "@/components/ui";

/** Exit confirmation over a lesson (default copy) or another flow (`title` / `description`). */
export function ExitDialog({
  onStay,
  onLeave,
  title = "¿Salir de la lección?",
  description = "Si sales ahora, perderás lo que llevas de esta lección.",
}: {
  onStay: () => void;
  onLeave: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-backdrop/80 p-4 pb-[calc(var(--safe-bottom)+1rem)]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="exit-title"
        aria-describedby="exit-desc"
        className="flex w-full flex-col gap-4 rounded-card border-2 border-line bg-surface p-5 shadow-[0_12px_40px_-12px_var(--shadow)]"
      >
        <h2 id="exit-title" className="text-2xl font-extrabold text-ink">
          {title}
        </h2>
        <p id="exit-desc" className="text-base text-ink-muted">
          {description}
        </p>
        <Button fullWidth autoFocus onClick={onStay}>
          Seguir aprendiendo
        </Button>
        <Button fullWidth variant="secondary" onClick={onLeave}>
          Salir
        </Button>
      </div>
    </div>
  );
}
