/**
 * Recoverable overflows in Claude's structured output, fixed before the zod check. Structured
 * outputs do not enforce `maxItems` (the SDK sends it as a description), so a pack can come back
 * with more turns, phrases or steps than the schema allows; the call is already billed, so a
 * too-long array is trimmed to its limit instead of failing the generation. Too few items, wrong
 * shapes or broken alternation are left as they are and still fail the zod check.
 *
 * Works on the raw JSON (unknown): anything that does not look as expected is passed through.
 */
import { PACK_ARRAY_LIMITS as P, ASSESSMENT_ARRAY_LIMITS as A } from "./schema.js";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

/** What was trimmed, `path: from→to`, for the log line (never the learner's text). */
type Trims = string[];

function trimArray(owner: Json, key: string, max: number, path: string, trims: Trims): void {
  const list = owner[key];
  if (Array.isArray(list) && list.length > max) {
    trims.push(`${path}: ${list.length}→${max}`);
    owner[key] = list.slice(0, max);
  }
}

const isCorrect = (option: unknown) => isObject(option) && option.verdict === "correct";

/** Keeps the correct option (and the original order) when a learner turn has too many. */
function trimOptions(turn: Json, path: string, trims: Trims): void {
  const options = turn.options;
  if (!Array.isArray(options) || options.length <= P.options) return;
  const correct = options.findIndex(isCorrect);
  const keep = new Set<number>(correct >= 0 ? [correct] : []);
  for (let i = 0; i < options.length && keep.size < P.options; i++) keep.add(i);
  trims.push(`${path}.options: ${options.length}→${P.options}`);
  turn.options = options.filter((_, i) => keep.has(i));
}

const isLearner = (turn: unknown) => isObject(turn) && turn.speaker === "learner";
const isNative = (turn: unknown) => isObject(turn) && turn.speaker === "native";
const learnerWithCorrect = (turn: unknown) =>
  isLearner(turn) && Array.isArray((turn as Json).options) && ((turn as Json).options as unknown[]).some(isCorrect);

/**
 * Cuts the dialogue to a prefix of at most `max` turns, so every native line still follows the
 * learner turn before it. Prefers a prefix that ends on a native line (the scene's reply), else
 * one that ends on a learner turn with a correct option; it must keep ≥ `min` turns and ≥ 1
 * learner turn. Without such a prefix it cuts at `max` and lets the zod check decide.
 */
function trimTurns(dialogue: Json, trims: Trims): void {
  const turns = dialogue.turns;
  if (!Array.isArray(turns) || turns.length <= P.turns.max) return;
  const valid = (length: number) => length >= P.turns.min && turns.slice(0, length).some(isLearner);
  let length: number = P.turns.max;
  for (const ends of [isNative, learnerWithCorrect]) {
    const found = [P.turns.max, P.turns.max - 1].find((k) => valid(k) && ends(turns[k - 1]));
    if (found) {
      length = found;
      break;
    }
  }
  trims.push(`dialogue.turns: ${turns.length}→${length}`);
  dialogue.turns = turns.slice(0, length);
}

/** Generated pack (new or refined): guide, keyPhrases, dialogue.turns and each turn's options. */
export function normalizePack(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const trims: Trims = [];
  trimArray(raw, "guide", P.guide, "guide", trims);
  trimArray(raw, "keyPhrases", P.keyPhrases, "keyPhrases", trims);
  const dialogue = raw.dialogue;
  if (isObject(dialogue)) {
    trimTurns(dialogue, trims);
    if (Array.isArray(dialogue.turns)) {
      dialogue.turns.forEach((turn, i) => {
        if (isObject(turn)) trimOptions(turn, `dialogue.turns.${i}`, trims);
      });
    }
  }
  if (trims.length) console.warn("[coach] trimmed pack overflow", trims.join(", "));
  return raw;
}

function trimAssessment(assessment: unknown, prefix: string, trims: Trims): void {
  if (!isObject(assessment)) return;
  trimArray(assessment, "strengths", A.strengths, `${prefix}strengths`, trims);
  trimArray(assessment, "weakPoints", A.weakPoints, `${prefix}weakPoints`, trims);
  trimArray(assessment, "facts", A.facts, `${prefix}facts`, trims);
}

/** The final assessment (the response is the assessment object itself). */
export function normalizeAssessment(raw: unknown): unknown {
  const trims: Trims = [];
  trimAssessment(raw, "", trims);
  if (trims.length) console.warn("[coach] trimmed assessment overflow", trims.join(", "));
  return raw;
}

/** An interview step: only its optional assessment has arrays with a max. */
export function normalizeInterviewStep(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const trims: Trims = [];
  trimAssessment(raw.assessment, "assessment.", trims);
  if (trims.length) console.warn("[coach] trimmed interview step overflow", trims.join(", "));
  return raw;
}
