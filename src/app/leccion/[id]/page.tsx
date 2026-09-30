import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/lesson";
import { getAllLessons, getLesson } from "@/lib/content";

// Static export: one page per lesson, nothing else.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllLessons().map((lesson) => ({ id: lesson.id }));
}

export async function generateMetadata({ params }: PageProps<"/leccion/[id]">): Promise<Metadata> {
  const { id } = await params;
  const lesson = getLesson(decodeURIComponent(id));
  return { title: lesson?.title ?? "Lección" };
}

/** Lesson session. Progress persistence (T07) plugs in through `LessonPlayer`'s `onComplete`. */
export default async function LessonPage({ params }: PageProps<"/leccion/[id]">) {
  const { id } = await params;
  const lesson = getLesson(decodeURIComponent(id));
  if (!lesson) notFound();
  return <LessonPlayer lessonId={lesson.id} />;
}
