/**
 * Audio plan shared by `npm run audio` (generate.ts) and `content:check --strict-audio`.
 *
 * Every playable of a pack gets one mp3 named by a hash of voice + text, so identical lines share
 * a file and any text or voice change produces a new file (the old one is pruned). The manifest
 * `public/audio/<lang>/manifest.json` maps audio key → file name; `speak()` reads it at runtime.
 *
 * Dialogue learner options are voiced by a pack voice that none of the dialogue's native turns
 * uses, so the two sides of a conversation always sound different.
 *
 * Kept free of `@/lib/content` (which needs the generated bundle): it walks the Pack itself.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pack, Playable } from "../../src/lib/content/types";

export interface AudioJob {
  key: string;
  text: string;
  voice: string;
  /** File name inside public/audio/<lang>/. */
  file: string;
}

export type Manifest = Record<string, string>;

export const MANIFEST = "manifest.json";

export function audioDir(root: string, lang: string): string {
  return join(root, "public", "audio", lang);
}

export function audioFile(text: string, voice: string): string {
  return createHash("sha1").update(`${voice}\n${text}`).digest("hex").slice(0, 16) + ".mp3";
}

/** One job per audio key, sorted by key. */
export function planAudio(pack: Pack): AudioJob[] {
  const jobs = new Map<string, AudioJob>();
  const add = (p: Playable | undefined, voice = p?.voice) => {
    if (!p || !voice) return;
    jobs.set(p.audioKey, { key: p.audioKey, text: p.text, voice, file: audioFile(p.text, voice) });
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
      if (t.speaker === "native") add(t);
      else t.options.forEach((o) => add(o, learnerVoice));
    }
  }
  for (const q of pack.placement) add(q.audio);
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

/** Errors for every playable whose current text + voice has no mp3 in the manifest. */
export function checkAudio(pack: Pack, root: string): string[] {
  const dir = audioDir(root, pack.meta.lang);
  const manifest = readManifest(dir);
  const missing = planAudio(pack).filter((j) => manifest[j.key] !== j.file || !existsSync(join(dir, j.file)));
  const shown = missing.slice(0, 20).map((j) => `no mp3 for "${j.key}" (${j.voice}: ${j.text})`);
  if (missing.length > shown.length) shown.push(`…and ${missing.length - shown.length} more`);
  if (missing.length) shown.push(`${missing.length} playable(s) without mp3: run \`npm run audio\``);
  return shown;
}
