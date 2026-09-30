"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { LessonLangContext } from "@/components/exercises/shared";
import { speak } from "@/lib/audio";
import { DEFAULT_LANG, getPack, type Phrase } from "@/lib/content";
import { cn } from "@/lib/cn";
import { createRng } from "@/lib/exercises";
import { MIX, buildDeck, getTopicPool, listTopics, parseGameState, readGameRaw, subscribeGame, type Topic, type TopicPool } from "@/lib/game";
import { Discover } from "./Discover";
import { Round } from "./Round";

type Stage = { step: "topics" } | { step: "discover" | "round"; pool: TopicPool; deck: Phrase[] };

const empty = () => "";

/** /jugar: topic grid → discovery cards → 60-second round. */
export function GameView({ lang = DEFAULT_LANG }: { lang?: string }) {
  const pack = getPack(lang);
  const topics = useMemo(() => listTopics(pack), [pack]);
  const mixCount = useMemo(() => getTopicPool(MIX, pack)?.topic.phrases.length ?? 0, [pack]);
  const raw = useSyncExternalStore(subscribeGame, () => readGameRaw(lang), empty);
  const game = useMemo(() => parseGameState(raw), [raw]);
  const [stage, setStage] = useState<Stage>({ step: "topics" });

  const go = (next: Stage) => {
    setStage(next);
    window.scrollTo(0, 0);
  };

  const open = (id: string) => {
    const pool = getTopicPool(id, pack);
    if (!pool || !pool.topic.phrases.length) return;
    const deck = buildDeck(pool.topic.phrases, new Set(game.known), createRng(`${id}:${Date.now()}`));
    // Called from the tap: the first card plays at once (iOS needs the gesture).
    speak(deck[0], { lang });
    go({ step: "discover", pool, deck });
  };

  const toTopics = () => go({ step: "topics" });

  return (
    <LessonLangContext.Provider value={lang}>
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
        <TopicGrid topics={topics} mixCount={mixCount} records={game.records} onOpen={open} />
      )}
    </LessonLangContext.Provider>
  );
}

function TopicGrid({
  topics,
  mixCount,
  records,
  onOpen,
}: {
  topics: Topic[];
  mixCount: number;
  records: Record<string, number>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <p className="text-base text-ink-muted">
        Elige un tema: descubre sus frases con audio y luego juega una ronda de 60 segundos.
      </p>
      <TopicButton
        tone="terracotta"
        emoji="🎲"
        title="Mezcla"
        detail={`Todos los temas · ${mixCount} frases`}
        record={records[MIX]}
        onClick={() => onOpen(MIX)}
        wide
      />
      <ul className="grid grid-cols-2 gap-3">
        {topics.map((t) => (
          <li key={t.id} className="flex">
            <TopicButton
              emoji={t.emoji}
              title={t.title}
              detail={`${t.phrases.length} ${t.phrases.length === 1 ? "frase" : "frases"}`}
              record={records[t.id]}
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
  detail,
  record,
  onClick,
  tone = "default",
  wide = false,
}: {
  emoji?: string;
  title: string;
  detail: string;
  record?: number;
  onClick: () => void;
  tone?: "default" | "terracotta";
  wide?: boolean;
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
        <span className="text-lg font-extrabold leading-tight text-ink">{title}</span>
        <span className="text-sm text-ink-muted">{detail}</span>
        <span className={cn("text-sm font-bold", record ? "text-terracotta-deep" : "text-ink-muted")}>
          {record ? `Récord: ${record}` : "Sin récord"}
        </span>
      </span>
    </button>
  );
}
