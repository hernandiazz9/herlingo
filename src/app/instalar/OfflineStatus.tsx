"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { languageName } from "@/lib/content";
import { useActiveLang } from "@/lib/content/use-active-lang";
import { useAudioProgress } from "@/lib/pwa/audio-cache";
import { offlineStatus, type OfflineStatus as Status } from "@/lib/pwa/register";

/**
 * Copy for each state. Audio is kept offline for the active language only (`name` = its name
 * inside a sentence, null before one is chosen); `hasAudio` false = it has no recorded audio yet.
 */
function copy(status: Status | "checking", name: string | null, hasAudio: boolean): { title: string; text: string } {
  switch (status) {
    case "checking":
      return { title: "Comprobando…", text: "Mirando si la app ya está guardada en este móvil." };
    case "ready":
      return {
        title: "Lista para usar sin conexión",
        text: !name
          ? "Lecciones, frasario y diálogos están guardados en este móvil. El audio se guarda cuando eliges idioma."
          : hasAudio
            ? `Lecciones, frasario, diálogos y todo el audio de ${name} están guardados en este móvil.`
            : `Lecciones, frasario y diálogos están guardados en este móvil. El ${name} aún no tiene audio grabado: suena con la voz de tu móvil.`,
      };
    case "downloading":
      return {
        title: "Descargando para usar sin conexión…",
        text: `Deja la app abierta con conexión un par de minutos: se está guardando todo el audio${name ? ` de ${name}` : ""}.`,
      };
    case "unavailable":
      return {
        title: "Aún no funciona sin conexión",
        text: "Ábrela desde su dirección https (no desde la red de casa) y espera unos minutos con conexión.",
      };
  }
}

/** Whether this device already has the offline copy (with the active language's audio). Polls while it downloads. */
export function OfflineStatus() {
  const [status, setStatus] = useState<Status | "checking">("checking");
  const { lang } = useActiveLang();
  const audio = useAudioProgress(lang);

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
  }, [lang]);

  const { title, text } = copy(status, lang ? languageName(lang) : null, audio.total > 0);
  return (
    <Card tone={status === "ready" ? "sea" : "lemon"} className="flex flex-col gap-1" role="status">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="text-sm text-ink">{text}</p>
    </Card>
  );
}
