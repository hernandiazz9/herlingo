/**
 * Audio plan shared by `npm run audio` (generate.ts) and `content:check --strict-audio`.
 *
 * Every playable of a pack gets one mp3 named by a hash of voice + spoken text (stress marks of a
 * pack with `stress` stripped), so identical lines share
 * a file and any text or voice change produces a new file (the old one is pruned). The manifest
 * `public/audio/<lang>/manifest.json` maps audio key → file name; `speak()` reads it at runtime.
 *
 * Dialogue learner options are voiced by a pack voice that none of the dialogue's native turns
 * uses, so the two sides of a conversation always sound different.
 *
 * pack.json `ttsVoices` can render a voice with another edge-tts voice or with ElevenLabs. An
 * ElevenLabs line also has a `fallback`: the edge-tts mp3 of the voice name, used (and kept) until
 * the ElevenLabs mp3 exists, so running out of credits never leaves a line without audio.
 *
 * Kept free of `@/lib/content` (which needs the generated bundle): it walks the Pack itself.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { grammarPlayables } from "../../src/lib/content/grammar";
import { stripStress } from "../../src/lib/content/script";
import type { Pack, Playable } from "../../src/lib/content/types";

export interface AudioJob {
  key: string;
  text: string;
  /** Pack voice name (pack.json `voices`). */
  voice: string;
  /** File name inside public/audio/<lang>/. */
  file: string;
  /** How `file` is rendered. */
  render: { provider: "edge"; voice: string } | { provider: "elevenlabs"; voiceId: string; model: string };
  /** ElevenLabs lines only: the edge-tts mp3 of `voice`, used until `file` exists. */
  fallback?: { file: string; voice: string };
  /** Lower = generated first when credits are limited (dialogue and story lines before the rest). */
  priority: number;
}

export type Manifest = Record<string, string>;

export const MANIFEST = "manifest.json";

export function audioDir(root: string, lang: string): string {
  return join(root, "public", "audio", lang);
}

export function audioFile(text: string, voice: string): string {
  return createHash("sha1").update(`${voice}\n${text}`).digest("hex").slice(0, 16) + ".mp3";
}

export const ELEVENLABS_DEFAULT_MODEL = "eleven_v3";

/** One job per audio key, sorted by key. */
export function planAudio(pack: Pack): AudioJob[] {
  const jobs = new Map<string, AudioJob>();
  const add = (p: Playable | undefined, voice = p?.voice, priority = 1) => {
    if (!p || !voice) return;
    // TTS gets the text without the pack's stress marks (unchanged for packs without `stress`).
    const text = stripStress(p.text, pack.meta);
    const tts = pack.meta.ttsVoices?.[voice];
    let job: AudioJob;
    if (tts?.provider === "elevenlabs") {
      const model = tts.model ?? ELEVENLABS_DEFAULT_MODEL;
      job = {
        key: p.audioKey,
        text,
        voice,
        file: audioFile(text, `elevenlabs:${tts.voiceId}:${model}`),
        render: { provider: "elevenlabs", voiceId: tts.voiceId, model },
        fallback: { file: audioFile(text, voice), voice },
        priority,
      };
    } else {
      const edgeVoice = tts?.provider === "edge" ? tts.voice : voice;
      job = { key: p.audioKey, text, voice, file: audioFile(text, edgeVoice), render: { provider: "edge", voice: edgeVoice }, priority };
    }
    jobs.set(p.audioKey, job);
  };
  pack.phrases.forEach((p) => add(p));
  pack.vocab.forEach((p) => add(p));
  pack.expressions.forEach((p) => add(p));
  for (const q of pack.qa) {
    add(q);
    q.accepted.forEach((p) => add(p));
    q.distractors.forEach((p) => add(p));
  }
  for (const g of pack.grammar) g.examples.forEach((p) => add(p));
  for (const d of pack.dialogues) {
    const nativeVoices = new Set(d.turns.flatMap((t) => (t.speaker === "native" ? [t.voice] : [])));
    const learnerVoice = pack.meta.voices.find((v) => !nativeVoices.has(v)) ?? pack.meta.voices[0];
    for (const t of d.turns) {
      if (t.speaker === "native") add(t, t.voice, 0);
      else t.options.forEach((o) => add(o, learnerVoice, 0));
    }
  }
  for (const q of pack.placement) add(q.audio);
  // Story key words are pack vocab / phrases / expressions (planned above).
  for (const s of pack.stories) {
    s.sentences.forEach((p) => add(p, p.voice, 0));
    for (const q of s.questions) {
      add(q);
      q.options.forEach((p) => add(p));
    }
  }
  // Gramática: verb infinitives, forms, tense examples, drills.
  grammarPlayables(pack).forEach((p) => add(p));
  return [...jobs.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function readManifest(dir: string): Manifest {
  const path = join(dir, MANIFEST);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Manifest;
  } catch {
    return {};
  }
}

/** The mp3 a job plays now: its own file, else its fallback, if present on disk. */
export function currentFile(job: AudioJob, dir: string): string | undefined {
  if (existsSync(join(dir, job.file))) return job.file;
  if (job.fallback && existsSync(join(dir, job.fallback.file))) return job.fallback.file;
  return undefined;
}

/**
 * Errors for every playable whose current text + voice has no mp3 in the manifest. An ElevenLabs
 * line still on its edge-tts fallback is fine (generated later, when there are credits).
 */
export function checkAudio(pack: Pack, root: string): string[] {
  const dir = audioDir(root, pack.meta.lang);
  const manifest = readManifest(dir);
  const missing = planAudio(pack).filter((j) => {
    const file = currentFile(j, dir);
    return !file || manifest[j.key] !== file;
  });
  const shown = missing.slice(0, 20).map((j) => `no mp3 for "${j.key}" (${j.voice}: ${j.text})`);
  if (missing.length > shown.length) shown.push(`…and ${missing.length - shown.length} more`);
  if (missing.length) shown.push(`${missing.length} playable(s) without mp3: run \`npm run audio\``);
  return shown;
}
