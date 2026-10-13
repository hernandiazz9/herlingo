"use client";

import { useMemo, type MouseEvent } from "react";
import { FOCUS } from "@/components/coach/shared";
import { cn } from "@/lib/cn";
import { dialogueEpisodes, estimateMinutes } from "./episodes";
import { JoinButton } from "./JoinedView";
import { episodeHref, type JoinSection } from "./nav";

/**
 * "De la app": an episode per dialogue of the pack (title, description, estimated length);
 * «Escuchar seguidos» with two or more.
 */
export function AppEpisodes({
  lang,
  onOpen,
  onJoin,
}: {
  lang: string;
  onOpen: (id: string) => void;
  onJoin: (section: JoinSection) => void;
}) {
  const episodes = useMemo(
    () => dialogueEpisodes(lang).map((episode) => ({ episode, minutes: estimateMinutes(episode) })),
    [lang],
  );

  const open = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(id);
  };

  return (
    <section aria-labelledby="app-episodes-title" className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-1">
        <h2 id="app-episodes-title" className="text-2xl font-extrabold tracking-tight text-ink">
          De la app
        </h2>
        <p className="text-sm text-ink-muted">Los diálogos del curso, narrados paso a paso.</p>
      </div>
      {episodes.length > 1 ? <JoinButton section="app" onJoin={onJoin} /> : null}
      {episodes.length === 0 ? (
        <p className="rounded-card border-2 border-dashed border-line p-6 text-center text-ink-muted">
          Este curso todavía no tiene diálogos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {episodes.map(({ episode, minutes }) => (
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
                {episode.intro ? <span className="text-base text-ink-muted">{episode.intro}</span> : null}
                <span className="text-sm font-bold text-sea-deep">{minutes > 1 ? `Unos ${minutes} min` : "1 min"}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
