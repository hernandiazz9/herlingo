"use client";

import { Fragment, useEffect, useMemo, useRef, type ReactNode } from "react";
import { FOCUS, Notice, Spinner } from "@/components/coach/shared";
import { PauseIcon, PlayIcon } from "@/components/quick/icons";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button, IconButton, ProgressBar, TargetText } from "@/components/ui";
import { cn } from "@/lib/cn";
import { compileEpisode, episodeMp3File, episodePlayer, type EpisodeChapter, type SportEpisode } from "@/lib/sport";
import { clock } from "./episodes";
import { NextStepIcon, PreviousStepIcon, SaveIcon } from "./icons";
import { useEpisodeAudio, useEpisodePlayer, useEpisodeXp, type EpisodeAudio } from "./use-episode-audio";

export interface EpisodeViewProps {
  episode: SportEpisode;
  /** Under the title: the dialogue's description, the route's request… */
  subtitle?: string;
  /** Under the title: e.g. where a new AI episode was saved. */
  notice?: ReactNode;
  onBack: () => void;
}

/**
 * Highlighted steps stop clear of the fixed tab bar (and the top edge) when scrolled into view.
 * Literal, so Tailwind generates it.
 */
const SCROLL_MARGIN = "scroll-mt-4 scroll-mb-[calc(var(--tabbar-height)+var(--safe-bottom)+1rem)]";

/** The step playing (lemon, like «Escuchar todo» and the story reader). */
const PLAYING = "border-lemon-deep bg-lemon-soft";

/**
 * One episode: it prepares its audio on open ("Preparando el audio… n/N"), then «Reproducir» plays
 * the joined file (lock screen and headphones included), «Paso anterior» / «Paso siguiente» move
 * between steps, the list shows where it is, «Guardar mp3» shares or downloads the file. Leaving
 * stops it. Mount with `key={episode.id}`.
 */
export function EpisodeView({ episode, subtitle, notice, onBack }: EpisodeViewProps) {
  const audio = useEpisodeAudio(episode);
  const groups = useMemo(() => [{ episode, chapters: compileEpisode(episode).chapters }], [episode]);

  return (
    <>
      <BackToSport onBack={onBack} />
      <PageHeader title={episode.title} subtitle={subtitle || undefined} />
      {notice}
      <PlayerSection lang={episode.lang} title={episode.title} audio={audio} />
      <StepsList groups={groups} />
    </>
  );
}

/** «← Modo deporte». */
export function BackToSport({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className={cn("min-h-11 self-start text-sm font-bold text-sea", FOCUS)}>
      ← Modo deporte
    </button>
  );
}

/**
 * The player of the file `audio` prepares (one episode or several joined): its status, progress,
 * controls, «Guardar mp3» (as `<title>.mp3`) and the XP of the episodes played to the end.
 */
export function PlayerSection({ lang, title, audio }: { lang: string; title: string; audio: EpisodeAudio }) {
  const player = useEpisodePlayer();
  const prepared = audio.status === "ready" ? audio.prepared : undefined;
  const earned = useEpisodeXp(lang, prepared);
  return (
    <section aria-label="Reproductor" className="flex flex-col gap-3">
      <AudioStatus audio={audio} />
      {player.loaded ? (
        <div className="flex flex-col gap-1">
          <ProgressBar value={player.timeSec} max={player.durationSec} label="Progreso del episodio" tone="sea" />
          <p className="flex justify-between text-sm font-bold tabular-nums text-ink-muted">
            <span>
              <span className="sr-only">Llevas </span>
              {clock(player.timeSec)}
            </span>
            <span>
              <span className="sr-only">de </span>
              {clock(player.durationSec)}
            </span>
          </p>
        </div>
      ) : null}
      <Controls loaded={player.loaded} playing={player.playing} timeSec={player.timeSec} durationSec={player.durationSec} />
      {player.loaded ? (
        <p className="text-sm text-ink-muted">
          Puedes bloquear el móvil: sigue sonando. Desde la pantalla de bloqueo o los auriculares, «siguiente» y
          «anterior» cambian de paso.
        </p>
      ) : null}
      {earned > 0 ? <Notice tone="success">¡Genial! +{earned} XP.</Notice> : null}
      {prepared && prepared.durationSec > 0 ? <SaveButton blob={prepared.blob} title={title} /> : null}
    </section>
  );
}

/** A list of steps: one episode's chapters, under its title when `titled`. */
export interface StepsGroup {
  episode: SportEpisode;
  chapters: readonly EpisodeChapter[];
}

/**
 * "Los pasos": every chapter of the file in play order (opening, steps, final scene), grouped by
 * episode (with the episode's title when there are several), the one playing highlighted and
 * scrolled into view.
 */
