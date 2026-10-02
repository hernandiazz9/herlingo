"use client";

import { useState, type MouseEvent } from "react";
import type { CoachPack } from "@/lib/coach";
import { useSavedPacks } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "./ConfirmDialog";
import { forgetRefine } from "./generation";
import { TrashIcon } from "./icons";
import { packHref } from "./nav";
import { FOCUS } from "./shared";

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** "Mis situaciones": the packs saved on this device, newest first; open one or delete it (confirmed). */
export function SavedPacks({ lang, onOpen }: { lang: string; onOpen: (id: string) => void }) {
  const { packs, remove } = useSavedPacks(lang);
  const [toDelete, setToDelete] = useState<CoachPack | null>(null);

  const open = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(id);
  };

  return (
    <section aria-labelledby="saved-title" className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-1">
        <h2 id="saved-title" tabIndex={-1} className="text-2xl font-extrabold tracking-tight text-ink outline-none">
          Mis situaciones
        </h2>
        <p className="text-sm text-ink-muted">Se guardan en este móvil: repasarlas no gasta nada y funcionan sin conexión.</p>
      </div>
      {packs.length === 0 ? (
        <p className="rounded-card border-2 border-dashed border-line p-6 text-center text-ink-muted">
          Aún no has preparado ninguna situación. Las que prepares aparecerán aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {packs.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <a
                href={packHref(p.id)}
                onClick={(e) => open(e, p.id)}
                className={cn(
                  "pressable flex min-w-0 flex-1 flex-col gap-0.5 rounded-card border-2 border-line bg-surface p-4 [--ledge:var(--line)]",
                  FOCUS,
                )}
              >
                <span className="text-lg font-bold leading-snug text-ink">{p.title}</span>
                <span className="truncate text-sm text-ink-muted">«{p.description}»</span>
                <span className="text-sm font-bold text-sea-deep">
                  {[`${p.keyPhrases.length} frases`, shortDate(p.createdAt)].filter(Boolean).join(" · ")}
                </span>
              </a>
              <button
                type="button"
                onClick={() => setToDelete(p)}
                aria-label={`Borrar «${p.title}»`}
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
          title="¿Borrar esta situación?"
          confirmLabel="Sí, borrar"
          onCancel={() => setToDelete(null)}
          fallbackFocus={() => document.getElementById("saved-title")}
          onConfirm={() => {
            forgetRefine(toDelete);
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
