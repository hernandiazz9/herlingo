"use client";

import { createContext, useContext, type ReactNode, type SVGProps } from "react";
import { SpeakerIcon } from "@/components/icons";
import { speak } from "@/lib/audio";
import { DEFAULT_LANG, type Playable } from "@/lib/content";
import { cn } from "@/lib/cn";
import type { Exercise, ExerciseOutcome } from "@/lib/exercises";

/** Language pack of the running session (for audio and speech recognition). */
export const LessonLangContext = createContext<string>(DEFAULT_LANG);

export function useLessonLang(): string {
  return useContext(LessonLangContext);
}

/** Plays a playable in the session language. Call it directly in a click handler (iOS). */
export function usePlay() {
  const lang = useLessonLang();
  return (p: Playable, slow = false) => void speak(p, { lang, slow });
}

export interface ExerciseProps<E extends Exercise> {
  exercise: E;
  /** True once answered: the exercise is locked while the feedback sheet shows. */
  answered: boolean;
  onAnswer: (outcome: ExerciseOutcome) => void;
}

/** Instruction line at the top of each exercise. */
export function Prompt({ children }: { children: ReactNode }) {
  return <h2 className="text-2xl font-extrabold tracking-tight text-ink">{children}</h2>;
}

/** Big round play button plus a smaller "Lento" (slow) button. */
export function PlayControls({ audio, size = "lg" }: { audio: Playable; size?: "lg" | "md" }) {
  const play = usePlay();
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Escuchar"
        title="Escuchar"
        onClick={() => play(audio)}
        className={cn(
          "pressable inline-flex shrink-0 items-center justify-center rounded-full bg-sea text-on-accent [--ledge:var(--sea-ledge)]",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
          size === "lg" ? "size-20" : "size-14",
        )}
      >
        <SpeakerIcon className={size === "lg" ? "size-10" : "size-7"} />
      </button>
      <button
        type="button"
        onClick={() => play(audio, true)}
        className={cn(
          "pressable inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line bg-surface px-4 text-sm font-bold text-sea [--ledge:var(--line)]",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
        )}
      >
        <SlowIcon className="size-5" />
        Lento
      </button>
    </div>
  );
}

/** Small inline play button (for a text line). */
export function MiniPlay({ audio, label = "Escuchar" }: { audio: Playable; label?: string }) {
  const play = usePlay();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => play(audio)}
      className="pressable inline-flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
    >
      <SpeakerIcon className="size-5" />
    </button>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

function Svg(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

/** Snail: slow playback. */
export function SlowIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 18h13a5 5 0 0 0 0-10 4 4 0 0 0-4 4 2 2 0 0 0 4 0" />
      <path d="M19 8V4M21 9l1-3" />
    </Svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}