export function StepsList({ groups }: { groups: readonly StepsGroup[] }) {
  const player = useEpisodePlayer();
  const current = player.loaded ? player.step : -1;
  const titled = groups.length > 1;

  const items = useRef(new Map<number, HTMLElement>());
  const register = (i: number) => (el: HTMLElement | null) => {
    if (el) items.current.set(i, el);
    else items.current.delete(i);
  };

  // The step that starts playing scrolls into view.
  useEffect(() => {
    if (!player.playing || current < 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    items.current.get(current)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [current, player.playing]);

  // Index in the file's chapters of each group's first one.
  const firsts = groups.map((_, g) => groups.slice(0, g).reduce((n, group) => n + group.chapters.length, 0));

  return (
    <section aria-labelledby="episode-steps-title" className="flex flex-col gap-3 pb-2">
      <h2 id="episode-steps-title" className="text-xl font-extrabold text-ink">
        Los pasos
      </h2>
      {groups.map(({ episode, chapters }, g) => {
        const first = firsts[g];
        const list = (
          <ol className="flex flex-col gap-2">
            {chapters.map((chapter, c) => {
              const i = first + c;
              return (
                <li
                  key={c}
                  ref={register(i)}
                  aria-current={i === current ? "step" : undefined}
                  className={cn(
                    "flex flex-col gap-1 rounded-card border-2 p-4 transition-colors motion-reduce:transition-none",
                    SCROLL_MARGIN,
                    i === current ? PLAYING : "border-line bg-surface",
                  )}
                >
                  <ChapterBody episode={episode} chapter={chapter} />
                </li>
              );
            })}
          </ol>
        );
        if (!titled) return <Fragment key={g}>{list}</Fragment>;
        return (
          <div key={g} className="flex flex-col gap-2">
            <h3 className="pt-1 text-lg font-extrabold leading-snug text-ink">
              <span className="text-ink-muted">{g + 1}. </span>
              {episode.title}
            </h3>
            {list}
          </div>
        );
      })}
    </section>
  );
}

/** "Preparando el audio… n/N", then what could not be prepared. */
function AudioStatus({ audio }: { audio: EpisodeAudio }) {
  if (audio.status === "error") return <Notice>{audio.message}</Notice>;
  if (audio.status === "preparing") {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-card border-2 border-line bg-surface px-4 py-3">
        <p className="flex items-center gap-3 text-base font-bold text-ink">
          <Spinner />
          <span>
            Preparando el audio…{" "}
            <span className="tabular-nums">{audio.total ? `${audio.done}/${audio.total}` : ""}</span>
          </span>
        </p>
        <ProgressBar value={audio.done} max={audio.total || 1} label="Audio preparado" tone="sea" />
      </div>
    );
  }
  const { missing, durationSec } = audio.prepared;
  if (durationSec <= 0) {
    return <Notice tone="info">No he podido descargar el audio: necesitas conexión para prepararlo.</Notice>;
  }
  if (missing > 0) {
    return (
      <Notice tone="info">
        {missing === 1 ? "Falta 1 audio" : `Faltan ${missing} audios`}: necesitas conexión para completarlo.
      </Notice>
    );
  }
  return null;
}

/** «Paso anterior» · «Reproducir» / «Pausar» / «Seguir» · «Paso siguiente». */
function Controls({ loaded, playing, timeSec, durationSec }: { loaded: boolean; playing: boolean; timeSec: number; durationSec: number }) {
  const started = timeSec > 0 && timeSec < durationSec - 0.05;
  const label = playing ? "Pausar" : started ? "Seguir" : "Reproducir";
  // Inside the tap (iOS): `play()` starts the element synchronously.
  const toggle = () => (playing ? episodePlayer.pause() : void episodePlayer.play());
  return (
    <div className="flex items-center gap-3">
      <IconButton
        label="Paso anterior"
        icon={<PreviousStepIcon />}
        disabled={!loaded}
        onClick={() => episodePlayer.previousStep()}
      />
      <Button fullWidth className="flex-1" disabled={!loaded} onClick={toggle}>
        {playing ? <PauseIcon width={24} height={24} /> : <PlayIcon width={24} height={24} />}
        {label}
      </Button>
      <IconButton label="Paso siguiente" icon={<NextStepIcon />} disabled={!loaded} onClick={() => episodePlayer.nextStep()} />
    </div>
  );
}

/** «Guardar mp3»: the joined file through the share sheet where it takes files, else a download. */
function SaveButton({ blob, title }: { blob: Blob; title: string }) {
  const save = () => {
    const file = episodeMp3File(blob, title);
    const download = () => {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };
    let canShare = false;
    try {
      canShare = typeof navigator.share === "function" && navigator.canShare?.({ files: [file] }) === true;
    } catch {
      canShare = false;
    }
    if (!canShare) return download();
    // Called inside the tap: the share sheet needs the gesture. Closing it is not an error.
    navigator.share({ files: [file], title }).catch((e: unknown) => {
      if (!(e instanceof DOMException && e.name === "AbortError")) download();
    });
  };
  return (
    <Button variant="secondary" size="md" fullWidth onClick={save}>
      <SaveIcon width={22} height={22} />
      Guardar mp3
    </Button>
  );
}

/** What a chapter of the list says: the opening, a step (who speaks, the line, its meaning), the final scene. */
function ChapterBody({ episode, chapter }: { episode: SportEpisode; chapter: EpisodeChapter }) {
  if (chapter.kind === "opening") {
    return (
      <>
        <p className="text-sm font-bold text-ink-muted">Inicio</p>
        <p className="text-base text-ink">{episode.intro || episode.title}</p>
      </>
    );
  }
  if (chapter.kind === "final") {
    return (
      <>
        <p className="text-sm font-bold text-ink-muted">Final</p>
        <p className="text-base text-ink">La escena entera, sin traducción.</p>
      </>
    );
  }
  const part = episode.parts[chapter.part];
  const step = part?.steps[chapter.index];
  if (!step) return null;
  const partTitle = chapter.index === 0 ? part.title.trim() : "";
  const native = step.speaker === "native";
  return (
    <>
      {partTitle ? <p className="text-sm font-extrabold text-ink">{partTitle}</p> : null}
      <p className={cn("text-sm font-bold", native ? "text-terracotta-deep" : "text-sea-deep")}>
        Paso {chapter.number + 1} · {native ? "Te dicen" : "Tú"}
      </p>
      <p lang={episode.lang} className="text-lg font-bold leading-snug text-ink">
        <TargetText text={step.line.text} lang={episode.lang} />
      </p>
      <p className="text-base text-ink-muted">{step.line.es}</p>
    </>
  );
}
