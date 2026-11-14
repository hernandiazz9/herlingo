/**
 * Hand-written shape checks for Mi entrevista (no zod in src/): server responses and stored
 * values. Tolerant: invalid items are skipped, missing optional texts are empty, a stored value
 * that cannot be read is empty. Nothing here throws. Stored texts are never cut (the learner's
 * data stays as written).
 */
import { isObject } from "@/lib/coach/parse";
import { readStored } from "./store";
import type {
  AnswerFeedback,
  AttemptRating,
  DeckBlock,
  DeckCard,
  DeckLine,
  DeckPhrase,
  FeedbackMistake,
  InterviewDeck,
  InterviewerTurn,
  InventedClaim,
  MockAttempt,
  MockCallUsage,
  MockReport,
  MockScore,
  MockTone,
  SavedReport,
  StoredDeck,
} from "./types";
import { countWords, wordsPerMinute } from "./words";

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const num = (v: unknown): number => (isNum(v) ? v : 0);
const nonNegative = (v: unknown): number => (isNum(v) && v > 0 ? v : 0);
const texts = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isText) : []);
/** The valid items of an array (others skipped); [] when not an array. */
const items = <T>(v: unknown, fn: (x: unknown) => T | null): T[] => (Array.isArray(v) ? v.flatMap((x) => fn(x) ?? []) : []);

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v);

/** An integer 1–5 (rounded and clamped), or null when not a number. */
export function toScore(v: unknown): MockScore | null {
  return isNum(v) ? (Math.min(5, Math.max(1, Math.round(v))) as MockScore) : null;
}

export const isTone = (v: unknown): v is MockTone => v === "friendly" || v === "tough";

// ---- Deck ----

function deckLine(v: unknown): DeckLine | null {
  return isObject(v) && isText(v.en) && isText(v.es) ? { en: v.en, es: v.es } : null;
}

function deckPhrase(v: unknown): DeckPhrase | null {
  const line = deckLine(v);
  return line && isObject(v) ? { ...line, ...(isText(v.note) ? { note: v.note } : {}) } : null;
}

function deckBlock(v: unknown): DeckBlock | null {
  if (!isObject(v) || !isId(v.id) || !isText(v.title)) return null;
  return { id: v.id, title: v.title, ...(isText(v.intro) ? { intro: v.intro } : {}) };
}

/** A card, or null without an id, a block, a title, a question or any model-answer sentence. */
function deckCard(v: unknown): DeckCard | null {
  if (!isObject(v) || !isId(v.id) || !isId(v.block) || !isText(v.title) || !isText(v.question)) return null;
  const answer = items(v.answer, deckLine);
  if (!answer.length) return null;
  return {
    id: v.id,
    block: v.block,
    title: v.title,
    question: v.question,
    variants: texts(v.variants),
    answer,
    anchors: texts(v.anchors),
    phrases: items(v.phrases, deckPhrase),
    ...(isText(v.tip) ? { tip: v.tip } : {}),
    ...(isText(v.pending) ? { pending: v.pending } : {}),
    ...(isNum(v.seconds) && v.seconds > 0 ? { seconds: Math.round(v.seconds) } : {}),
  };
}

/**
 * A deck (version 1), tolerant: invalid blocks and cards are skipped, the first of each id kept,
 * cards of an unknown block and blocks left without cards dropped; null when no card is left.
 */
export function parseDeck(v: unknown): InterviewDeck | null {
  if (!isObject(v) || v.version !== 1) return null;
  const blockIds = new Set<string>();
  const blocks = items(v.blocks, deckBlock).filter((b) => !blockIds.has(b.id) && blockIds.add(b.id));
  const cardIds = new Set<string>();
  const cards = items(v.cards, deckCard).filter((c) => blockIds.has(c.block) && !cardIds.has(c.id) && cardIds.add(c.id));
  if (!cards.length) return null;
  const used = new Set(cards.map((c) => c.block));
  return {
    version: 1,
    generated: str(v.generated),
    ...(isText(v.learner) ? { learner: v.learner } : {}),
    blocks: blocks.filter((b) => used.has(b.id)),
    cards,
  };
}

/** A raw `lang-lern:mock-interview:deck` value; null when absent, corrupt or without a usable deck. */
export function parseStoredDeck(raw: string): StoredDeck | null {
  const v = readStored(raw);
  const deck = parseDeck(v?.deck);
  if (!v || !deck) return null;
  return { deck, updatedAt: str(v.updatedAt), fetchedAt: str(v.fetchedAt) };
}

// ---- Responses ----

/** The interviewer's turn; null without a valid `kind`, or a follow-up without its line. */
export function parseInterviewerTurn(v: unknown): InterviewerTurn | null {
  if (!isObject(v)) return null;
  const ack = str(v.ack).trim();
  if (v.kind === "followup") return isText(v.line) ? { kind: "followup", line: v.line.trim(), ack } : null;
  if (v.kind === "move_on") return { kind: "move_on", ack };
  return null;
}

function mistake(v: unknown): FeedbackMistake | null {
  return isObject(v) && isText(v.said) && isText(v.better) ? { said: v.said, better: v.better, why: str(v.why) } : null;
}

function invented(v: unknown): InventedClaim | null {
  return isObject(v) && isText(v.claim) ? { claim: v.claim, why: str(v.why) } : null;
}

