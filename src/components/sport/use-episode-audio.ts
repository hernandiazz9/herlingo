"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  downloadedEpisodes,
  EpisodeAudioError,
  episodeClipCount,
  episodePlayer,
  joinEpisodes,
  keepScreenAwake,
  pageHidden,
  prepareEpisode,
  trackEpisodeXp,
  type EpisodePlayerState,
  type PreparedEpisode,
  type SportEpisode,
} from "@/lib/sport";

/** «Completar audio» of a file with missing clips. */
export interface Completion {
  /** The missing clips are being downloaded now. */
  completing: boolean;
  /** Downloads the missing clips again (the tap on «Completar audio»). */
  complete: () => void;
}

export type EpisodeAudio =
  | { status: "preparing"; done: number; total: number }
  /** `completion` while clips are missing. */
  | { status: "ready"; prepared: PreparedEpisode; completion?: Completion }
  | { status: "error"; message: string };

const FORMAT_MESSAGE = "Este episodio tiene audios en otro formato y no se puede reproducir.";
const FAILED_MESSAGE = "No he podido preparar el audio de este episodio.";

/** Loads a prepared file into the episode player at `startSec` (nothing when it has no audio). */
function loadInto(prepared: PreparedEpisode, title: string, startSec = 0): void {
  if (prepared.durationSec <= 0) return;
  episodePlayer.load(prepared.blob, prepared.chapters, { title, durationSec: prepared.durationSec });
  if (startSec > 0) episodePlayer.seek(startSec);
}

interface CompleteOptions {
  /** The file prepared (and loaded, when it has audio). */
  prepared: PreparedEpisode;
  /** The same file prepared again: clips already on the device from the caches, the rest from the network. */
  redo: (signal: AbortSignal) => Promise<PreparedEpisode | null>;
  /** Loads a better file into the player at `startSec`. */
  load: (prepared: PreparedEpisode, startSec: number) => void;
  /** The file to show and its completion (none once nothing is missing). */
  show: (prepared: PreparedEpisode, completion: Completion | undefined) => void;
  /** Leaving the episode: stops everything. */
  signal: AbortSignal;
}

/**
 * Completes a file with missing clips (docs/sport.md "Offline"): by itself when the page becomes
 * visible or the browser goes back online (only while not playing), and on «Completar audio».
 * The Screen Wake Lock is held while it downloads. A file with fewer missing clips loads at the
 * start of the chapter that was current (after the end: at the start); one that arrives while
 * playing waits for the next pause. Shows `prepared` at once.
 */
function completeMissing({ prepared, redo, load, show, signal }: CompleteOptions): void {
  if (prepared.missing === 0 || signal.aborted) {
    show(prepared, undefined);
    return;
  }
  let current = prepared;
  /** A better file that arrived while playing. */
  let better: PreparedEpisode | undefined;
  let running = false;
  let stopWaiting: (() => void) | undefined;
  const missing = () => (better ?? current).missing;

  const publish = () => show(current, current.missing > 0 ? { completing: running, complete: run } : undefined);

  const swap = () => {
    if (!better || signal.aborted) return;
    const next = better;
    better = undefined;
    stopWaiting?.();
    stopWaiting = undefined;
    const { loaded, step, timeSec, durationSec } = episodePlayer.getState();
    const atEnd = timeSec >= durationSec - 0.05;
    current = next;
    load(next, loaded && !atEnd ? (next.chapters[step]?.startSec ?? 0) : 0);
    publish();
  };

  const auto = () => {
    if (pageHidden() || navigator.onLine === false || episodePlayer.getState().playing) return;
    run();
  };
  const stopAuto = () => {
    document.removeEventListener("visibilitychange", auto);
    window.removeEventListener("online", auto);
  };

  function run(): void {
    if (running || signal.aborted || missing() === 0) return;
    running = true;
    publish();
    const ctrl = new AbortController();
    const stop = () => ctrl.abort();
    signal.addEventListener("abort", stop);
    const release = keepScreenAwake();
    void redo(ctrl.signal)
      .catch(() => null)
      .then((next) => {
        release();
        signal.removeEventListener("abort", stop);
        running = false;
        if (signal.aborted) return;
        if (next && next.durationSec > 0 && next.missing < missing()) {
          better = next;
          if (!episodePlayer.getState().playing) {
            swap();
          } else {
            stopWaiting ??= episodePlayer.subscribe((state) => {
              if (!state.playing) swap();
            });
          }
        }
        if (missing() === 0) stopAuto();
        publish();
      });
  }

  document.addEventListener("visibilitychange", auto);
  window.addEventListener("online", auto);
  signal.addEventListener(
    "abort",
    () => {
      stopAuto();
      stopWaiting?.();
    },
    { once: true },
  );
  publish();
}

/**
 * Prepares `episode` on mount (downloads its clips, joins them; the screen kept on meanwhile) and
 * loads the result into the one episode player; nothing plays until a «Reproducir» tap
 * (`episodePlayer.play()`). With clips missing, `completion` («Completar audio»; also by itself
 * when the page comes back or the connection returns). Unmounting cancels the download and
 * unloads the player (leaving the episode stops it). Mount it with `key={episode.id}`: one
 * episode per mount.
 */
