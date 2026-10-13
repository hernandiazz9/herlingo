"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { startAudioSync } from "./audio-cache";
import { registerServiceWorker, useUpdateStatus } from "./register";

/**
 * Registers the service worker, keeps the active language's audio offline (`startAudioSync`) and,
 * when a new version is ready, offers to reload into it ("Luego" hides it for that version; the
 * "Actualizaciones" card on /perfil still offers it).
 */
export function UpdatePrompt() {
  const status = useUpdateStatus();
  const [dismissed, setDismissed] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    registerServiceWorker();
    startAudioSync();
  }, []);

  if (status.state !== "ready" || status.worker === dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-height)+var(--safe-bottom)+0.75rem)] z-50 mx-auto w-full max-w-[var(--column-width)] px-4">
      <div
        role="status"
        className="flex items-center gap-3 rounded-card border-2 border-sea bg-sea-soft p-3 pl-4 shadow-[0_12px_40px_-12px_var(--shadow)]"
      >
        <p className="min-w-0 flex-1 text-base font-bold text-ink">Hay una versión nueva de la app.</p>
        <button
          type="button"
          onClick={() => setDismissed(status.worker)}
          className="min-h-12 px-2 text-sm font-bold text-ink-muted focus-visible:outline-3 focus-visible:outline-lemon-deep"
        >
          Luego
        </button>
        <Button size="md" onClick={status.apply}>
          Actualizar
        </Button>
      </div>
    </div>
  );
}
