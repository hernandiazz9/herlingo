import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findLessonPack, getAllLessons, getLesson, getPack, listLangs } from "@/lib/content";
import { LessonRoute } from "./LessonRoute";

// Static export: one page per lesson of every pack, nothing else (ids are unique across packs).
export const dynamicParams = false;

export function generateStaticParams() {
  return listLangs().flatMap((lang) => getAllLessons(getPack(lang)).map((lesson) => ({ id: lesson.id })));
}

export async function generateMetadata({ params }: PageProps<"/leccion/[id]">): Promise<Metadata> {
  const id = decodeURIComponent((await params).id);
  const pack = findLessonPack(id);
  return { title: (pack && getLesson(id, pack)?.title) ?? "Lección" };
}

/** Lesson session; the result is saved on the device (`LessonRoute`). */
export default async function LessonPage({ params }: PageProps<"/leccion/[id]">) {
  const id = decodeURIComponent((await params).id);
  const pack = findLessonPack(id);
  const lesson = pack && getLesson(id, pack);
  if (!pack || !lesson) notFound();
  return <LessonRoute lessonId={lesson.id} lang={pack.meta.lang} />;
}
