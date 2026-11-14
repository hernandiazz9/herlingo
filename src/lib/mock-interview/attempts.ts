/**
 * The answers on the device (`lang-lern:mock-interview:attempts` = `{ v: 1, attempts }`, newest
 * first, unique ids). No count cap and nothing dropped automatically: from
 * `EXPORT_SUGGESTED_AT` attempts the screen suggests «Exportar intentos»; attempts are deleted
 * only by an explicit action (`deleteAttempt`, `deleteAllAttempts`). Per-card state is derived
 * (`cardStats`), never stored.
 */
import { CoachApiError, toCoachApiError } from "@/lib/coach/api";
import { getFeedback } from "./api";
import { parseAttempts, toScore } from "./parse";
import { MOCK_KEYS, newId, readRaw, writeStored } from "./store";
import type { AttemptMode, AttemptRating, CardStats, FeedbackResult, MockAttempt, MockScore } from "./types";
import { countWords, wordsPerMinute } from "./words";

/** From this many attempts the screen suggests exporting them. */
export const EXPORT_SUGGESTED_AT = 400;

export const readAttemptsRaw = (): string => readRaw(MOCK_KEYS.attempts);

export function getAttempts(): MockAttempt[] {
  if (typeof window === "undefined") return [];
  return parseAttempts(readAttemptsRaw());
}

export function getAttempt(id: string): MockAttempt | undefined {
  return getAttempts().find((a) => a.id === id);
}

function write(attempts: MockAttempt[]): boolean {
  return writeStored(MOCK_KEYS.attempts, { attempts });
}

/** What the screen knows when an answer ends; the id, date, words and pace are added. */
export interface NewAttempt {
  mode: AttemptMode;
  sessionId?: string;
  cardId: string;
  asked: string;
  isFollowUp: boolean;
  transcript: string;
  seconds: number;
  stuck: boolean;
}

/** Stores an answer at the top of the list. Null when storage failed. */
export function addAttempt(input: NewAttempt): MockAttempt | null {
  const seconds = Number.isFinite(input.seconds) && input.seconds > 0 ? Math.round(input.seconds * 10) / 10 : 0;
  const words = countWords(input.transcript);
  const attempt: MockAttempt = {
    id: newId(),
    at: new Date().toISOString(),
    mode: input.mode,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    cardId: input.cardId,
    asked: input.asked,
    isFollowUp: input.isFollowUp,
    transcript: input.transcript,
    seconds,
    words,
    wpm: wordsPerMinute(words, seconds),
    stuck: input.stuck,
  };
  return write([attempt, ...getAttempts()]) ? attempt : null;
}

/** Rewrites one attempt in place. False when it is not there or storage failed. */
function patchAttempt(id: string, fn: (a: MockAttempt) => MockAttempt): boolean {
  const attempts = getAttempts();
  const i = attempts.findIndex((a) => a.id === id);
  if (i < 0) return false;
  attempts[i] = fn(attempts[i]);
  return write(attempts);
}

/** Its feedback (clears `feedbackError`), the model and the correction's cost. */
export function setAttemptFeedback(id: string, result: FeedbackResult): boolean {
  return patchAttempt(id, (a) => {
    const next: MockAttempt = { ...a, feedback: result.feedback, costUsd: result.usage.costUsd };
    if (result.usage.model) next.model = result.usage.model;
    delete next.feedbackError;
    return next;
  });
}

/** Why its correction failed (Spanish, shown as is); the feedback it may already have is kept. */
export function setAttemptFeedbackError(id: string, message: string): boolean {
  return patchAttempt(id, (a) => ({ ...a, feedbackError: message }));
}

/**
 * «¿Te sirvió?» (`useful`) and «Tu nota» (`myScore`, 1–5), merged into the attempt's rating; a key
 * passed as `undefined` clears it. False when the attempt is not there or storage failed.
 */
export function rateAttempt(id: string, rating: AttemptRating): boolean {
  return patchAttempt(id, (a) => {
    const next: AttemptRating = { ...a.rating };
    if ("useful" in rating) {
      if (typeof rating.useful === "boolean") next.useful = rating.useful;
      else delete next.useful;
    }
    if ("myScore" in rating) {
      const score = toScore(rating.myScore);
      if (score !== null) next.myScore = score;
      else delete next.myScore;
    }
    const out: MockAttempt = { ...a, rating: next };
    if (!Object.keys(next).length) delete out.rating;
    return out;
  });
}

/**
 * Corrects a stored attempt (`POST /api/coach/feedback/`) and stores the result on it: the
 * feedback, or the error's message in `feedbackError` (an aborted request stores nothing). Rejects
 * with the `CoachApiError` like `getFeedback`; code `no_attempt` when the attempt is not stored.
 */
export async function correctAttempt(id: string, opts: { signal?: AbortSignal } = {}): Promise<FeedbackResult> {
  const a = getAttempt(id);
  if (!a) throw new CoachApiError("other", "Ese intento ya no está en el dispositivo.", 0, "no_attempt");
  try {
    const result = await getFeedback(
      { cardId: a.cardId, asked: a.asked, isFollowUp: a.isFollowUp, answer: a.transcript, seconds: a.seconds, stuck: a.stuck },
      opts,
    );
    setAttemptFeedback(id, result);
    return result;
  } catch (e) {
    const err = toCoachApiError(e);
    if (err.kind !== "aborted") setAttemptFeedbackError(id, err.message);
    throw err;
  }
}

/** Deletes one attempt (an explicit action only). */
export function deleteAttempt(id: string): boolean {
  const attempts = getAttempts();
  return attempts.some((a) => a.id === id) ? write(attempts.filter((a) => a.id !== id)) : true;
}

/** Deletes every attempt (an explicit action only, e.g. after exporting them). */
export function deleteAllAttempts(): boolean {
  return write([]);
}

/** The attempts of one simulacro, in the order they were answered (oldest first). */
export function sessionAttempts(attempts: readonly MockAttempt[], sessionId: string): MockAttempt[] {
  return attempts.filter((a) => a.sessionId === sessionId).sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Per-card state from the attempts: answers to the card's own question (follow-ups counted apart),
 * the newest and best score of those answers, and «Dominada» when the two newest corrected ones
 * scored 4 or more. Cards without attempts are absent: use `EMPTY_CARD_STATS`.
 */
export function cardStats(attempts: readonly MockAttempt[]): Map<string, CardStats> {
  const newestFirst = [...attempts].sort((a, b) => b.at.localeCompare(a.at));
  const byCard = new Map<string, CardStats & { scores: MockScore[] }>();
  for (const a of newestFirst) {
    let s = byCard.get(a.cardId);
    if (!s) {
      s = { answers: 0, followUps: 0, lastAt: a.at, mastered: false, scores: [] };
      byCard.set(a.cardId, s);
    }
    if (a.isFollowUp) s.followUps++;
    else {
      s.answers++;
      if (a.feedback) s.scores.push(a.feedback.score);
    }
  }
  const out = new Map<string, CardStats>();
  for (const [cardId, { scores, ...s }] of byCard) {
    out.set(cardId, {
      ...s,
      ...(scores.length ? { lastScore: scores[0], bestScore: Math.max(...scores) as MockScore } : {}),
      mastered: scores.length >= 2 && scores[0] >= 4 && scores[1] >= 4,
    });
  }
  return out;
}

/** A card with no attempts. */
export const EMPTY_CARD_STATS: Readonly<CardStats> = Object.freeze({ answers: 0, followUps: 0, mastered: false });
