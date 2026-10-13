"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { prefetchGenerated, speakSequence, stop, type SequenceLine } from "@/lib/audio";
import { routeListenSteps, routeMeaningOptions, type CoachRoute, type RouteListenStep } from "@/lib/coach";
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
 * narrator, `GAP_MS` apart, from the first turn to the last (words skipped). A tap on a single
 * line (any other `speak()`) pauses it where it was; leaving the screen stops it. «Seguir» starts
 * the paused step again from its target line. Counts one listen per start from the top. Where the
 * browser has a Media Session, it shows the route title with play/pause (lock screen, headphones).
 */
export function useListenAll(route: CoachRoute): ListenAll {
  const steps = useMemo(() => routeListenSteps(route), [route]);
  /** Two lines per step: line `2i` is step i's target line, `2i + 1` its meaning. */
  const lines = useMemo<SequenceLine[]>(
    () =>
      steps.flatMap((step) => [
        { input: step.line, options: { lang: route.lang } },
        { input: step.meaning, options: routeMeaningOptions(route) },
      ]),
    [steps, route],
  );
  const [state, setState] = useState<{ status: ListenAllStatus; at: number }>({ status: "idle", at: 0 });
  /** Bumped by every start, pause and unmount: a stale sequence never touches the state. */
  const run = useRef(0);

  const play = (from: number) => {
    const token = ++run.current;
    setState({ status: "playing", at: from });
    void speakSequence(lines, {
      from,
      gapMs: GAP_MS,
      onLine: (i) => {
        if (run.current === token) setState({ status: "playing", at: i });
      },
    }).then((finished) => {
      if (run.current !== token) return;
      run.current++;
      setState((s) => (finished ? { status: "idle", at: 0 } : { status: "paused", at: s.at }));
    });
    // Lines not on the device yet (meanings of routes saved before «Escuchar todo») load ahead, in order.
    void prefetchGenerated(steps.slice(from >> 1).flatMap((step) => [step.line, step.meaning]));
  };

  const pause = () => {
    run.current++;
    stop();
    setState((s) => ({ status: "paused", at: s.at }));
  };

  /** «Seguir»: the paused step again, from its target line. */
  const resume = () => play(state.at - (state.at % 2));

  const toggle = () => {
    if (!lines.length) return;
    if (state.status === "playing") return pause();
    if (state.status === "paused") return resume();
    play(0);
    recordListen(steps[0].line.audioKey, route.lang);
  };

  // Leaving the route or the screen stops the sequence.
  useEffect(
    () => () => {
      run.current++;
      stop();
    },
    [],
  );

  const active = state.status !== "idle";
  const onMediaPlay = useEffectEvent(() => {
    if (state.status === "paused") resume();
  });
  const onMediaPause = useEffectEvent(() => {
    if (state.status === "playing") pause();
  });

  // Media Session (lock screen, headphones): the route title and play/pause while a sequence is on.
  useEffect(() => {
    const session = mediaSession();
    if (!active || !session) return;
    try {
      if (typeof MediaMetadata !== "undefined") {
        session.metadata = new MediaMetadata({
          title: route.title,
          artist: "Modo rápido",
          artwork: [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
        });
      }
    } catch {
      // No metadata: the controls still work.
    }
    setAction(session, "play", () => onMediaPlay());
    setAction(session, "pause", () => onMediaPause());
    return () => {
      setAction(session, "play", null);
      setAction(session, "pause", null);
      session.metadata = null;
      session.playbackState = "none";
    };
  }, [active, route.title]);

  useEffect(() => {
    const session = mediaSession();
    if (session && state.status !== "idle") session.playbackState = state.status;
  }, [state.status]);

  return { status: state.status, step: active ? (steps[state.at >> 1] ?? null) : null, toggle };
}

function mediaSession(): MediaSession | undefined {
  return typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : undefined;
}

/** Media Session action handlers throw for actions a browser does not support. */
function setAction(session: MediaSession, action: MediaSessionAction, handler: MediaSessionActionHandler | null) {
  try {
    session.setActionHandler(action, handler);
  } catch {
    // Not supported here.
  }
}
