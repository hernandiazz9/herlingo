/**
 * Language metadata for the prompts and the TTS allowlist, read from `content/<lang>/pack.json`
 * (the same file `getPack()` is built from). Bundled into the functions via `includeFiles` in
 * vercel.json. Adding a language = adding its content, nothing here changes.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CoachError } from "./http";

const PackMeta = z.object({
  lang: z.string(),
  name: z.string(),
  nativeName: z.string(),
  speechLocale: z.string(),
  voices: z.array(z.string()).min(1),
});
export type LanguageMeta = z.infer<typeof PackMeta>;

let cache: Map<string, LanguageMeta> | undefined;

function load(): Map<string, LanguageMeta> {
  if (cache) return cache;
  const root = join(process.cwd(), "content");
  const found = new Map<string, LanguageMeta>();
  for (const dir of existsSync(root) ? readdirSync(root) : []) {
    const file = join(root, dir, "pack.json");
    if (!existsSync(file)) continue;
    const meta = PackMeta.parse(JSON.parse(readFileSync(file, "utf8")));
    found.set(meta.lang, meta);
  }
  cache = found;
  return found;
}

export function getLanguage(lang: string): LanguageMeta {
  const meta = load().get(lang);
  if (!meta) throw new CoachError(400, "bad_request", "Ese idioma no está disponible.");
  return meta;
}

/** Native turns use the pack's first voice; learner options a different one, like static dialogues. */
export function packVoices(meta: LanguageMeta): { native: string; learner: string } {
  return { native: meta.voices[0], learner: meta.voices[1] ?? meta.voices[0] };
}

/** Every voice any pack declares: the TTS endpoint accepts only these. */
export function allowedVoices(): Set<string> {
  return new Set([...load().values()].flatMap((m) => m.voices));
}
