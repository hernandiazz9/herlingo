"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { checkAnswer, type DictationExercise as Dictation } from "@/lib/exercises";
import { PlayControls, Prompt, type ExerciseProps } from "./shared";

/** Hear Italian, type it. Accents and punctuation are forgiven (with a note for accents). */
export function DictationExercise({ exercise, answered, onAnswer }: ExerciseProps<Dictation>) {
  const [text, setText] = useState("");

  const check = () => {
    if (answered || !text.trim()) return;
    const result = checkAnswer(text, exercise.accepted);
    onAnswer({ correct: result.correct, accentNote: result.accentNote, given: text.trim() });
  };

  return (
    <form
      className="flex flex-1 flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        check();
      }}
    >
      <Prompt>Escribe lo que oyes</Prompt>
      <PlayControls audio={exercise.audio} />
      <label className="flex flex-col gap-2">
        <span className="sr-only">Lo que oyes, en italiano</span>
        <textarea
          lang="it"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              check();
            }
          }}
          readOnly={answered}
          rows={3}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="Escribe en italiano…"
          className="w-full resize-none rounded-card border-2 border-line bg-surface p-4 text-xl font-bold text-ink placeholder:font-normal placeholder:text-ink-muted focus:border-sea focus:outline-none"
        />
      </label>
      <div className="mt-auto">
        <Button type="submit" fullWidth disabled={answered || !text.trim()}>
          Comprobar
        </Button>
      </div>
    </form>
  );
}
