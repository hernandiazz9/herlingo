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
