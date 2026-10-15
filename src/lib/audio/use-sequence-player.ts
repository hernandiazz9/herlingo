"use client";

/**
 * «Escuchar todo» (routes, stories, grammar pages; docs/coach.md "«Escuchar todo»"): plays a list
 * of steps (each one or more lines) hands-free.
 *
 * - **One joined file** when every line has an mp3: prepared ahead on mount from what is on the
 *   device (`joinLines`, generated lines from Cache Storage only, no download), played on Modo
 *   deporte's player (`episodePlayer`: the shared, gesture-unlocked element, its chapters = the
 *   steps, Media Session with position state). It keeps playing with the screen locked.
 * - **The chain** (`speakSequence`, clip after clip, as before) when a line has no mp3 on the
 *   device (device voice, not downloaded yet, another format), with the "Audio lento" setting on
 *   (one file has one rate) or when the file is not ready `WAIT_MS` after the tap. It prefetches
 *   the generated lines ahead and prepares the file again, so the next start can play the file.
 *
 * Any other `speak()` / `stop()` (a tap on one line) pauses it (`pausable`) or ends it.
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { getSettings } from "@/lib/progress/settings";
import { episodePlayer, type EpisodePlayerState } from "@/lib/sport/player";
import type { PreparedChapter } from "@/lib/sport/prepare";
import { audioTurn, prefetchGenerated, speakSequence, stop as stopAudio, type SequenceLine } from "./index";
import { joinLines, type JoinedLines } from "./joined";

export type SequenceStatus = "idle" | "playing" | "paused";

export interface SequencePlayerOptions {
  /** Silence between two lines (inside a step too), in ms. */
  gapMs: number;
  /** Lock screen title: the route, story, verb or topic. */
  title: string;
  /** Lock screen artist: the section ("Modo rápido", "Historias", "Gramática"). */
  artist: string;
  /**
   * Another `speak()` (a tap on one line) pauses it where it was, and the chain has the lock
   * screen's play/pause too (Modo rápido); otherwise that ends it.
   */
  pausable?: boolean;
  /** Step `i` was heard to its end. */
  onStepDone?: (i: number) => void;
}

export interface SequencePlayer {
  status: SequenceStatus;
  /** The step playing, or where it is paused; null when idle. */
  step: number | null;
  /** Plays from the start of step `from` (default 0). Call it inside the tap handler. */
  play: (from?: number) => void;
  /** Pauses where it is; `play(step)` goes on from that step's start. */
  pause: () => void;
  /** Ends it if it is on (its audio stops; any other audio is left alone). */
  stop: () => void;
}

/** A pause this close to the end of the file is its end. */
const END_SLACK_SEC = 0.05;
/** Longest wait, after a tap, for the file still being prepared; then the chain plays. */
const WAIT_MS = 2000;
const ARTWORK: MediaImage[] = [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }];

interface Plan {
  lines: SequenceLine[];
  /** Per line, its step. */
  stepOf: number[];
  /** Per step, its first line. */
  firstLine: number[];
}

/** The joined file of a plan's lines, prepared ahead; `result` null = cannot be joined now. */
interface Ahead {
  lines: readonly SequenceLine[];
  promise: Promise<JoinedLines | null>;
  done: boolean;
  result: JoinedLines | null;
}

/** `idle`; `chain` (clip after clip); `waiting` for the file prepared ahead; `file` (the joined file). */
type Mode = "idle" | "chain" | "waiting" | "file";

interface View {
  status: SequenceStatus;
  step: number;
  /** The chain is on (its own lock screen session). */
  chain: boolean;
}

const IDLE_VIEW: View = { status: "idle", step: 0, chain: false };

