"use client";

import { useEffect, useId, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { LiveTranscript, MicButton, useListen } from "@/components/speech";
import { Button, Card } from "@/components/ui";
import { COACH_LIMITS, type CoachPack } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "./ConfirmDialog";
import { cancelGeneration, clearGeneration, newPackJob, startNewPack, useGeneration } from "./generation";
import { SparklesIcon } from "./icons";
import { FIELD, FOCUS, Notice, Spinner } from "./shared";

const LIMIT = COACH_LIMITS.description;
/** The learner describes situations in their own language, the language of the UI copy. */
const DICTATION_LOCALE = "es-ES";

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
  /** The description being typed: kept by the parent so it survives a 401 (code asked again). */
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  /** A new pack arrived (`saved`: false when the device could not store it): show it. */
  onCreated: (pack: CoachPack, saved: boolean) => void;
}

/**
 * "¿Qué vas a hacer?": description (typed, dictated or from an example) → a new pack. The request
 * runs in `./generation`: leaving this screen does not throw it away (it is saved when it arrives).
 */
export function SituationForm({ lang, draft: text, setDraft: setText, onCreated }: SituationFormProps) {
  const id = useId();
  const key = newPackJob(lang);
  const job = useGeneration(key, ({ pack, saved }) => {
    setText("");
    onCreated(pack, saved);
  });
  // Dictation (long mode): what is heard is appended to what is typed and stays editable.
  const listen = useListen({
    locale: DICTATION_LOCALE,
    mode: "long",
    onResult: (r) => {
      setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${r.transcript}` : r.transcript).slice(0, LIMIT));
      if (job?.status === "error") clearGeneration(key);
    },
  });
  const error = job?.status === "error" && job.error.kind !== "unauthorized" ? job.error : null;
  // A paid pack the device could not store lives only in memory: no new request until it is opened
  // or dismissed (a new one would overwrite it).
  const unsaved = job?.status === "done" && !job.saved ? job.pack : null;
  const blocked = error?.kind === "limit" || unsaved !== null;
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  // A pack that finished while you were elsewhere: once its notice shows, the description it was
  // made from leaves the form (something typed since stays).
  const readyInput = job?.status === "done" ? job.input : null;
  useEffect(() => {
    if (readyInput !== null) setText((prev) => (prev.trim() === readyInput ? "" : prev));
  }, [readyInput, setText]);

  const edit = (value: string) => {
    setText(value);
    if (job?.status === "error") clearGeneration(key);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const description = text.trim();
    if (!description || job?.status === "pending" || blocked) return;
    listen.cancel();
    startNewPack(lang, description);
  };

  if (job?.status === "pending") return <Generating description={job.input} onCancel={() => cancelGeneration(key)} />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {job?.status === "done" ? (
        <Ready
          pack={job.pack}
          saved={job.saved}
          onOpen={() => {
            clearGeneration(key);
            onCreated(job.pack, job.saved);
          }}
          onDismiss={() => setConfirmDismiss(true)}
        />
      ) : null}
      {unsaved && confirmDismiss ? (
        <ConfirmDialog
          title="¿Descartar esta situación?"
          confirmLabel="Sí, descartar"
          onCancel={() => setConfirmDismiss(false)}
          fallbackFocus={() => document.getElementById(id)}
          onConfirm={() => {
            setConfirmDismiss(false);
            clearGeneration(key);
          }}
        >
          «{unsaved.title}» no está guardada en este móvil: si la descartas, se perderá. No se puede deshacer.
        </ConfirmDialog>
      ) : null}
      <label htmlFor={id} className="text-xl font-extrabold text-ink">
        ¿Qué vas a hacer?
      </label>
      <div className={cn(FIELD, "flex flex-col gap-2 rounded-card p-3")}>
        <textarea
          id={id}
          value={text}
          onChange={(e) => edit(e.target.value)}
          maxLength={LIMIT}
          rows={3}
          placeholder="Por ejemplo: comprar un billete de tren y preguntar de qué andén sale"
          className="min-h-24 w-full resize-none bg-transparent text-lg leading-snug text-ink outline-none placeholder:text-ink-muted"
        />
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm", text.length >= LIMIT ? "font-bold text-error-deep" : "text-ink-muted")}>
            {text.length}/{LIMIT}
          </span>
          <MicButton listen={listen} size="sm" disabled={!listen.active && text.length >= LIMIT} />
        </div>
      </div>
      <LiveTranscript listen={listen} lang="es" align="start" />

      <div role="group" aria-labelledby={`${id}-ideas`} className="flex flex-wrap gap-2">
        <span id={`${id}-ideas`} className="w-full text-sm font-bold text-ink-muted">
          Ideas
        </span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => edit(ex.text)}
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
      {unsaved ? (
        <p className="text-sm text-ink-muted">Abre o descarta «{unsaved.title}» antes de preparar otra situación.</p>
      ) : null}
      {error ? <Notice>{error.message}</Notice> : null}
    </form>
  );
}

/**
 * A pack that finished while you were elsewhere (it is already in Mis situaciones when `saved`;
 * otherwise it can be opened or dismissed).
 */
function Ready({ pack, saved, onOpen, onDismiss }: { pack: CoachPack; saved: boolean; onOpen: () => void; onDismiss: () => void }) {
  return (
    <Notice tone={saved ? "success" : "info"} className="flex flex-col gap-3">
      <p>
        {saved
          ? `«${pack.title}» ya está lista y guardada en Mis situaciones.`
          : `«${pack.title}» ya está lista, pero no he podido guardarla en este móvil: ábrela ahora o se perderá.`}
      </p>
      <Button size="md" onClick={onOpen}>
        Abrir
      </Button>
      {saved ? null : (
        <Button variant="secondary" size="md" onClick={onDismiss}>
          Descartar
        </Button>
      )}
    </Notice>
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
        Escribo los pasos, las frases clave y un diálogo para practicar. Puede tardar hasta un minuto. Mientras tanto
        puedes repasar tus situaciones guardadas: la nueva aparecerá en Mis situaciones (no cierres la app).
      </p>
      <Button variant="secondary" size="md" onClick={onCancel}>
        Cancelar
      </Button>
      <p className="text-sm text-ink-muted">Si cancelas, se pierde, pero cuenta igual para tu límite y tu gasto.</p>
    </Card>
  );
}
