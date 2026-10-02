"use client";

import Link from "next/link";
import { AboutMeCard } from "@/components/coach/AboutMeCard";
import { AiUsagePanel } from "@/components/coach/AiUsagePanel";
import { AssessmentDetails, LEVEL_INTERVIEW_HREF } from "@/components/coach/LevelInterview";
import { Card } from "@/components/ui";
import { useLearnerProfile } from "@/lib/coach/use-coach";

const LINK_BUTTON =
  "pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep";

/** Prepárate in /perfil: the AI level (interview result), "Sobre mí" and "Uso de IA". */
export function CoachSections({ lang }: { lang: string }) {
  const { latest } = useLearnerProfile(lang);
  return (
    <>
      <section aria-labelledby="ai-level-title" className="flex flex-col gap-3">
        <h2 id="ai-level-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Tu nivel para la IA
        </h2>
        <Card className="flex flex-col gap-4">
          {latest ? (
            <AssessmentDetails assessment={latest} date={latest.date} />
          ) : (
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-ink">Entrevista de nivel</h3>
              <p className="text-sm text-ink-muted">
                Unas 8 preguntas con la IA (unos 5 minutos). Con el resultado, Prepárate ajusta las situaciones a tu nivel.
              </p>
            </div>
          )}
          <Link href={LEVEL_INTERVIEW_HREF} className={LINK_BUTTON}>
            {latest ? "Repetir la entrevista" : "Hacer la entrevista"}
          </Link>
        </Card>
        <AboutMeCard lang={lang} />
      </section>

      <section aria-labelledby="ai-usage-title" className="flex flex-col gap-3">
        <h2 id="ai-usage-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Uso de IA
        </h2>
        <AiUsagePanel />
      </section>
    </>
  );
}
