"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import { LiveTranscript } from "./LiveTranscript";
import { MicButton } from "./MicButton";
import type { ListenControls } from "./use-listen";

export interface SpeakPanelProps {
  listen: ListenControls;
  /** `lang` of the heard text. */
  lang?: string;
  /** Mic accessible name and status line when idle. Default "Toca y habla". */
  idleLabel?: string;
  /** Show «what was heard» after a session. Default false. */
  showResult?: boolean;
  /** Extra actions next to "Reintentar" on an error. */
  errorActions?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** Big mic + live text, centred: the panel for "say this phrase" screens (lessons, dialogue turns). */
export function SpeakPanel({
  listen,
  lang,
  idleLabel: ownIdleLabel,
  showResult,
  errorActions,
  disabled,
  className,
}: SpeakPanelProps) {
  const copy = useLearnCopy();
  const idleLabel = ownIdleLabel ?? copy.tapAndSpeak;
  if (!listen.supported) return null;
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <MicButton listen={listen} idleLabel={idleLabel} disabled={disabled} />
      <LiveTranscript
        listen={listen}
        lang={lang}
        idleHint={disabled ? null : idleLabel}
        showResult={showResult}
        errorActions={errorActions}
      />
    </div>
  );
}
