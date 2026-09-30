"use client";

import { useEffect, useState } from "react";
import { CloseIcon, PlayControls } from "@/components/exercises/shared";
import { Button, Card, IconButton, ProgressBar } from "@/components/ui";
import { speak, stop } from "@/lib/audio";
import type { Phrase } from "@/lib/content";
import { explain, markKnown, type Topic } from "@/lib/game";

/**
 * Discovery: one card per phrase of the deck. "La sé" marks it known; "Otra vez" sends it to the
 * end. Each new card plays on arrival (from the tap that brought it). Skippable to the round.
 */
export function Discover({
  lang,
  topic,
  deck,
  onDone,
  onExit,
}: {
  lang: string;
  topic: Topic;
  deck: Phrase[];
  onDone: () => void;
  onExit: () => void;
}) {
  const [queue, setQueue] = useState(deck);
  const [known, setKnown] = useState(0);
  const card = queue[0];

  useEffect(() => () => stop(), []);

  const advance = (next: Phrase[]) => {
    setQueue(next);
    if (next.length) speak(next[0], { lang });
    else {
      stop();
      onDone();
    }
  };

  const knowIt = () => {
    markKnown(lang, card.id);
    setKnown((n) => n + 1);
    advance(queue.slice(1));
  };

  const again = () => advance([...queue.slice(1), card]);

  if (!card) return null;
  const explanation = explain(card);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center gap-3">
        <IconButton label="Salir al menú de temas" icon={<CloseIcon />} onClick={onExit} />
        <ProgressBar value={known} max={deck.length} label="Frases descubiertas" className="flex-1" />
        <span className="text-sm font-bold text-ink-muted tabular-nums">
          {known}/{deck.length}
        </span>
      </div>

      <p className="text-sm font-bold uppercase tracking-wide text-terracotta-deep">
        {topic.emoji ? `${topic.emoji} ` : ""}Descubre · {topic.title}
      </p>

      <Card className="flex flex-col gap-4">
        <PlayControls audio={card} />
        <p lang="it" className="text-3xl font-extrabold leading-tight text-sea-deep">
          {card.text}
        </p>
        <p className="text-xl font-bold text-ink">{card.es}</p>
        {card.literal ? <p className="text-sm text-ink-muted">Literal: «{card.literal}»</p> : null}
        {explanation ? <p className="rounded-button bg-lemon-soft px-4 py-3 text-base text-ink">{explanation}</p> : null}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={again}>
          Otra vez
        </Button>
        <Button onClick={knowIt}>La sé</Button>
      </div>

      <Button
        variant="secondary"
        size="md"
        onClick={() => {
          stop();
          onDone();
        }}
      >
        Ir a la ronda rápida
      </Button>
    </div>
  );
}
