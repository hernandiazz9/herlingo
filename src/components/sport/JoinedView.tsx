"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { FOCUS, Notice } from "@/components/coach/shared";
import { PlayIcon } from "@/components/quick/icons";
import { PageHeader } from "@/components/shell/PageHeader";
import { cn } from "@/lib/cn";
import { compileEpisode } from "@/lib/sport";
import { useSectionEpisodes } from "./episodes";
import { BackToSport, PlayerSection, StepsList } from "./EpisodeView";
import { JOIN_SECTIONS, joinedHref, type JoinSection } from "./nav";
import { useJoinedAudio } from "./use-episode-audio";

/**
 * «Escuchar seguidos» of a home section: its fully downloaded episodes, in the section's order,
 * as one audio (`joinEpisodes`; chapters across episodes, so «siguiente» / «anterior» go step by
 * step through all of them). The list is taken when it opens: an episode saved meanwhile does not
 * interrupt it. Mount with `key={section}`.
 */
export function JoinedView({ lang, section, onBack }: { lang: string; section: JoinSection; onBack: () => void }) {
  const live = useSectionEpisodes(lang, section);
  const [episodes] = useState(live);
  const title = JOIN_SECTIONS[section];
  const audio = useJoinedAudio(episodes, title);
  const groups = useMemo(
    () =>
      audio.status === "ready" ? audio.included.map((episode) => ({ episode, chapters: compileEpisode(episode).chapters })) : [],
    [audio],
  );

  return (
    <>
      <BackToSport onBack={onBack} />
      <PageHeader title={title} subtitle="Sus episodios descargados, uno tras otro, en un solo audio." />
      {audio.status === "empty" ? (
        <Notice tone="info">
          {episodes.length === 0
            ? "Esta lista todavía no tiene episodios."
            : "Ningún episodio de esta lista está descargado todavía. Abre cada uno una vez con conexión: así se descarga su audio y podrás escucharlos seguidos."}
        </Notice>
      ) : (
        <>
          {audio.status === "ready" ? <Included count={audio.included.length} left={audio.left} /> : null}
          <PlayerSection lang={lang} title={title} audio={audio} />
          {groups.length ? <StepsList groups={groups} /> : null}
        </>
      )}
    </>
  );
}

/** How many episodes the audio holds and how many were left out (not downloaded yet). */
function Included({ count, left }: { count: number; left: number }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-bold text-ink">
        {count === 1 ? "Suena 1 episodio." : `Suenan ${count} episodios, uno tras otro.`}
      </p>
      {left > 0 ? (
        <Notice tone="info">
          {left === 1
            ? "Queda fuera 1 episodio que aún no está descargado: ábrelo una vez con conexión para añadirlo."
            : `Quedan fuera ${left} episodios que aún no están descargados: ábrelos una vez con conexión para añadirlos.`}
        </Notice>
      ) : null}
    </div>
  );
}

/** «Escuchar seguidos» under a section's title: opens its episodes joined into one audio. */
export function JoinButton({ section, onJoin }: { section: JoinSection; onJoin: (section: JoinSection) => void }) {
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onJoin(section);
  };
  return (
    <a
      href={joinedHref(section)}
      onClick={open}
      className={cn(
        "pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button border-2 border-line bg-surface px-5 text-base font-bold tracking-wide text-sea [--ledge:var(--line)]",
        FOCUS,
      )}
    >
      <PlayIcon width={22} height={22} />
      Escuchar seguidos
    </a>
  );
}
