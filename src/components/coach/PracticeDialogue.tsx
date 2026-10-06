"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import type { CoachPack } from "@/lib/coach";
import { useSavedPacks } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { notePracticeOpened, practiceHref } from "./practice-nav";
import { FOCUS } from "./shared";

/**
 * "Practicar el diálogo" in the pack view: opens the role-play page. It reads the pack from the
 * device, so a version that could not be saved cannot be practised.
 */
export function PracticeDialogue({ pack }: { pack: CoachPack }) {
  const saved = useSavedPacks(pack.lang).get(pack.id);
  const turns = pack.dialogue.turns;
  const answers = turns.filter((t) => t.speaker === "learner").length;
  return (
    <section aria-labelledby="practice-title" className="flex flex-col gap-3 rounded-card border-2 border-sea/30 bg-sea-soft p-5">
      <div className="flex flex-col gap-1">
        <h2 id="practice-title" className="text-xl font-extrabold text-ink">
          Practica el diálogo
        </h2>
        <p className="text-lg text-ink">{pack.dialogue.title}</p>
        <p className="text-sm text-ink-muted">
          {turns.length} turnos · {answers === 1 ? "1 respuesta tuya" : `${answers} respuestas tuyas`}
        </p>
      </div>
      {saved?.createdAt === pack.createdAt ? (
        <>
          <Link
            href={practiceHref(pack.id)}
            onClick={notePracticeOpened}
            className={cn(
              "pressable inline-flex min-h-14 w-full items-center justify-center rounded-button bg-sea px-6 text-lg font-bold tracking-wide text-on-accent [--ledge:var(--sea-ledge)]",
              FOCUS,
            )}
          >
            Practicar el diálogo
          </Link>
          <p className="text-sm text-ink-muted">Escucha, responde y gana XP al terminar (si lo repites hoy, la mitad).</p>
        </>
      ) : (
        <>
          <Button fullWidth disabled>
            Practicar el diálogo
          </Button>
          <p className="text-sm text-ink-muted">
            No he podido guardar esta versión en el móvil, así que no puedes practicar su diálogo.
          </p>
        </>
      )}
    </section>
  );
}
