"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { getPack } from "@/lib/content";
import { LanguagePicker, pickablePacks, useChooseLanguage } from "./LanguagePicker";

/**
 * Ruta's quick switch: the active language (flag + name) as a button that opens the picker in a
 * bottom sheet. Hidden when there is only one language to study.
 */
export function LanguageSwitch({ lang }: { lang: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const choose = useChooseLanguage(close);
  const trigger = useRef<HTMLButtonElement>(null);

  if (pickablePacks().length < 2) return null;
  const meta = getPack(lang).meta;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="pressable inline-flex min-h-11 items-center gap-2 self-start rounded-full border-2 border-line bg-surface px-4 text-base font-bold text-ink [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          {meta.emoji ?? "🌍"}
        </span>
        <span>
          <span className="sr-only">Idioma que estudias: </span>
          {meta.name}
        </span>
        <span aria-hidden="true" className="text-ink-muted">
          ▾
        </span>
        <span className="sr-only">. Toca para cambiarlo</span>
      </button>
      {open ? (
        <LanguageSheet
          current={lang}
          onChoose={choose}
          onClose={() => {
            close();
            trigger.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}
    </>
  );
}

function LanguageSheet({ current, onChoose, onClose }: { current: string; onChoose: (lang: string) => void; onClose: () => void }) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-backdrop/80 p-4 pb-[calc(var(--safe-bottom)+1rem)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-[calc(var(--column-width)-2rem)] flex-col gap-4 overflow-y-auto rounded-card border-2 border-line bg-surface p-5 shadow-[0_12px_40px_-12px_var(--shadow)]"
      >
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-2xl font-extrabold text-ink">
            ¿Qué idioma estudias?
          </h2>
          <p className="text-sm text-ink-muted">Cada idioma guarda su propio progreso.</p>
        </div>
        <LanguagePicker current={current} onChoose={onChoose} />
        <Button fullWidth variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
