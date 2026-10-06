"use client";

import { MicIcon, MicStopIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useListenRemaining, type ListenControls } from "./use-listen";

export type MicButtonSize = "lg" | "sm";

export interface MicButtonProps {
  listen: ListenControls;
  /** "lg" = big round button (a phrase to say); "sm" = pill with text (dictation next to a field). */
  size?: MicButtonSize;
  /** Accessible name (lg) or visible text (sm) when idle. Default "Toca y habla" / "Dictar". */
  idleLabel?: string;
  disabled?: boolean;
  className?: string;
}

const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep";
const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/**
 * The mic. Tap to start; it stops by itself on silence; tap again to finish and keep what was said.
 * While listening a ring (lg) or the seconds left (sm) count down to the cap. Renders nothing when
 * the browser has no speech recognition (the screen keeps its fallback).
 */
export function MicButton({ listen, size = "lg", idleLabel, disabled, className }: MicButtonProps) {
  const remaining = useListenRemaining(listen);
  if (!listen.supported) return null;

  const { status } = listen;
  const open = status === "listening" || status === "hearing";
  const label =
    status === "starting"
      ? "Abriendo el micrófono…"
      : open
        ? "Terminar y usar lo que he dicho"
        : status === "processing"
          ? "Un momento…"
          : (idleLabel ?? (size === "lg" ? "Toca y habla" : "Dictar"));
  const tone = open
    ? "bg-terracotta text-on-accent [--ledge:var(--terracotta-ledge)]"
    : "bg-sea text-on-accent [--ledge:var(--sea-ledge)]";
  const pulse = open && "animate-pulse motion-reduce:animate-none";
  const Icon = open ? MicStopIcon : MicIcon;
  const busy = status === "starting" || status === "processing";

  if (size === "sm") {
    const seconds = remaining === null ? null : Math.ceil(remaining / 1000);
    return (
      <button
        type="button"
        onClick={listen.toggle}
        disabled={disabled || status === "processing"}
        aria-pressed={listen.active}
        aria-busy={busy || undefined}
        className={cn(
          "pressable inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold",
          "disabled:cursor-not-allowed disabled:opacity-60",
          FOCUS,
          open || busy ? tone : "border-2 border-line bg-surface text-terracotta-deep [--ledge:var(--line)]",
          className,
        )}
      >
        <Icon width={18} height={18} className={cn(status === "starting" && "animate-pulse motion-reduce:animate-none")} />
        {open ? "Terminar" : label}
        {seconds !== null ? <span className="tabular-nums font-normal">· {seconds} s</span> : null}
      </button>
    );
  }

  const fraction = remaining === null ? 1 : remaining / listen.timings.maxMs;
  return (
    <span className={cn("relative inline-flex size-28 items-center justify-center", className)}>
      {open ? (
        <svg viewBox="0 0 112 112" className="absolute inset-0 size-full -rotate-90" aria-hidden="true" focusable="false">
          <circle cx="56" cy="56" r={RING_R} fill="none" strokeWidth="5" className="stroke-sand" />
          <circle
            cx="56"
            cy="56"
            r={RING_R}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - fraction)}
            className="stroke-terracotta transition-[stroke-dashoffset] duration-300 ease-linear motion-reduce:transition-none"
          />
        </svg>
      ) : null}
      <button
        type="button"
        onClick={listen.toggle}
        disabled={disabled || status === "processing"}
        aria-label={label}
        title={label}
        aria-pressed={listen.active}
        aria-busy={busy || undefined}
        className={cn(
          "pressable inline-flex size-24 items-center justify-center rounded-full",
          "disabled:cursor-not-allowed disabled:opacity-60",
          FOCUS,
          tone,
          pulse,
        )}
      >
        <Icon className={cn("size-11", status === "starting" && "animate-pulse motion-reduce:animate-none")} />
      </button>
    </span>
  );
}
