/**
 * Exercise UI, one component per exercise type. Each gets `{ exercise, answered, onAnswer }` and
 * reports an `ExerciseOutcome`; the lesson player (or review, T08...) shows the feedback.
 */
export { ChoiceExercise } from "./ChoiceExercise";
export { DictationExercise } from "./DictationExercise";
export { ExerciseView, type ExerciseViewProps } from "./ExerciseView";
export { FillGapExercise } from "./FillGapExercise";
export { GrammarTip } from "./GrammarTip";
export { MatchExercise } from "./MatchExercise";
export { PictureChoiceExercise } from "./PictureChoiceExercise";
export { SpeakExercise, type SpeakExerciseProps } from "./SpeakExercise";
export { TilesExercise } from "./TilesExercise";
export { WordIntro } from "./WordIntro";
export { CloseIcon, LessonLangContext, MiniPlay, PlayControls, Prompt, SlowIcon, useLessonLang, usePlay, type ExerciseProps } from "./shared";
