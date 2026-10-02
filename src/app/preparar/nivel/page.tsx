import type { Metadata } from "next";
import { LevelInterview } from "@/components/coach/LevelInterview";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "Entrevista de nivel" };

/** AI level interview (from /perfil and Prepárate). */
export default function LevelInterviewPage() {
  return (
    <>
      <PageHeader title="Entrevista de nivel" subtitle="Unas preguntas para que la IA sepa qué nivel tienes." />
      <LevelInterview />
    </>
  );
}
