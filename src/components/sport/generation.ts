"use client";

/**
 * AI episodes that outlive the screen that asked for them, on Prepárate's job runner
 * (`components/coach/generation.ts`, same contract as packs and routes): the server bills an
 * episode whether or not anyone is still looking, so leaving /deporte/ never aborts the request. It
 * finishes there, is saved in "Mis episodios" and waits for the screen to come back. One job per
 * language. In memory: closing the app loses a running one.
 */
import {
  clearGeneration,
  holdsUnsaved,
  runJob,
  useJob,
  type Job,
  type JobDone,
} from "@/components/coach/generation";
import { generateEpisode, saveEpisode, type GenerationUsage, type StoredEpisode } from "@/lib/coach";

type EpisodePayload = { episode: StoredEpisode; usage: GenerationUsage };

/** An episode job (`input` = the description); `usage.today` is the episode counter. */
export type EpisodeGeneration = Job<EpisodePayload>;
export type EpisodeGenerationDone = JobDone<EpisodePayload>;

const episodeJob = (lang: string) => `episode\n${lang}`;

/**
 * Asks for an episode about `description`, saved in "Mis episodios" when it arrives (even if the
 * screen was left). No-op while one is running for `lang`, and while a finished one the device
 * could not store waits to be opened or dismissed (it is paid for and exists nowhere else).
 */
export function startEpisode(lang: string, description: string): void {
  if (holdsUnsaved(episodeJob(lang))) return;
  runJob<EpisodePayload>(
    episodeJob(lang),
    description,
    (signal) => generateEpisode(lang, description, { signal }).then(({ episode, usage }) => ({ episode, usage })),
    ({ episode }) => saveEpisode(episode),
  );
}

/** Forgets the finished job of `lang` (shown, opened or dismissed); a running one is left alone. */
export function clearEpisodeGeneration(lang: string): void {
  clearGeneration(episodeJob(lang));
}

/** The episode job of `lang`, live: `useJob`'s contract (clear it with `clearEpisodeGeneration`). */
export function useEpisodeGeneration(lang: string, onDone?: (result: EpisodeGenerationDone) => void): EpisodeGeneration | undefined {
  return useJob<EpisodePayload>(episodeJob(lang), onDone);
}
