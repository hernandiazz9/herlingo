"use client";

import Link from "next/link";
import { getPack } from "@/lib/content";
import { useScreenLang } from "@/lib/content/use-active-lang";

/** Every dialogue of the active pack, grouped by situation (pack order). */
export function DialogueList() {
  const lang = useScreenLang();
  return lang ? <PackDialogues lang={lang} /> : null;
}

function PackDialogues({ lang }: { lang: string }) {
  const pack = getPack(lang);
  const groups = pack.meta.situations
    .map((situation) => ({ situation, dialogues: pack.dialogues.filter((d) => d.situation === situation.id) }))
    .filter((g) => g.dialogues.length > 0);

  if (groups.length === 0) {
    return <p className="text-ink-muted">Todavía no hay diálogos.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ situation, dialogues }) => (
        <section key={situation.id} className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-ink">
            {situation.emoji ? <span aria-hidden="true">{situation.emoji} </span> : null}
            {situation.title}
          </h2>
          <ul className="flex flex-col gap-2">
            {dialogues.map((d) => {
              const answers = d.turns.filter((t) => t.speaker === "learner").length;
              return (
                <li key={d.id}>
                  <Link
                    href={`/dialogos/${encodeURIComponent(d.id)}`}
                    className="pressable flex flex-col gap-1 rounded-card border-2 border-line bg-surface p-4 [--ledge:var(--line)]"
                  >
                    <span className="text-lg font-bold text-ink">{d.title}</span>
                    {d.description ? <span className="text-ink-muted">{d.description}</span> : null}
                    <span className="text-sm font-bold text-sea-deep">
                      {answers === 1 ? "1 respuesta" : `${answers} respuestas`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
