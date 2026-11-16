/**
 * From Claude's draft to the stored episode: trimmed strings, valid speakers, voices, stats and
 * warnings (never rejects: the tokens are already paid). Then the play order (docs/sport.md
 * "Order", in English): the compiled list of clips and gaps that audio.ts joins into one mp3.
 */
import { createHash } from "node:crypto";
import type { EpisodeDraft, ListeningEpisode, TopicIdea, Usage } from "./schema";

/** Narrator: a British voice, distinct from both Australian main voices. */
export const NARRATOR_VOICE = "en-GB-SoniaNeural";
const MAIN_VOICES = { female: "en-AU-NatashaNeural", male: "en-AU-WilliamMultilingualNeural" } as const;
/** A second main speaker of the same gender: the closest accent. */
const MAIN_ALT_VOICES = { female: "en-NZ-MollyNeural", male: "en-NZ-MitchellNeural" } as const;
const EXTRA_VOICES = {
  female: ["en-IE-EmilyNeural", "en-US-AvaMultilingualNeural", "en-GB-LibbyNeural", "en-CA-ClaraNeural", "en-ZA-LeahNeural"],
  male: ["en-GB-RyanNeural", "en-IE-ConnorNeural", "en-US-AndrewMultilingualNeural", "en-CA-LiamNeural", "en-ZA-LukeNeural"],
} as const;

function hashIndex(seed: string, n: number): number {
  return createHash("sha1").update(seed).digest().readUInt32BE(0) % n;
}

