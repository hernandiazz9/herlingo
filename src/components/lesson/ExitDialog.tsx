"use client";

import { Button } from "@/components/ui";

/** "¿Salir de la lección?" confirmation, over the lesson. */
export function ExitDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
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
          ¿Salir de la lección?
        </h2>
        <p id="exit-desc" className="text-base text-ink-muted">
          Si sales ahora, perderás lo que llevas de esta lección.
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
