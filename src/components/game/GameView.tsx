"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { EntryCard } from "@/components/coach/EntryCard";
import { SportEntryCard } from "@/components/sport/SportEntryCard";
import { useHideQuickFab } from "@/components/shell/QuickFab";
import { LessonLangContext } from "@/components/exercises/shared";
import { speak } from "@/lib/audio";
import { coachAvailable } from "@/lib/coach/available";
import { getPack, glossOf, type GlossLang } from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";
import { useScreenLang } from "@/lib/content/use-active-lang";
import type { LearnCopy } from "@/lib/i18n/learn-copy";
import { LearnCopyProvider, useLearnCopyFor } from "@/lib/i18n/use-learn-copy";
import { cn } from "@/lib/cn";
import { createRng } from "@/lib/exercises";
import {
  MIX,
  buildDeck,
  getTopicPool,
  listTopics,
  parseGameState,
  readGameRaw,
  subscribeGame,
  type GameCard,
  type Topic,
  type TopicPool,
} from "@/lib/game";
import { Discover } from "./Discover";
import { Round } from "./Round";

type Stage = { step: "topics" } | { step: "discover" | "round"; pool: TopicPool; deck: GameCard[] };

const empty = () => "";

/** "12 frases · 4 palabras": phrase and pictured-word counts of a topic (non-zero ones only). */
function countLabel(topic: Topic, copy: LearnCopy): string {
  return copy.topicCount(topic.phrases.length, topic.words.length);
}

/** /jugar: topic grid → discovery cards → 60-second round. */
export function GameView() {
  const lang = useScreenLang();
  return lang ? <Game key={lang} lang={lang} /> : null;
}

function Game({ lang }: { lang: string }) {
  const pack = getPack(lang);
  const topics = useMemo(() => listTopics(pack), [pack]);
  const copy = useLearnCopyFor(lang);
  const mixDetail = useMemo(() => {
    const mix = getTopicPool(MIX, pack)?.topic;
    return mix ? countLabel(mix, copy) : "";
  }, [pack, copy]);
  const raw = useSyncExternalStore(subscribeGame, () => readGameRaw(lang), empty);
  const game = useMemo(() => parseGameState(raw), [raw]);
  const [stage, setStage] = useState<Stage>({ step: "topics" });
  const gloss = useGlossLang(lang);
  // Discovery cards and the round have their own bottom controls: no ⚡ button over them.
  useHideQuickFab(stage.step !== "topics");

  const go = (next: Stage) => {
    setStage(next);
    window.scrollTo(0, 0);
  };

  const open = (id: string) => {
    const pool = getTopicPool(id, pack);
    if (!pool) return;
    const deck = buildDeck(pool.topic, new Set(game.known), createRng(`${id}:${Date.now()}`));
    if (!deck.length) return;
    // Called from the tap: the first card plays at once (iOS needs the gesture).
    speak(deck[0], { lang });
    go({ step: "discover", pool, deck });
  };

  const toTopics = () => go({ step: "topics" });

  return (
    <LessonLangContext.Provider value={lang}>
    <LearnCopyProvider lang={lang}>
      {stage.step === "discover" ? (
        <Discover
          key={stage.pool.topic.id}
          lang={lang}
          topic={stage.pool.topic}
          deck={stage.deck}
          onDone={() => go({ ...stage, step: "round" })}
          onExit={toTopics}
        />
      ) : stage.step === "round" ? (
        <Round lang={lang} pool={stage.pool} deck={stage.deck} record={game.records[stage.pool.topic.id] ?? 0} onExit={toTopics} />
      ) : (
        <TopicGrid
          topics={topics}
          mixDetail={mixDetail}
          records={game.records}
          onOpen={open}
          gloss={gloss.lang}
          glossTag={gloss.tag}
          coach={coachAvailable(lang)}
          copy={copy}
        />
      )}
    </LearnCopyProvider>
    </LessonLangContext.Provider>
  );
}

function TopicGrid({
  topics,
  mixDetail,
  records,
  onOpen,
  gloss,
  glossTag,
  coach,
  copy,
}: {
  topics: Topic[];
  mixDetail: string;
  records: Record<string, number>;
  onOpen: (id: string) => void;
  /** The learner's gloss language (topic titles) and its `lang` attribute. */
  gloss: GlossLang;
  glossTag: string | undefined;
  /** Prepárate is offered for this pack (`coachAvailable`). */
  coach: boolean;
  copy: LearnCopy;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      {coach ? <EntryCard /> : null}
      {coach ? <SportEntryCard /> : null}
      <p className="text-base text-ink-muted">
        {copy.pickTopic}
      </p>
      <TopicButton
        tone="terracotta"
        emoji="🎲"
        title={copy.mix}
        detail={copy.allTopics(mixDetail)}
        record={records[MIX]}
        copy={copy}
        onClick={() => onOpen(MIX)}
        wide
      />
      <ul className="grid grid-cols-2 gap-3">
        {topics.map((t) => (
          <li key={t.id} className="flex">
            <TopicButton
              emoji={t.emoji}
              title={glossOf(t.title, gloss)}
              titleLang={glossTag}
              detail={countLabel(t, copy)}
              record={records[t.id]}
              copy={copy}
              onClick={() => onOpen(t.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopicButton({
  emoji,
  title,
  titleLang,
  detail,
  record,
  onClick,
  tone = "default",
  wide = false,
  copy,
}: {
  emoji?: string;
  title: string;
  /** `lang` of the title when it is a gloss in another language than Spanish. */
  titleLang?: string;
  detail: string;
  record?: number;
  onClick: () => void;
  tone?: "default" | "terracotta";
  wide?: boolean;
  copy: LearnCopy;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable flex w-full flex-col gap-1 rounded-card border-2 p-4 text-left",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
        tone === "terracotta"
          ? "border-terracotta bg-terracotta-soft [--ledge:var(--terracotta-ledge)]"
          : "border-line bg-surface [--ledge:var(--line)]",
        wide && "flex-row items-center gap-4",
      )}
    >
      {emoji ? (
        <span aria-hidden="true" className={cn(wide ? "text-4xl" : "text-3xl")}>
          {emoji}
        </span>
      ) : null}
      <span className="flex flex-col gap-0.5">
        <span lang={titleLang} className="text-lg font-extrabold leading-tight text-ink">
          {title}
        </span>
        <span className="text-sm text-ink-muted">{detail}</span>
        <span className={cn("text-sm font-bold", record ? "text-terracotta-deep" : "text-ink-muted")}>
          {record ? copy.record(record) : copy.noRecord}
        </span>
      </span>
    </button>
  );
}
