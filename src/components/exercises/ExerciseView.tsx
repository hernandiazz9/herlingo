"use client";

import type { Exercise, ExerciseOutcome } from "@/lib/exercises";
import { ChoiceExercise } from "./ChoiceExercise";
import { DictationExercise } from "./DictationExercise";
import { FillGapExercise } from "./FillGapExercise";
import { MatchExercise } from "./MatchExercise";
import { SpeakExercise } from "./SpeakExercise";
import { TilesExercise } from "./TilesExercise";

export interface ExerciseViewProps {
  exercise: Exercise;
  answered: boolean;
  onAnswer: (outcome: ExerciseOutcome) => void;
  onCannotSpeak: () => void;
}

/** Renders any exercise by type. Give it a `key` per attempt so its state resets on retries. */
export function ExerciseView({ exercise, answered, onAnswer, onCannotSpeak }: ExerciseViewProps) {
  switch (exercise.type) {
    case "listen-meaning":
    case "read-meaning":
    case "answer":
      return <ChoiceExercise exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case "tiles":
      return <TilesExercise exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case "fill-gap":
      return <FillGapExercise exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case "dictation":
      return <DictationExercise exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case "match":
      return <MatchExercise exercise={exercise} answered={answered} onAnswer={onAnswer} />;
    case "speak":
      return <SpeakExercise exercise={exercise} answered={answered} onAnswer={onAnswer} onCannotSpeak={onCannotSpeak} />;
  }
}
