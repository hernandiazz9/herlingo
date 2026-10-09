"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { checkForUpdate, type UpdateCheck } from "@/lib/pwa/register";

const MESSAGES: Record<UpdateCheck, string> = {
  available: "Hay una versión nueva. Toca «Actualizar» en el aviso de abajo.",
  latest: "Ya tienes la última versión.",
  offline: "No hay conexión. Vuelve a intentarlo cuando tengas internet.",
  unavailable: "Solo funciona en la app publicada (o instalada en la pantalla de inicio).",
};

/** "Buscar actualización": asks for a new version now instead of waiting for the next launch. */
export function UpdateSection() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheck | null>(null);

  const check = async () => {
    setChecking(true);
    setResult(null);
    try {
      setResult(await checkForUpdate());
    } catch {
      setResult("offline");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-ink">Actualizaciones</h3>
        <p className="text-sm text-ink-muted">La app busca versiones nuevas sola al abrirla. Aquí puedes buscar ahora.</p>
      </div>
      <button
        type="button"
        onClick={check}
        disabled={checking}
        className="pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep disabled:opacity-60"
      >
        {checking ? "Buscando…" : "Buscar actualización"}
      </button>
      <p role="status" aria-live="polite" className="text-sm font-bold text-ink empty:hidden">
        {result ? MESSAGES[result] : ""}
      </p>
    </Card>
  );
}
