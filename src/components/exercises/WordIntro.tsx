"use client";

import { Button, Picture } from "@/components/ui";
import type { Vocab } from "@/lib/content";
import { PlayControls, useLessonLang } from "./shared";

/**
 * Ungraded new-word card (first time a vocab word appears): picture when it has one, the word
 * with audio, its Spanish meaning, "Continuar". The audio auto-plays from the tap that showed it
 * (the lesson player does it).
 */
export function WordIntro({ item, onContinue }: { item: Vocab; onContinue: () => void }) {
  const lang = useLessonLang();
  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">Palabra nueva</p>
      <div className="flex flex-col items-center gap-5 pt-2 text-center">
        {item.image ? <Picture image={item.image} alt="" size="intro" /> : null}
        <div className="flex flex-col gap-1">
          <p lang={lang} className="text-4xl font-extrabold tracking-tight text-sea-deep">
            {item.text}
          </p>
          <p className="text-xl text-ink">{item.es}</p>
        </div>
        <PlayControls audio={item} size="md" />
        {item.notes ? <p className="text-base text-ink-muted">{item.notes}</p> : null}
      </div>
      <div className="mt-auto pt-2">
        <Button fullWidth onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
