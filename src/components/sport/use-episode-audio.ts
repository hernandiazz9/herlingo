"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  downloadedEpisodes,
  EpisodeAudioError,
  episodeClipCount,
  episodePlayer,
  joinEpisodes,
  prepareEpisode,
  trackEpisodeXp,
  type EpisodePlayerState,
  type PreparedEpisode,
  type SportEpisode,
} from "@/lib/sport";

export type EpisodeAudio =
  | { status: "preparing"; done: number; total: number }
  | { status: "ready"; prepared: PreparedEpisode }
  | { status: "error"; message: string };

const FORMAT_MESSAGE = "Este episodio tiene audios en otro formato y no se puede reproducir.";
const FAILED_MESSAGE = "No he podido preparar el audio de este episodio.";

/**
 * Prepares `episode` on mount (downloads its clips, joins them) and loads the result into the one
 * episode player; nothing plays until a «Reproducir» tap (`episodePlayer.play()`). Unmounting
 * cancels the download and unloads the player (leaving the episode stops it). Mount it with
 * `key={episode.id}`: one episode per mount.
 */
export function useEpisodeAudio(episode: SportEpisode): EpisodeAudio {
  const [audio, setAudio] = useState<EpisodeAudio>({ status: "preparing", done: 0, total: 0 });

  useEffect(() => {
    const ctrl = new AbortController();
    prepareEpisode(episode, {
      signal: ctrl.signal,
      onProgress: ({ done, total }) => {
        if (!ctrl.signal.aborted) setAudio({ status: "preparing", done, total });
      },
    }).then(
      (prepared) => {
        if (ctrl.signal.aborted) return;
        if (prepared.durationSec > 0) {
          episodePlayer.load(prepared.blob, prepared.chapters, { title: episode.title, durationSec: prepared.durationSec });
        }
        setAudio({ status: "ready", prepared });
      },
      (e: unknown) => {
        if (ctrl.signal.aborted) return;
        setAudio({ status: "error", message: e instanceof EpisodeAudioError ? FORMAT_MESSAGE : FAILED_MESSAGE });
      },
    );
    return () => {
      ctrl.abort();
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
    }
  | { status: "empty"; left: number }
  | { status: "error"; message: string };

/**
 * «Escuchar seguidos»: on mount, joins the fully downloaded episodes of `episodes` (in order, no
 * network: `downloadedEpisodes`) into one file and loads it into the episode player under `title`;
 * nothing plays until a «Reproducir» tap. Unmounting cancels and unloads the player. Pass a list
 * that keeps its identity while mounted.
 */
export function useJoinedAudio(episodes: readonly SportEpisode[], title: string): JoinedAudio {
  const [audio, setAudio] = useState<JoinedAudio>({ status: "preparing", done: 0, total: 0 });

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      const ready = await downloadedEpisodes(episodes);
      if (ctrl.signal.aborted) return;
      const counts = ready.map((episode) => episodeClipCount(episode));
      const total = counts.reduce((sum, n) => sum + n, 0);
      setAudio({ status: "preparing", done: 0, total });
      const prepared: PreparedEpisode[] = [];
      const included: SportEpisode[] = [];
      let before = 0;
      for (const [i, episode] of ready.entries()) {
        try {
          const one = await prepareEpisode(episode, {
            signal: ctrl.signal,
            onProgress: ({ done }) => {
              if (!ctrl.signal.aborted) setAudio({ status: "preparing", done: Math.min(total, before + done), total });
            },
          });
          if (one.durationSec > 0) {
            prepared.push(one);
            included.push(episode);
          }
        } catch (e) {
          if (ctrl.signal.aborted) return;
          if (!(e instanceof EpisodeAudioError)) throw e;
          // Audio in another format: this episode is left out.
        }
        before += counts[i];
      }
      if (ctrl.signal.aborted) return;
      const left = episodes.length - included.length;
      if (!prepared.length) {
        setAudio({ status: "empty", left });
        return;
      }
      const joined = joinEpisodes(prepared);
      episodePlayer.load(joined.blob, joined.chapters, { title, durationSec: joined.durationSec });
      setAudio({ status: "ready", prepared: joined, included, left });
    };
    run().catch(() => {
      if (!ctrl.signal.aborted) setAudio({ status: "error", message: FAILED_MESSAGE });
    });
    return () => {
      ctrl.abort();
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
