"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DialoguePlayer } from "@/components/dialogue/DialoguePlayer";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui";
import { awardPracticeXp, packDialogue, type CoachPack } from "@/lib/coach";
import { useSavedPacks } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useHydrated } from "@/lib/progress/use-progress";
import { PACK_PARAM, PREPARE_HREF } from "./nav";
import { leavePractice, PRACTICE_TITLE } from "./practice-nav";
import { FOCUS } from "./shared";

const REGISTER: Record<CoachPack["register"], string> = { formal: "Trato de usted", informal: "Trato de tú" };

/**
 * /preparar/dialogo/?pack=<id>: the role-play of a saved pack in the dialogue player, with XP on
 * finishing (first time per day per pack). Uses `useSearchParams`: render inside Suspense.
 */
export function PackPractice() {
  const lang = useScreenLang();
  return lang ? <SavedPractice key={lang} lang={lang} /> : <PageHeader title={PRACTICE_TITLE} />;
}

function SavedPractice({ lang }: { lang: string }) {
  const hydrated = useHydrated();
  const id = useSearchParams().get(PACK_PARAM);
  const { get } = useSavedPacks(lang);
  const pack = id ? get(id) : undefined;

  if (!hydrated) return <PageHeader title={PRACTICE_TITLE} />;
  if (!pack) {
    return (
      <>
        <PageHeader title="Situación no encontrada" subtitle="No está guardada en este móvil: puede que la hayas borrado." />
        <Link
          href={PREPARE_HREF}
          className={cn(
            "pressable inline-flex min-h-14 w-full items-center justify-center rounded-button bg-sea px-6 text-lg font-bold tracking-wide text-on-accent [--ledge:var(--sea-ledge)]",
            FOCUS,
          )}
        >
          Volver a Prepárate
        </Link>
      </>
    );
  }
  return <Practice key={`${pack.id}:${pack.createdAt}`} pack={pack} />;
}

function Practice({ pack }: { pack: CoachPack }) {
  const router = useRouter();
  const dialogue = useMemo(() => packDialogue(pack), [pack]);
  const [xp, setXp] = useState<number | null>(null);
  const answers = dialogue.turns.filter((t) => t.speaker === "learner").length;
  const back = () => leavePractice(pack.id, (href) => router.replace(href));

  return (
    <>
      <button type="button" onClick={back} className={cn("self-start text-sm font-bold text-sea", FOCUS)}>
        ← {pack.title}
      </button>
      <PageHeader title={pack.dialogue.title} />
      <DialoguePlayer
        dialogue={dialogue}
        lang={pack.lang}
        intro={
          <>
            <p className="text-sm font-bold text-sea-deep">Tu situación</p>
            <p className="text-lg text-ink">«{pack.description}»</p>
            <p className="text-sm text-ink-muted">
              {REGISTER[pack.register]} · {answers === 1 ? "1 respuesta" : `${answers} respuestas`}
            </p>
          </>
        }
        exit={<Button onClick={back}>Volver</Button>}
        onFinish={({ firstTry }) => setXp(awardPracticeXp(pack, firstTry))}
        summary={
          xp === null ? null : xp > 0 ? (
            <p className="mt-2 text-xl font-extrabold text-success-deep">+{xp} XP</p>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">Hoy ya has ganado XP con este diálogo. Mañana podrás ganar más.</p>
          )
        }
      />
    </>
  );
}
