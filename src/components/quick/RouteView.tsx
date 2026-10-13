"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronRightIcon, TrashIcon } from "@/components/coach/icons";
import { ConfirmDialog } from "@/components/coach/ConfirmDialog";
import { DANGER, FOCUS, registerBadge } from "@/components/coach/shared";
import { SpeakerIcon } from "@/components/icons";
import { SlowIcon } from "@/components/phrasebook/icons";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button, TargetText } from "@/components/ui";
import { speak, stop } from "@/lib/audio";
import { routeLine, type CoachRoute, type CoachRouteLine, type CoachRouteTurn, type RouteListenStep } from "@/lib/coach";
import { cn } from "@/lib/cn";
import type { Playable } from "@/lib/content";
import { recordListen } from "@/lib/progress/activity";
import { PauseIcon, PlayIcon } from "./icons";
import { useListenAll, type ListenAll } from "./listen-all";

export interface RouteViewProps {
  route: CoachRoute;
  /** A message about this route (saved, not saved…), shown under the title. */
  notice?: ReactNode;
  onBack: () => void;
  /** Called once the learner confirmed the deletion. */
  onDelete: () => void;
}

/** Where a step of «Escuchar todo» is on screen: the turn's main line, or one of its alts. */
const spotOf = (step: RouteListenStep | null) => (step ? (step.alt === undefined ? step.turnId : `${step.turnId}:${step.alt}`) : null);

/**
 * Highlighted lines stop clear of the fixed tab bar (and the top edge) when scrolled into view.
 * Literal, so Tailwind generates it.
 */
const SCROLL_MARGIN = "scroll-mt-4 scroll-mb-[calc(var(--tabbar-height)+var(--safe-bottom)+1rem)]";

/**
 * A quick route: «Escuchar todo» (every line and its meaning, hands-free), then the likely
 * exchange as chat bubbles, each line with audio, «Más» for variants and words.
 */
