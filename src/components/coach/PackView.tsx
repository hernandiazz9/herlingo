"use client";

import { useEffect, type ReactNode } from "react";
import { SpeakerIcon } from "@/components/icons";
import { SlowIcon } from "@/components/phrasebook/icons";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, TargetText } from "@/components/ui";
import { speak, stop } from "@/lib/audio";
import { packLine, type CoachKeyPhrase, type CoachPack } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { recordListen } from "@/lib/progress/activity";
import { PracticeDialogue } from "./PracticeDialogue";
import { RefineCard } from "./RefineCard";
import { FOCUS } from "./shared";

const REGISTER: Record<CoachPack["register"], string> = { formal: "Trato de usted", informal: "Trato de tú" };

export interface PackViewProps {
  pack: CoachPack;
  /** A message about this pack (saved, new version…), shown under the title. */
  notice?: ReactNode;
  onBack: () => void;
  onRefined: (pack: CoachPack, saved: boolean) => void;
}

/** A preparation pack: guide, key phrases with audio, the dialogue slot and "Ajustar". */
export function PackView({ pack, notice, onBack, onRefined }: PackViewProps) {
  useEffect(() => () => stop(), []);

  return (
    <>
      <button type="button" onClick={onBack} className={cn("self-start text-sm font-bold text-sea", FOCUS)}>
        ← Prepárate
      </button>
      <PageHeader title={pack.title} subtitle={`«${pack.description}»`} />
      <p className="-mt-3 flex flex-wrap gap-2 text-sm font-bold">
        <span className="rounded-full bg-lemon-soft px-3 py-1 text-ink">{REGISTER[pack.register]}</span>
        <span className="rounded-full bg-sand px-3 py-1 text-ink-muted">{pack.keyPhrases.length} frases clave</span>
      </p>
      {notice}

      <section aria-labelledby="guide-title" className="flex flex-col gap-3">
        <h2 id="guide-title" className="text-xl font-extrabold text-ink">
          Paso a paso
        </h2>
        <Card className="p-4">
          <ol className="flex flex-col gap-3">
            {pack.guide.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lemon text-base font-extrabold text-on-lemon"
                >
                  {i + 1}
                </span>
                <p className="pt-1 text-base text-ink">{step.es}</p>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section aria-labelledby="phrases-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="phrases-title" className="text-xl font-extrabold text-ink">
            Frases clave
          </h2>
          <p className="text-sm text-ink-muted">Toca una frase para oírla; el caracol la dice más despacio.</p>
        </div>
        <ul className="flex flex-col gap-2">
          {pack.keyPhrases.map((phrase, i) => (
            <KeyPhraseRow key={i} pack={pack} phrase={phrase} />
          ))}
        </ul>
      </section>

      <PracticeDialogue pack={pack} />
      <RefineCard key={pack.id} pack={pack} onRefined={onRefined} />
    </>
  );
}

function KeyPhraseRow({ pack, phrase }: { pack: CoachPack; phrase: CoachKeyPhrase }) {
  const line = packLine(pack, phrase.text);
  return (
    <li className="flex items-start gap-1 rounded-card border-2 border-line bg-surface p-2 pl-4">
      <button
        type="button"
        onClick={() => {
          speak(line, { lang: pack.lang });
          recordListen(line.audioKey, pack.lang);
        }}
        className={cn("flex min-h-12 flex-1 items-start gap-3 py-1.5 text-left", FOCUS)}
      >
        <span className="flex-1">
          <span lang={pack.lang} className="block text-lg font-bold leading-snug text-ink">
            <TargetText text={phrase.text} lang={pack.lang} />
          </span>
          <span className="block text-base text-ink-muted">{phrase.es}</span>
          {phrase.note ? <span className="mt-1 block text-sm text-sea-deep">{phrase.note}</span> : null}
        </span>
        <SpeakerIcon className="mt-1 shrink-0 text-sea" width={22} height={22} />
      </button>
      <button
        type="button"
        onClick={() => {
          speak(line, { lang: pack.lang, slow: true });
          recordListen(line.audioKey, pack.lang);
        }}
        aria-label="Escuchar despacio"
        title="Escuchar despacio"
        className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-full text-sea", FOCUS)}
      >
        <SlowIcon width={22} height={22} />
      </button>
    </li>
  );
}
