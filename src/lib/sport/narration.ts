/**
 * Modo deporte's fixed narration (docs/sport.md "Episode model") and the gaps between clips
 * ("Gaps"): the only place they are defined. Copy is keyed by gloss language; `es` (Spain Spanish,
 * "tú") is the only one today and the fallback for any other.
 */
import type { GlossLang } from "@/lib/content";

export interface NarrationCopy {
  /** Opening, before the episode title: "Modo deporte. <title>.". */
  opening: string;
  /** Before a native line's meaning. */
  means: string;
  /** Intro of a dialogue's native turn. */
  theySay: string;
  /** Intro of a route's native turn. */
  theyMaySay: string;
  /** Added after a dialogue learner turn's prompt. */
  youCanSay: string;
  /** Intro of a route's learner turn. */
  yourTurn: string;
  /** Cue of a learner variant. */
  orAlso: string;
  /** Cue of a native variant (routes). */
  orTheyMaySay: string;
  /** Before the final scene. */
  finalScene: string;
  /** Last line. */
  end: string;
}

/** Narration copy per gloss language. */
export const NARRATION = {
  es: {
    opening: "Modo deporte.",
    means: "Significa:",
    theySay: "Te dicen:",
    theyMaySay: "Te pueden decir:",
    youCanSay: "Puedes decir:",
    yourTurn: "Te toca a ti. Dices:",
    orAlso: "O también:",
    orTheyMaySay: "O también te pueden decir:",
    finalScene: "Y ahora, la escena entera, sin traducción.",
    end: "Fin del episodio.",
  },
} as const satisfies Partial<Record<GlossLang, NarrationCopy>>;

/** The narration copy of `glossLang` (Spain Spanish when it has none). */
export function narrationCopy(glossLang: GlossLang): NarrationCopy {
  return (NARRATION as Partial<Record<GlossLang, NarrationCopy>>)[glossLang] ?? NARRATION.es;
}

/** Silences between clips, in ms. */
export const EPISODE_GAPS = {
  /** Between repetitions of the same line (normal → slow → normal, twice). */
  repeat: 400,
  /** Between blocks: narrator ↔ target line, step ↔ step. */
  block: 1000,
  /** Before a part title and before the final scene. */
  section: 1500,
} as const;

/** `text` ending in a full stop (unless it already ends in punctuation), to join narrator sentences. */
export function sentence(text: string): string {
  const t = text.trim();
  return !t || /[.!?…:;»"”)]$/.test(t) ? t : `${t}.`;
}
