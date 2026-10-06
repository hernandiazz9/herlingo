"use client";

import { Button, Card } from "@/components/ui";
import type { GrammarCard } from "@/lib/content";
import { MiniPlay, useLessonLang } from "./shared";

/** Ungraded grammar card shown inside a lesson. */
export function GrammarTip({ card, onContinue }: { card: GrammarCard; onContinue: () => void }) {
  const lang = useLessonLang();
  const [header, ...rows] = card.table ?? [];
  return (
    <div className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">Un apunte</p>
      <h2 className="text-2xl font-extrabold tracking-tight text-ink">{card.title}</h2>
      <p className="text-lg text-ink">{card.summary}</p>
      {card.points?.length ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-ink">
          {card.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      {header ? (
        <Card className="overflow-x-auto p-3">
          <table className="w-full text-left text-base">
            <thead>
              <tr>
                {header.map((h, i) => (
                  <th key={i} className="px-2 py-1 font-bold text-sea-deep">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-line">
                  {row.map((c, i) => (
                    <td key={i} lang={i > 0 ? lang : undefined} className="px-2 py-1 text-ink">
                      {c}
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
                <span lang={lang} className="font-bold text-ink">
                  {ex.text}
                </span>{" "}
                <span className="text-ink-muted">· {ex.es}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto pt-2">
        <Button fullWidth onClick={onContinue}>
          Entendido
        </Button>
      </div>
    </div>
  );
}
