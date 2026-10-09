"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon, MiniPlay, useLessonGloss, useLessonLang } from "@/components/exercises";
import { Card, TargetText } from "@/components/ui";
import { glossOf, type Expression, type GlossText, type GrammarCard } from "@/lib/content";

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
  const gloss = useLessonGloss();
  const g = (v: GlossText) => glossOf(v, gloss.lang);
  /** A map cell is a gloss; a plain one is shown as written. */
  const cellLang = (c: unknown) => (typeof c === "string" ? undefined : gloss.tag);
  const [header, ...rows] = card.table ?? [];
  return (
    <Card className="flex flex-col gap-3">
      <h2 lang={gloss.tag} className="text-xl font-extrabold text-ink">
        {g(card.title)}
      </h2>
      <p lang={gloss.tag} className="text-base text-ink">
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
        <div className="overflow-x-auto rounded-button border-2 border-line">
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
        </div>
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
    </Card>
  );
}

export function ExpressionView({ item }: { item: Expression }) {
  const lang = useLessonLang();
  const gloss = useLessonGloss();
  return (
    <Card className="flex items-start gap-3 p-4">
      <MiniPlay audio={item} />
      <div className="flex flex-col gap-0.5">
        <p lang={lang} className="text-lg font-bold text-ink">
          <TargetText text={item.text} lang={lang} />
        </p>
        <p lang={gloss.tag} className="text-base text-ink">
          {glossOf(item, gloss.lang)}
        </p>
        {item.standard ? (
          <p className="text-sm text-ink-muted">
            Estándar: <span lang={lang}>{item.standard}</span>
          </p>
        ) : null}
        {item.notes ? (
          <p lang={gloss.tag} className="text-sm text-ink-muted">
            {glossOf(item.notes, gloss.lang)}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
