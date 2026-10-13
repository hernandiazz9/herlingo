"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessCard } from "@/components/coach/AccessCard";
import { focusPageHeading } from "@/components/coach/nav";
import { Notice, useOnline } from "@/components/coach/shared";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui";
import type { StoredEpisode } from "@/lib/coach";
import { coachAvailable } from "@/lib/coach/available";
import { useCoachAccess } from "@/lib/coach/use-coach";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useHydrated } from "@/lib/progress/use-progress";
import { AppEpisodes } from "./AppEpisodes";
import { EpisodeForm, episodesLeft, type EpisodesToday } from "./EpisodeForm";
import { EpisodeView } from "./EpisodeView";
import { useEpisode } from "./episodes";
import { useEpisodeGeneration } from "./generation";
import { JoinedView } from "./JoinedView";
import {
  closeEpisode,
  EPISODE_PARAM,
  isJoinSection,
  JOIN_PARAM,
  openEpisode,
  openJoined,
  SPORT_SUBTITLE,
  SPORT_TITLE,
  type JoinSection,
} from "./nav";
import { RouteEpisodes } from "./RouteEpisodes";
import { SavedEpisodes } from "./SavedEpisodes";

const ACCESS_INTRO =
  "El modo deporte usa las voces de Prepárate y necesita tu código de acceso. Escríbelo una vez: se guarda en este móvil.";

interface EpisodeNotice {
  id: string;
  tone: "success" | "info";
  text: string;
}

/**
 * /deporte/: the home (the offline notice, the form for an AI episode, "Mis episodios", "De tus
 * rutas", "De la app"), with `?ep=<id>` one episode's player, with `?seguidos=<section>` a
 * section's downloaded episodes joined into one audio («Escuchar seguidos»). Needs
 * `coachAvailable(lang)` and the Prepárate access code (the AI episodes, narrator and slow lines
 * come from the coach backend). Uses `useSearchParams`: render inside a Suspense boundary.
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
  const params = useSearchParams();
  const episodeId = params.get(EPISODE_PARAM);
  const joinParam = params.get(JOIN_PARAM);
  const joined = episodeId ? null : isJoinSection(joinParam) ? joinParam : null;
  const { hasCode } = useCoachAccess();
  const online = useOnline();
  /** The AI episode just received: playable even when the device could not store it (lost when you leave). */
  const [fresh, setFresh] = useState<StoredEpisode | null>(null);
  const [notice, setNotice] = useState<EpisodeNotice | null>(null);
  /** Today's episode counter after the last episode of this visit. */
  const [today, setToday] = useState<EpisodesToday | null>(null);
  /** The description being typed: survives the form being swapped for the code card (401). */
  const [draft, setDraft] = useState("");
  const job = useEpisodeGeneration(lang);
  const accessNotice = job?.status === "error" && job.error.kind === "unauthorized" ? job.error.message : null;

  // Opening or closing an episode (taps, the back button) swaps the view in place: move focus to its title.
  const view = episodeId ?? (joined && `${JOIN_PARAM}:${joined}`);
  const shown = useRef(view);
  useEffect(() => {
    if (shown.current === view) return;
    shown.current = view;
    focusPageHeading();
  }, [view]);

  if (!hydrated) return <PageHeader title={SPORT_TITLE} subtitle={SPORT_SUBTITLE} />;

  if (!hasCode) {
    return (
      <>
        <PageHeader title={SPORT_TITLE} subtitle={SPORT_SUBTITLE} />
        <AccessCard intro={ACCESS_INTRO} notice={accessNotice} />
      </>
    );
  }

  const open = (id: string) => {
    setNotice(null);
    openEpisode(id);
  };
  const back = () => {
    setNotice(null);
    closeEpisode();
  };
  const join = (section: JoinSection) => {
    setNotice(null);
    openJoined(section);
  };

  if (episodeId) {
    return (
      <OpenEpisode
        lang={lang}
        id={episodeId}
        fresh={fresh}
        notice={notice?.id === episodeId ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        onBack={back}
      />
    );
  }

  if (joined) return <JoinedView key={joined} lang={lang} section={joined} onBack={back} />;

  return (
    <>
      <PageHeader title={SPORT_TITLE} subtitle={SPORT_SUBTITLE} />
      {!online ? (
        <Notice tone="info">
          Sin conexión. Tus episodios descargados funcionan igual; para preparar uno nuevo necesitas internet.
        </Notice>
      ) : null}
      <EpisodeForm
        lang={lang}
        draft={draft}
        setDraft={setDraft}
        online={online}
        today={today}
        onCreated={(episode, saved, usage) => {
          const left = episodesLeft(usage.today);
          setFresh(episode);
          if (left) setToday(usage.today);
          open(episode.id);
          setNotice({
            id: episode.id,
            tone: saved ? "success" : "info",
            text: [
              saved
                ? "Guardado en Mis episodios: su audio se descarga en este móvil para escucharlo sin conexión."
                : "No he podido guardarlo en este móvil: si sales de aquí, se perderá.",
              left ? `${left}.` : "",
            ]
              .filter(Boolean)
              .join(" "),
          });
        }}
      />
      <SavedEpisodes lang={lang} onOpen={open} onJoin={join} />
      <RouteEpisodes lang={lang} onOpen={open} onJoin={join} />
      <AppEpisodes lang={lang} onOpen={open} onJoin={join} />
    </>
  );
}

function OpenEpisode({
  lang,
  id,
  fresh,
  notice,
  onBack,
}: {
  lang: string;
  id: string;
  fresh: StoredEpisode | null;
  notice: ReactNode;
  onBack: () => void;
}) {
  const found = useEpisode(lang, id, fresh);
  if (!found) {
    return (
      <>
        <PageHeader
          title="Episodio no encontrado"
          subtitle="No está en este móvil: puede que lo hayas borrado (o la ruta de la que salía) o que sea de otro curso."
        />
        <Button onClick={onBack} fullWidth>
          Volver a Modo deporte
        </Button>
      </>
    );
  }
  return <EpisodeView key={found.episode.id} episode={found.episode} subtitle={found.subtitle} notice={notice} onBack={onBack} />;
}
