"use client";

import Link from "next/link";
import { useState } from "react";
import { getDialogue, getPack, getSituation, glossOf } from "@/lib/content";
import { registerLabel } from "@/lib/content/register";
import { useGlossLang } from "@/lib/content/use-gloss";
import { LearnCopyProvider, useLearnCopyFor } from "@/lib/i18n/use-learn-copy";
import { dialogueXp } from "@/lib/exercises";
import { countPlay, recordActivity, repeatXp } from "@/lib/progress/activity";
import { DialoguePlayer } from "./DialoguePlayer";

/** Plays a scripted dialogue of the content pack (see `DialoguePlayer`); every finish earns XP (half on repeats today). */
export function DialogueSimulator({ id, lang }: { id: string; lang: string }) {
  const pack = getPack(lang);
  const dialogue = getDialogue(id, pack);
  const [xp, setXp] = useState<{ earned: number; repeat: boolean } | null>(null);
  const gloss = useGlossLang(lang);
  const copy = useLearnCopyFor(lang);

  if (!dialogue) return <p className="text-ink-muted">{copy.dialogueNotFound}</p>;

  const situation = getSituation(dialogue.situation, pack);
  const answers = dialogue.turns.filter((t) => t.speaker === "learner").length;

  return (
    <LearnCopyProvider lang={lang}>
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
            {xp.repeat ? <p className="text-sm text-ink-muted">{copy.halfXp}</p> : null}
          </>
        )
      }
      intro={
        <>
          {situation ? (
            <p className="text-sm font-bold text-sea-deep">
              {situation.emoji ? `${situation.emoji} ` : ""}
              <span lang={gloss.tag}>{glossOf(situation.title, gloss.lang)}</span>
            </p>
          ) : null}
          {dialogue.description ? (
            <p lang={gloss.tag} className="text-lg text-ink">
              {glossOf(dialogue.description, gloss.lang)}
            </p>
          ) : null}
          <p className="text-sm text-ink-muted">
            {[registerLabel(dialogue.register, pack.meta.formalRegister), copy.answersCount(answers)].filter(Boolean).join(" · ")}
          </p>
        </>
      }
      exit={
        <Link
          href="/dialogos/"
          className="pressable inline-flex min-h-14 items-center justify-center rounded-button bg-sea px-4 text-lg font-bold text-on-accent [--ledge:var(--sea-ledge)]"
        >
          {copy.otherDialogues}
        </Link>
      }
    />
    </LearnCopyProvider>
  );
}
