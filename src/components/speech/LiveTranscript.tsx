"use client";

import type { ReactNode } from "react";
import { Button, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import type { ListenStatus } from "@/lib/speech";
import { useListenRemaining, type ListenControls } from "./use-listen";

export interface LiveTranscriptProps {
  listen: ListenControls;
  /** `lang` of the heard text (the pack's language, or "es"). */
  lang?: string;
  /** Status line while idle (e.g. "Toca y habla"). Nothing by default. */
  idleHint?: ReactNode;
  /** Show «what was heard» after the session ends with words. Default false (the screen shows it). */
  showResult?: boolean;
  /** Extra actions next to "Reintentar" on an error (e.g. "Prefiero evaluarme yo"). */
  errorActions?: ReactNode;
  /** "center" for a phrase panel, "start" under a text field. Default "center". */
  align?: "center" | "start";
  className?: string;
}

const STATUS_COPY: Partial<Record<ListenStatus, "micStarting" | "statusListening" | "statusHearing" | "micWait">> = {
  starting: "micStarting",
  listening: "statusListening",
  hearing: "statusHearing",
  processing: "micWait",
};

/**
 * What the mic is doing, in words: the state (aria-live), the live text as it is heard, a countdown
 * to the cap, "Cancelar" (discard) while open, and on an error the engine's message + "Reintentar".
 */
export function LiveTranscript({
  listen,
  lang,
  idleHint,
  showResult = false,
  errorActions,
  align = "center",
  className,
}: LiveTranscriptProps) {
  const remaining = useListenRemaining(listen);
  const copy = useLearnCopy();
  if (!listen.supported) return null;

  const { status, interim, active, error, result } = listen;
  const statusKey = STATUS_COPY[status];
  const statusText = statusKey ? copy[statusKey] : status === "idle" ? idleHint : null;
  const center = align === "center";

  return (
    <div className={cn("flex w-full flex-col gap-2", center ? "items-center text-center" : "items-start", className)}>
      <p role="status" aria-live="polite" className="min-h-6 text-base font-bold text-ink-muted">
        {statusText}
      </p>

      {active && (interim || status === "hearing") ? (
        <p
          lang={lang}
          className={cn(
            "w-full rounded-card border-2 border-line bg-surface px-4 py-3 text-lg text-ink",
            center && "text-center",
          )}
        >
          {interim ? `«${interim}»` : "…"}
        </p>
      ) : null}

      {showResult && result ? (
        <p className="text-base text-ink-muted">
          {copy.heard}:{" "}
          <span lang={lang} className="font-bold text-ink">
            «{result.transcript}»
          </span>
        </p>
      ) : null}

      {remaining !== null ? (
        <div className={cn("flex w-full max-w-xs items-center gap-3", center ? "self-center" : "self-start")}>
          <ProgressBar
            value={remaining}
            max={listen.timings.maxMs}
            tone="sea"
            label={copy.timeToSpeak}
            className="h-2"
          />
          <span className="shrink-0 text-sm tabular-nums text-ink-muted" aria-hidden="true">
            {Math.ceil(remaining / 1000)} s
          </span>
        </div>
      ) : null}

      {active ? (
        <button
          type="button"
          onClick={listen.cancel}
          className={cn(
            "inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-base font-bold text-sea-deep underline underline-offset-4",
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
          )}
        >
          {copy.cancel}
        </button>
      ) : null}

      {error ? (
        <div className={cn("flex w-full flex-col gap-3", center ? "items-center" : "items-start")}>
          <p role="alert" className="w-full rounded-card bg-error-soft px-4 py-3 text-base text-error-deep">
            {copy.speechErrors[error.kind]}
          </p>
          <div className={cn("flex flex-wrap items-center gap-3", center && "justify-center")}>
            <Button variant="secondary" size="md" onClick={listen.start}>
              {copy.retry}
            </Button>
            {errorActions}
          </div>
        </div>
      ) : null}
    </div>
  );
}
