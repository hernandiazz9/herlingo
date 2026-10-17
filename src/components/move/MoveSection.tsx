"use client";

import { useState, type ReactNode } from "react";
import { Button, Card } from "@/components/ui";
import { APP_NAME, APP_URL, PREVIOUS_APP_NAME } from "@/lib/app-config";
import { EXPORT_READ_ERROR, exportBackupFile, exportedMessage } from "@/lib/backup/file";
import { leagueEnabled } from "@/lib/league/config";
import { APP_HOST } from "@/lib/move";
import { useLegacyHost } from "./use-legacy-host";

/** The `id` the route's card links to (`/perfil/#mudanza`). */
export const MOVE_SECTION_ID = "mudanza";

type Status = { kind: "error" | "info"; text: string } | null;

/**
 * Perfil on an old address: how to move to `APP_URL` without losing anything (save a backup file,
 * install the new address, bring the file there). Nothing on the new address.
 */
export function MoveSection() {
  const legacy = useLegacyHost();
  const [status, setStatus] = useState<Status>(null);
  const [copied, setCopied] = useState(false);
  if (!legacy) return null;

  const save = async () => {
    setStatus(null);
    const saved = await exportBackupFile();
    if (!saved) return setStatus({ kind: "error", text: EXPORT_READ_ERROR });
    const text = exportedMessage(saved);
    if (text) setStatus({ kind: "info", text });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id={MOVE_SECTION_ID} aria-labelledby="move-title" className="flex scroll-mt-6 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="move-title" className="text-2xl font-extrabold tracking-tight text-ink">
          {APP_NAME} se muda
        </h2>
        <p className="text-sm text-ink-muted">
          {PREVIOUS_APP_NAME} ahora se llama {APP_NAME} y vive en {APP_HOST}. Esta dirección sigue funcionando: pásate
          cuando quieras, sin perder nada.
        </p>
      </div>
      <Card className="flex flex-col gap-4">
        <Step n={1} title="Guarda tus datos">
          Un archivo con tu progreso, ajustes y situaciones de Prepárate. Guárdalo en Archivos.
        </Step>
        <Button size="md" onClick={() => void save()}>
          Guardar mis datos
        </Button>
        {status ? (
          <p
            role={status.kind === "error" ? "alert" : "status"}
            className={
              status.kind === "error"
                ? "rounded-card bg-error-soft p-4 text-base font-bold text-error-deep"
                : "rounded-card bg-sea-soft p-4 text-base text-ink"
            }
          >
            {status.text}
          </p>
        ) : null}
        <div className="h-0.5 bg-line" />
        <Step n={2} title="Instala la app nueva">
          Abre{" "}
          <a href={APP_URL} target="_blank" rel="noopener" className="font-bold text-sea-deep underline">
            {APP_HOST}
          </a>{" "}
          en Safari y toca Compartir → «Añadir a pantalla de inicio».
        </Step>
        <Button size="md" variant="secondary" onClick={() => void copy()} aria-live="polite">
          {copied ? "Dirección copiada" : "Copiar la dirección"}
        </Button>
        <div className="h-0.5 bg-line" />
        <Step n={3} title="Trae tus datos">
          Abre {APP_NAME} desde el icono nuevo, toca «Traer mis datos» y elige el archivo. Si ya habías empezado allí: Perfil
          → Copia de seguridad.
        </Step>
      </Card>
      <p className="text-sm text-ink-muted">
        Cuando veas tu progreso en {APP_NAME}, puedes borrar el icono de {PREVIOUS_APP_NAME}. El código de acceso de
        Prepárate tendrás que escribirlo otra vez.
        {leagueEnabled()
          ? ` Si usas «Guardado en la nube» con tu email, también basta con entrar en la Liga de ${APP_NAME} con el mismo email.`
          : ""}
      </p>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sea text-base font-extrabold text-on-accent"
      >
        {n}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-ink">
          <span className="sr-only">Paso {n}: </span>
          {title}
        </h3>
        <p className="text-sm text-ink-muted">{children}</p>
      </div>
    </div>
  );
}
