import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllLessons, getLesson } from "@/lib/content";
import { LessonRoute } from "./LessonRoute";

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

/** Lesson session; the result is saved on the device (`LessonRoute`). */
export default async function LessonPage({ params }: PageProps<"/leccion/[id]">) {
  const { id } = await params;
  const lesson = getLesson(decodeURIComponent(id));
  if (!lesson) notFound();
  return <LessonRoute lessonId={lesson.id} />;
}
