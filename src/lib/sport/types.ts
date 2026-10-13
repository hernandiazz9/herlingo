/**
 * Modo deporte episode model (docs/sport.md "Episode model"): one model for the three sources
 * (AI episodes, the pack's dialogues, saved Modo rápido routes), compiled by `compileEpisode` into
 * the ordered clips and gaps the player joins into one mp3. Plain data, no framework.
 */
import type { Playable } from "@/lib/content";

/** A target-language line (`text`, ≤ 300) and its Spain Spanish meaning (`es`, ≤ 400). */
export interface EpisodeLine {
  text: string;
  es: string;
}

/** Another way to say a step's line, announced by a narrator cue (Spanish, ≤ 120: "El azúcar:"). */
export interface EpisodeVariant extends EpisodeLine {
  cue: string;
}

export interface EpisodeStep {
  speaker: "learner" | "native";
  /** Narrator, Spanish, ≤ 200: the context / what you want to say. */
  intro: string;
  /** The main line. */
  line: EpisodeLine;
  /** 0–2. */
  variants: EpisodeVariant[];
  /** Narrator, Spanish, ≤ 200. */
  tip?: string;
}

/** `title` is spoken before the part's first step ("Primera parte: la fruta.", ≤ 80); empty = not spoken. */
export interface EpisodePart {
  title: string;
  steps: EpisodeStep[];
}

export type EpisodeSource = "ai" | "dialogue" | "route";

export interface SportEpisode {
  /** AI: a uuid · `dlg:<dialogueId>` · `route:<routeId>`. */
  id: string;
  source: EpisodeSource;
  lang: string;
  /** Spanish, ≤ 60. */
  title: string;
  /** Narrator opening, ≤ 300; empty = none. */
  intro: string;
  /** The pack's voices, like routes: `native` for native lines, `learner` for learner lines. */
  voices: { native: string; learner: string };
  parts: EpisodePart[];
}

/** An AI episode as the server returns it and the device stores it. */
export type StoredEpisode = SportEpisode & {
  source: "ai";
  /** ISO date it was generated. */
  createdAt: string;
  /** The learner's own words. */
  description: string;
  register: "formal" | "informal";
};

/**
 * One piece of the joined episode, in play order: a line's mp3 or a silence of `ms`. `step` is the
 * index in `CompiledEpisode.chapters` of the chapter the piece belongs to (0 = opening, 1…n = the
 * steps in order, n + 1 = final scene). A gap that separates two chapters belongs to the earlier
 * one, so every chapter starts on its first clip.
 */
export type EpisodeSegment =
  | { kind: "clip"; playable: Playable; step: number }
  | { kind: "gap"; ms: number; step: number };

/**
 * A chapter of the joined episode: the opening, one per step (next / previous track on the lock
 * screen), the final scene. `start` = index in `segments` of its first piece.
 */
export type EpisodeChapter =
  | { kind: "opening"; start: number }
  | {
      kind: "step";
      start: number;
      /** Index in `episode.parts`. */
      part: number;
      /** Index in that part's `steps`. */
      index: number;
      /** 0-based across the whole episode. */
      number: number;
    }
  | { kind: "final"; start: number };

export interface CompiledEpisode {
  segments: EpisodeSegment[];
  chapters: EpisodeChapter[];
}
