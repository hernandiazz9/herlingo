"use client";

import { useState, type MouseEvent } from "react";
import { ConfirmDialog } from "@/components/coach/ConfirmDialog";
import { TrashIcon } from "@/components/coach/icons";
import { FOCUS } from "@/components/coach/shared";
import type { CoachRoute } from "@/lib/coach";
import { useSavedRoutes } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { routeHref } from "./nav";

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** "Mis rutas": the routes saved on this device, newest first; open one or delete it (confirmed). */
export function SavedRoutes({ lang, onOpen }: { lang: string; onOpen: (id: string) => void }) {
  const { routes, remove } = useSavedRoutes(lang);
  const [toDelete, setToDelete] = useState<CoachRoute | null>(null);

  const open = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(id);
  };

  return (
    <section aria-labelledby="routes-title" className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-1">
        <h2 id="routes-title" tabIndex={-1} className="text-2xl font-extrabold tracking-tight text-ink outline-none">
          Mis rutas
        </h2>
        <p className="text-sm text-ink-muted">Se guardan en este móvil: verlas y escucharlas no gasta nada y funcionan sin conexión.</p>
      </div>
      {routes.length === 0 ? (
        <p className="rounded-card border-2 border-dashed border-line p-6 text-center text-ink-muted">
          Aún no has preparado ninguna ruta. Las que prepares aparecerán aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {routes.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <a
                href={routeHref(r.id)}
                onClick={(e) => open(e, r.id)}
                className={cn(
                  "pressable flex min-w-0 flex-1 flex-col gap-0.5 rounded-card border-2 border-line bg-surface p-4 [--ledge:var(--line)]",
                  FOCUS,
                )}
              >
                <span className="text-lg font-bold leading-snug text-ink">{r.title}</span>
                <span className="truncate text-sm text-ink-muted">«{r.description}»</span>
                <span className="text-sm font-bold text-sea-deep">
                  {[`${r.turns.length} frases`, shortDate(r.createdAt)].filter(Boolean).join(" · ")}
                </span>
              </a>
              <button
                type="button"
                onClick={() => setToDelete(r)}
                aria-label={`Borrar «${r.title}»`}
                title="Borrar"
                className={cn(
                  "pressable inline-flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-ink-muted [--ledge:var(--line)]",
                  FOCUS,
                )}
              >
                <TrashIcon width={22} height={22} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {toDelete ? (
        <ConfirmDialog
          title="¿Borrar esta ruta?"
          confirmLabel="Sí, borrar"
          onCancel={() => setToDelete(null)}
          fallbackFocus={() => document.getElementById("routes-title")}
          onConfirm={() => {
            remove(toDelete.id);
            setToDelete(null);
          }}
        >
          Se borrarán «{toDelete.title}» y su audio de este móvil. No se puede deshacer.
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
