"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { AccessCard } from "@/components/coach/AccessCard";
import { focusPageHeading } from "@/components/coach/nav";
import { Notice, useOnline } from "@/components/coach/shared";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui";
import { coachAvailable } from "@/lib/coach/available";
import { useCoachAccess } from "@/lib/coach/use-coach";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useHydrated } from "@/lib/progress/use-progress";
import { AppEpisodes } from "./AppEpisodes";
import { EpisodeView } from "./EpisodeView";
import { useEpisode } from "./episodes";
import { closeEpisode, EPISODE_PARAM, openEpisode, SPORT_SUBTITLE, SPORT_TITLE } from "./nav";

const ACCESS_INTRO =
  "El modo deporte usa las voces de Prepárate y necesita tu código de acceso. Escríbelo una vez: se guarda en este móvil.";

/**
 * /deporte/: the home (the offline notice, then "De la app") or, with `?ep=<id>`, one episode's
 * player. Needs `coachAvailable(lang)` and the Prepárate access code (narrator and slow lines come
 * from the voice service). Uses `useSearchParams`: render inside a Suspense boundary.
 */
export function SportView() {
  const lang = useScreenLang();
  if (lang && !coachAvailable(lang)) {
    return (
      <>
        <PageHeader title={SPORT_TITLE} subtitle={SPORT_SUBTITLE} />
        <Notice tone="info">El modo deporte todavía no está disponible para este curso.</Notice>
      </>
    );
  }
  return lang ? <Sport key={lang} lang={lang} /> : <PageHeader title={SPORT_TITLE} subtitle={SPORT_SUBTITLE} />;
}

function Sport({ lang }: { lang: string }) {
  const hydrated = useHydrated();
  const episodeId = useSearchParams().get(EPISODE_PARAM);
  const { hasCode } = useCoachAccess();
  const online = useOnline();

  // Opening or closing an episode (taps, the back button) swaps the view in place: move focus to its title.
  const shown = useRef(episodeId);
  useEffect(() => {
    if (shown.current === episodeId) return;
    shown.current = episodeId;
    focusPageHeading();
  }, [episodeId]);

  if (!hydrated) return <PageHeader title={SPORT_TITLE} subtitle={SPORT_SUBTITLE} />;

  if (!hasCode) {
    return (
      <>
        <PageHeader title={SPORT_TITLE} subtitle={SPORT_SUBTITLE} />
        <AccessCard intro={ACCESS_INTRO} />
      </>
    );
  }

  if (episodeId) return <OpenEpisode lang={lang} id={episodeId} />;

  return (
    <>
      <PageHeader title={SPORT_TITLE} subtitle={SPORT_SUBTITLE} />
      {!online ? (
        <Notice tone="info">
          Sin conexión. Tus episodios descargados funcionan igual; para preparar uno nuevo necesitas internet.
        </Notice>
      ) : null}
      <AppEpisodes lang={lang} onOpen={openEpisode} />
    </>
  );
}

function OpenEpisode({ lang, id }: { lang: string; id: string }) {
  const found = useEpisode(lang, id);
  if (!found) {
    return (
      <>
        <PageHeader title="Episodio no encontrado" subtitle="No está en este móvil: puede que hayas borrado la ruta de la que salía o que sea de otro curso." />
        <Button onClick={closeEpisode} fullWidth>
          Volver a Modo deporte
        </Button>
      </>
    );
  }
  return <EpisodeView key={found.episode.id} episode={found.episode} subtitle={found.subtitle} onBack={closeEpisode} />;
}
