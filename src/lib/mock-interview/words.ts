/** Words and pace of a spoken answer, computed on the device (never asked from Claude). */

/** Words of a transcript: runs of non-space characters with at least one letter or digit ("—" is not a word). */
export function countWords(text: string): number {
  let n = 0;
  for (const token of text.split(/\s+/)) if (/[\p{L}\p{N}]/u.test(token)) n++;
  return n;
}

/** Words per minute = words / seconds × 60, rounded; 0 when the time was not measured. */
export function wordsPerMinute(words: number, seconds: number): number {
  if (!Number.isFinite(words) || !Number.isFinite(seconds) || words <= 0 || seconds <= 0) return 0;
  return Math.round((words / seconds) * 60);
}
