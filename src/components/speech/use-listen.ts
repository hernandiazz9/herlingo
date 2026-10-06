"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { stop as stopAudio } from "@/lib/audio";
import {
  LISTEN_TIMINGS,
  canRecognize,
  createListenSession,
  type ListenError,
  type ListenMode,
  type ListenOptions,
  type ListenResult,
  type ListenSession,
  type ListenState,
  type ListenStatus,
  type ListenTimings,
} from "@/lib/speech";

export interface UseListenOptions extends Omit<ListenOptions, "locale"> {
  /** BCP 47 locale: the pack's `speechLocale`, or "es-ES" for answers in Spanish. */
  locale: string;
  /** Final transcript (never empty) once the session ends with words. */
  onResult?: (result: ListenResult) => void;
  /** Every error except `aborted` (cancel, a newer session, page hidden): those return to idle. */
  onError?: (error: ListenError) => void;
}

export interface ListenControls {
  /** Recognition exists in this browser (false on the server and e.g. Chrome on iPhone). */
  supported: boolean;
  status: ListenStatus;
  /** A session is open (starting, listening, hearing or processing). */
  active: boolean;
  /** Live text heard so far ("" before any result). */
  interim: string;
  /** `Date.now()` when listening began, null before (countdown to `timings.maxMs`). */
  listeningAt: number | null;
  /** Set while status is "done". */
  result: ListenResult | null;
  /** Set while status is "error" (never `aborted`). */
  error: ListenError | null;
  mode: ListenMode;
  /** Effective timings for the current (or next) session. */
  timings: Readonly<ListenTimings>;
  /** Opens the mic. Call it directly in a tap handler (iOS). Cancels any other live session. */
  start: () => void;
  /** Stop and keep what was heard. */
  finish: () => void;
  /** Stop and discard; back to idle. */
  cancel: () => void;
  /** Tap on the mic: start when idle/done/error, finish when open. */
  toggle: () => void;
  /** Back to idle (clears the last result or error). Cancels an open session. */
  reset: () => void;
}

const IDLE: ListenState = { status: "idle", interim: "", listeningAt: null };
const OPEN: ReadonlySet<ListenStatus> = new Set(["starting", "listening", "hearing", "processing"]);
const noSubscribe = () => () => {};

/**
 * One mic for a screen, over the speech engine (`createListenSession`, docs/speech.md).
 * Render it with `<MicButton listen={…} />` and `<LiveTranscript listen={…} />` (or `<SpeakPanel>`).
 * Unmounting cancels the open session. Any playing audio stops when listening starts.
 */
export function useListen(options: UseListenOptions): ListenControls {
  const { locale, onResult, onError, ...sessionOptions } = options;
  const mode: ListenMode = sessionOptions.mode ?? "phrase";
  const supported = useSyncExternalStore(noSubscribe, canRecognize, () => false);
  const [state, setState] = useState<ListenState>(IDLE);
  const session = useRef<ListenSession | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);

  // Latest options and callbacks, read when a session starts or settles.
  const latest = useRef({ locale, sessionOptions, onResult, onError });
  useEffect(() => {
    latest.current = { locale, sessionOptions, onResult, onError };
  });

  const detach = useCallback(() => {
    unsubscribe.current?.();
    unsubscribe.current = null;
    session.current = null;
  }, []);

  const start = useCallback(() => {
    if (session.current && OPEN.has(session.current.state.status)) return;
    detach();
    stopAudio(); // the mic would capture it
    const { locale: loc, sessionOptions: opts } = latest.current;
    const s = createListenSession({ ...opts, locale: loc });
    session.current = s;
    unsubscribe.current = s.subscribe((next) => {
      if (session.current === s) setState(next);
    });
    void s.result.then((end) => {
      if (session.current !== s) return;
      if (end.status === "done") {
        setState(end);
        latest.current.onResult?.(end.result);
      } else if (end.error.kind === "aborted") {
        setState(IDLE);
      } else {
        setState(end);
        latest.current.onError?.(end.error);
      }
    });
    setState({ status: "starting", interim: "", listeningAt: null });
    s.start();
  }, [detach]);

  const finish = useCallback(() => session.current?.finish(), []);

  const cancel = useCallback(() => {
    const s = session.current;
    detach();
    s?.cancel();
    setState(IDLE);
  }, [detach]);

  const toggle = useCallback(() => {
    if (session.current && OPEN.has(session.current.state.status)) session.current.finish();
    else start();
  }, [start]);

  useEffect(
    () => () => {
      const s = session.current;
      unsubscribe.current?.();
      session.current = null;
      s?.cancel();
    },
    [],
  );

  const d = LISTEN_TIMINGS[mode];
  const timings: ListenTimings = {
    silenceMs: sessionOptions.silenceMs ?? d.silenceMs,
    maxMs: sessionOptions.maxMs ?? d.maxMs,
    noSpeechMs: sessionOptions.noSpeechMs ?? d.noSpeechMs,
    startTimeoutMs: sessionOptions.startTimeoutMs ?? d.startTimeoutMs,
    endGraceMs: sessionOptions.endGraceMs ?? d.endGraceMs,
  };

  return {
    supported,
    status: state.status,
    active: OPEN.has(state.status),
    interim: state.interim,
    listeningAt: state.listeningAt,
    result: state.status === "done" ? state.result : null,
    error: state.status === "error" ? state.error : null,
    mode,
    timings,
    start,
    finish,
    cancel,
    toggle,
    reset: cancel,
  };
}

/**
 * Ms left before the cap while listening (ticks ~4×/s), null when not counting.
 * Reads `listeningAt` + `timings.maxMs` from the controls.
 */
export function useListenRemaining(listen: Pick<ListenControls, "status" | "listeningAt" | "timings">): number | null {
  const counting = (listen.status === "listening" || listen.status === "hearing") && listen.listeningAt !== null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!counting) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [counting]);
  if (!counting || listen.listeningAt === null) return null;
  return Math.max(0, listen.timings.maxMs - Math.max(0, now - listen.listeningAt));
}
