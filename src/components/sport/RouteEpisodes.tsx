"use client";

import { useMemo, type MouseEvent } from "react";
import { FOCUS } from "@/components/coach/shared";
import { useSavedRoutes } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { episodeFromRoute } from "@/lib/sport";
import { estimateMinutes } from "./episodes";
import { JoinButton } from "./JoinedView";
import { episodeHref, type JoinSection } from "./nav";

/**
 * "De tus rutas": an episode per saved Modo rápido route (free, built on the device), newest
 * first, with its title, request and estimated length; «Escuchar seguidos» with two or more.
 */
export function RouteEpisodes({
  lang,
  onOpen,
  onJoin,
}: {
  lang: string;
  onOpen: (id: string) => void;
  onJoin: (section: JoinSection) => void;
}) {
  const { routes } = useSavedRoutes(lang);
  const items = useMemo(
    () =>
      routes.map((route) => {
        const episode = episodeFromRoute(route);
        return { episode, description: route.description, minutes: estimateMinutes(episode) };
      }),
    [routes],
  );

  const open = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(id);
  };

  return (
    <section aria-labelledby="route-episodes-title" className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-1">
        <h2 id="route-episodes-title" className="text-2xl font-extrabold tracking-tight text-ink">
          De tus rutas
        </h2>
        <p className="text-sm text-ink-muted">Tus rutas de Modo rápido, narradas paso a paso.</p>
      </div>
      {items.length > 1 ? <JoinButton section="rutas" onJoin={onJoin} /> : null}
      {items.length === 0 ? (
        <p className="rounded-card border-2 border-dashed border-line p-6 text-center text-ink-muted">
          Aún no tienes rutas guardadas. Las que prepares en Modo rápido aparecerán aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map(({ episode, description, minutes }) => (
            <li key={episode.id}>
              <a
                href={episodeHref(episode.id)}
                onClick={(e) => open(e, episode.id)}
                className={cn(
                  "pressable flex flex-col gap-0.5 rounded-card border-2 border-line bg-surface p-4 [--ledge:var(--line)]",
                  FOCUS,
                )}
              >
                <span className="text-lg font-bold leading-snug text-ink">{episode.title}</span>
                <span className="truncate text-sm text-ink-muted">«{description}»</span>
                <span className="text-sm font-bold text-sea-deep">{minutes > 1 ? `Unos ${minutes} min` : "1 min"}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
