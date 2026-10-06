"use client";

import Link from "next/link";
import { getDialogue, getPack, getSituation } from "@/lib/content";
import { DialoguePlayer } from "./DialoguePlayer";

/** "Trato de tú", or "Trato de usted (Lei)" / "(Vous)" for the pack's formal register; neutral = none. */
function registerLabel(register: string): string {
  if (register === "tu") return "Trato de tú";
  if (register === "neutral") return "";
  return `Trato de usted (${register.charAt(0).toUpperCase()}${register.slice(1)})`;
}

/** Plays a scripted dialogue of the content pack (see `DialoguePlayer`). */
export function DialogueSimulator({ id, lang }: { id: string; lang: string }) {
  const pack = getPack(lang);
  const dialogue = getDialogue(id, pack);

  if (!dialogue) return <p className="text-ink-muted">No se ha encontrado este diálogo.</p>;

  const situation = getSituation(dialogue.situation, pack);
  const answers = dialogue.turns.filter((t) => t.speaker === "learner").length;

  return (
    <DialoguePlayer
      dialogue={dialogue}
      lang={lang}
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
