"use client";

/**
 * AI episodes that outlive the screen that asked for them (same contract as Prepárate's
 * `components/coach/generation.ts`): the server bills an episode whether or not anyone is still
 * looking, so leaving /deporte/ never aborts the request. It finishes here, is saved in "Mis
 * episodios" and waits for the screen to come back. One job per language. In memory: closing the
 * app loses a running one.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Job, JobDone } from "@/components/coach/generation";
import { generateEpisode, saveEpisode, toCoachApiError, type GenerationUsage, type StoredEpisode } from "@/lib/coach";

type EpisodePayload = { episode: StoredEpisode; usage: GenerationUsage };

/** An episode job (`input` = the description); `usage.today` is the episode counter. */
export type EpisodeGeneration = Job<EpisodePayload>;
export type EpisodeGenerationDone = JobDone<EpisodePayload>;

const jobs = new Map<string, EpisodeGeneration>();
const listeners = new Set<() => void>();
/** The mounted screen of each language: it gets the finished episode at once instead of it waiting. */
const consumers = new Map<string, (result: EpisodeGenerationDone) => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/**
 * True while a finished episode the device could not store waits to be opened or dismissed: it is
 * paid for and exists nowhere else, so a new request must not overwrite it.
 */
function holdsUnsaved(lang: string): boolean {
  const job = jobs.get(lang);
  return job?.status === "done" && !job.saved;
}

/**
 * Asks for an episode about `description`, saved in "Mis episodios" when it arrives (even if the
 * screen was left). No-op while one is running for `lang`, and while a finished one the device
 * could not store waits to be opened or dismissed.
 */
export function startEpisode(lang: string, description: string): void {
  if (jobs.get(lang)?.status === "pending" || holdsUnsaved(lang)) return;
  const ctrl = new AbortController();
  const current = () => {
    const job = jobs.get(lang);
    return job?.status === "pending" && job.ctrl === ctrl;
  };
  jobs.set(lang, { status: "pending", input: description, ctrl });
  notify();
  generateEpisode(lang, description, { signal: ctrl.signal }).then(
    ({ episode, usage }) => {
      // Saved even if the job was dropped after the answer arrived: it is already paid for.
      const saved = saveEpisode(episode);
      if (!current()) return;
      const result: EpisodeGenerationDone = { status: "done", saved, input: description, episode, usage };
      const consumer = consumers.get(lang);
      if (consumer) {
        jobs.delete(lang);
        notify();
        consumer(result);
      } else {
        jobs.set(lang, result);
        notify();
      }
    },
    (e: unknown) => {
      if (!current()) return;
      const error = toCoachApiError(e);
      if (error.kind === "aborted") jobs.delete(lang);
      else jobs.set(lang, { status: "error", error, input: description });
      notify();
    },
  );
}

/** Forgets the finished job of `lang` (shown, opened or dismissed); a running one is left alone. */
export function clearEpisodeGeneration(lang: string): void {
  const job = jobs.get(lang);
  if (!job || job.status === "pending") return;
  jobs.delete(lang);
  notify();
}

/**
 * The episode job of `lang`, live (undefined when none). While mounted, `onDone` receives an
 * episode that finishes at once (the job is then forgotten); one that finished while unmounted
 * stays as the returned `done` job until `clearEpisodeGeneration`.
 */
export function useEpisodeGeneration(lang: string, onDone?: (result: EpisodeGenerationDone) => void): EpisodeGeneration | undefined {
  const job = useSyncExternalStore(subscribe, () => jobs.get(lang), () => undefined);
  const callback = useRef(onDone);
  useEffect(() => {
    callback.current = onDone;
  });
  const consumes = onDone !== undefined;
  useEffect(() => {
    if (!consumes) return;
    const fn = (result: EpisodeGenerationDone) => callback.current?.(result);
    consumers.set(lang, fn);
    return () => {
      if (consumers.get(lang) === fn) consumers.delete(lang);
    };
  }, [lang, consumes]);
  return job;
}
