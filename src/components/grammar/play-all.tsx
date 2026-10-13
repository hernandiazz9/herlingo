"use client";

import { useEffect, useMemo, useRef } from "react";
import { SpeakerIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { SequenceLine } from "@/lib/audio";
import { useSequencePlayer } from "@/lib/audio/use-sequence-player";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import { getTab } from "@/lib/navigation";

/** Silence between two lines of «Escuchar todo» on a grammar page. */
const GAP_MS = 600;

export interface PlayAll {
  /** Index of the line playing (or paused from the lock screen); null when idle. */
  playing: number | null;
  /** The «Escuchar todo» / «Parar» button: starts from the first line, again = stop. Call it inside the tap. */
  toggle: () => void;
  /** Stops the sequence if it is on (switching tense); other audio is left alone. */
  cancel: () => void;
  /** Ref of line `i`'s element: the line playing scrolls into view. */
  itemRef: (i: number) => (el: HTMLElement | null) => void;
}

/**
 * «Escuchar todo» of a grammar page: `lines` one after another (each as its own play button plays
 * it), `GAP_MS` apart: one joined file when every line has an mp3 (it keeps playing with the
 * screen locked; lock screen: `title`, "Gramática"), else clip after clip (`useSequencePlayer`).
 * Any other `speak()` (a row, an example, the infinitive) ends it; leaving the page stops it.
 */
export function usePlayAll(lines: readonly SequenceLine[], title: string): PlayAll {
  const steps = useMemo(() => lines.map((line) => [line]), [lines]);
  const player = useSequencePlayer(steps, { gapMs: GAP_MS, title, artist: getTab("grammar").title });
  const playing = player.step;
  const items = useRef(new Map<number, HTMLElement>());

  const toggle = () => {
    if (player.status !== "idle") return player.stop();
    if (lines.length) player.play(0);
  };

  // The line playing scrolls into view.
  useEffect(() => {
    if (playing === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    items.current.get(playing)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [playing]);

  const itemRef = (i: number) => (el: HTMLElement | null) => {
    if (el) items.current.set(i, el);
    else items.current.delete(i);
  };

  return { playing, toggle, cancel: player.stop, itemRef };
}

/** Frame of a line that «Escuchar todo» is playing (lemon, like the story reader). */
export const PLAYING_FRAME = "border-lemon-deep bg-lemon-soft";

/** The «Escuchar todo» / «Parar» button of a grammar page. */
export function PlayAllButton({ player }: { player: PlayAll }) {
  const copy = useLearnCopy();
  const on = player.playing !== null;
  return (
    <Button size="md" className="self-start" onClick={player.toggle} aria-pressed={on}>
      <SpeakerIcon className="size-5" />
      {on ? copy.stop : copy.listenAll}
    </Button>
  );
}