export function useEpisodeAudio(episode: SportEpisode): EpisodeAudio {
  const [audio, setAudio] = useState<EpisodeAudio>({ status: "preparing", done: 0, total: 0 });

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    const release = keepScreenAwake();
    prepareEpisode(episode, {
      signal,
      onProgress: ({ done, total }) => {
        if (!signal.aborted) setAudio({ status: "preparing", done, total });
      },
    }).then(
      (prepared) => {
        release();
        if (signal.aborted) return;
        loadInto(prepared, episode.title);
        completeMissing({
          prepared,
          signal,
          redo: (s) => prepareEpisode(episode, { signal: s }),
          load: (next, startSec) => loadInto(next, episode.title, startSec),
          show: (current, completion) => setAudio({ status: "ready", prepared: current, completion }),
        });
      },
      (e: unknown) => {
        release();
        if (signal.aborted) return;
        setAudio({ status: "error", message: e instanceof EpisodeAudioError ? FORMAT_MESSAGE : FAILED_MESSAGE });
      },
    );
    return () => {
      ctrl.abort();
      release();
      episodePlayer.unload();
    };
  }, [episode]);

  return audio;
}

/** The episode player's state, live. */
export function useEpisodePlayer(): EpisodePlayerState {
  return useSyncExternalStore(episodePlayer.subscribe, episodePlayer.getState, episodePlayer.getState);
}

/** «Escuchar seguidos»: the episodes joined into one file, and which of them it holds. */
export type JoinedAudio =
  | { status: "preparing"; done: number; total: number }
  | {
      status: "ready";
      prepared: PreparedEpisode;
      /** The episodes in the file, in order: the fully downloaded ones. */
      included: SportEpisode[];
      /** Episodes left out (not fully downloaded, or audio in another format). */
      left: number;
      /** While clips are missing. */
      completion?: Completion;
    }
  | { status: "empty"; left: number }
  | { status: "error"; message: string };

/**
 * Prepares `list` one after another and joins the ones with audio (`onProgress`: clips settled
 * across all of them); an episode with audio in another format is left out. Rejects with an
 * `AbortError` when `signal` aborts.
 */
async function prepareAll(
  list: readonly SportEpisode[],
  signal: AbortSignal,
  onProgress?: (done: number) => void,
): Promise<{ prepared?: PreparedEpisode; included: SportEpisode[] }> {
  const prepared: PreparedEpisode[] = [];
  const included: SportEpisode[] = [];
  let before = 0;
  for (const episode of list) {
    try {
      const one = await prepareEpisode(episode, { signal, onProgress: ({ done }) => onProgress?.(before + done) });
      if (one.durationSec > 0) {
        prepared.push(one);
        included.push(episode);
      }
    } catch (e) {
      if (signal.aborted || !(e instanceof EpisodeAudioError)) throw e;
      // Audio in another format: this episode is left out.
    }
    before += episodeClipCount(episode);
  }
  return { prepared: prepared.length ? joinEpisodes(prepared) : undefined, included };
}

/**
 * «Escuchar seguidos»: on mount, joins the fully downloaded episodes of `episodes` (in order, no
 * network: `downloadedEpisodes`) into one file and loads it into the episode player under `title`;
 * nothing plays until a «Reproducir» tap. Clips missing anyway: `completion`, like one episode.
 * Unmounting cancels and unloads the player. Pass a list that keeps its identity while mounted.
 */
export function useJoinedAudio(episodes: readonly SportEpisode[], title: string): JoinedAudio {
  const [audio, setAudio] = useState<JoinedAudio>({ status: "preparing", done: 0, total: 0 });

  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    const release = keepScreenAwake();
    const run = async () => {
      const ready = await downloadedEpisodes(episodes);
      if (signal.aborted) return;
      const total = ready.reduce((sum, episode) => sum + episodeClipCount(episode), 0);
      setAudio({ status: "preparing", done: 0, total });
      const { prepared, included } = await prepareAll(ready, signal, (done) => {
        if (!signal.aborted) setAudio({ status: "preparing", done: Math.min(total, done), total });
      });
      release();
      if (signal.aborted) return;
      const left = episodes.length - included.length;
      if (!prepared) {
        setAudio({ status: "empty", left });
        return;
      }
      loadInto(prepared, title);
      completeMissing({
        prepared,
        signal,
        redo: async (s) => {
          const again = await prepareAll(included, s);
          return again.included.length === included.length ? (again.prepared ?? null) : null;
        },
        load: (next, startSec) => loadInto(next, title, startSec),
        show: (current, completion) => setAudio({ status: "ready", prepared: current, included, left, completion }),
      });
    };
    run().catch(() => {
      release();
      if (!signal.aborted) setAudio({ status: "error", message: FAILED_MESSAGE });
    });
    return () => {
      ctrl.abort();
      release();
      episodePlayer.unload();
    };
  }, [episodes, title]);

  return audio;
}

/**
 * The XP of the episodes in `prepared` (the file loaded in the episode player) that get played to
 * the end (docs/sport.md "XP"): returns the XP earned since it was loaded.
 */
export function useEpisodeXp(lang: string, prepared: PreparedEpisode | undefined): number {
  const [earned, setEarned] = useState(0);
  useEffect(() => {
    if (!prepared) return;
    return trackEpisodeXp(lang, prepared, (xp) => setEarned((n) => n + xp));
  }, [lang, prepared]);
  return earned;
}
