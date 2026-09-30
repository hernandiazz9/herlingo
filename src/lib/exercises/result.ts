import type { Exercise, ExerciseOutcome, ItemOutcome, LessonResult } from "./types";

/** XP for finishing a lesson, plus one per exercise right at the first try, plus a perfect bonus. */
export const XP_LESSON = 10;
export const XP_PER_FIRST_TRY = 1;
export const XP_PERFECT_BONUS = 5;

export function lessonXp(exercises: number, firstTryCorrect: number): number {
  const perfect = exercises > 0 && firstTryCorrect === exercises;
  return XP_LESSON + firstTryCorrect * XP_PER_FIRST_TRY + (perfect ? XP_PERFECT_BONUS : 0);
}

/** Accumulates per-item outcomes while a session runs. */
export function recordOutcome(
  items: Map<string, ItemOutcome>,
  exercise: Exercise,
  outcome: ExerciseOutcome,
): void {
  const wrong = new Set(outcome.correct ? [] : (outcome.wrongItemIds ?? exercise.itemIds));
  if (outcome.correct && outcome.wrongItemIds) for (const id of outcome.wrongItemIds) wrong.add(id);
  for (const itemId of exercise.itemIds) {
    const o = items.get(itemId) ?? { itemId, attempts: 0, mistakes: 0 };
    o.attempts += 1;
    if (wrong.has(itemId)) o.mistakes += 1;
    items.set(itemId, o);
  }
}

export function buildResult(args: {
  lessonId: string;
  lang: string;
  seed: string;
  startedAt: number;
  finishedAt: number;
  exercises: number;
  firstTryCorrect: number;
  items: Map<string, ItemOutcome>;
}): LessonResult {
  const { items, ...rest } = args;
  return {
    ...rest,
    durationMs: Math.max(0, args.finishedAt - args.startedAt),
    xp: lessonXp(args.exercises, args.firstTryCorrect),
    items: [...items.values()],
  };
}
