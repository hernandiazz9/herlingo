"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MicIcon } from "@/components/phrasebook/icons";
import { Button, Card } from "@/components/ui";
import { COACH_LIMITS, generatePack, toCoachApiError, type CoachApiError, type CoachPack } from "@/lib/coach";
import { useSavedPacks } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { SparklesIcon } from "./icons";
import { FIELD, FOCUS, Notice, Spinner } from "./shared";
import { useDictation } from "./use-dictation";

const LIMIT = COACH_LIMITS.description;

/** Example situations (the learner's words, in Spanish: valid for any target language). */
const EXAMPLES = [
  { label: "☕ En el bar", text: "Pedir un café y algo de comer en un bar y pagar" },
  { label: "🚆 Billete de tren", text: "Comprar un billete de tren en la taquilla y preguntar de qué andén sale" },
  { label: "🧭 Preguntar el camino", text: "Preguntar a alguien por la calle cómo llegar al centro a pie" },
  { label: "🏨 Llegar al alojamiento", text: "Hacer el check-in en el alojamiento y preguntar a qué hora es el desayuno" },
  { label: "💊 En la farmacia", text: "Explicar en la farmacia que me duele la garganta y pedir algo" },
  { label: "🍽️ Reservar mesa", text: "Llamar a un restaurante para reservar mesa para dos esta noche" },
];

export interface SituationFormProps {
  lang: string;
  /** A new pack arrived (`saved`: false when the device could not store it). */
  onCreated: (pack: CoachPack, saved: boolean) => void;
  /** The server rejected the stored code (it is forgotten, so the parent asks for it again). */
  onUnauthorized: (message: string) => void;
}

/** "¿Qué vas a hacer?": description (typed, dictated or from an example) → a new pack. */
export function SituationForm({ lang, onCreated, onUnauthorized }: SituationFormProps) {
  const id = useId();
  const { save } = useSavedPacks(lang);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<CoachApiError | null>(null);
  const [blocked, setBlocked] = useState(false);
  const request = useRef<AbortController | null>(null);
  const dictation = useDictation((heard) =>
    setText((prev) => (prev.trim() ? `${prev.trim()} ${heard}` : heard).slice(0, LIMIT)),
  );

  useEffect(() => () => request.current?.abort(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const description = text.trim();
    if (!description || pending || blocked) return;
    dictation.cancel();
    const ctrl = new AbortController();
    request.current = ctrl;
    setPending(description);
    setError(null);
    try {
      const { pack } = await generatePack(lang, description, { signal: ctrl.signal });
      const saved = save(pack);
      setText("");
      onCreated(pack, saved);
    } catch (err) {
      const apiError = toCoachApiError(err);
      if (apiError.kind === "unauthorized") onUnauthorized(apiError.message);
      else if (apiError.kind !== "aborted") {
        if (apiError.kind === "limit") setBlocked(true);
        setError(apiError);
      }
    } finally {
      if (request.current === ctrl) request.current = null;
      setPending(null);
    }
  };

  if (pending) return <Generating description={pending} onCancel={() => request.current?.abort()} />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor={id} className="text-xl font-extrabold text-ink">
        ¿Qué vas a hacer?
      </label>
      <div className={cn(FIELD, "flex flex-col gap-2 rounded-card p-3")}>
        <textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMIT}
          rows={3}
          placeholder="Por ejemplo: comprar un billete de tren y preguntar de qué andén sale"
          className="min-h-24 w-full resize-none bg-transparent text-lg leading-snug text-ink outline-none placeholder:text-ink-muted"
        />
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm", text.length >= LIMIT ? "font-bold text-error-deep" : "text-ink-muted")}>
            {text.length}/{LIMIT}
          </span>
          {dictation.available ? (
            <button
              type="button"
              onClick={dictation.toggle}
              aria-pressed={dictation.listening}
              className={cn(
                "pressable inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold",
                FOCUS,
                dictation.listening
                  ? "bg-terracotta text-on-accent [--ledge:var(--terracotta-ledge)]"
                  : "border-2 border-line bg-surface text-terracotta-deep [--ledge:var(--line)]",
              )}
            >
              <MicIcon width={18} height={18} /> {dictation.listening ? "Escuchando… (toca para parar)" : "Dictar"}
            </button>
          ) : null}
        </div>
      </div>
      {dictation.message ? (
        <p role="status" className="text-sm text-ink-muted">
          {dictation.message}
        </p>
      ) : null}

      <div role="group" aria-labelledby={`${id}-ideas`} className="flex flex-wrap gap-2">
        <span id={`${id}-ideas`} className="w-full text-sm font-bold text-ink-muted">
          Ideas
        </span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => setText(ex.text)}
            className={cn(
              "pressable rounded-full border-2 border-line bg-surface px-3 py-1.5 text-sm font-bold text-ink [--ledge:var(--line)]",
              FOCUS,
            )}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <Button type="submit" fullWidth disabled={!text.trim() || blocked}>
        <SparklesIcon width={22} height={22} /> Preparar
      </Button>
      {error ? <Notice>{error.message}</Notice> : null}
    </form>
  );
}

function Generating({ description, onCancel }: { description: string; onCancel: () => void }) {
  return (
    <Card tone="sea" role="status" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Spinner className="size-7" />
        <p className="text-xl font-extrabold text-ink">Preparando tu situación…</p>
      </div>
      <p className="text-base text-ink">«{description}»</p>
      <p className="text-sm text-ink-muted">
        Escribo los pasos, las frases clave y un diálogo para practicar. Puede tardar hasta un minuto: no cierres esta
        pantalla.
      </p>
      <Button variant="secondary" size="md" onClick={onCancel}>
        Cancelar
      </Button>
    </Card>
  );
}
