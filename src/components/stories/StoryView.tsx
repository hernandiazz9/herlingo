"use client";

import { useState } from "react";
import { getPack, getStory } from "@/lib/content";
import { StoryGames } from "./StoryGames";
import { StoryReader } from "./StoryReader";

/** A story page: the reader, then the games (full screen) with their summary. */
export function StoryView({ id, lang }: { id: string; lang: string }) {
  const story = getStory(id, getPack(lang));
  const [playing, setPlaying] = useState(false);
  // New key per round: a fresh set of games every time.
  const [round, setRound] = useState(0);
  if (!story) return null;
  return (
    <>
      <StoryReader
        story={story}
        lang={lang}
        onPlay={() => {
          setRound(round + 1);
          setPlaying(true);
        }}
      />
      {playing ? <StoryGames key={round} story={story} lang={lang} onExit={() => setPlaying(false)} /> : null}
    </>
  );
}
