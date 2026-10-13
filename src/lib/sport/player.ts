/**
 * The Modo deporte player (docs/sport.md "Player", "Lock screen"): one prepared episode (or several
 * joined) on the shared, gesture-unlocked audio element, its chapters as steps, and the Media
 * Session controls (lock screen, headphones). Client-only; one player for the app.
 *
 *   const prepared = await prepareEpisode(episode, { onProgress });
 *   episodePlayer.load(prepared.blob, prepared.chapters, { title, durationSec: prepared.durationSec });
 *   <button onClick={() => void episodePlayer.play()}>Reproducir</button>   // inside the tap
 *
 * `speak()` or `stop()` from `@/lib/audio` anywhere stop it (the position is kept: `play()` goes
 * on from there). Leaving the screen: `unload()`.
 */
import { mp3Media, stop, type Mp3Media, type Mp3MediaEvents } from "@/lib/audio";
import type { PreparedChapter } from "./prepare";

export interface EpisodePlayerState {
  /** An episode is loaded (`load`, until `unload`). */
  loaded: boolean;
  playing: boolean;
  timeSec: number;
  durationSec: number;
  /** Index in the loaded chapters of the one at `timeSec` (opening, steps, final scene). */
  step: number;
}

export interface EpisodePlayerMeta {
  /** Lock screen title: the episode's. */
  title: string;
  /** Exact duration (`PreparedEpisode.durationSec`). */
  durationSec: number;
}

/** «Paso anterior» within this many seconds of a step's start goes to the previous step. */
export const RESTART_WINDOW_SEC = 3;

const ARTIST = "Modo deporte";
const ARTWORK: MediaImage[] = [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }];
const ACTIONS: MediaSessionAction[] = [
  "play",
  "pause",
  "nexttrack",
  "previoustrack",
  "seekto",
];

const IDLE: EpisodePlayerState = { loaded: false, playing: false, timeSec: 0, durationSec: 0, step: 0 };

let state = IDLE;
const listeners = new Set<(state: EpisodePlayerState) => void>();
let url: string | undefined;
let chapters: readonly PreparedChapter[] = [];
let meta: EpisodePlayerMeta | undefined;
let media: Mp3Media | null = null;
/** Media Session handlers and metadata are ours (set on play, cleared on stop/unload). */
let sessionOn = false;

const clamp = (sec: number) => Math.min(Math.max(0, Number.isFinite(sec) ? sec : 0), state.durationSec);

/** Index of the chapter playing at `sec`: the last one that starts at or before it. */
function stepAt(sec: number): number {
  let step = 0;
  for (let i = 0; i < chapters.length; i++) if (chapters[i].startSec <= sec + 0.001) step = i;
  return step;
}

function set(patch: Partial<EpisodePlayerState>): void {
  const next = { ...state, ...patch };
  next.step = next.loaded ? stepAt(next.timeSec) : 0;
  if (
    next.loaded === state.loaded &&
    next.playing === state.playing &&
    next.timeSec === state.timeSec &&
    next.durationSec === state.durationSec &&
    next.step === state.step
  ) {
    return;
  }
  state = next;
  for (const listener of listeners) listener(state);
}

/** Where playback is now (the element's position while attached). */
function now(): number {
  return media?.active() ? clamp(media.time()) : state.timeSec;
}

function mediaSession(): MediaSession | undefined {
  return typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : undefined;
}

/** Media Session action handlers throw for actions a browser does not support. */
function setAction(session: MediaSession, action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
  try {
    session.setActionHandler(action, handler);
  } catch {
    // Not supported here.
  }
}

function updateSession(): void {
  const session = mediaSession();
  if (!session || !sessionOn) return;
  session.playbackState = state.playing ? "playing" : "paused";
  try {
    if (state.durationSec > 0) {
      session.setPositionState({ duration: state.durationSec, playbackRate: 1, position: clamp(state.timeSec) });
    }
  } catch {
    // No position state here: the controls still work.
  }
}

/**
 * Lock screen and headphones: title, play/pause, next/previous step, seek. No seek ±15 s: with
 * those handlers iOS shows ±15 s buttons instead of previous/next track (the steps).
 */
