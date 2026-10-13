"use client";

import { useMemo } from "react";
import type { SequenceLine } from "@/lib/audio";
import { useSequencePlayer } from "@/lib/audio/use-sequence-player";
import { routeListenSteps, routeMeaningOptions, type CoachRoute, type RouteListenStep } from "@/lib/coach";
import { getTab } from "@/lib/navigation";
import { recordListen } from "@/lib/progress/activity";

/** Silence between two lines of «Escuchar todo». */
const GAP_MS = 800;

export type ListenAllStatus = "idle" | "playing" | "paused";

export interface ListenAll {
  status: ListenAllStatus;
  /** The step playing, or where «Seguir» goes on; null when idle. */
  step: RouteListenStep | null;
  /** The button: «Escuchar todo» starts, «Pausar» pauses, «Seguir» goes on. Call it inside the tap handler. */
  toggle: () => void;
}

/**
 * «Escuchar todo» for a route: every step's target line, then its meaning read by the Spanish
 * narrator, `GAP_MS` apart, from the first turn to the last (words skipped). One joined file when
 * every line is on the device (it keeps playing with the screen locked), else clip after clip
 * (`useSequencePlayer`). A tap on a single line (any other `speak()`) pauses it where it was;
 * leaving the screen stops it. «Seguir» starts the paused step again from its target line. Counts
 * one listen per start from the top. Lock screen: the route title, "Modo rápido", play/pause.
 */
export function useListenAll(route: CoachRoute): ListenAll {
  const steps = useMemo(() => routeListenSteps(route), [route]);
  /** Two lines per step: its target line, then its meaning. */
  const lines = useMemo<SequenceLine[][]>(
    () =>
      steps.map((step) => [
        { input: step.line, options: { lang: route.lang } },
        { input: step.meaning, options: routeMeaningOptions(route) },
      ]),
    [steps, route],
  );
  const player = useSequencePlayer(lines, { gapMs: GAP_MS, title: route.title, artist: getTab("quick").title, pausable: true });

  const toggle = () => {
    if (!steps.length) return;
    if (player.status === "playing") return player.pause();
    // «Seguir»: the paused step again, from its target line.
    if (player.status === "paused") return player.play(player.step ?? 0);
    player.play(0);
    recordListen(steps[0].line.audioKey, route.lang);
  };

  return { status: player.status, step: player.step === null ? null : (steps[player.step] ?? null), toggle };
}
