"use client";

import { useEffect } from "react";
import { SpeakerIcon } from "@/components/icons";
import { Button, TargetText } from "@/components/ui";
import type { Playable } from "@/lib/content";
import { speak, stop } from "@/lib/audio";
import { recordListen } from "@/lib/progress/activity";
import { CloseIcon, SlowIcon } from "./icons";
import { useLessonLang } from "@/components/exercises";

export interface ShowModeProps {
  item: Playable & { es: string };
  onClose: () => void;
}

/** Full-screen "show it to a native speaker" view: the phrase in huge type, with play buttons. */
export function ShowMode({ item, onClose }: ShowModeProps) {
  const lang = useLessonLang();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const play = (slow = false) => {
    speak(item, { lang, slow });
    recordListen(item.audioKey, lang);
  };

  const close = () => {
    stop();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mostrar frase"
      className="fixed inset-0 z-[60] flex flex-col bg-surface pt-[calc(1rem+var(--safe-top))] pb-[calc(1.25rem+var(--safe-bottom))] pl-[calc(1.25rem+env(safe-area-inset-left))] pr-[calc(1.25rem+env(safe-area-inset-right))]"
    >
      <div className="flex justify-end">
        <button
          type="button"
          autoFocus
          onClick={close}
          aria-label="Cerrar"
          className="inline-flex size-12 items-center justify-center rounded-full bg-sand text-ink focus-visible:outline-3 focus-visible:outline-lemon-deep"
        >
          <CloseIcon />
        </button>
      </div>
      <button
        type="button"
        onClick={() => play()}
        className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
        aria-label={`Escuchar: ${item.text}`}
      >
        <p lang={lang} className="text-[clamp(2.25rem,11vw,4.5rem)] leading-tight font-extrabold break-words text-ink">
          <TargetText text={item.text} lang={lang} />
        </p>
        <p className="text-xl text-ink-muted">{item.es}</p>
      </button>
      <div className="mx-auto grid w-full max-w-[var(--column-width)] grid-cols-2 gap-3">
        <Button onClick={() => play()}>
          <SpeakerIcon /> Escuchar
        </Button>
        <Button variant="secondary" onClick={() => play(true)}>
          <SlowIcon /> Lento
        </Button>
      </div>
    </div>
  );
}
