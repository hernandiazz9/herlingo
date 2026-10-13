/**
 * Playables for generated lines. Pass them to `speak()` from `@/lib/audio` like content playables:
 * the mp3 comes from the device cache, else from `/api/coach/tts/` once (then cached), else the
 * device voice. Importing this module registers the coach TTS endpoint as that source.
 */
import { generatedPlayable, prefetchGenerated, setGeneratedAudioSource, type PrefetchResult } from "@/lib/audio";
import { getPack, type Playable } from "@/lib/content";
import { CoachApiError, fetchSpeech } from "./api";
import type { CoachPack, CoachRoute, InterviewQuestion } from "./types";

/**
 * The coach TTS endpoint as the generated-audio source. Over the day's voice allowance (429
 * `tts_limit`) the line is declined for the session: the device voice plays it silently, without
 * asking the server again for that line.
 */
setGeneratedAudioSource(async (text, voice, signal) => {
  try {
    return await fetchSpeech(text, voice, signal);
  } catch (e) {
    if (e instanceof CoachApiError && e.code === "tts_limit") return null;
    throw e;
  }
});

/** Voices a pack of `lang` gets (same rule as the server): native = first, learner = second. */
export function coachVoices(lang: string): { native: string; learner: string } {
  const { voices } = getPack(lang).meta;
  return { native: voices[0], learner: voices[1] ?? voices[0] };
}

/** A line of a pack: native turns and key phrases use the native voice, learner options the learner one. */
export function packLine(pack: CoachPack, text: string, speaker: "native" | "learner" = "native"): Playable {
  return generatedPlayable(text, pack.voices[speaker]);
}

/** Every playable line of a pack: key phrases, native turns, learner options. */
export function packPlayables(pack: CoachPack): Playable[] {
  const lines = pack.keyPhrases.map((k) => packLine(pack, k.text));
  for (const turn of pack.dialogue.turns) {
    if (turn.speaker === "native") lines.push(packLine(pack, turn.text));
    else lines.push(...turn.options.map((o) => packLine(pack, o.text, "learner")));
  }
  return lines;
}

/**
 * A line of a quick route: `voices.native` for native turns, their alts and every turn's words;
 * `voices.learner` for learner turns and their alts.
 */
export function routeLine(route: CoachRoute, text: string, speaker: "native" | "learner" = "native"): Playable {
  return generatedPlayable(text, route.voices[speaker]);
}

/** Every playable line of a route: each turn's main line, its alts and its words. */
export function routePlayables(route: CoachRoute): Playable[] {
  return route.turns.flatMap((turn) => [
    routeLine(route, turn.text, turn.speaker),
    ...turn.alts.map((alt) => routeLine(route, alt.text, turn.speaker)),
    ...turn.words.map((word) => routeLine(route, word.text, "native")),
  ]);
}

/** The interview question's target-language line (native voice), if it has one. */
export function questionPlayable(lang: string, question: InterviewQuestion): Playable | undefined {
  return question.text ? generatedPlayable(question.text, coachVoices(lang).native) : undefined;
}

/** Downloads every line of a pack that is not on the device yet, so it plays offline. Never rejects. */
export function cachePackAudio(pack: CoachPack, signal?: AbortSignal): Promise<PrefetchResult> {
  return prefetchGenerated(packPlayables(pack), signal);
}

/** Downloads every line of a route that is not on the device yet, so it plays offline. Never rejects. */
export function cacheRouteAudio(route: CoachRoute, signal?: AbortSignal): Promise<PrefetchResult> {
  return prefetchGenerated(routePlayables(route), signal);
}