function assignVoices(episodeId: string, cast: EpisodeDraft["cast"]): Record<string, string> {
  const voices: Record<string, string> = { narrator: NARRATOR_VOICE };
  const used = new Set<string>([NARRATOR_VOICE]);
  const take = (voice: string, id: string) => {
    voices[id] = voice;
    used.add(voice);
  };
  const ordered = [...cast.filter((c) => c.main), ...cast.filter((c) => !c.main)];
  for (const member of ordered) {
    const main = MAIN_VOICES[member.gender];
    const alt = MAIN_ALT_VOICES[member.gender];
    if (member.main && !used.has(main)) take(main, member.id);
    else if (member.main && !used.has(alt)) take(alt, member.id);
    else {
      const pool = EXTRA_VOICES[member.gender];
      const start = hashIndex(`${episodeId}:${member.id}`, pool.length);
      const free = [...pool.slice(start), ...pool.slice(0, start)].find((v) => !used.has(v)) ?? pool[start]!;
      take(free, member.id);
    }
  }
  return voices;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const words = (s: string) => (s.match(/[A-Za-z0-9'’-]+/g) ?? []).length;

export function buildEpisode(
  idea: TopicIdea,
  draft: EpisodeDraft,
  generation: { model: string; mode: "batch" | "direct"; batchId?: string; effort: string; usage: Usage; costMicro: number },
): ListeningEpisode {
  const warnings: string[] = [];
  const cast = draft.cast.map((c) => ({ ...c, id: clean(c.id).toLowerCase(), name: clean(c.name), role: clean(c.role) }));
  const castIds = new Set(cast.map((c) => c.id));
  const fallbackSpeaker = cast.find((c) => c.main)?.id ?? cast[0]?.id ?? "speaker";
  const parts = draft.parts.map((part) => ({
    title: clean(part.title),
    steps: part.steps.map((step) => {
      let speaker = clean(step.speaker).toLowerCase();
      if (!castIds.has(speaker)) {
        warnings.push(`unknown speaker "${step.speaker}"`);
        speaker = fallbackSpeaker;
      }
      const focus = step.focus;
      return {
        speaker,
        intro: clean(step.intro),
        line: { text: clean(step.line.text), meaning: focus ? clean(step.line.meaning) : "" },
        focus,
        variants: focus ? step.variants.slice(0, 2).map((v) => ({ cue: clean(v.cue), text: clean(v.text), meaning: clean(v.meaning) })) : [],
        tip: focus ? clean(step.tip) : "",
      };
    }),
  }));
  const steps = parts.flatMap((p) => p.steps);
  const focusCount = steps.filter((s) => s.focus).length;
  const wordCount = steps.reduce((sum, s) => sum + words(s.line.text), 0);
  const long = steps.filter((s) => s.line.text.length > 300).length;
  if (long) warnings.push(`${long} lines over 300 characters`);
  if (focusCount < 4 || focusCount > 7) warnings.push(`${focusCount} focus steps`);
  if (wordCount < 320 || wordCount > 600) warnings.push(`${wordCount} words`);
  if (cast.filter((c) => c.main).length !== 2) warnings.push(`${cast.filter((c) => c.main).length} main speakers`);

  return {
    format: "herlingo-listening/1",
    id: idea.id,
    source: "ai",
    lang: "en",
    topic: idea.topic,
    number: idea.number,
    brief: idea.brief,
    title: clean(draft.title),
    description: clean(draft.description),
    level: draft.level,
    register: draft.register,
    intro: clean(draft.intro),
    cast,
    parts,
    outro: clean(draft.outro),
    voices: assignVoices(idea.id, cast),
    createdAt: new Date().toISOString(),
    generation: {
      model: generation.model,
      mode: generation.mode,
      batchId: generation.batchId,
      effort: generation.effort,
      usage: generation.usage,
      costUsd: generation.costMicro / 1_000_000,
    },
    stats: { steps: steps.length, focus: focusCount, words: wordCount, warnings },
  };
}

// ---------------------------------------------------------------------------------------------
// Play order

export type Segment = { kind: "clip"; text: string; voice: string; slow: boolean } | { kind: "gap"; ms: number };

/** Gaps (ms): docs/sport.md "Gaps", a little shorter, plus one between conversation turns. Variants sound once (B2–C1). */
export const GAPS = { repeat: 400, turn: 400, block: 800, part: 1200 } as const;

const COPY = {
  meaning: "In other words:",
  tip: "Tip:",
  final: "And now, all of it again, from the start, with no stops.",
  end: "End of the episode.",
};

const ORDINALS = ["one", "two", "three", "four", "five", "six"];

export function compileEpisode(ep: ListeningEpisode): Segment[] {
  const out: Segment[] = [];
  const narrator = ep.voices.narrator ?? NARRATOR_VOICE;
  const say = (text: string, voice = narrator, slow = false) => {
    if (text.trim()) out.push({ kind: "clip", text, voice, slow });
  };
  const gap = (ms: number) => {
    const last = out[out.length - 1];
    if (!last) return;
    if (last.kind === "gap") last.ms = Math.max(last.ms, ms);
    else out.push({ kind: "gap", ms });
  };
  const voiceOf = (speaker: string) => ep.voices[speaker] ?? narrator;
  const sentence = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

  say(`${sentence(ep.title)} ${ep.intro}`);
  ep.parts.forEach((part, i) => {
    gap(GAPS.part);
    say(part.title || `Part ${ORDINALS[i] ?? i + 1}.`);
    gap(GAPS.block);
    for (const step of part.steps) {
      const voice = voiceOf(step.speaker);
      if (step.intro) {
        gap(GAPS.block);
        say(step.intro);
        gap(GAPS.block);
      }
      say(step.line.text, voice);
      if (step.focus) {
        gap(GAPS.repeat);
        say(step.line.text, voice, true);
        gap(GAPS.repeat);
        say(step.line.text, voice);
        if (step.line.meaning) {
          gap(GAPS.block);
          say(`${COPY.meaning} ${step.line.meaning}`);
        }
        for (const variant of step.variants) {
          gap(GAPS.block);
          say(variant.cue);
          gap(GAPS.repeat);
          say(variant.text, voice);
          if (variant.meaning) {
            gap(GAPS.repeat);
            say(variant.meaning);
          }
        }
        if (step.tip) {
          gap(GAPS.block);
          say(`${COPY.tip} ${step.tip}`);
        }
        gap(GAPS.block);
      } else {
        gap(GAPS.turn);
      }
    }
  });
  gap(GAPS.part);
  say(COPY.final);
  gap(GAPS.block);
  for (const step of ep.parts.flatMap((p) => p.steps)) {
    say(step.line.text, voiceOf(step.speaker));
    gap(GAPS.turn);
  }
  gap(GAPS.part);
  say(ep.outro);
  gap(GAPS.block);
  say(COPY.end);
  return out;
}
