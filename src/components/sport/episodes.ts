"use client";

import { useMemo } from "react";
import type { CoachRoute } from "@/lib/coach";
import { useSavedRoutes } from "@/lib/coach/use-coach";
import { getPack } from "@/lib/content";
import { compileEpisode, dialogueEpisodeId, episodeFromDialogue, episodeFromRoute, routeEpisodeId, type SportEpisode } from "@/lib/sport";

/** Id prefixes of the free episodes ("dlg:", "route:"), from the ids `@/lib/sport` builds. */
const DIALOGUE_PREFIX = dialogueEpisodeId("");
const ROUTE_PREFIX = routeEpisodeId("");

/** An episode to play and the line under its title. */
export interface EpisodeToPlay {
  episode: SportEpisode;
  subtitle: string;
}

/**
 * The episode `id` names in pack `lang`, live (a saved route deleted elsewhere turns it
 * undefined): `dlg:<dialogueId>` = one of the pack's dialogues, `route:<routeId>` = a saved Modo
 * rápido route. Undefined for an unknown id, another pack's dialogue or (until they exist on the
 * device) an AI episode.
 */
export function useEpisode(lang: string, id: string): EpisodeToPlay | undefined {
  const { get } = useSavedRoutes(lang);
  const route = id.startsWith(ROUTE_PREFIX) ? get(id.slice(ROUTE_PREFIX.length)) : undefined;
  // Every change to the saved routes parses them again (new objects): the episode keeps its
  // identity while its route's data is the same, so the player is not prepared again mid-play.
  const routeJson = route ? JSON.stringify(route) : null;
  return useMemo(() => {
    if (routeJson) {
      const saved = JSON.parse(routeJson) as CoachRoute;
      return { episode: episodeFromRoute(saved), subtitle: `«${saved.description}»` };
    }
    if (!id.startsWith(DIALOGUE_PREFIX)) return undefined;
    const episode = episodeFromDialogue(id.slice(DIALOGUE_PREFIX.length));
    return episode?.lang === lang ? { episode, subtitle: episode.intro } : undefined;
  }, [id, lang, routeJson]);
}

/** "De la app": an episode per dialogue of pack `lang`, in pack order. */
export function dialogueEpisodes(lang: string): SportEpisode[] {
  return getPack(lang).dialogues.flatMap((d) => episodeFromDialogue(d.id) ?? []);
}

/** Speech rate assumed by the estimate (characters per second, spaces included). */
const CHARS_PER_SEC = 14;
/** Slow lines are read at −30 %. */
const SLOW_SPEED = 0.7;
/** The voice's own silence around each clip. */
const CLIP_PAD_SEC = 0.3;

/**
 * Rough length of an episode before any audio is downloaded, in whole minutes (at least 1): its
 * gaps plus each clip's text at a usual speech rate. The player shows the exact one once prepared.
 */
export function estimateMinutes(episode: SportEpisode): number {
  let sec = 0;
  for (const s of compileEpisode(episode).segments) {
    if (s.kind === "gap") {
      sec += s.ms / 1000;
      continue;
    }
    const slow = "slow" in s.playable && s.playable.slow === true;
    sec += CLIP_PAD_SEC + s.playable.text.length / CHARS_PER_SEC / (slow ? SLOW_SPEED : 1);
  }
  return Math.max(1, Math.round(sec / 60));
}

/** "4:07": seconds as minutes and seconds. */
export function clock(sec: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
