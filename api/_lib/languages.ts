/**
 * Language metadata for the prompts and the TTS allowlist, read from `content/<lang>/pack.json`
 * (the same file `getPack()` is built from). Bundled into the functions via `includeFiles` in
 * vercel.json. Adding a language = adding its content, nothing here changes.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CoachError } from "./http.js";

const PackMeta = z.object({
  lang: z.string(),
  name: z.string(),
  nativeName: z.string(),
  speechLocale: z.string(),
  voices: z.array(z.string()).min(1),
  /** Gloss languages (absent = Spain Spanish only). The prompts write Spain Spanish glosses: Prepárate needs "es". */
  glossLangs: z.array(z.string()).optional(),
  /**
   * Written stress (optional, `pack.json` `stress`): `mark` after the stressed vowel of every word
   * with two or more `vowels`, none in words with a `selfStressed` letter. Shown to the learner,
   * never sent to a voice.
   */
  stress: z
    .object({ mark: z.string().min(1), vowels: z.string().min(1), selfStressed: z.string().optional() })
    .optional(),
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
  // The prompts write Spain Spanish glosses for a learner of another language: not for a pack
  // without "es" glosses, nor for a Spanish-language pack (its glosses are the same language).
  const targetIsSpanish = meta.speechLocale.split("-")[0].toLowerCase() === "es";
  if ((meta.glossLangs && !meta.glossLangs.includes("es")) || targetIsSpanish) {
    throw new CoachError(400, "bad_request", "Prepárate todavía no está disponible para este idioma.");
  }
  return meta;
}

/** Native turns use the pack's first voice; learner options a different one, like static dialogues. */
export function packVoices(meta: LanguageMeta): { native: string; learner: string } {
  return { native: meta.voices[0], learner: meta.voices[1] ?? meta.voices[0] };
}

/**
 * `text` without the written stress marks of the packs that declare `voice` (the coach TTS gets
 * only text and voice). Unchanged for voices of packs without `stress`.
 */
export function stripStressForVoice(text: string, voice: string): string {
  let out = text;
  for (const meta of load().values()) {
    const mark = meta.stress?.mark;
    if (mark && meta.voices.includes(voice)) out = out.split(mark).join("");
  }
  return out;
}

/**
 * The narrator of each gloss language: the one voice that reads a line's meaning aloud (Modo
 * rápido «Escuchar todo» reads each route line's Spain Spanish `es`). Accepted by the TTS endpoint
 * on its own, not through a pack (no pack declares it). Mirror: `COACH_NARRATORS` in
 * src/lib/coach/audio.ts.
 */
export const NARRATOR_VOICES: Readonly<Record<string, string>> = { es: "es-ES-AlvaroNeural" };

/** Every voice any pack declares, plus the narrator voices: the TTS endpoint accepts only these. */
export function allowedVoices(): Set<string> {
  return new Set([...[...load().values()].flatMap((m) => m.voices), ...Object.values(NARRATOR_VOICES)]);
}
