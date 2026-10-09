"use client";

import { Button, Card, TargetText } from "@/components/ui";
import { glossOf, type GlossText, type GrammarCard } from "@/lib/content";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import { MiniPlay, useLessonGloss, useLessonLang } from "./shared";

/** Ungraded grammar card shown inside a lesson. */
export function GrammarTip({ card, onContinue }: { card: GrammarCard; onContinue: () => void }) {
  const lang = useLessonLang();
  const gloss = useLessonGloss();
  const copy = useLearnCopy();
  const g = (v: GlossText) => glossOf(v, gloss.lang);
  /** A map cell is a gloss; a plain one is shown as written. */
  const cellLang = (c: unknown) => (typeof c === "string" ? undefined : gloss.tag);
  const [header, ...rows] = card.table ?? [];
  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">{copy.grammarKicker}</p>
      <h2 lang={gloss.tag} className="text-2xl font-extrabold tracking-tight text-ink">
        {g(card.title)}
      </h2>
      <p lang={gloss.tag} className="text-lg text-ink">
        {g(card.summary)}
      </p>
      {card.points?.length ? (
        <ul lang={gloss.tag} className="flex list-disc flex-col gap-1 pl-5 text-base text-ink">
          {card.points.map((p, i) => (
            <li key={i}>{g(p)}</li>
          ))}
        </ul>
      ) : null}
      {header ? (
        <Card className="overflow-x-auto p-3">
          <table className="w-full text-left text-base">
            <thead>
              <tr>
                {header.map((h, i) => (
                  <th key={i} lang={cellLang(h)} className="px-2 py-1 font-bold text-sea-deep">
                    {g(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-line">
                  {row.map((c, i) => (
                    <td key={i} lang={typeof c === "string" ? (i > 0 ? lang : undefined) : gloss.tag} className="px-2 py-1 text-ink">
                      {i > 0 && typeof c === "string" ? <TargetText text={c} lang={lang} /> : g(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
      {card.examples.length ? (
        <ul className="flex flex-col gap-2">
          {card.examples.map((ex) => (
            <li key={ex.audioKey} className="flex items-center gap-3">
              <MiniPlay audio={ex} />
              <span>
                <TargetText text={ex.text} lang={lang}>
                  <span lang={lang} className="font-bold text-ink">
                    {ex.text}
                  </span>{" "}
                  <span className="text-ink-muted">
                    · <span lang={gloss.tag}>{glossOf(ex, gloss.lang)}</span>
                  </span>
                </TargetText>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto pt-2">
        <Button fullWidth onClick={onContinue}>
          {copy.gotIt}
        </Button>
      </div>
    </div>
  );
}