export function RouteView({ route, notice, onBack, onDelete }: RouteViewProps) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => () => stop(), []);
  const listen = useListenAll(route);
  const spot = spotOf(listen.step);
  const spots = useRef(new Map<string, HTMLElement>());
  const register = (key: string) => (el: HTMLElement | null) => {
    if (el) spots.current.set(key, el);
    else spots.current.delete(key);
  };

  // The line «Escuchar todo» reaches scrolls into view (after its «Más» panel opened).
  useEffect(() => {
    if (!spot || listen.status !== "playing") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    spots.current.get(spot)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [spot, listen.status]);

  return (
    <>
      <button type="button" onClick={onBack} className={cn("min-h-11 self-start text-sm font-bold text-sea", FOCUS)}>
        ← Modo rápido
      </button>
      <PageHeader title={route.title} subtitle={`«${route.description}»`} />
      <p className="-mt-3 flex flex-wrap gap-2 text-sm font-bold">
        <span className="rounded-full bg-lemon-soft px-3 py-1 text-ink">{registerBadge(route)}</span>
      </p>
      {notice}

      <section aria-labelledby="route-turns-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="route-turns-title" className="text-xl font-extrabold text-ink">
            La conversación
          </h2>
          <p className="text-sm text-ink-muted">Toca el altavoz para oír cada frase; el caracol la dice más despacio.</p>
        </div>
        <ListenAllButton listen={listen} />
        <ol className="flex flex-col gap-3">
          {route.turns.map((turn) => (
            <TurnBubble
              key={turn.id}
              route={route}
              turn={turn}
              playing={listen.step?.turnId === turn.id ? (listen.step.alt ?? "main") : undefined}
              register={register}
            />
          ))}
        </ol>
      </section>

      <button type="button" onClick={() => setConfirming(true)} className={cn(DANGER, "min-h-12 gap-2 self-start")}>
        <TrashIcon width={20} height={20} />
        Borrar ruta
      </button>
      {confirming ? (
        <ConfirmDialog
          title="¿Borrar esta ruta?"
          confirmLabel="Sí, borrar"
          onCancel={() => setConfirming(false)}
          fallbackFocus={() => document.querySelector<HTMLElement>("main h1")}
          onConfirm={() => {
            setConfirming(false);
            onDelete();
          }}
        >
          Se borrarán «{route.title}» y su audio de este móvil. No se puede deshacer.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

const SPEAKER = {
  native: {
    label: "Te dicen",
    altsTitle: "También te pueden decir",
    bubble: "mr-8 rounded-tl-md",
    tone: "border-line bg-surface",
    labelClass: "text-terracotta-deep",
  },
  learner: {
    label: "Tú",
    altsTitle: "También puedes decir",
    bubble: "ml-8 rounded-tr-md",
    tone: "border-sea/30 bg-sea-soft",
    labelClass: "text-sea-deep",
  },
} as const;

/** The big «Escuchar todo» / «Pausar» / «Seguir» button above the turns. */
function ListenAllButton({ listen }: { listen: ListenAll }) {
  const playing = listen.status === "playing";
  const label = playing ? "Pausar" : listen.status === "paused" ? "Seguir" : "Escuchar todo";
  return (
    <div className="flex flex-col gap-1">
      <Button fullWidth onClick={listen.toggle}>
        {playing ? <PauseIcon width={24} height={24} /> : <PlayIcon width={24} height={24} />}
        {label}
      </Button>
      <p className="text-sm text-ink-muted">Cada frase y luego su significado, una tras otra, sin tocar nada.</p>
    </div>
  );
}

/** A highlighted line of «Escuchar todo» (lemon, like the story reader). */
const PLAYING = "border-lemon-deep bg-lemon-soft";

function TurnBubble({
  route,
  turn,
  playing,
  register,
}: {
  route: CoachRoute;
  turn: CoachRouteTurn;
  /** What «Escuchar todo» is on in this turn: its main line or the index of an alt. */
  playing?: "main" | number;
  register: (key: string) => (el: HTMLElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // «Escuchar todo» reaching an alt opens «Más», so the line playing is on screen.
  if (typeof playing === "number" && !open) setOpen(true);
  const panelId = useId();
  const style = SPEAKER[turn.speaker];
  const hasMore = turn.alts.length > 0 || turn.words.length > 0;

  return (
    <li
      ref={register(turn.id)}
      aria-current={playing === "main" ? "true" : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-card border-2 p-4 transition-colors motion-reduce:transition-none",
        SCROLL_MARGIN,
        style.bubble,
        playing === "main" ? PLAYING : style.tone,
      )}
    >
      <p className={cn("text-sm font-bold", style.labelClass)}>{style.label}</p>
      <div>
        <p lang={route.lang} className="text-xl font-bold leading-snug text-ink">
          <TargetText text={turn.text} lang={route.lang} />
        </p>
        <p className="text-base text-ink-muted">{turn.es}</p>
      </div>
      <div className="flex items-center gap-2">
        <PlayButtons line={routeLine(route, turn.text, turn.speaker)} lang={route.lang} />
        {hasMore ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className={cn("ml-auto inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-base font-bold text-sea", FOCUS)}
          >
            {open ? "Menos" : "Más"}
            <ChevronRightIcon
              width={18}
              height={18}
              className={cn("transition-transform motion-reduce:transition-none", open ? "-rotate-90" : "rotate-90")}
            />
          </button>
        ) : null}
      </div>
      {hasMore ? (
        <div id={panelId} hidden={!open} className="flex flex-col gap-3 border-t-2 border-line pt-3">
          {turn.alts.length > 0 ? (
            <LineGroup
              title={style.altsTitle}
              route={route}
              lines={turn.alts}
              speaker={turn.speaker}
              playing={typeof playing === "number" ? playing : undefined}
              spot={(i) => register(`${turn.id}:${i}`)}
            />
          ) : null}
          {turn.words.length > 0 ? <LineGroup title="Palabras" route={route} lines={turn.words} speaker="native" /> : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Variants or key words of a turn, each with its translation and audio (`speaker` = the voice).
 * Alts take part in «Escuchar todo»: `playing` = the index highlighted, `spot` registers each one.
 */
function LineGroup({
  title,
  route,
  lines,
  speaker,
  playing,
  spot,
}: {
  title: string;
  route: CoachRoute;
  lines: CoachRouteLine[];
  speaker: CoachRouteTurn["speaker"];
  playing?: number;
  spot?: (i: number) => (el: HTMLElement | null) => void;
}) {
  const titleId = useId();
  return (
    <div className="flex flex-col gap-1">
      <h3 id={titleId} className="text-sm font-bold text-ink-muted">
        {title}
      </h3>
      <ul aria-labelledby={titleId} className="flex flex-col gap-2">
        {lines.map((line, i) => (
          <li
            key={i}
            ref={spot?.(i)}
            aria-current={playing === i ? "true" : undefined}
            className={cn(
              "-mx-2 flex items-start gap-2 rounded-button border-2 px-2 py-1 transition-colors motion-reduce:transition-none",
              SCROLL_MARGIN,
              playing === i ? PLAYING : "border-transparent",
            )}
          >
            <span className="min-w-0 flex-1 pt-1">
              <span lang={route.lang} className="block text-lg font-bold leading-snug text-ink">
                <TargetText text={line.text} lang={route.lang} />
              </span>
              <span className="block text-base text-ink-muted">{line.es}</span>
            </span>
            <PlayButtons line={routeLine(route, line.text, speaker)} lang={route.lang} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 🔊 normal and 🐌 slow for one line; each tap plays it inside the gesture and counts the listen. */
function PlayButtons({ line, lang }: { line: Playable; lang: string }) {
  const play = (slow: boolean) => {
    speak(line, { lang, slow });
    recordListen(line.audioKey, lang);
  };
  return (
    <span className="flex shrink-0 gap-2 pb-1">
      <button
        type="button"
        onClick={() => play(false)}
        aria-label="Escuchar"
        title="Escuchar"
        className={cn("pressable inline-flex size-11 items-center justify-center rounded-full bg-sea text-on-accent [--ledge:var(--sea-ledge)]", FOCUS)}
      >
        <SpeakerIcon width={22} height={22} />
      </button>
      <button
        type="button"
        onClick={() => play(true)}
        aria-label="Escuchar despacio"
        title="Escuchar despacio"
        className={cn(
          "pressable inline-flex size-11 items-center justify-center rounded-full border-2 border-line bg-surface text-sea [--ledge:var(--line)]",
          FOCUS,
        )}
      >
        <SlowIcon width={22} height={22} />
      </button>
    </span>
  );
}
