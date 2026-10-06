/**
 * Exercise engine (framework-free): session generator, lenient answer checking, results.
 *
 *   import { generateSession, checkAnswer, similarity } from "@/lib/exercises";
 */
export * from "./types";
export {
  checkAnswer,
  diffWords,
  normalizeAnswer,
  similarity,
  spellNumbers,
  toTiles,
  typoAllowance,
  type AnswerCheck,
  type CheckOptions,
  type DiffWord,
} from "./normalize";
export { createRng, hashSeed, type Rng } from "./random";
export { defaultSessionSize, generateSession, type GenerateOptions } from "./generate";
export {
  XP_DIALOGUE,
  XP_LESSON,
  XP_PER_FIRST_TRY,
  XP_PERFECT_BONUS,
  buildResult,
  dialogueXp,
  lessonXp,
  recordOutcome,
} from "./result";
