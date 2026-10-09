/**
 * Glosses: the learner-facing text that explains target-language content (translations, notes,
 * grammar cards, titles, instructions written by the content). Framework-free, no zod.
 *
 * A pack lists the gloss languages it carries in `pack.json` `glossLangs` (absent = `["es"]`).
 * Source shape (docs/content-guide.md, "Gloss languages"):
 *   - fields named after the language carry one sibling per gloss language: `es` / `ru` / `en`
 *     (item translations), `questionEs` / `questionRu` / `questionEn` (Q&A), `titleEs` /
 *     `titleRu` / `titleEn` (stories). `es` always means Spain Spanish;
 *   - every other gloss field (`notes`, `explanation`, `literal`, grammar `title` / `summary` /
 *     `points`, `description`, `prompt`, `feedback`…) is a string (= Spain Spanish, as in every pack
 *     before glossLangs) or a map `{ "ru": "…", "en": "…" }`.
 *
 * `glossOf()` is the ONLY way UI and exercise generation read a gloss; it reads both shapes.
 */

/** Every gloss language the app knows: code → Spanish name, own name, BCP-47 tag for `lang=`. */
export const GLOSS_LANGUAGES = {
  es: { name: "Español", nativeName: "Español", tag: "es" },
  en: { name: "Inglés", nativeName: "English", tag: "en" },
  ru: { name: "Ruso", nativeName: "Русский", tag: "ru" },
} as const;

export type GlossLang = keyof typeof GLOSS_LANGUAGES;
export const GLOSS_LANG_CODES = Object.keys(GLOSS_LANGUAGES) as [GlossLang, ...GlossLang[]];
/** The gloss language of every pack that does not list `glossLangs`. */
export const DEFAULT_GLOSS_LANG: GlossLang = "es";

/** One text per gloss language. */
export type GlossMap = Partial<Record<GlossLang, string>>;
/** A plain string (Spain Spanish) or one text per gloss language. */
export type GlossText = string | GlossMap;

export const isGlossLang = (v: unknown): v is GlossLang =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(GLOSS_LANGUAGES, v);

/** A pack's gloss languages, in order (the first is the default choice). */
export function glossLangsOf(meta: { glossLangs?: readonly GlossLang[] }): readonly GlossLang[] {
  return meta.glossLangs?.length ? meta.glossLangs : [DEFAULT_GLOSS_LANG];
}

/** `lang` attribute for an element showing a gloss: none for Spain Spanish (the document's language). */
export function glossTag(lang: GlossLang): string | undefined {
  return lang === DEFAULT_GLOSS_LANG ? undefined : GLOSS_LANGUAGES[lang].tag;
}

/** "Ru" for "ru": the suffix of a language-named sibling (`questionRu`, `titleRu`). */
export function glossSuffix(lang: GlossLang): string {
  return lang.charAt(0).toUpperCase() + lang.slice(1);
}

/** Field bases whose siblings are named `<base><Lang>` (`questionEs`, `titleEs`). */
export type GlossBase = "question" | "title";

function pick(map: Readonly<Record<string, unknown>>, key: (l: GlossLang) => string, lang: GlossLang): string | undefined {
  const own = map[key(lang)];
  if (typeof own === "string") return own;
  // Content is validated (every listed language present): this only covers a missing value,
  // e.g. a Prepárate pack (Spain Spanish only). Prefer Spain Spanish, then any language.
  for (const l of [DEFAULT_GLOSS_LANG, ...GLOSS_LANG_CODES]) {
    const v = map[key(l)];
    if (typeof v === "string") return v;
  }
  return undefined;
}

/**
 * The gloss in `lang`:
 *   - `glossOf(item.notes, lang)`: a gloss field (string = Spain Spanish, or a per-language map);
 *   - `glossOf(item, lang)`: an item's translation, its `es` / `ru` / `en` sibling;
 *   - `glossOf(qa, lang, "question")` / `glossOf(story, lang, "title")`: `questionEs` / `titleRu`…
 * Falls back to another language only when the asked one is missing (never for valid content).
 */
export function glossOf(value: object, lang: GlossLang, base?: GlossBase): string;
export function glossOf(value: GlossText, lang: GlossLang): string;
export function glossOf(value: GlossText | undefined, lang: GlossLang): string | undefined;
export function glossOf(value: GlossText | object | undefined, lang: GlossLang, base?: GlossBase): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  const map = value as Readonly<Record<string, unknown>>;
  if (base) return pick(map, (l) => `${base}${glossSuffix(l)}`, lang) ?? "";
  return pick(map, (l) => l, lang) ?? "";
}

/** `glossOf` over a list of gloss texts (grammar `points`). */
export function glossesOf(values: readonly GlossText[] | undefined, lang: GlossLang): string[] {
  return (values ?? []).map((v) => glossOf(v, lang) ?? "");
}
