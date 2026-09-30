import type { GrammarCard, Playable } from "@/lib/content";

export type ExerciseType =
  | "listen-meaning"
  | "read-meaning"
  | "tiles"
  | "fill-gap"
  | "dictation"
  | "answer"
  | "match"
  | "speak";

/** What the feedback sheet shows as the right answer. */
export interface Solution {
  text: string;
  es?: string;
  audio?: Playable;
  /** Extra context, e.g. the question that was asked. */
  note?: string;
}

export interface ChoiceOption {
  id: string;
  /** Shown text (Spanish meaning, or Italian reply). */
  label: string;
  correct: boolean;
  /** Italian option that can be played (Q&A replies). */
  audio?: Playable;
}

interface Base {
  /** Unique inside the session. */
  key: string;
  /** Lesson item ids this exercise practises. */
  itemIds: string[];
  solution: Solution;
}

/** Hear Italian, pick the Spanish meaning. */
export interface ListenMeaningExercise extends Base {
  type: "listen-meaning";
  audio: Playable;
  options: ChoiceOption[];
}

/** Read Italian (with a play button), pick the Spanish meaning. */
export interface ReadMeaningExercise extends Base {
  type: "read-meaning";
  audio: Playable;
  options: ChoiceOption[];
}

/** Spanish → Italian by tapping word tiles (answer words + distractors, shuffled). */
export interface TilesExercise extends Base {
  type: "tiles";
  es: string;
  answer: string;
  tiles: string[];
  audio: Playable;
}

/** Italian sentence with one word missing; pick the word. */
export interface FillGapExercise extends Base {
  type: "fill-gap";
  es: string;
  before: string;
  after: string;
  gap: string;
  options: string[];
  audio: Playable;
}

/** Hear Italian, type it. */
export interface DictationExercise extends Base {
  type: "dictation";
  audio: Playable;
  /** Accepted spellings (first = model answer). */
  accepted: string[];
  es: string;
}

/** Hear a typical question, pick the right reply. */
export interface AnswerExercise extends Base {
  type: "answer";
  question: Playable;
  questionEs: string;
  options: ChoiceOption[];
}

export interface MatchPair {
  id: string;
  it: string;
  es: string;
  audio: Playable;
}

/** Match Italian and Spanish pairs. */
export interface MatchExercise extends Base {
  type: "match";
  pairs: MatchPair[];
  /** Pair ids in display order for each column. */
  itOrder: string[];
  esOrder: string[];
}

/** Say the phrase aloud (speech recognition or self-evaluation). */
export interface SpeakExercise extends Base {
  type: "speak";
  audio: Playable;
  es: string;
}

export type Exercise =
  | ListenMeaningExercise
  | ReadMeaningExercise
  | TilesExercise
  | FillGapExercise
  | DictationExercise
  | AnswerExercise
  | MatchExercise
  | SpeakExercise;

/** Ungraded tip shown inside the session (lesson grammar cards). */
export interface GrammarStep {
  type: "grammar";
  key: string;
  card: GrammarCard;
}

export type SessionStep = Exercise | GrammarStep;

/** What an exercise reports when answered. */
export interface ExerciseOutcome {
  correct: boolean;
  /** Right but with missing/wrong accents. */
  accentNote?: boolean;
  /** Items answered wrong (match); defaults to all `itemIds` when incorrect. */
  wrongItemIds?: string[];
  /** What the learner gave (typed text, recognised speech...), for the feedback sheet. */
  given?: string;
}

/** Per-item outcome in a finished lesson. */
export interface ItemOutcome {
  itemId: string;
  /** Exercises answered that practised the item (retries included). */
  attempts: number;
  /** Wrong answers on the item. 0 = always right. */
  mistakes: number;
}

/** Handed to `onComplete` when a lesson ends (persistence is the caller's job). */
export interface LessonResult {
  lessonId: string;
  lang: string;
  seed: string;
  /** Epoch ms. */
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  xp: number;
  /** Graded exercises in the generated session (retries and skipped ones excluded). */
  exercises: number;
  /** Exercises right at the first attempt. */
  firstTryCorrect: number;
  items: ItemOutcome[];
}
