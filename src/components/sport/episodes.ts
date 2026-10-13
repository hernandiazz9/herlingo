"use client";

import { useMemo } from "react";
import type { CoachRoute, StoredEpisode } from "@/lib/coach";
import { useSavedEpisodes, useSavedRoutes } from "@/lib/coach/use-coach";
import { getPack } from "@/lib/content";
import { compileEpisode, dialogueEpisodeId, episodeFromDialogue, episodeFromRoute, routeEpisodeId, type SportEpisode } from "@/lib/sport";
import type { JoinSection } from "./nav";

/** Id prefixes of the free episodes ("dlg:", "route:"), from the ids `@/lib/sport` builds. */
const DIALOGUE_PREFIX = dialogueEpisodeId("");
const ROUTE_PREFIX = routeEpisodeId("");

/** An episode to play and the line under its title. */
export interface EpisodeToPlay {
  episode: SportEpisode;
  subtitle: string;
}

/**
 * The episode `id` names in pack `lang`, live (a saved route or episode deleted elsewhere turns it
 * undefined): `dlg:<dialogueId>` = one of the pack's dialogues, `route:<routeId>` = a saved Modo
 * rápido route, any other id = an AI episode in "Mis episodios" (or `fresh`, the one just
 * received when the device could not store it). Undefined for an unknown id or another pack's
 * dialogue.
 */
export function useEpisode(lang: string, id: string, fresh?: StoredEpisode | null): EpisodeToPlay | undefined {
  const routes = useSavedRoutes(lang);
  const episodes = useSavedEpisodes(lang);
  const route = id.startsWith(ROUTE_PREFIX) ? routes.get(id.slice(ROUTE_PREFIX.length)) : undefined;
  const isFree = id.startsWith(ROUTE_PREFIX) || id.startsWith(DIALOGUE_PREFIX);
  const ai = isFree ? undefined : (episodes.get(id) ?? (fresh?.id === id && fresh.lang === lang ? fresh : undefined));
  // Every change to the saved routes or episodes parses them again (new objects): the episode
  // keeps its identity while its data is the same, so the player is not prepared again mid-play.
  const routeJson = route ? JSON.stringify(route) : null;
  const aiJson = ai ? JSON.stringify(ai) : null;
  return useMemo(() => {
    if (aiJson) {
      const saved = JSON.parse(aiJson) as StoredEpisode;
      return { episode: saved, subtitle: `«${saved.description}»` };
    }
    if (routeJson) {
      const saved = JSON.parse(routeJson) as CoachRoute;
      return { episode: episodeFromRoute(saved), subtitle: `«${saved.description}»` };
    }
    if (!id.startsWith(DIALOGUE_PREFIX)) return undefined;
    const episode = episodeFromDialogue(id.slice(DIALOGUE_PREFIX.length));
    return episode?.lang === lang ? { episode, subtitle: episode.intro } : undefined;
  }, [id, lang, routeJson, aiJson]);
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

/**
 * The episodes of a home section, live, in its order: "Mis episodios" (AI, newest first), "De tus
 * rutas" (saved routes, newest first) or "De la app" (the pack's dialogues, pack order).
 */
export function useSectionEpisodes(lang: string, section: JoinSection): SportEpisode[] {
  const { episodes } = useSavedEpisodes(lang);
  const { routes } = useSavedRoutes(lang);
  return useMemo(() => {
    if (section === "mis") return episodes;
    if (section === "rutas") return routes.map(episodeFromRoute);
    return dialogueEpisodes(lang);
  }, [section, episodes, routes, lang]);
}
