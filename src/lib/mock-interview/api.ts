/**
 * Mi entrevista's calls to the coach backend (docs/mock-interview.md "API"): owner only, with the
 * stored access code. Each resolves with checked data or rejects with a `CoachApiError` from
 * `@/lib/coach` (kind offline | unauthorized | limit | failed | aborted | other, the server's
 * `code` — `forbidden`, `no_deck`, `daily_limit`, `budget`, `not_configured`… — and a Spanish
 * `message` to show as is). Bodies are trimmed and clamped to the server's limits first. Every
 * billed call is applied to the stored usage summary (`usage.mock`).
 */
import { CoachApiError, coachJson, invalidCoachResponse, type CoachCallOptions } from "@/lib/coach/api";
import { isObject } from "@/lib/coach/parse";
import { noteMockCall } from "@/lib/coach/usage";
import { storeDeck } from "./deck";
import { parseDeck, parseFeedback, parseInterviewerTurn, parseMockCallUsage, parseMockReport, toScore } from "./parse";
import {
  MOCK_REQUEST_LIMITS as L,
  type FeedbackRequest,
  type FeedbackResult,
  type ReportRequest,
  type ReportResult,
  type StoredDeck,
  type TurnRequest,
  type TurnResult,
} from "./types";

const MESSAGES = {
  offline: "No hay conexión. Mi entrevista necesita internet para preguntar y corregir; tus tarjetas e intentos siguen en el dispositivo.",
  unavailable: "Mi entrevista no está disponible en este servidor.",
  emptyAnswer: "No hay respuesta: di o escribe algo antes de seguir.",
  noAnswers: "No hay respuestas corregidas para hacer el informe.",
};

/** Prepárate's wording of "no connection" and "no backend here" is replaced by Mi entrevista's. */
function mockError(e: unknown): unknown {
  if (!(e instanceof CoachApiError)) return e;
  if (e.kind === "offline" && e.code === "offline" && typeof navigator !== "undefined" && navigator.onLine === false) {
    return new CoachApiError("offline", MESSAGES.offline, e.status, e.code);
  }
  // A 404 the coach backend did not write (a plain static host); `no_deck` keeps its own message.
  if (e.status === 404 && e.code === "other") return new CoachApiError("other", MESSAGES.unavailable, 404, "other");
  return e;
}

async function call(path: string, options?: CoachCallOptions): Promise<Record<string, unknown>> {
  let data: unknown;
  try {
    data = await coachJson(path, options);
  } catch (e) {
    throw mockError(e);
  }
  if (!isObject(data)) throw invalidCoachResponse();
  return data;
}

/** `s` trimmed and cut at `max` characters, at the last space when there is one in the second half. */
function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max / 2 ? cut.slice(0, space) : cut).trim();
}

/** The answer as sent (trimmed, ≤ 3000); an empty one rejects with code `empty_answer`. */
function answerText(s: string): string {
  const t = clip(s, L.answer);
  if (!t) throw new CoachApiError("other", MESSAGES.emptyAnswer, 0, "empty_answer");
  return t;
}

const secondsOf = (s: number) => (Number.isFinite(s) ? Math.min(L.seconds, Math.max(0, Math.round(s))) : 0);

/**
 * Downloads the owner's deck and stores it on the device (`saved: false` when storage failed: the
 * deck is still returned). On any failure the stored deck is left as it was. 404 `no_deck`: none
 * uploaded yet; 403 `forbidden`: not the owner.
 */
export async function fetchDeck(opts: { signal?: AbortSignal } = {}): Promise<StoredDeck & { saved: boolean }> {
  const data = await call("deck", { signal: opts.signal });
  const deck = parseDeck(data.deck);
  if (!deck) throw invalidCoachResponse();
  const stored: StoredDeck = {
    deck,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    fetchedAt: new Date().toISOString(),
  };
  return { ...stored, saved: storeDeck(stored) };
}

/**
 * The interviewer after an answer: a follow-up (`next.line`) or move on. `followUpsLeft: 0` gets
 * the canned move-on at once (nothing billed). An empty answer rejects with code `empty_answer`.
 */
export async function takeTurn(req: TurnRequest, opts: { signal?: AbortSignal } = {}): Promise<TurnResult> {
  const body = {
    cardId: req.cardId,
    tone: req.tone,
    asked: clip(req.asked, L.asked),
    history: req.history
      .filter((h) => h.asked.trim())
      .slice(-L.history)
      .map((h) => ({ asked: clip(h.asked, L.asked), answer: clip(h.answer, L.answer) })),
    answer: answerText(req.answer),
    seconds: secondsOf(req.seconds),
    followUpsLeft: Number.isFinite(req.followUpsLeft) ? Math.min(L.followUps, Math.max(0, Math.round(req.followUpsLeft))) : 0,
  };
  const data = await call("interviewer", { method: "POST", body, signal: opts.signal });
  const next = parseInterviewerTurn(data.next);
  if (!next) throw invalidCoachResponse();
  const usage = parseMockCallUsage(data.usage);
  noteMockCall(usage, "turn");
  return { next, usage };
}

/** One answer's correction (`kind: "answer"`). An empty answer rejects with code `empty_answer`. */
export async function getFeedback(req: FeedbackRequest, opts: { signal?: AbortSignal } = {}): Promise<FeedbackResult> {
  const body = {
    kind: "answer",
    cardId: req.cardId,
    asked: clip(req.asked, L.asked),
    isFollowUp: req.isFollowUp,
    answer: answerText(req.answer),
    seconds: secondsOf(req.seconds),
    stuck: req.stuck,
  };
  const data = await call("feedback", { method: "POST", body, signal: opts.signal });
  const feedback = parseFeedback(data.feedback);
  if (!feedback) throw invalidCoachResponse();
  const usage = parseMockCallUsage(data.usage);
  noteMockCall(usage, "answer");
  return { feedback, usage };
}

/**
 * The simulacro's report (`kind: "report"`) from its corrected answers (the first 24; each with at
 * most 4 invented claims and 3 mistakes). No answers rejects with code `no_answers`.
 */
export async function getReport(req: ReportRequest, opts: { signal?: AbortSignal } = {}): Promise<ReportResult> {
  const answers = req.answers.slice(0, L.reportAnswers).map((a) => ({
    cardId: a.cardId,
    asked: clip(a.asked, L.asked),
    score: toScore(a.score) ?? 1,
    summary: clip(a.summary, L.summary),
    invented: a.invented
      .map((c) => clip(c, L.line))
      .filter(Boolean)
      .slice(0, L.reportInvented),
    mistakes: a.mistakes
      .map((m) => ({ said: clip(m.said, L.line), better: clip(m.better, L.line), why: clip(m.why, L.line) }))
      .filter((m) => m.said && m.better && m.why)
      .slice(0, L.reportMistakes),
  }));
  if (!answers.length) throw new CoachApiError("other", MESSAGES.noAnswers, 0, "no_answers");
  const data = await call("feedback", { method: "POST", body: { kind: "report", tone: req.tone, answers }, signal: opts.signal });
  const report = parseMockReport(data.report);
  if (!report) throw invalidCoachResponse();
  const usage = parseMockCallUsage(data.usage);
  noteMockCall(usage, "report");
  return { report, usage };
}
