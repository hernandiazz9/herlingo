"use client";

import { LessonPlayer } from "@/components/lesson";
import { recordLessonResult } from "@/lib/progress";

/** Lesson player that saves the result (done, XP, streak, spaced repetition) on the device. */
export function LessonRoute({ lessonId }: { lessonId: string }) {
  return <LessonPlayer lessonId={lessonId} onComplete={recordLessonResult} />;
}
