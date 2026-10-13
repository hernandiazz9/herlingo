"use client";

import { useEffect, useId, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ConfirmDialog } from "@/components/coach/ConfirmDialog";
import { clearGeneration, routeJob, startRoute, useRouteGeneration } from "@/components/coach/generation";
import { SparklesIcon } from "@/components/coach/icons";
import { FIELD, Notice } from "@/components/coach/shared";
import { Button } from "@/components/ui";
import { COACH_LIMITS, type CoachApiError, type CoachRoute, type GenerationUsage } from "@/lib/coach";
import { cn } from "@/lib/cn";

const LIMIT = COACH_LIMITS.description;

/** Today's route counter (`usage.today` of a route response). */
export type RoutesToday = GenerationUsage["today"];

/** "Te quedan N rutas hoy" (null when the server sent no limit). */
export function routesLeft(today: RoutesToday | null | undefined): string | null {
  if (!today || today.limit <= 0) return null;
  const n = Math.max(0, today.limit - today.used);
  if (n === 0) return "Hoy ya no te quedan rutas";
  return n === 1 ? "Te queda 1 ruta hoy" : `Te quedan ${n} rutas hoy`;
}

/**
 * The error text of a failed route. The client's no-connection message talks about Prepárate's
 * situations, so that one comes from here: nothing while offline (the screen's offline notice
 * says it), else the reconnect hint. Everything else is the server's message as is.
 */
function errorText(error: CoachApiError, online: boolean): string | null {
  if (error.kind === "offline" && error.code === "offline") {
    return online ? "No he podido conectar con el servidor. Revisa tu conexión e inténtalo de nuevo." : null;
  }
  return error.message;
}

export interface QuickFormProps {
  lang: string;
  /** What is being typed: kept by the parent so it survives a 401 (code asked again). */
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  online: boolean;
  /** Today's route counter after the last route of this visit ("Te quedan N rutas hoy"). */
  today: RoutesToday | null;
  /** A route arrived (`saved`: false when the device could not store it): open it. */
  onCreated: (route: CoachRoute, saved: boolean, usage: GenerationUsage) => void;
}

/**
 * Modo rápido form: free text (1–500 characters) → a route. The request runs in
 * `components/coach/generation`: leaving `/rapido/` does not throw it away (it is saved in Mis
 * rutas when it arrives and waits here to be opened).
 */
export function QuickForm({ lang, draft: text, setDraft: setText, online, today, onCreated }: QuickFormProps) {
  const id = useId();
  const key = routeJob(lang);
  const job = useRouteGeneration(lang, ({ route, saved, usage }) => {
    setText("");
    onCreated(route, saved, usage);
  });
  const pending = job?.status === "pending";
  const error = job?.status === "error" && job.error.kind !== "unauthorized" ? job.error : null;
  const message = error ? errorText(error, online) : null;
  // A paid route the device could not store lives only in memory: no new request until it is
  // opened or dismissed (a new one would overwrite it).
  const unsaved = job?.status === "done" && !job.saved ? job.route : null;
  const blocked = error?.kind === "limit" || unsaved !== null;
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  // A route that finished while you were elsewhere: once its notice shows, the description it was
  // made from leaves the form (something typed since stays).
  const readyInput = job?.status === "done" ? job.input : null;
  useEffect(() => {
    if (readyInput !== null) setText((prev) => (prev.trim() === readyInput ? "" : prev));
  }, [readyInput, setText]);

  const value = pending ? job.input : text;
  const over = value.length > LIMIT;
  const left = routesLeft(today);

  const edit = (next: string) => {
    setText(next);
    if (job?.status === "error") clearGeneration(key);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const description = text.trim();
    if (!description || over || pending || !online || blocked) return;
    startRoute(lang, description);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {job?.status === "done" ? (
        <Ready
          route={job.route}
          saved={job.saved}
          today={job.usage.today}
          onOpen={() => {
            clearGeneration(key);
            onCreated(job.route, job.saved, job.usage);
          }}
          onDismiss={() => setConfirmDismiss(true)}
        />
      ) : null}
      {unsaved && confirmDismiss ? (
        <ConfirmDialog
          title="¿Descartar esta ruta?"
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

      <label htmlFor={id} className="sr-only">
        Qué necesitas
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
          placeholder="Ej.: tengo que imprimir un documento desde el móvil"
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
            Preparando tu ruta…
          </>
        ) : (
          <>
            <SparklesIcon width={22} height={22} /> Prepárame
          </>
        )}
      </Button>
      {pending ? (
        <p role="status" className="text-sm text-ink-muted">
          <span className="sr-only">Preparando tu ruta… </span>
          Suele tardar unos segundos. Si sales de aquí, se guardará igual en Mis rutas (no cierres la app).
        </p>
      ) : null}
      {unsaved ? (
        <p className="text-sm text-ink-muted">Abre o descarta «{unsaved.title}» antes de preparar otra ruta.</p>
      ) : null}
      {message ? <Notice>{message}</Notice> : null}
      {!pending && left && job?.status !== "done" ? <p className="text-sm font-bold text-sea-deep">{left}</p> : null}
    </form>
  );
}

/**
 * A route that finished while you were elsewhere (already in Mis rutas when `saved`; otherwise it
 * can be opened or dismissed).
 */
function Ready({
  route,
  saved,
  today,
  onOpen,
  onDismiss,
}: {
  route: CoachRoute;
  saved: boolean;
  today: RoutesToday;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const left = routesLeft(today);
  return (
    <Notice tone={saved ? "success" : "info"} className="flex flex-col gap-3">
      <p>
        {saved
          ? `«${route.title}» ya está lista y guardada en Mis rutas.`
          : `«${route.title}» ya está lista, pero no he podido guardarla en este móvil: ábrela ahora o se perderá.`}
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
