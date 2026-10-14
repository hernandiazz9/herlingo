"use client";

/**
 * Generations that outlive the screen that started them: Prepárate packs, Modo rápido routes and
 * (through `runJob` / `useJob`, `components/sport/generation.ts`) Modo deporte episodes: the one
 * job runner. The server bills a generation whether or not anyone is still looking, so leaving the
 * form (opening a saved pack or route, another tab) never aborts the request: it finishes here, the
 * result is saved ("Mis situaciones" / "Mis rutas" / "Mis episodios", or a pack replaced in place
 * for a refinement) and waits for the screen to come back. Only an explicit "Cancelar" aborts (the
 * UI says it still counts). In memory: closing the app loses a running one.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  generatePack,
  generateRoute,
  refinePack,
  replacePack,
  savePack,
  saveRoute,
  toCoachApiError,
  type CoachApiError,
  type CoachPack,
  type CoachRoute,
  type GenerationUsage,
} from "@/lib/coach";

/** A finished job: `P` is what it produced (`{ pack }` for packs, `{ route, usage }` for routes). */
export type JobResult<P extends object> =
  | ({ status: "done"; saved: boolean; input: string } & P)
  | { status: "error"; error: CoachApiError; input: string };

export type Job<P extends object> = { status: "pending"; input: string; ctrl: AbortController } | JobResult<P>;

export type JobDone<P extends object> = Extract<JobResult<P>, { status: "done" }>;

type PackPayload = { pack: CoachPack };
type RoutePayload = { route: CoachRoute; usage: GenerationUsage };

/** `input`: the description (new pack) or the instruction (refinement, "" = "Generar otra vez"). */
export type GenerationResult = JobResult<PackPayload>;
export type Generation = Job<PackPayload>;

/** A Modo rápido route job (`input` = the description); `usage.today` is the route counter. */
export type RouteGenerationResult = JobResult<RoutePayload>;
export type RouteGeneration = Job<RoutePayload>;

const jobs = new Map<string, Job<object>>();
const listeners = new Set<() => void>();
/** The mounted screen of each job: it gets the finished result at once instead of it waiting. */
const consumers = new Map<string, (result: JobDone<object>) => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export const newPackJob = (lang: string) => `new\n${lang}`;
export const refineJob = (pack: CoachPack) => `refine\n${pack.lang}\n${pack.id}`;
export const routeJob = (lang: string) => `route\n${lang}`;

/**
 * Starts the job `key` (`input` = what the learner asked for): `request` runs outside any screen,
 * `store` saves its payload as soon as it arrives (true = stored) even if the job was cancelled
 * meanwhile. No-op while `key` is running.
 */
export function runJob<P extends object>(
  key: string,
  input: string,
  request: (signal: AbortSignal) => Promise<P>,
  store: (payload: P) => boolean,
) {
  if (jobs.get(key)?.status === "pending") return;
  const ctrl = new AbortController();
  const current = () => {
    const job = jobs.get(key);
    return job?.status === "pending" && job.ctrl === ctrl;
  };
  jobs.set(key, { status: "pending", input, ctrl });
  notify();
  request(ctrl.signal).then(
    (payload) => {
      // Saved even if the job was cancelled after the answer arrived: it is already paid for.
      const saved = store(payload);
      if (!current()) return;
      const result = { ...payload, status: "done", saved, input } as JobDone<P>;
      const consumer = consumers.get(key);
      if (consumer) {
        jobs.delete(key);
        notify();
        consumer(result);
      } else {
        jobs.set(key, result);
        notify();
      }
    },
    (e: unknown) => {
      if (!current()) return;
      const error = toCoachApiError(e);
      if (error.kind === "aborted") jobs.delete(key);
      else jobs.set(key, { status: "error", error, input });
      notify();
    },
  );
}

/**
 * True while a finished result the device could not store waits under `key` to be opened or
 * dismissed (`clearGeneration`): it is paid for and exists nowhere else, so a new request must not
 * overwrite it.
 */
