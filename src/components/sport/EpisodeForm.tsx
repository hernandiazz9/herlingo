"use client";

import { useEffect, useId, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ConfirmDialog } from "@/components/coach/ConfirmDialog";
import { SparklesIcon } from "@/components/coach/icons";
import { FIELD, Notice } from "@/components/coach/shared";
import { Button } from "@/components/ui";
import { COACH_LIMITS, type CoachApiError, type GenerationUsage, type StoredEpisode } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { clearEpisodeGeneration, startEpisode, useEpisodeGeneration } from "./generation";

const LIMIT = COACH_LIMITS.description;

/** Today's episode counter (`usage.today` of an episode response). */
export type EpisodesToday = GenerationUsage["today"];

/** "Te quedan N episodios hoy" (null when the server sent no limit). */
export function episodesLeft(today: EpisodesToday | null | undefined): string | null {
  if (!today || today.limit <= 0) return null;
  const n = Math.max(0, today.limit - today.used);
  if (n === 0) return "Hoy ya no te quedan episodios";
  return n === 1 ? "Te queda 1 episodio hoy" : `Te quedan ${n} episodios hoy`;
}

/**
 * The error text of a failed episode. The client's no-connection message talks about Prepárate's
 * situations, so that one comes from here: nothing while offline (the screen's offline notice
 * says it), else the reconnect hint. Everything else (the daily limit, the budget, a failed
 * generation) is the server's message as is.
 */
function errorText(error: CoachApiError, online: boolean): string | null {
  if (error.kind === "offline" && error.code === "offline") {
    return online ? "No he podido conectar con el servidor. Revisa tu conexión e inténtalo de nuevo." : null;
  }
  return error.message;
}

export interface EpisodeFormProps {
  lang: string;
  /** What is being typed: kept by the parent so it survives a 401 (code asked again). */
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  online: boolean;
  /** Today's episode counter after the last episode of this visit ("Te quedan N episodios hoy"). */
  today: EpisodesToday | null;
  /** An episode arrived (`saved`: false when the device could not store it): open it. */
  onCreated: (episode: StoredEpisode, saved: boolean, usage: GenerationUsage) => void;
}

/**
 * Modo deporte form: free text (1–500 characters) → an AI episode. The request runs in
 * `./generation`: leaving /deporte/ does not throw it away (it is saved in Mis episodios when it
 * arrives and waits here to be opened).
 */
export function EpisodeForm({ lang, draft: text, setDraft: setText, online, today, onCreated }: EpisodeFormProps) {
  const id = useId();
  const job = useEpisodeGeneration(lang, ({ episode, saved, usage }) => {
    setText("");
    onCreated(episode, saved, usage);
  });
  const pending = job?.status === "pending";
  const error = job?.status === "error" && job.error.kind !== "unauthorized" ? job.error : null;
  const message = error ? errorText(error, online) : null;
  // A paid episode the device could not store lives only in memory: no new request until it is
  // opened or dismissed (a new one would overwrite it).
  const unsaved = job?.status === "done" && !job.saved ? job.episode : null;
  const blocked = error?.kind === "limit" || unsaved !== null;
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  // An episode that finished while you were elsewhere: once its notice shows, the description it
  // was made from leaves the form (something typed since stays).
  const readyInput = job?.status === "done" ? job.input : null;
  useEffect(() => {
    if (readyInput !== null) setText((prev) => (prev.trim() === readyInput ? "" : prev));
  }, [readyInput, setText]);

  const value = pending ? job.input : text;
  const over = value.length > LIMIT;
  const left = episodesLeft(today);

  const edit = (next: string) => {
    setText(next);
    if (job?.status === "error") clearEpisodeGeneration(lang);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const description = text.trim();
    if (!description || over || pending || !online || blocked) return;
    startEpisode(lang, description);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {job?.status === "done" ? (
        <Ready
          episode={job.episode}
          saved={job.saved}
          today={job.usage.today}
          onOpen={() => {
            clearEpisodeGeneration(lang);
            onCreated(job.episode, job.saved, job.usage);
          }}
          onDismiss={() => setConfirmDismiss(true)}
        />
      ) : null}
      {unsaved && confirmDismiss ? (
        <ConfirmDialog
          title="¿Descartar este episodio?"
          confirmLabel="Sí, descartar"
          onCancel={() => setConfirmDismiss(false)}
          fallbackFocus={() => document.getElementById(id)}
          onConfirm={() => {
            setConfirmDismiss(false);
            clearEpisodeGeneration(lang);
          }}
        >
          «{unsaved.title}» no está guardado en este móvil: si lo descartas, se perderá. No se puede deshacer.
        </ConfirmDialog>
      ) : null}

      <label htmlFor={id} className="sr-only">
        Qué situación quieres aprender
      </label>
      <div className={cn(FIELD, "flex flex-col gap-2 rounded-card p-3")}>
        <textarea
          id={id}
          value={value}
          onChange={(e) => edit(e.target.value)}
          readOnly={pending}
          rows={3}
          aria-invalid={over}
          aria-describedby={`${id}-count`}
          placeholder="Ej.: ir a un supermercado"
          className="min-h-24 w-full resize-none bg-transparent text-lg leading-snug text-ink outline-none placeholder:text-ink-muted"
        />
        <span id={`${id}-count`} className={cn("text-sm", over ? "font-bold text-error-deep" : "text-ink-muted")}>
          {value.length}/{LIMIT}
          {over ? ` · Acórtalo: máximo ${LIMIT} caracteres` : ""}
        </span>
      </div>

      <Button type="submit" fullWidth disabled={!text.trim() || over || pending || !online || blocked}>
        {pending ? (
          <>
            <span
              aria-hidden="true"
              className="inline-block size-5 shrink-0 animate-spin rounded-full border-3 border-on-accent/30 border-t-on-accent motion-reduce:animate-none"
            />
            Preparando tu episodio…
          </>
        ) : (
          <>
            <SparklesIcon width={22} height={22} /> Prepárame el episodio
          </>
        )}
      </Button>
      {pending ? (
        <p role="status" className="text-sm text-ink-muted">
          <span className="sr-only">Preparando tu episodio… </span>
          Puede tardar medio minuto. Si sales de aquí, se guardará igual en Mis episodios (no cierres la app).
        </p>
      ) : null}
      {unsaved ? (
        <p className="text-sm text-ink-muted">Abre o descarta «{unsaved.title}» antes de preparar otro episodio.</p>
      ) : null}
      {message ? <Notice>{message}</Notice> : null}
      {!pending && left && job?.status !== "done" ? <p className="text-sm font-bold text-sea-deep">{left}</p> : null}
    </form>
  );
}

/**
 * An episode that finished while you were elsewhere (already in Mis episodios when `saved`;
 * otherwise it can be opened or dismissed).
 */
function Ready({
  episode,
  saved,
  today,
  onOpen,
  onDismiss,
}: {
  episode: StoredEpisode;
  saved: boolean;
  today: EpisodesToday;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const left = episodesLeft(today);
  return (
    <Notice tone={saved ? "success" : "info"} className="flex flex-col gap-3">
      <p>
        {saved
          ? `«${episode.title}» ya está listo y guardado en Mis episodios.`
          : `«${episode.title}» ya está listo, pero no he podido guardarlo en este móvil: ábrelo ahora o se perderá.`}
        {left ? ` ${left}.` : ""}
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
