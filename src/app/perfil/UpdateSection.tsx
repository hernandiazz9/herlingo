"use client";

import { useState } from "react";
import { Button, Card, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  checkForUpdate,
  getUpdateStatus,
  useUpdateStatus,
  type UpdateCheck,
  type UpdateStatus,
} from "@/lib/pwa/register";

const MESSAGES: Record<UpdateCheck, string> = {
  found: "¡Versión nueva encontrada! Descargándola…",
  latest: "Ya tienes la última versión.",
  offline: "No hay conexión. Vuelve a intentarlo cuando tengas internet.",
  unavailable: "Solo funciona en la app publicada (o instalada en la pantalla de inicio).",
};

const STATUS: Record<UpdateStatus["state"], string> = {
  idle: "",
  downloading: "¡Versión nueva encontrada! Descargándola…",
  ready: "¡Versión nueva lista! Al actualizar, la app se recarga y tu progreso se queda.",
  failed: "La descarga de la versión nueva se cortó. Vuelve a intentarlo con buena conexión.",
};

/**
 * "Buscar actualización": asks for a new version now instead of waiting for the next launch, then
 * follows it (also when the app found it on its own): download progress, then "Actualizar ahora".
 */
export function UpdateSection() {
  const status = useUpdateStatus();
  const [checking, setChecking] = useState(false);
  // A check's answer, shown while the status it was given against has not changed.
  const [result, setResult] = useState<{ check: UpdateCheck; status: UpdateStatus } | null>(null);

  const check = async () => {
    setChecking(true);
    setResult(null);
    let answer: UpdateCheck;
    try {
      answer = await checkForUpdate();
    } catch {
      answer = "offline";
    }
    setResult({ check: answer, status: getUpdateStatus() });
    setChecking(false);
  };

  const message = result && result.status === status ? MESSAGES[result.check] : STATUS[status.state];
  const searching = status.state === "idle" || status.state === "failed";

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-ink">Actualizaciones</h3>
        <p className="text-sm text-ink-muted">La app busca versiones nuevas sola al abrirla. Aquí puedes buscar ahora.</p>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn("text-sm font-bold text-ink empty:hidden", searching && "order-last")}
      >
        {message}
      </p>
      {status.state === "downloading" ? (
        <div className="flex flex-col gap-2">
          <ProgressBar value={status.done} max={status.total || 1} label="Descarga de la versión nueva" tone="sea" />
          <p className="text-sm text-ink-muted">
            {status.total ? `${Math.floor((status.done * 100) / status.total)} %` : "Preparando…"} · Puedes seguir
            usando la app mientras tanto.
          </p>
        </div>
      ) : status.state === "ready" ? (
        <Button size="md" onClick={status.apply}>
          Actualizar ahora
        </Button>
      ) : (
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep disabled:opacity-60"
        >
          {checking ? "Buscando…" : "Buscar actualización"}
        </button>
      )}
    </Card>
  );
}
