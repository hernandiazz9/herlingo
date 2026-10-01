/**
 * Stable audio keys. Ids only use single "-" or "." separators, so the "--" used here can never
 * collide with a real id. Keys are file-name safe: mp3s live at `/audio/<lang>/<key>.mp3`.
 *
 *   phrase / vocab / expression / placement   <id>
 *   qa question                               <qaId>--q
 *   qa accepted reply n (1-based)             <qaId>--a<n>
 *   qa distractor n                           <qaId>--d<n>
 *   grammar example n                         <cardId>--e<n>
 *   dialogue native turn                      <dialogueId>--<turnId>
 *   dialogue learner option n                 <dialogueId>--<turnId>--<n>
 *   story sentence                            <storyId>--<sentenceId>
 *   story question / option n                 <storyId>--<questionId>, <storyId>--<questionId>--<n>
 *   story key word                            its item id (vocab / phrase / expression)
 */
export function audioKey(id: string, ...parts: (string | number)[]): string {
  return [id, ...parts].join("--");
}

/** Spoken form of a vocab item: "il biglietto", "l'orario", "stazione" (no article). */
export function vocabText(word: string, article?: string): string {
  if (!article) return word;
  return article.endsWith("'") || article.endsWith("’") ? `${article}${word}` : `${article} ${word}`;
}

/**
 * Picture keys (vocab `image`, dialogue `avatars`): `fluent:<icon>` (Microsoft Fluent Emoji Flat
 * icon name, e.g. `fluent:hot-beverage`) or `custom:<slug>` (our own drawing,
 * `assets/images/custom/<slug>.svg`; slug = vocab id with dots → dashes, e.g. `custom:food-cannolo`).
 * `npm run images` writes the file to `public/images/<source>/<name>.svg`.
 */
export const IMAGE_SOURCES = ["fluent", "custom"] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];
export const IMAGE_KEY_PATTERN = /^(fluent|custom):([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** `{ source, name }` of a picture key, or null if it is malformed. */
export function parseImageKey(key: string): { source: ImageSource; name: string } | null {
  const m = IMAGE_KEY_PATTERN.exec(key);
  return m ? { source: m[1] as ImageSource, name: m[2] } : null;
}

/** Path of a picture inside `public/images/` ("fluent/hot-beverage.svg"), or null if malformed. */
export function imageFile(key: string): string | null {
  const k = parseImageKey(key);
  return k ? `${k.source}/${k.name}.svg` : null;
}
