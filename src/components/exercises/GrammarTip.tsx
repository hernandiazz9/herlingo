"use client";

import { GrammarCardBody } from "@/components/grammar/GrammarCardBody";
import { Button } from "@/components/ui";
import type { GrammarCard } from "@/lib/content";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";

/** Ungraded grammar card shown inside a lesson. */
export function GrammarTip({ card, onContinue }: { card: GrammarCard; onContinue: () => void }) {
  const copy = useLearnCopy();
  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">{copy.grammarKicker}</p>
      <GrammarCardBody card={card} />
      <div className="mt-auto pt-2">
        <Button fullWidth onClick={onContinue}>
          {copy.gotIt}
        </Button>
      </div>
    </div>
  );
}
