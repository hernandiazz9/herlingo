"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { EpisodeAudioError, episodePlayer, prepareEpisode, type EpisodePlayerState, type PreparedEpisode, type SportEpisode } from "@/lib/sport";

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
