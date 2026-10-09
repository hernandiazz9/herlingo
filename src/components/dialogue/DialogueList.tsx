"use client";

import Link from "next/link";
import { useState } from "react";
import { ALL_LEVELS, LevelChips, type LevelFilter } from "@/components/level/LevelChips";
import { getPack, glossOf } from "@/lib/content";
import { useLevel } from "@/lib/content/level-hook";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useGlossLang } from "@/lib/content/use-gloss";

/**
 * Every dialogue of the active pack, grouped by situation (pack order). A pack with levels shows
 * the learner's level first, with level chips and "Todos" (a view filter: the level is not changed).
 */
export function DialogueList() {
  const lang = useScreenLang();
  return lang ? <PackDialogues key={lang} lang={lang} /> : null;
}

function PackDialogues({ lang }: { lang: string }) {
  const pack = getPack(lang);
  const { levels, level } = useLevel(lang);
  const gloss = useGlossLang(lang);
  const [filter, setFilter] = useState<LevelFilter>(level ?? ALL_LEVELS);
  const shown = filter === ALL_LEVELS ? pack.dialogues : pack.dialogues.filter((d) => d.level === filter);
  const groups = pack.meta.situations
    .map((situation) => ({ situation, dialogues: shown.filter((d) => d.situation === situation.id) }))
    .filter((g) => g.dialogues.length > 0);

  const chips = levels.length ? (
    <LevelChips levels={levels} value={filter} onChange={setFilter} label="Filtrar por nivel" allLabel="Todos" />
  ) : null;

  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {chips}
        <p className="text-ink-muted">{pack.dialogues.length ? "Todavía no hay diálogos de este nivel." : "Todavía no hay diálogos."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {chips}
      {groups.map(({ situation, dialogues }) => (
        <section key={situation.id} className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-ink">
            {situation.emoji ? <span aria-hidden="true">{situation.emoji} </span> : null}
            <span lang={gloss.tag}>{glossOf(situation.title, gloss.lang)}</span>
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
                    <span lang={gloss.tag} className="text-lg font-bold text-ink">
                      {glossOf(d.title, gloss.lang)}
                    </span>
                    {d.description ? (
                      <span lang={gloss.tag} className="text-ink-muted">
                        {glossOf(d.description, gloss.lang)}
                      </span>
                    ) : null}
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