export function useSequencePlayer(steps: readonly (readonly SequenceLine[])[], options: SequencePlayerOptions): SequencePlayer {
  const { gapMs, title, artist, pausable = false } = options;
  const plan = useMemo<Plan>(() => {
    const lines: SequenceLine[] = [];
    const stepOf: number[] = [];
    const firstLine: number[] = [];
    steps.forEach((step, i) => {
      firstLine.push(lines.length);
      for (const line of step) {
        lines.push(line);
        stepOf.push(i);
      }
    });
    return { lines, stepOf, firstLine };
  }, [steps]);

  const [view, setView] = useState<View>(IDLE_VIEW);
  const show = (status: SequenceStatus, step: number, chain: boolean) =>
    setView((v) => (v.status === status && v.step === step && v.chain === chain ? v : { status, step, chain }));

  const mode = useRef<Mode>("idle");
  /** Bumped by every start, pause, stop and unmount: a stale run never touches the state. */
  const run = useRef(0);
  const ahead = useRef<Ahead | null>(null);
  const aheadCtrl = useRef<AbortController | null>(null);
  /** The file loaded in the episode player by this hook (null = not ours / none). */
  const loaded = useRef<JoinedLines | null>(null);
  /** False once another `speak()` / `stop()` took the audio from the file. */
  const turn = useRef<() => boolean>(() => true);
  /** The step last seen playing (a step done = the next one starts, or the end). */
  const lastStep = useRef(0);
  /** The latest options, for callbacks of a run started earlier. */
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const prepareAhead = (lines: readonly SequenceLine[], signal: AbortSignal) => {
    const job: Ahead = { lines, done: false, result: null, promise: joinLines(lines, { gapMs, cachedOnly: true, signal }) };
    void job.promise.then((result) => {
      job.done = true;
      job.result = signal.aborted ? null : result;
    });
    ahead.current = job;
  };

  // The joined file, prepared ahead from what is on the device, so a tap plays it at once.
  useEffect(() => {
    const ctrl = new AbortController();
    aheadCtrl.current = ctrl;
    prepareAhead(plan.lines, ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prepareAhead only reads gapMs
  }, [plan, gapMs]);

  /** Lets the episode player go (stops the file, clears its lock screen). */
  const unloadFile = () => {
    if (!loaded.current) return;
    loaded.current = null;
    episodePlayer.unload();
  };

  const stepDone = (i: number) => latest.current.onStepDone?.(i);

  const chapters = (joined: JoinedLines): PreparedChapter[] =>
    plan.firstLine.map((first, i) => ({
      kind: "step",
      start: first,
      part: 0,
      index: i,
      number: i,
      startSec: joined.starts[Math.min(first, joined.starts.length - 1)] ?? 0,
      episodeId: "",
    }));

  /** The joined file from the start of `step`, on the episode player (synchronous inside a tap). */
  const playFile = (joined: JoinedLines, step: number) => {
    run.current++;
    mode.current = "idle"; // its own load and seek are not playback
    if (loaded.current !== joined) {
      episodePlayer.load(joined.blob, chapters(joined), { title, artist, durationSec: joined.durationSec });
      loaded.current = joined;
    }
    episodePlayer.seek(joined.starts[plan.firstLine[step]] ?? 0);
    lastStep.current = step;
    mode.current = "file";
    void episodePlayer.play();
    turn.current = audioTurn();
    show("playing", step, false);
  };

  /** Clip after clip from `step` (`speakSequence`), as before the joined file. */
  const playChain = (step: number) => {
    const token = ++run.current;
    unloadFile();
    mode.current = "chain";
    lastStep.current = step;
    show("playing", step, true);
    void speakSequence(plan.lines, {
      from: plan.firstLine[step],
      gapMs,
      onLine: (i) => {
        if (run.current !== token) return;
        const s = plan.stepOf[i];
        if (s === lastStep.current + 1) stepDone(lastStep.current);
        lastStep.current = s;
        show("playing", s, true);
      },
    }).then((finished) => {
      if (run.current !== token) return;
      run.current++;
      mode.current = "idle";
      if (finished) {
        stepDone(lastStep.current);
        show("idle", 0, false);
      } else if (latest.current.pausable) {
        show("paused", lastStep.current, true);
      } else {
        show("idle", 0, false);
      }
    });
    // Generated lines not on the device yet load ahead, in order (routes saved before «Escuchar
    // todo» had meanings); then the file is prepared again, so the next start can play it.
    const ctrl = aheadCtrl.current;
    const lines = plan.lines;
    const playables = lines.slice(plan.firstLine[step]).flatMap((l) => (typeof l.input === "string" ? [] : [l.input]));
    void prefetchGenerated(playables).then(() => {
      const job = ahead.current;
      if (ctrl && !ctrl.signal.aborted && job?.lines === lines && job.done && !job.result) prepareAhead(lines, ctrl.signal);
    });
  };

  const play = (from = 0) => {
    if (!plan.lines.length) return;
    const step = Math.min(Math.max(0, from), plan.firstLine.length - 1);
    const job = ahead.current?.lines === plan.lines ? ahead.current : null;
    if (getSettings().slowAudio || !job || (job.done && !job.result)) return playChain(step);
    if (job.result) return playFile(job.result, step);
    // Still preparing (from the device: a moment): the file once it is ready, else (or past
    // `WAIT_MS`, a slow network for content mp3s) the chain.
    const token = ++run.current;
    unloadFile();
    stopAudio();
    const current = audioTurn();
    mode.current = "waiting";
    show("playing", step, false);
    const waited = new Promise<void>((resolve) => setTimeout(resolve, WAIT_MS));
    void Promise.race([job.promise, waited]).then(() => {
      if (run.current !== token) return;
      if (!current()) {
        run.current++;
        mode.current = "idle";
        show(latest.current.pausable ? "paused" : "idle", latest.current.pausable ? step : 0, false);
        return;
      }
      if (job.result) playFile(job.result, step);
      else playChain(step);
    });
  };

  const pause = () => {
    if (mode.current === "file") {
      episodePlayer.pause();
      show("paused", view.step, false);
      return;
    }
    run.current++;
    const wasChain = mode.current === "chain";
    mode.current = "idle";
    stopAudio();
    show("paused", view.step, wasChain);
  };

  const stop = () => {
    if (mode.current === "idle" && view.status === "idle") return;
    run.current++;
    const was = mode.current;
    mode.current = "idle";
    if (was === "chain" || was === "waiting") stopAudio();
    unloadFile();
    show("idle", 0, false);
  };

  /** Ends a run of the file from inside the episode player's listener (unloads it after). */
  const finishFile = () => {
    run.current++;
    mode.current = "idle";
    show("idle", 0, false);
    const file = loaded.current;
    queueMicrotask(() => {
      if (loaded.current === file && mode.current === "idle") unloadFile();
    });
  };

  // The joined file's playback: steps from its chapters, pauses, the end, interruptions.
  const onPlayer = useEffectEvent((s: EpisodePlayerState) => {
    if (!s.loaded) loaded.current = null; // unloaded (by us, or by another player screen)
    if (mode.current !== "file") return;
    if (!s.loaded) {
      mode.current = "idle";
      show("idle", 0, false);
      return;
    }
    const ended = s.durationSec > 0 && s.timeSec >= s.durationSec - END_SLACK_SEC;
    if (s.playing || ended) {
      if (s.step === lastStep.current + 1) stepDone(lastStep.current);
      lastStep.current = s.step;
    }
    if (s.playing) {
      show("playing", s.step, false);
      return;
    }
    if (ended) {
      if (lastStep.current === plan.firstLine.length - 1) stepDone(lastStep.current);
      finishFile();
      return;
    }
    if (!turn.current() && !latest.current.pausable) {
      finishFile(); // another line took the audio: it ends here
      return;
    }
    // Paused (the button, the lock screen, headphones, another line): `play(step)` goes on.
    show("paused", s.step, false);
  });
  useEffect(() => episodePlayer.subscribe((s) => onPlayer(s)), []);

  // Leaving the screen stops it.
  useEffect(
    () => () => {
      run.current++;
      const was = mode.current;
      mode.current = "idle";
      if (was === "chain" || was === "waiting") stopAudio();
      unloadFile();
    },
    [],
  );

  // The chain's lock screen (Modo rápido, as before the joined file): title, play/pause, state.
  const chainSession = pausable && view.chain && view.status !== "idle";
  const onMediaPlay = useEffectEvent(() => {
    if (view.status === "paused") play(view.step);
  });
  const onMediaPause = useEffectEvent(() => {
    if (view.status === "playing") pause();
  });
  useEffect(() => {
    const session = mediaSession();
    if (!chainSession || !session) return;
    try {
      if (typeof MediaMetadata !== "undefined") session.metadata = new MediaMetadata({ title, artist, artwork: ARTWORK });
    } catch {
      // No metadata: the controls still work.
    }
    setAction(session, "play", () => onMediaPlay());
    setAction(session, "pause", () => onMediaPause());
    return () => {
      // The joined file took over: its lock screen is the episode player's now.
      if (mode.current === "file") return;
      setAction(session, "play", null);
      setAction(session, "pause", null);
      session.metadata = null;
      session.playbackState = "none";
    };
  }, [chainSession, title, artist]);

  useEffect(() => {
    const session = mediaSession();
    if (session && chainSession && view.status !== "idle") session.playbackState = view.status;
  }, [chainSession, view.status]);

  return { status: view.status, step: view.status === "idle" ? null : view.step, play, pause, stop };
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
