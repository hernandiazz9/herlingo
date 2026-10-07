"use client";

import Link from "next/link";
import { useState } from "react";
import { ALL_LEVELS, LevelChips, type LevelFilter } from "@/components/level/LevelChips";
import { ProgressBar, TargetText } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getPack, getSituation, getStories } from "@/lib/content";
import { useLevel } from "@/lib/content/level-hook";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { storyHref, useStoriesDone } from "@/lib/stories";

/**
 * Every story in trip order, with its situation and whether it is done on this device. A pack with
 * levels shows the learner's level first, with level chips and "Todos" (a view filter only).
 */
export function StoryList() {
  const lang = useScreenLang();
  return lang ? <PackStories key={lang} lang={lang} /> : null;
}

function PackStories({ lang }: { lang: string }) {
  const pack = getPack(lang);
  const all = getStories(pack);
  const { levels, level } = useLevel(lang);
  const [filter, setFilter] = useState<LevelFilter>(level ?? ALL_LEVELS);
  const stories = levels.length && filter !== ALL_LEVELS ? all.filter((s) => s.level === filter) : all;
  const done = useStoriesDone(pack.meta.lang);
  const count = stories.filter((s) => s.id in done).length;

  const chips = levels.length ? (
    <LevelChips levels={levels} value={filter} onChange={setFilter} label="Filtrar por nivel" allLabel="Todos" />
  ) : null;

  if (stories.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {chips}
        <p className="text-ink-muted">{all.length ? "Todavía no hay historias de este nivel." : "Todavía no hay historias."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {chips}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-ink-muted">
          {count} de {stories.length} {stories.length === 1 ? "historia leída" : "historias leídas"}
        </p>
        <ProgressBar label="Historias leídas" value={count} max={stories.length} tone="sea" />
      </div>
      <ol className="flex flex-col gap-3">
        {stories.map((story, i) => {
          const isDone = story.id in done;
          const situation = getSituation(story.situation, pack);
          return (
            <li key={story.id}>
              <Link
                href={storyHref(story.id)}
                className={cn(
                  "pressable flex items-start gap-3 rounded-card border-2 p-4",
                  isDone ? "border-success/40 bg-success-soft [--ledge:var(--success)]" : "border-line bg-surface [--ledge:var(--line)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-full text-2xl",
                    isDone ? "bg-success text-on-accent" : "bg-sea-soft",
                  )}
                >
                  {isDone ? "✓" : (story.emoji ?? i + 1)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span lang={pack.meta.lang} className="text-lg font-bold leading-tight text-ink">
                    <TargetText text={story.title} lang={pack.meta.lang} />
                  </span>
                  <span className="text-ink-muted">{story.titleEs}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold">
                    {situation ? (
                      <span className="text-sea-deep">
                        {situation.emoji ? <span aria-hidden="true">{situation.emoji} </span> : null}
                        {situation.title}
                      </span>
                    ) : null}
                    <span className="text-ink-muted">{story.level}</span>
                    {isDone ? <span className="text-success-deep">Leída</span> : null}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
