import type { GrammarCard, ImageRef, Playable, Vocab } from "@/lib/content";

export type ExerciseType =
  | "listen-meaning"
  | "read-meaning"
  | "tiles"
  | "fill-gap"
  | "dictation"
  | "answer"
  | "match"
  | "speak"
  | "picture-choice"
  | "picture-listen";

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
  /** Shown text (Spanish meaning, or target-language reply). */
  label: string;
  correct: boolean;
  /** Target-language option that can be played (Q&A replies). */
  audio?: Playable;
}

interface Base {
  /** Unique inside the session. */
  key: string;
  /** Lesson item ids this exercise practises. */
  itemIds: string[];
  solution: Solution;
}

/** Hear the target language, pick the Spanish meaning. */
export interface ListenMeaningExercise extends Base {
  type: "listen-meaning";
  audio: Playable;
  options: ChoiceOption[];
}

/** Read the target language (with a play button), pick the Spanish meaning. */
export interface ReadMeaningExercise extends Base {
  type: "read-meaning";
  audio: Playable;
  options: ChoiceOption[];
}

/** Spanish → target language by tapping word tiles (answer words + distractors, shuffled). */
export interface TilesExercise extends Base {
  type: "tiles";
  es: string;
  answer: string;
  tiles: string[];
  audio: Playable;
}

/** Target-language sentence with one word missing; pick the word. */
export interface FillGapExercise extends Base {
  type: "fill-gap";
  es: string;
  before: string;
  after: string;
  gap: string;
  options: string[];
  audio: Playable;
}

/** Hear the target language, type it. */
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
  /** Target-language text (the left column). */
  text: string;
  es: string;
  audio: Playable;
  /** Set on every pair of a picture match: the right column shows pictures instead of `es`. */
  image?: ImageRef;
}

/** Match target-language and Spanish pairs (or target-language words and pictures, when the pairs have `image`). */
export interface MatchExercise extends Base {
  type: "match";
  pairs: MatchPair[];
  /** Pair ids in display order for each column. */
  textOrder: string[];
  esOrder: string[];
}

/** Say the phrase aloud (speech recognition or self-evaluation). */
export interface SpeakExercise extends Base {
  type: "speak";
  audio: Playable;
  es: string;
}

/** A picture card of a picture-choice exercise (a pictured vocab word). */
export interface PictureOption {
  id: string;
  /** Target-language word as spoken ("il caffè"), written under the picture. */
  text: string;
  es: string;
  image: ImageRef;
  audio: Playable;
  correct: boolean;
}

/**
 * Pick the picture among 4 (2×2). `picture-choice`: prompt in Spanish, cards show picture +
 * target-language word (tap = audio). `picture-listen`: target-language audio only, the words
 * show once checked.
 */
export interface PictureChoiceExercise extends Base {
  type: "picture-choice" | "picture-listen";
  /** The word asked (target-language audio). */
  audio: Playable;
  es: string;
  options: PictureOption[];
}

export type Exercise =
  | ListenMeaningExercise
  | ReadMeaningExercise
  | TilesExercise
  | FillGapExercise
  | DictationExercise
  | AnswerExercise
  | MatchExercise
  | SpeakExercise
  | PictureChoiceExercise;

/** Ungraded tip shown inside the session (lesson grammar cards). */
export interface GrammarStep {
  type: "grammar";
  key: string;
  card: GrammarCard;
}

/** Ungraded new-word card shown before the first exercise that practises a vocab word never seen before. */
export interface IntroStep {
  type: "intro";
  key: string;
  item: Vocab;
}

export type SessionStep = Exercise | GrammarStep | IntroStep;

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
