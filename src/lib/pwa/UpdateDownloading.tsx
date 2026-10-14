"use client";

import { useUpdateStatus } from "./register";

/**
 * A small "Descargando actualización…" pill (home screen) while a new version downloads; the
 * "Actualizaciones" card on /perfil shows the full progress, and `UpdatePrompt` offers the reload.
 */
export function UpdateDownloading() {
  const status = useUpdateStatus();
  if (status.state !== "downloading") return null;
  const percent = status.total ? ` ${Math.floor((status.done * 100) / status.total)} %` : "";
  return (
    <div className="mb-4 flex">
      <p
        role="status"
        className="rounded-full border-2 border-sea bg-sea-soft px-3 py-1 text-sm font-bold text-sea-deep"
      >
        Descargando actualización…<span className="tabular-nums">{percent}</span>
      </p>
    </div>
  );
}