export function holdsUnsaved(key: string): boolean {
  const job = jobs.get(key);
  return job?.status === "done" && !job.saved;
}

/**
 * Starts a new pack for `description`. No-op while one is running for `lang`, and while a finished
 * one the device could not store waits to be opened or dismissed.
 */
export function startNewPack(lang: string, description: string): void {
  if (holdsUnsaved(newPackJob(lang))) return;
  runJob<PackPayload>(
    newPackJob(lang),
    description,
    (signal) => generatePack(lang, description, { signal }).then(({ pack }) => ({ pack })),
    ({ pack }) => savePack(pack),
  );
}

/** Starts "Ajustar" (`instruction`) or "Generar otra vez" (`""`) of a pack. */
export function startRefine(pack: CoachPack, instruction: string): void {
  runJob<PackPayload>(
    refineJob(pack),
    instruction,
    (signal) => refinePack(pack, instruction, { signal }).then((result) => ({ pack: result.pack })),
    (payload) => replacePack(payload.pack),
  );
}

/**
 * Starts a Modo rápido route for `description` (saved in "Mis rutas" when it arrives). No-op
 * while one is running for `lang`, and while a finished one the device could not store waits to be
 * opened or dismissed.
 */
export function startRoute(lang: string, description: string): void {
  if (holdsUnsaved(routeJob(lang))) return;
  runJob<RoutePayload>(
    routeJob(lang),
    description,
    (signal) => generateRoute(lang, description, { signal }).then(({ route, usage }) => ({ route, usage })),
    ({ route }) => saveRoute(route),
  );
}

/** "Cancelar": aborts the request (the server may still bill it) and forgets the job. */
export function cancelGeneration(key: string): void {
  const job = jobs.get(key);
  if (job?.status !== "pending") return;
  jobs.delete(key);
  job.ctrl.abort();
  notify();
}

/**
 * The pack was deleted: its running refinement is aborted (its answer would have nowhere to go;
 * `replacePack` never stores a version of a deleted pack) and a finished one is forgotten.
 */
export function forgetRefine(pack: CoachPack): void {
  const key = refineJob(pack);
  cancelGeneration(key);
  clearGeneration(key);
}

/** Forgets a finished job (shown or delivered). */
export function clearGeneration(key: string): void {
  if (jobs.get(key)?.status === "pending" || !jobs.has(key)) return;
  jobs.delete(key);
  notify();
}

/**
 * The job under `key`, live (undefined when none). While mounted, `onDone` receives a result that
 * finishes at once (the job is then forgotten); one that finished while unmounted stays as the
 * returned `done` job until `clearGeneration`.
 */
export function useJob<P extends object>(key: string, onDone?: (result: JobDone<P>) => void): Job<P> | undefined {
  const job = useSyncExternalStore(subscribe, () => jobs.get(key) as Job<P> | undefined, () => undefined);
  const callback = useRef(onDone);
  useEffect(() => {
    callback.current = onDone;
  });
  const consumes = onDone !== undefined;
  useEffect(() => {
    if (!consumes) return;
    const fn = (result: JobDone<object>) => callback.current?.(result as JobDone<P>);
    consumers.set(key, fn);
    return () => {
      if (consumers.get(key) === fn) consumers.delete(key);
    };
  }, [key, consumes]);
  return job;
}

/** The pack job under `key`, live: `useJob`'s contract. */
export function useGeneration(key: string, onDone?: (result: JobDone<PackPayload>) => void): Generation | undefined {
  return useJob<PackPayload>(key, onDone);
}

/** The route job of `lang`, live: same contract as `useGeneration` (clear it with `routeJob(lang)`). */
export function useRouteGeneration(
  lang: string,
  onDone?: (result: JobDone<RoutePayload>) => void,
): RouteGeneration | undefined {
  return useJob<RoutePayload>(routeJob(lang), onDone);
}
