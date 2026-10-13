"use client";

import Link from "next/link";
import { TargetText } from "@/components/ui";
import { getPack, glossOf, listGrammarTopics, listVerbs } from "@/lib/content";
import { useLevel } from "@/lib/content/level-hook";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useGlossLang } from "@/lib/content/use-gloss";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import { GrammarScreen, grammarHref } from "./GrammarScreen";

/**
 * `/gramatica/`: the active language's verbs (a grid of tiles in `order`) and topics (its grammar
 * cards minus the ones a verb covers; a levelled pack shows the learner's level, as the Ruta does).
 */
export function GrammarIndex() {
  const lang = useScreenLang();
  return lang ? (
    <GrammarScreen key={lang} lang={lang}>
      <PackGrammar lang={lang} />
    </GrammarScreen>
  ) : null;
}

function PackGrammar({ lang }: { lang: string }) {
  const pack = getPack(lang);
  const gloss = useGlossLang(lang);
  const copy = useLearnCopy();
  const { level } = useLevel(lang);
  const verbs = listVerbs(pack);
  const topics = listGrammarTopics(pack, level);

  if (verbs.length === 0 && topics.length === 0) {
    return <p className="text-ink-muted">{copy.grammarEmpty}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {verbs.length ? (
        <section aria-labelledby="grammar-verbs" className="flex flex-col gap-3">
          <h2 id="grammar-verbs" className="text-xl font-extrabold text-ink">
            {copy.grammarVerbs}
          </h2>
          <ul className="grid grid-cols-2 gap-3">
            {verbs.map((verb) => (
              <li key={verb.id} className="flex">
                <Link
                  href={grammarHref(verb.id)}
                  className="pressable flex min-h-28 flex-1 flex-col gap-1 rounded-card border-2 border-line bg-surface p-4 [--ledge:var(--line)]"
                >
                  <span lang={lang} className="text-2xl font-extrabold leading-tight break-words text-ink">
                    <TargetText text={verb.infinitive} lang={lang} />
                  </span>
                  <span lang={gloss.tag} className="text-sm leading-snug text-ink-muted">
                    {glossOf(verb, gloss.lang)}
                  </span>
                  {verb.irregular ? (
                    <span className="mt-auto self-start rounded-full bg-terracotta-soft px-2.5 py-0.5 text-xs font-bold text-terracotta-deep">
                      {copy.grammarIrregular}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topics.length ? (
        <section aria-labelledby="grammar-topics" className="flex flex-col gap-3">
          <h2 id="grammar-topics" className="text-xl font-extrabold text-ink">
            {copy.grammarTopics}
          </h2>
          <ul className="flex flex-col gap-2">
            {topics.map((card) => (
              <li key={card.id}>
                <Link
                  href={grammarHref(card.id)}
                  className="pressable flex items-center gap-3 rounded-card border-2 border-line bg-surface p-4 [--ledge:var(--line)]"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span lang={gloss.tag} className="text-lg font-bold leading-tight text-ink">
                      {glossOf(card.title, gloss.lang)}
                    </span>
                    <span lang={gloss.tag} className="line-clamp-2 text-sm text-ink-muted">
                      {glossOf(card.summary, gloss.lang)}
                    </span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-2xl text-ink-muted">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
