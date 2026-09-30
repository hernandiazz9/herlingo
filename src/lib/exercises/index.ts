/**
 * Exercise engine (framework-free): session generator, lenient answer checking, results.
 *
 *   import { generateSession, checkAnswer, similarity } from "@/lib/exercises";
 */
export * from "./types";
export { checkAnswer, normalizeAnswer, similarity, toTiles, type AnswerCheck } from "./normalize";
export { createRng, hashSeed, type Rng } from "./random";
export { defaultSessionSize, generateSession, type GenerateOptions } from "./generate";
export { XP_LESSON, XP_PER_FIRST_TRY, XP_PERFECT_BONUS, buildResult, lessonXp, recordOutcome } from "./result";
