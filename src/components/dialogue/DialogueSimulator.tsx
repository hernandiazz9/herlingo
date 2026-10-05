"use client";

import Link from "next/link";
import { useState } from "react";
import { getDialogue, getPack, getSituation } from "@/lib/content";
import { dialogueXp } from "@/lib/exercises";
import { recordActivity } from "@/lib/progress/activity";
import { DialoguePlayer } from "./DialoguePlayer";

const REGISTER: Record<string, string> = { lei: "Trato de usted (Lei)", tu: "Trato de tú", neutral: "" };

/** Plays a scripted dialogue of the content pack (see `DialoguePlayer`); every finish earns XP. */
export function DialogueSimulator({ id, lang }: { id: string; lang?: string }) {
  const pack = getPack(lang);
  const dialogue = getDialogue(id, pack);
  const [xp, setXp] = useState<number | null>(null);

  if (!dialogue) return <p className="text-ink-muted">No se ha encontrado este diálogo.</p>;

  const situation = getSituation(dialogue.situation, pack);
  const answers = dialogue.turns.filter((t) => t.speaker === "learner").length;

  return (
    <DialoguePlayer
      dialogue={dialogue}
      lang={lang}
      onFinish={({ firstTry }) => {
        const earned = dialogueXp(firstTry);
        recordActivity({ lang: pack.meta.lang, xp: earned, outcomes: [], source: "dialogue" });
        setXp(earned);
      }}
      summary={xp === null ? null : <p className="mt-2 text-xl font-extrabold text-success-deep">+{xp} XP</p>}
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
            {[REGISTER[dialogue.register], `${answers} respuestas`].filter(Boolean).join(" · ")}
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
