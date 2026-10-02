"use client";

/**
 * Pack generations that outlive the screen that started them. The server bills a generation
 * whether or not anyone is still looking, so leaving the form (opening a saved pack, another tab)
 * never aborts the request: it finishes here, the pack is saved ("Mis situaciones", or replaced
 * in place for a refinement) and the result waits for the screen to come back. Only an explicit
 * "Cancelar" aborts (the UI says it still counts). In memory: closing the app loses a running one.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  generatePack,
  refinePack,
  replacePack,
  savePack,
  toCoachApiError,
  type CoachApiError,
  type CoachPack,
  type PackResult,
} from "@/lib/coach";

export type GenerationResult =
  | { status: "done"; pack: CoachPack; saved: boolean; input: string }
  | { status: "error"; error: CoachApiError; input: string };

/** `input`: the description (new pack) or the instruction (refinement, "" = "Generar otra vez"). */
export type Generation = { status: "pending"; input: string; ctrl: AbortController } | GenerationResult;

const jobs = new Map<string, Generation>();
const listeners = new Set<() => void>();
/** The mounted screen of each job: it gets the finished pack at once instead of it waiting. */
const consumers = new Map<string, (result: Extract<GenerationResult, { status: "done" }>) => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export const newPackJob = (lang: string) => `new\n${lang}`;
export const refineJob = (pack: CoachPack) => `refine\n${pack.lang}\n${pack.id}`;

function run(key: string, input: string, request: (signal: AbortSignal) => Promise<PackResult>, store: (pack: CoachPack) => boolean) {
  if (jobs.get(key)?.status === "pending") return;
  const ctrl = new AbortController();
  const current = () => {
    const job = jobs.get(key);
    return job?.status === "pending" && job.ctrl === ctrl;
  };
  jobs.set(key, { status: "pending", input, ctrl });
  notify();
  request(ctrl.signal).then(
    ({ pack }) => {
      // Saved even if the job was cancelled after the answer arrived: it is already paid for.
      const saved = store(pack);
      if (!current()) return;
      const result = { status: "done", pack, saved, input } as const;
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

/** Starts a new pack for `description` (no-op while one is running for `lang`). */
export function startNewPack(lang: string, description: string): void {
  run(newPackJob(lang), description, (signal) => generatePack(lang, description, { signal }), savePack);
}

/** Starts "Ajustar" (`instruction`) or "Generar otra vez" (`""`) of a pack. */
export function startRefine(pack: CoachPack, instruction: string): void {
  run(refineJob(pack), instruction, (signal) => refinePack(pack, instruction, { signal }), replacePack);
}

/** "Cancelar": aborts the request (the server may still bill it) and forgets the job. */
export function cancelGeneration(key: string): void {
  const job = jobs.get(key);
  if (job?.status !== "pending") return;
  jobs.delete(key);
  job.ctrl.abort();
  notify();
}

/** Forgets a finished job (shown or delivered). */
export function clearGeneration(key: string): void {
  if (jobs.get(key)?.status === "pending" || !jobs.has(key)) return;
  jobs.delete(key);
  notify();
}

/**
 * The job under `key`, live (undefined when none). While mounted, `onDone` receives a pack that
 * finishes at once (the job is then forgotten); one that finished while unmounted stays as the
 * returned `done` job until `clearGeneration`.
 */
export function useGeneration(
  key: string,
  onDone?: (result: Extract<GenerationResult, { status: "done" }>) => void,
): Generation | undefined {
  const job = useSyncExternalStore(subscribe, () => jobs.get(key), () => undefined);
  const callback = useRef(onDone);
  useEffect(() => {
    callback.current = onDone;
  });
  const consumes = onDone !== undefined;
  useEffect(() => {
    if (!consumes) return;
    const fn: NonNullable<typeof onDone> = (result) => callback.current?.(result);
    consumers.set(key, fn);
    return () => {
      if (consumers.get(key) === fn) consumers.delete(key);
    };
  }, [key, consumes]);
  return job;
}
