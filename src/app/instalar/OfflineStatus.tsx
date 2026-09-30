"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { offlineStatus, type OfflineStatus as Status } from "@/lib/pwa/register";

const COPY: Record<Status | "checking", { title: string; text: string }> = {
  checking: { title: "Comprobando…", text: "Mirando si la app ya está guardada en este móvil." },
  ready: {
    title: "Lista para usar sin conexión",
    text: "Lecciones, frasario, diálogos y todo el audio están guardados en este móvil.",
  },
  downloading: {
    title: "Descargando para usar sin conexión…",
    text: "Deja la app abierta con conexión un par de minutos: se está guardando todo el audio.",
  },
  unavailable: {
    title: "Aún no funciona sin conexión",
    text: "Ábrela desde su dirección https (no desde la red de casa) y espera unos minutos con conexión.",
  },
};

/** Whether this device already has the offline copy. Polls while it downloads. */
export function OfflineStatus() {
  const [status, setStatus] = useState<Status | "checking">("checking");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () =>
      offlineStatus().then((s) => {
        if (!alive) return;
        setStatus(s);
        if (s !== "ready") timer = setTimeout(check, 3000);
      });
    check();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const { title, text } = COPY[status];
  return (
    <Card tone={status === "ready" ? "sea" : "lemon"} className="flex flex-col gap-1" role="status">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="text-sm text-ink">{text}</p>
    </Card>
  );
}
