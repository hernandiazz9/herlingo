/**
 * The episode compiler (docs/sport.md "Decisions": Order, Variants, Final scene, Gaps): turns any
 * episode into the ordered clips and silences the player joins into one mp3, plus its chapters.
 *
 *   opening   "Modo deporte. <title>." · intro
 *   per step  [part title] · intro · learner line normal → slow → normal / native line twice ·
 *             meaning ("Significa:" before a native one) · tip · each variant: cue, twice, meaning
 *   final     "Y ahora, la escena entera, sin traducción." · every main line once · "Fin del episodio."
 *
 * Narrator lines are generated with the gloss language's narrator voice; target lines are
 * generated in the episode's voice for the speaker, or in the content line's own voice when they
 * are pack content (a dialogue's turns and options: their content mp3 only with
 * `DIALOGUE_LINES_FROM_CONTENT`); slow lines are always generated (read slower by the voice).
 * Never `speechSynthesis`.
 */
import { generatedPlayable, isGenerated } from "@/lib/audio/generated";
import { COACH_NARRATORS } from "@/lib/coach/audio";
import { DEFAULT_GLOSS_LANG, type GlossLang, type Playable } from "@/lib/content";
import { EPISODE_GAPS, narrationCopy, sentence } from "./narration";
import { contentLines, MAX_VARIANTS } from "./sources";
import type { CompiledEpisode, EpisodeChapter, EpisodeLine, EpisodeSegment, EpisodeStep, SportEpisode } from "./types";

/**
 * Whether a dialogue episode plays its normal-speed target lines from the pack's content mp3s
 * (true) or as edge-tts lines in the same voice (false, today: like its slow lines, one voice
 * engine for the whole episode instead of the content's Gemini mp3s next to edge-tts slow ones).
 * One edit brings the content mp3s back.
 */
export const DIALOGUE_LINES_FROM_CONTENT = false;

/** The narrator voice of `glossLang` (the Spain Spanish one when it has none). */
function narratorVoice(glossLang: GlossLang): string {
  return (COACH_NARRATORS as Partial<Record<GlossLang, { voice: string }>>)[glossLang]?.voice ?? COACH_NARRATORS.es.voice;
}

export function compileEpisode(episode: SportEpisode, glossLang: GlossLang = DEFAULT_GLOSS_LANG): CompiledEpisode {
  const copy = narrationCopy(glossLang);
  const narratorVoiceName = narratorVoice(glossLang);
  const content = contentLines(episode);
  const segments: EpisodeSegment[] = [];
  const chapters: EpisodeChapter[] = [];

  const narrator = (text: string) => generatedPlayable(text.trim(), narratorVoiceName);
  const target = (speaker: EpisodeStep["speaker"], text: string): Playable => {
    const line = content(speaker, text);
    if (line && DIALOGUE_LINES_FROM_CONTENT) return line;
    return generatedPlayable(text, line?.voice ?? episode.voices[speaker]);
  };
  /** Slow lines are always generated, in the voice of the normal line. */
  const slow = (normal: Playable) => generatedPlayable(normal.text, normal.voice, { slow: true });

  const chapter = () => chapters.length - 1;
  const clip = (playable: Playable) => {
    if (playable.text) segments.push({ kind: "clip", playable, step: chapter() });
  };
  const narrate = (text: string) => clip(narrator(text));
  /** A silence before the next clip; none at the very start, never two in a row (the longer wins). */
  const gap = (ms: number) => {
    const last = segments[segments.length - 1];
    if (!last) return;
    if (last.kind === "gap") last.ms = Math.max(last.ms, ms);
    else segments.push({ kind: "gap", ms, step: last.step });
  };
  const open = (next: EpisodeChapter) => chapters.push(next);

  /** The meaning of a line: "Significa: …" for a native line, the bare translation for a learner one. */
  const meaning = (speaker: EpisodeStep["speaker"], line: EpisodeLine) => {
    if (speaker === "native") {
      narrate(copy.means);
      // The meaning follows its "Significa:" with no gap: one spoken sentence in two clips (the
      // meaning clip is the same mp3 a route's «Escuchar todo» already downloaded).
    }
    narrate(line.es);
  };

  // Opening.
  open({ kind: "opening", start: segments.length });
  narrate(`${copy.opening} ${sentence(episode.title)}`);
  if (episode.intro.trim()) {
    gap(EPISODE_GAPS.block);
    narrate(episode.intro);
  }

  // Steps.
  const mainLines: { speaker: EpisodeStep["speaker"]; text: string }[] = [];
  episode.parts.forEach((part, p) => {
    part.steps.forEach((step, index) => {
      const partTitle = index === 0 ? part.title.trim() : "";
      gap(partTitle ? EPISODE_GAPS.section : EPISODE_GAPS.block);
      open({ kind: "step", start: segments.length, part: p, index, number: mainLines.length });
      if (partTitle) {
        narrate(partTitle);
        gap(EPISODE_GAPS.block);
      }
      if (step.intro.trim()) {
        narrate(step.intro);
        gap(EPISODE_GAPS.block);
      }
      const line = target(step.speaker, step.line.text);
      if (step.speaker === "learner") {
        clip(line);
        gap(EPISODE_GAPS.repeat);
        clip(slow(line));
        gap(EPISODE_GAPS.repeat);
        clip(line);
      } else {
        clip(line);
        gap(EPISODE_GAPS.repeat);
        clip(line);
      }
      gap(EPISODE_GAPS.block);
      meaning(step.speaker, step.line);
      if (step.tip?.trim()) {
        gap(EPISODE_GAPS.block);
        narrate(step.tip);
      }
      for (const variant of step.variants.slice(0, MAX_VARIANTS)) {
        gap(EPISODE_GAPS.block);
        if (variant.cue.trim()) {
          narrate(variant.cue);
          gap(EPISODE_GAPS.block);
        }
        const v = target(step.speaker, variant.text);
        clip(v);
        gap(EPISODE_GAPS.repeat);
        clip(v);
        gap(EPISODE_GAPS.block);
        meaning(step.speaker, variant);
      }
      mainLines.push({ speaker: step.speaker, text: step.line.text });
    });
  });

  // Final scene: every step's main line in order, once, normal speed.
  if (mainLines.length) {
    gap(EPISODE_GAPS.section);
    open({ kind: "final", start: segments.length });
    narrate(copy.finalScene);
    for (const line of mainLines) {
      gap(EPISODE_GAPS.block);
      clip(target(line.speaker, line.text));
    }
  }
  gap(EPISODE_GAPS.block);
  narrate(copy.end);
  return { segments, chapters };
}

/**
 * Every generated line the compiled episode needs (narrator, slow and generated target lines),
 * each once: to download before playing and to keep in `pruneCoachAudio`.
 */
export function episodePlayables(episode: SportEpisode, glossLang: GlossLang = DEFAULT_GLOSS_LANG): Playable[] {
  const out = new Map<string, Playable>();
  for (const s of compileEpisode(episode, glossLang).segments) {
    if (s.kind === "clip" && isGenerated(s.playable) && !out.has(s.playable.audioKey)) out.set(s.playable.audioKey, s.playable);
  }
  return [...out.values()];
}