/** An answer's feedback; null without a score or a summary. Lists keep their valid items. */
export function parseFeedback(v: unknown): AnswerFeedback | null {
  if (!isObject(v) || !isText(v.summary)) return null;
  const score = toScore(v.score);
  if (score === null) return null;
  const fluency = isObject(v.fluency) ? v.fluency : {};
  return {
    score,
    summary: v.summary,
    mistakes: items(v.mistakes, mistake),
    pronunciation: texts(v.pronunciation),
    content: str(v.content),
    invented: items(v.invented, invented),
    fluency: { fillers: texts(fluency.fillers), note: str(fluency.note) },
    improved: str(v.improved),
    next: str(v.next),
  };
}

/** A simulacro report; null without a score or a summary. */
export function parseMockReport(v: unknown): MockReport | null {
  if (!isObject(v) || !isText(v.summary)) return null;
  const score = toScore(v.score);
  if (score === null) return null;
  return {
    score,
    summary: v.summary,
    strengths: texts(v.strengths),
    weakPoints: texts(v.weakPoints),
    invented: texts(v.invented),
    next: str(v.next),
  };
}

const today = (v: unknown) => (isObject(v) ? { used: num(v.used), limit: num(v.limit) } : { used: 0, limit: 0 });

/** A response's `usage`; missing figures are 0 (never rejected: the answer itself is what matters). */
export function parseMockCallUsage(v: unknown): MockCallUsage {
  const o = isObject(v) ? v : {};
  const t = isObject(o.tokens) ? o.tokens : {};
  return {
    costUsd: num(o.costUsd),
    model: isText(o.model) ? o.model : null,
    latencyMs: num(o.latencyMs),
    tokens: { input: num(t.input), output: num(t.output), cacheWrite: num(t.cacheWrite), cacheRead: num(t.cacheRead) },
    today: today(o.today),
    remainingUsd: num(o.remainingUsd),
  };
}

// ---- Stored attempts and reports ----

function rating(v: unknown): AttemptRating | undefined {
  if (!isObject(v)) return undefined;
  const myScore = toScore(v.myScore);
  const out: AttemptRating = {
    ...(typeof v.useful === "boolean" ? { useful: v.useful } : {}),
    ...(myScore !== null ? { myScore } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

/** A stored attempt; null without an id, a date, a mode or a card. Words and pace are recomputed when missing. */
export function parseAttempt(v: unknown): MockAttempt | null {
  if (!isObject(v) || !isText(v.id) || !isText(v.at) || !isText(v.cardId)) return null;
  if (v.mode !== "card" && v.mode !== "mock") return null;
  const transcript = str(v.transcript);
  const seconds = nonNegative(v.seconds);
  const words = isNum(v.words) && v.words >= 0 ? Math.round(v.words) : countWords(transcript);
  const feedback = parseFeedback(v.feedback);
  const rated = rating(v.rating);
  return {
    id: v.id,
    at: v.at,
    mode: v.mode,
    ...(isText(v.sessionId) ? { sessionId: v.sessionId } : {}),
    cardId: v.cardId,
    asked: str(v.asked),
    isFollowUp: v.isFollowUp === true,
    transcript,
    seconds,
    words,
    wpm: isNum(v.wpm) && v.wpm >= 0 ? v.wpm : wordsPerMinute(words, seconds),
    stuck: v.stuck === true,
    ...(feedback ? { feedback } : {}),
    ...(isText(v.feedbackError) ? { feedbackError: v.feedbackError } : {}),
    ...(rated ? { rating: rated } : {}),
    ...(isText(v.model) ? { model: v.model } : {}),
    ...(isNum(v.costUsd) && v.costUsd >= 0 ? { costUsd: v.costUsd } : {}),
  };
}

/** A stored report; null without an id, a date or a valid report. */
export function parseSavedReport(v: unknown): SavedReport | null {
  if (!isObject(v) || !isText(v.id) || !isText(v.at)) return null;
  const report = parseMockReport(v.report);
  if (!report) return null;
  return {
    id: v.id,
    at: v.at,
    tone: isTone(v.tone) ? v.tone : "friendly",
    ...(isText(v.sessionId) ? { sessionId: v.sessionId } : {}),
    cardIds: texts(v.cardIds),
    report,
    costUsd: nonNegative(v.costUsd),
    ...(isText(v.model) ? { model: v.model } : {}),
  };
}

/** The valid items of a stored `{ v: 1, [field]: T[] }`, first of each id kept; [] when absent or corrupt. */
function storedList<T extends { id: string }>(raw: string, field: string, item: (v: unknown) => T | null): T[] {
  const list = readStored(raw)?.[field];
  const seen = new Set<string>();
  return items(list, item).filter((x) => !seen.has(x.id) && seen.add(x.id));
}

/** Attempts of a raw `lang-lern:mock-interview:attempts` value; invalid ones are dropped. */
export const parseAttempts = (raw: string): MockAttempt[] => storedList(raw, "attempts", parseAttempt);

/** Reports of a raw `lang-lern:mock-interview:reports` value; invalid ones are dropped. */
export const parseReports = (raw: string): SavedReport[] => storedList(raw, "reports", parseSavedReport);
