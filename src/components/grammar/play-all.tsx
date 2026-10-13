"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakerIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { speakSequence, stop, type SequenceLine } from "@/lib/audio";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";

/** Silence between two lines of «Escuchar todo» on a grammar page. */
const GAP_MS = 600;

export interface PlayAll {
  /** Index of the line playing (or coming after the pause); null when idle. */
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
 * it), `GAP_MS` apart, through `speakSequence` (sequential audio on iOS after one tap). Any other
 * `speak()` (a row, an example, the infinitive) ends it; leaving the page stops it.
 */
export function usePlayAll(lines: readonly SequenceLine[]): PlayAll {
  const [playing, setPlaying] = useState<number | null>(null);
  /** Bumped by every start and stop: a stale sequence never touches the state. */
  const run = useRef(0);
  const on = useRef(false);
  const items = useRef(new Map<number, HTMLElement>());

  const cancel = () => {
    if (!on.current) return;
    run.current++;
    on.current = false;
    stop();
    setPlaying(null);
  };

  const toggle = () => {
    if (on.current) return cancel();
    if (!lines.length) return;
    const token = ++run.current;
    on.current = true;
    setPlaying(0);
    void speakSequence(lines, {
      gapMs: GAP_MS,
      onLine: (i) => {
        if (run.current === token) setPlaying(i);
      },
    }).then(() => {
      if (run.current !== token) return;
      on.current = false;
      setPlaying(null);
    });
  };

  // Leaving the page stops the sequence (and only the sequence).
  useEffect(
    () => () => {
      run.current++;
      if (on.current) stop();
      on.current = false;
    },
    [],
  );

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

  return { playing, toggle, cancel, itemRef };
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
