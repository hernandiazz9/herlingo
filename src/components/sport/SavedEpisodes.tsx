"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { ConfirmDialog } from "@/components/coach/ConfirmDialog";
import { TrashIcon } from "@/components/coach/icons";
import { FOCUS } from "@/components/coach/shared";
import type { StoredEpisode } from "@/lib/coach";
import { useSavedEpisodes } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { estimateMinutes } from "./episodes";
import { JoinButton } from "./JoinedView";
import { episodeHref, type JoinSection } from "./nav";

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/**
 * "Mis episodios": the AI episodes saved on this device, newest first; open one or delete it
 * (confirmed); «Escuchar seguidos» with two or more.
 */
export function SavedEpisodes({
  lang,
  onOpen,
  onJoin,
}: {
  lang: string;
  onOpen: (id: string) => void;
  onJoin: (section: JoinSection) => void;
}) {
  const { episodes, remove } = useSavedEpisodes(lang);
  const minutes = useMemo(() => new Map(episodes.map((e) => [e.id, estimateMinutes(e)])), [episodes]);
  const [toDelete, setToDelete] = useState<StoredEpisode | null>(null);

  const open = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(id);
  };

  return (
    <section aria-labelledby="my-episodes-title" className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-1">
        <h2 id="my-episodes-title" tabIndex={-1} className="text-2xl font-extrabold tracking-tight text-ink outline-none">
          Mis episodios
        </h2>
        <p className="text-sm text-ink-muted">Se guardan en este móvil con su audio: escucharlos no gasta nada y funcionan sin conexión.</p>
      </div>
      {episodes.length > 1 ? <JoinButton section="mis" onJoin={onJoin} /> : null}
      {episodes.length === 0 ? (
        <p className="rounded-card border-2 border-dashed border-line p-6 text-center text-ink-muted">
          Aún no has preparado ningún episodio. Los que prepares aparecerán aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {episodes.map((episode) => {
            const min = minutes.get(episode.id) ?? 1;
            return (
              <li key={episode.id} className="flex items-center gap-2">
                <a
                  href={episodeHref(episode.id)}
                  onClick={(e) => open(e, episode.id)}
                  className={cn(
                    "pressable flex min-w-0 flex-1 flex-col gap-0.5 rounded-card border-2 border-line bg-surface p-4 [--ledge:var(--line)]",
                    FOCUS,
                  )}
                >
                  <span className="text-lg font-bold leading-snug text-ink">{episode.title}</span>
                  <span className="truncate text-sm text-ink-muted">«{episode.description}»</span>
                  <span className="text-sm font-bold text-sea-deep">
                    {[min > 1 ? `Unos ${min} min` : "1 min", shortDate(episode.createdAt)].filter(Boolean).join(" · ")}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => setToDelete(episode)}
                  aria-label={`Borrar «${episode.title}»`}
                  title="Borrar"
                  className={cn(
                    "pressable inline-flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-ink-muted [--ledge:var(--line)]",
                    FOCUS,
                  )}
                >
                  <TrashIcon width={22} height={22} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {toDelete ? (
        <ConfirmDialog
          title="¿Borrar este episodio?"
          confirmLabel="Sí, borrar"
          onCancel={() => setToDelete(null)}
          fallbackFocus={() => document.getElementById("my-episodes-title")}
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
