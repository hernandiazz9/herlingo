"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon, MiniPlay, useLessonLang } from "@/components/exercises";
import { Card } from "@/components/ui";
import type { Expression, GrammarCard } from "@/lib/content";

/** Full-screen reference sheet over the path (grammar cards, local expressions). */
export function SideSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="side-sheet-title"
        className="flex w-full max-w-[var(--column-width)] flex-col bg-cream pt-[calc(var(--safe-top)+0.75rem)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      >
        <header className="flex items-center gap-3 px-4 py-2">
          <button
            type="button"
            aria-label="Cerrar"
            title="Cerrar"
            onClick={onClose}
            autoFocus
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
          >
            <CloseIcon className="size-7" />
          </button>
          <h1 id="side-sheet-title" className="text-2xl font-extrabold tracking-tight text-ink">
            {title}
          </h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pt-2 pb-[calc(var(--safe-bottom)+1.5rem)]">{children}</div>
      </div>
    </div>
  );
}

export function GrammarCardView({ card }: { card: GrammarCard }) {
  const lang = useLessonLang();
  const [header, ...rows] = card.table ?? [];
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xl font-extrabold text-ink">{card.title}</h2>
      <p className="text-base text-ink">{card.summary}</p>
      {card.points?.length ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-ink">
          {card.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      {header ? (
        <div className="overflow-x-auto rounded-button border-2 border-line">
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
        </div>
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
    </Card>
  );
}

export function ExpressionView({ item }: { item: Expression }) {
  const lang = useLessonLang();
  return (
    <Card className="flex items-start gap-3 p-4">
      <MiniPlay audio={item} />
      <div className="flex flex-col gap-0.5">
        <p lang={lang} className="text-lg font-bold text-ink">
          {item.text}
        </p>
        <p className="text-base text-ink">{item.es}</p>
        {item.standard ? (
          <p className="text-sm text-ink-muted">
            Estándar: <span lang={lang}>{item.standard}</span>
          </p>
        ) : null}
        {item.notes ? <p className="text-sm text-ink-muted">{item.notes}</p> : null}
      </div>
    </Card>
  );
}
