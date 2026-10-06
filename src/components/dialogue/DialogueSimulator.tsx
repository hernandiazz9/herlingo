"use client";

import Link from "next/link";
import { useState } from "react";
import { getDialogue, getPack, getSituation } from "@/lib/content";
import { dialogueXp } from "@/lib/exercises";
import { countPlay, recordActivity, repeatXp } from "@/lib/progress/activity";
import { DialoguePlayer } from "./DialoguePlayer";

/** "Trato de tú", or "Trato de usted (Lei)" / "(Vous)" for the pack's formal register; neutral = none. */
function registerLabel(register: string): string {
  if (register === "tu") return "Trato de tú";
  if (register === "neutral") return "";
  return `Trato de usted (${register.charAt(0).toUpperCase()}${register.slice(1)})`;
}

/** Plays a scripted dialogue of the content pack (see `DialoguePlayer`); every finish earns XP (half on repeats today). */
export function DialogueSimulator({ id, lang }: { id: string; lang: string }) {
  const pack = getPack(lang);
  const dialogue = getDialogue(id, pack);
  const [xp, setXp] = useState<{ earned: number; repeat: boolean } | null>(null);

  if (!dialogue) return <p className="text-ink-muted">No se ha encontrado este diálogo.</p>;

  const situation = getSituation(dialogue.situation, pack);
  const answers = dialogue.turns.filter((t) => t.speaker === "learner").length;

  return (
    <DialoguePlayer
      dialogue={dialogue}
      lang={lang}
      onFinish={({ firstTry, total }) => {
        const before = countPlay(pack.meta.lang, `dialogue:${dialogue.id}`);
        const earned = repeatXp(dialogueXp(firstTry, total), before);
        recordActivity({ lang: pack.meta.lang, xp: earned, outcomes: [], source: "dialogue" });
        setXp({ earned, repeat: before > 0 });
      }}
      summary={
        xp === null ? null : (
          <>
            <p className="mt-2 text-xl font-extrabold text-success-deep">+{xp.earned} XP</p>
            {xp.repeat ? <p className="text-sm text-ink-muted">Ya lo habías hecho hoy: la mitad de XP.</p> : null}
          </>
        )
      }
      intro={
        <>
          {situation ? (
            <p className="text-sm font-bold text-sea-deep">
              {situation.emoji ? `${situation.emoji} ` : ""}
              {situation.title}
            </p>
          ) : null}
          {dialogue.description ? <p className="text-lg text-ink">{dialogue.description}</p> : null}
          <p className="text-sm text-ink-muted">
            {[registerLabel(dialogue.register), `${answers} respuestas`].filter(Boolean).join(" · ")}
          </p>
        </>
      }
      exit={
        <Link
          href="/dialogos/"
          className="pressable inline-flex min-h-14 items-center justify-center rounded-button bg-sea px-4 text-lg font-bold text-on-accent [--ledge:var(--sea-ledge)]"
        >
          Otros diálogos
        </Link>
      }
    />
  );
}
