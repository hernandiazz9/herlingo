"use client";

import { Card, TargetText } from "@/components/ui";
import { MiniPlay, useLessonGloss, useLessonLang } from "@/components/exercises/shared";
import { glossOf, type GlossText, type GrammarCard } from "@/lib/content";

/**
 * A grammar card's content (title, summary, points, table, examples with audio), as a fragment for
 * a flex column. Shared by the lesson tip (`GrammarTip`) and the Gramática topic page, which shows
 * the title in its page header (`heading={false}`). Language and gloss from the enclosing session
 * (`LessonLangContext`), else the screen's.
 */
export function GrammarCardBody({ card, heading = true }: { card: GrammarCard; heading?: boolean }) {
  const lang = useLessonLang();
  const gloss = useLessonGloss();
  const g = (v: GlossText) => glossOf(v, gloss.lang);
  /** A map cell is a gloss; a plain one is shown as written. */
  const cellLang = (c: unknown) => (typeof c === "string" ? undefined : gloss.tag);
  const [header, ...rows] = card.table ?? [];
  return (
    <>
      {heading ? (
        <h2 lang={gloss.tag} className="text-2xl font-extrabold tracking-tight text-ink">
          {g(card.title)}
        </h2>
      ) : null}
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
    </>
  );
}
