/**
 * Long spoken texts in voice-sized pieces. `/api/coach/tts/` reads at most `SPOKEN_TEXT_MAX`
 * characters per request (`LIMITS.ttsText` on the server), but some lines are longer (a route
 * meaning may have 400, content glosses have no cap): the coach source asks for each piece and joins
 * their mp3s into the line's one mp3 (docs/coach.md "Generated audio"). Pure, no browser API.
 */

/** The most characters one voice request reads (the server's `LIMITS.ttsText`). */
export const SPOKEN_TEXT_MAX = 300;

/** Closing quotes and brackets that may follow a punctuation mark. */
const CLOSERS = `["'»”’)\\]]*`;
const SENTENCE_END = new RegExp(`[.!?…。！？]${CLOSERS}$`, "u");
const CLAUSE_END = new RegExp(`[;:,；：，]${CLOSERS}$`, "u");

/** Boundary levels, preferred first: after a sentence, after a clause, between words. */
const SENTENCE = 0;
const CLAUSE = 1;
const WORD = 2;

/** The strongest boundary that follows `word`. */
function boundaryAfter(word: string): number {
  if (SENTENCE_END.test(word)) return SENTENCE;
  if (CLAUSE_END.test(word)) return CLAUSE;
  return WORD;
}

/** `text` cut every `max` characters (one word longer than a whole piece), never inside a surrogate pair. */
function hardCut(text: string, max: number): string[] {
  const out: string[] = [];
  let at = 0;
  while (at < text.length) {
    let end = Math.min(text.length, at + max);
    const code = text.charCodeAt(end - 1);
    if (end < text.length && end - 1 > at && code >= 0xd800 && code <= 0xdbff) end--;
    out.push(text.slice(at, end));
    at = end;
  }
  return out;
}

/**
 * The units a text may be cut between: its sentences; a sentence longer than `max` in its clauses;
 * a clause longer than `max` in its words; a word longer than `max` in `max`-character slices.
 */
function units(words: readonly string[], level: number, max: number): string[] {
  const groups: string[][] = [];
  let group: string[] = [];
  for (const word of words) {
    group.push(word);
    if (boundaryAfter(word) <= level) {
      groups.push(group);
      group = [];
    }
  }
  if (group.length) groups.push(group);
  return groups.flatMap((g) => {
    const text = g.join(" ");
    if (text.length <= max) return [text];
    return level < WORD ? units(g, level + 1, max) : hardCut(text, max);
  });
}

/**
 * A spoken text in pieces of at most `max` characters, in order: its units (sentences, else clauses
 * cut at `; : ,`, else words, else slices of a word longer than `max`) packed greedily, so as few
 * pieces as those cuts allow. A text that fits (trimmed, as the server reads it) comes back as is,
 * as the only piece: it keeps its one playable and key. Runs of whitespace become one space in the
 * pieces of a longer text.
 */
export function splitSpokenText(text: string, max: number = SPOKEN_TEXT_MAX): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= max) return [text];
  const out: string[] = [];
  let piece = "";
  for (const unit of units(trimmed.split(/\s+/u), SENTENCE, max)) {
    const joined = piece ? `${piece} ${unit}` : unit;
    if (joined.length <= max) {
      piece = joined;
    } else {
      out.push(piece);
      piece = unit;
    }
  }
  if (piece) out.push(piece);
  return out;
}