function showSession(): void {
  const session = mediaSession();
  if (!session || !meta) return;
  if (!sessionOn) {
    sessionOn = true;
    try {
      if (typeof MediaMetadata !== "undefined") {
        session.metadata = new MediaMetadata({ title: meta.title, artist: ARTIST, artwork: ARTWORK });
      }
    } catch {
      // No metadata: the controls still work.
    }
    setAction(session, "play", () => void play());
    setAction(session, "pause", () => pause());
    setAction(session, "nexttrack", () => nextStep());
    setAction(session, "previoustrack", () => previousStep());
    setAction(session, "seekto", (d) => {
      if (d.seekTime !== undefined) seek(d.seekTime);
    });
  }
  updateSession();
}

function clearSession(): void {
  const session = mediaSession();
  if (!session || !sessionOn) return;
  sessionOn = false;
  for (const action of ACTIONS) setAction(session, action, null);
  session.metadata = null;
  session.playbackState = "none";
  try {
    session.setPositionState();
  } catch {
    // Nothing to clear.
  }
}

/** The element's position and play state into `state` (and the lock screen when they changed). */
function sync(type: string): void {
  if (!media?.active()) return;
  const playing = !media.paused();
  const wasPlaying = state.playing;
  set({ playing, timeSec: clamp(media.time()) });
  if (playing !== wasPlaying || type === "seeked" || type === "loadedmetadata" || type === "durationchange") {
    updateSession();
  }
}

const events: Mp3MediaEvents = {
  onChange: sync,
  onEnded: () => {
    set({ playing: false, timeSec: state.durationSec });
    updateSession();
  },
  onError: () => {
    const failed = media;
    media = null;
    failed?.release();
    set({ playing: false });
    updateSession();
  },
  // `speak()` / `stop()` elsewhere: stopped, the position kept for the next `play()`.
  onReleased: () => {
    media = null;
    set({ playing: false });
    clearSession();
  },
};

/** Loads a prepared file (nothing plays until `play()`); unloads the previous one. */
function load(blob: Blob, list: readonly PreparedChapter[], m: EpisodePlayerMeta): void {
  unload();
  url = URL.createObjectURL(blob);
  chapters = list;
  meta = m;
  set({ loaded: true, playing: false, timeSec: 0, durationSec: Math.max(0, m.durationSec) });
}

/**
 * Plays from the current position (from the start after the end). Call it inside the tap handler
 * (iOS): it stops any other audio and starts the element synchronously. Resolves false when
 * nothing is loaded or the browser refused to play.
 */
function play(): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  if (state.durationSec > 0 && now() >= state.durationSec - 0.05) seek(0);
  if (!media?.active()) {
    stop(); // a line, «Escuchar todo», the device voice
    media = mp3Media(url, events, state.timeSec);
  }
  const playing = media;
  showSession();
  return playing.play().then((ok) => {
    if (!ok) sync("pause");
    return ok;
  });
}

function pause(): void {
  media?.pause();
}

/** Jumps to `sec` (clamped to the episode), playing or paused. */
function seek(sec: number): void {
  if (!state.loaded) return;
  const to = clamp(sec);
  if (media?.active()) media.seek(to);
  set({ timeSec: to });
  updateSession();
}

/** The start of the next step (chapter); nothing after the last one. */
function nextStep(): void {
  const step = stepAt(now());
  if (step + 1 < chapters.length) seek(chapters[step + 1].startSec);
}

/** The start of this step; within `RESTART_WINDOW_SEC` of it, the start of the previous one. */
function previousStep(): void {
  const at = now();
  const step = stepAt(at);
  const start = chapters[step]?.startSec ?? 0;
  seek(at - start < RESTART_WINDOW_SEC && step > 0 ? chapters[step - 1].startSec : start);
}

/** Calls `listener` with every new state; returns the unsubscribe function. */
function subscribe(listener: (state: EpisodePlayerState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getState(): EpisodePlayerState {
  return state;
}

/** Stops, clears the lock screen and frees the file. */
function unload(): void {
  const attached = media;
  media = null;
  attached?.release();
  clearSession();
  if (url) URL.revokeObjectURL(url);
  url = undefined;
  chapters = [];
  meta = undefined;
  set(IDLE);
}

/** The one Modo deporte player (state for `useSyncExternalStore`: `subscribe` + `getState`). */
export const episodePlayer = {
  load,
  play,
  pause,
  seek,
  nextStep,
  previousStep,
  subscribe,
  getState,
  unload,
} as const;
