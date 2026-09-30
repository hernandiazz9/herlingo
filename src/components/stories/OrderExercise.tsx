"use client";

import { useEffect, useRef, useState } from "react";
import { MiniPlay, Prompt, useLessonLang, usePlay } from "@/components/exercises";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { OrderStep } from "@/lib/stories";

const FLASH_MS = 600;

/** Tap the story sentences in the order they happen. Reports the number of wrong taps. */
export function OrderExercise({ step, onDone }: { step: OrderStep; onDone: (mistakes: number) => void }) {
  const [placed, setPlaced] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const play = usePlay();
  const lang = useLessonLang();
  const byId = new Map(step.sentences.map((s) => [s.id, s]));
  const finished = placed.length === step.sentences.length;

  useEffect(() => {
    if (finished) button.current?.focus({ preventScroll: true });
  }, [finished]);

  const tap = (id: string) => {
    if (finished || placed.includes(id)) return;
    const expected = step.sentences[placed.length];
    if (id === expected.id) {
      setPlaced([...placed, id]);
      play(expected);
      return;
    }
    setMistakes(mistakes + 1);
    setWrong(id);
    window.setTimeout(() => setWrong((w) => (w === id ? null : w)), FLASH_MS);
  };

  return (
    <div className="flex flex-col gap-6">
      <Prompt>Ordena la historia</Prompt>
      <p className="text-base text-ink-muted">Toca las frases en el orden en que pasan.</p>

      {placed.length ? (
        <ol className="flex flex-col gap-2">
          {placed.map((id, i) => {
            const s = byId.get(id)!;
            return (
              <li key={id} className="flex items-start gap-2 rounded-button border-2 border-success bg-success-soft p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-sm font-extrabold text-on-accent">
                  {i + 1}
                </span>
                <span lang={lang} className="flex-1 text-base font-bold text-success-deep">
                  {s.text}
                </span>
                {finished ? <MiniPlay audio={s} label={`Escuchar la frase ${i + 1}`} /> : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {!finished ? (
        <ul className="flex flex-col gap-3">
          {step.shuffled
            .filter((id) => !placed.includes(id))
            .map((id) => (
              <li key={id}>
                <button
                  type="button"
                  lang={lang}
                  onClick={() => tap(id)}
                  className={cn(
                    "pressable min-h-14 w-full rounded-button border-2 px-4 py-3 text-left text-base font-bold",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
                    wrong === id
                      ? "border-error bg-error-soft text-error-deep [--ledge:var(--error)]"
                      : "border-line bg-surface text-ink [--ledge:var(--line)]",
                  )}
                >
                  {byId.get(id)!.text}
                </button>
              </li>
            ))}
        </ul>
      ) : (
        <div role="status" className="flex flex-col gap-3">
          <p className="text-2xl font-extrabold text-success-deep">{mistakes === 0 ? "¡Perfecto!" : "¡Hecho!"}</p>
          {mistakes > 0 ? (
            <p className="text-base text-ink">
              {mistakes === 1 ? "Has fallado 1 vez, pero ya está en orden." : `Has fallado ${mistakes} veces, pero ya está en orden.`}
            </p>
          ) : null}
          <Button ref={button} fullWidth onClick={() => onDone(mistakes)}>
            Continuar
          </Button>
        </div>
      )}
    </div>
  );
}
