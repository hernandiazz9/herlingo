"use client";

import { Button } from "@/components/ui";
import type { CoachPack } from "@/lib/coach";

/**
 * "Practicar el diálogo" slot of the pack view: the role-play of `pack.dialogue` goes here
 * (plan 005 T47: the dialogue simulator with generated audio and XP). Until then it only
 * describes the dialogue.
 */
export function PracticeDialogue({ pack }: { pack: CoachPack }) {
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
      <Button fullWidth disabled>
        Practicar el diálogo
      </Button>
      <p className="text-sm text-ink-muted">Muy pronto podrás practicarlo aquí, con audio.</p>
    </section>
  );
}
