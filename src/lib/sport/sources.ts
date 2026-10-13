/**
 * Free episodes, built on the device with fixed narration (docs/sport.md "From a dialogue",
 * "From a route"): from one of the pack's dialogues and from a saved Modo rápido route. Derived on
 * the fly, never stored.
 */
import { coachVoices } from "@/lib/coach/audio";
import type { CoachRoute, CoachRouteLine } from "@/lib/coach/types";
import { findDialoguePack, getDialogue, glossOf, type Dialogue, type Playable } from "@/lib/content";
import { NARRATION, sentence } from "./narration";
import type { EpisodeStep, EpisodeVariant, SportEpisode } from "./types";

/** Variants per step (docs/sport.md "Variants"). */
export const MAX_VARIANTS = 2;

/** The model's narrator text is Spain Spanish (`es`), whatever gloss language the learner reads. */
const COPY = NARRATION.es;
const DIALOGUE_PREFIX = "dlg:";
const ROUTE_PREFIX = "route:";

export const dialogueEpisodeId = (dialogueId: string) => `${DIALOGUE_PREFIX}${dialogueId}`;
export const routeEpisodeId = (routeId: string) => `${ROUTE_PREFIX}${routeId}`;

function findDialogue(dialogueId: string): Dialogue | undefined {
  const pack = findDialoguePack(dialogueId);
  return pack ? getDialogue(dialogueId, pack) : undefined;
}

/**
 * The episode of a pack dialogue (undefined for an unknown id): one part; the dialogue's title and
 * description as the opening. A native turn is a native step ("Te dicen:"); a learner turn is a
 * learner step whose intro is its prompt + "Puedes decir:", whose line is the `correct` option and
 * whose variants are the `acceptable` ones ("O también:"). `wrong` options and feedback are never
 * used. Its lines keep their content mp3s (`episodeContentPlayable`).
 */
export function episodeFromDialogue(dialogueId: string): SportEpisode | undefined {
  const pack = findDialoguePack(dialogueId);
  const dialogue = pack && getDialogue(dialogueId, pack);
  if (!pack || !dialogue) return undefined;
  const steps: EpisodeStep[] = [];
  for (const turn of dialogue.turns) {
    if (turn.speaker === "native") {
      steps.push({ speaker: "native", intro: COPY.theySay, line: { text: turn.text, es: glossOf(turn, "es") }, variants: [] });
      continue;
    }
    const correct = turn.options.find((o) => o.verdict === "correct");
    const acceptable = turn.options.filter((o) => o.verdict === "acceptable");
    const main = correct ?? acceptable.shift();
    if (!main) continue;
    steps.push({
      speaker: "learner",
      intro: `${sentence(glossOf(turn.prompt, "es"))} ${COPY.youCanSay}`.trim(),
      line: { text: main.text, es: glossOf(main, "es") },
      variants: acceptable
        .slice(0, MAX_VARIANTS)
        .map((o): EpisodeVariant => ({ cue: COPY.orAlso, text: o.text, es: glossOf(o, "es") })),
    });
  }
  return {
    id: dialogueEpisodeId(dialogue.id),
    source: "dialogue",
    lang: pack.meta.lang,
    title: glossOf(dialogue.title, "es"),
    intro: glossOf(dialogue.description, "es") ?? "",
    voices: coachVoices(pack.meta.lang),
    parts: [{ title: "", steps }],
  };
}

/**
 * The episode of a saved quick route: one part, no opening text beyond its title. A native turn
 * is a native step ("Te pueden decir:", its alts as variants with "O también te pueden decir:"); a
 * learner turn is a learner step ("Te toca a ti. Dices:", its alts as variants with "O también:");
 * at most 2 variants per step; words are skipped. Lines use the route's voices, so they share
 * their mp3s with the route.
 */
export function episodeFromRoute(route: CoachRoute): SportEpisode {
  const variants = (alts: readonly CoachRouteLine[], cue: string): EpisodeVariant[] =>
    alts.slice(0, MAX_VARIANTS).map((alt) => ({ cue, text: alt.text, es: alt.es }));
  return {
    id: routeEpisodeId(route.id),
    source: "route",
    lang: route.lang,
    title: route.title,
    intro: "",
    voices: { ...route.voices },
    parts: [
      {
        title: "",
        steps: route.turns.map(
          (turn): EpisodeStep =>
            turn.speaker === "native"
              ? {
                  speaker: "native",
                  intro: COPY.theyMaySay,
                  line: { text: turn.text, es: turn.es },
                  variants: variants(turn.alts, COPY.orTheyMaySay),
                }
              : {
                  speaker: "learner",
                  intro: COPY.yourTurn,
                  line: { text: turn.text, es: turn.es },
                  variants: variants(turn.alts, COPY.orAlso),
                },
        ),
      },
    ],
  };
}

/**
 * The content playable of a target line of the episode, if the line is pack content (a dialogue
 * episode's turns and options, with their own mp3 and voice); undefined otherwise. Built once per
 * episode: `contentLines(episode)(speaker, text)`.
 */
export function contentLines(episode: SportEpisode): (speaker: EpisodeStep["speaker"], text: string) => Playable | undefined {
  const dialogue =
    episode.source === "dialogue" && episode.id.startsWith(DIALOGUE_PREFIX)
      ? findDialogue(episode.id.slice(DIALOGUE_PREFIX.length))
      : undefined;
  if (!dialogue) return () => undefined;
  const lines = new Map<string, Playable>();
  const add = (speaker: EpisodeStep["speaker"], p: Playable) => {
    const key = `${speaker}\n${p.text}`;
    if (!lines.has(key)) lines.set(key, { text: p.text, audioKey: p.audioKey, voice: p.voice });
  };
  for (const turn of dialogue.turns) {
    if (turn.speaker === "native") add("native", turn);
    else for (const option of turn.options) add("learner", option);
  }
  return (speaker, text) => lines.get(`${speaker}\n${text}`);
}
