/**
 * Mi entrevista wire and device types (docs/mock-interview.md): plain TypeScript written from the
 * server's zod schemas (api/_lib/schema.ts: `InterviewDeck`, `MockTone`, `InterviewerTurn`,
 * `AnswerFeedback`, `MockReport`; api/_lib/ledger.ts: `MockCallUsage`; the request bodies of
 * api/coach/interviewer.ts and api/coach/feedback.ts). src/ never imports zod or api/ code: change
 * one side, change the other.
 */

// ---- Deck (`GET /api/coach/deck/`) ----

export interface DeckBlock {
  /** 1–64 letters, digits, `-` and `_`. */
  id: string;
  title: string;
  intro?: string;
}

/** One sentence of a model answer, or a key phrase: English and its Spain Spanish meaning. */
export interface DeckLine {
  en: string;
  es: string;
}

export interface DeckPhrase extends DeckLine {
  note?: string;
}

export interface DeckCard {
  id: string;
  /** Id of its block. */
  block: string;
  title: string;
  /** English, read by the interviewer; rotates with `variants`. */
  question: string;
  variants: string[];
  /** The model answer, sentence by sentence (1–20). */
  answer: DeckLine[];
  /** Keywords shown on «Me he bloqueado». */
  anchors: string[];
  phrases: DeckPhrase[];
  tip?: string;
  /** Part of the model answer is unconfirmed: «Falta un dato» (the server's `null` is absent here). */
  pending?: string;
  /** Target length of a spoken answer (10–300). */
  seconds?: number;
}

export interface InterviewDeck {
  version: 1;
  /** ISO date of the source file. */
  generated: string;
  learner?: string;
  blocks: DeckBlock[];
  cards: DeckCard[];
}

// ---- Interviewer and corrector (`POST /api/coach/interviewer/`, `POST /api/coach/feedback/`) ----

export type MockTone = "friendly" | "tough";
export type MockScore = 1 | 2 | 3 | 4 | 5;

/** The interviewer's decision after an answer: one follow-up (`line`, English) or move on. `ack`: a short spoken reaction. */
export interface InterviewerTurn {
  kind: "followup" | "move_on";
  /** Only with `followup`. */
  line?: string;
  ack: string;
}

/** A mistake: what was said (English), the better way (English) and why (Spanish). */
export interface FeedbackMistake {
  said: string;
  better: string;
  why: string;
}

/** A claim the model answer does not support (English) and why (Spanish). */
export interface InventedClaim {
  claim: string;
  why: string;
}

/** The correction of one answer (Spanish fields unless noted). */
export interface AnswerFeedback {
  score: MockScore;
  summary: string;
  /** Most important first (≤ 6). */
  mistakes: FeedbackMistake[];
  /** Possible issues inferred from the transcript (≤ 4). */
  pronunciation: string[];
  content: string;
  /** The most serious finding (≤ 4). */
  invented: InventedClaim[];
  /** Fillers and cut-offs seen (English, ≤ 5) and a short note; words per minute are the device's. */
  fluency: { fillers: string[]; note: string };
  /** English: his answer, better said. */
  improved: string;
  next: string;
}

/** The simulacro's overall report (Spanish). */
export interface MockReport {
  score: MockScore;
  summary: string;
  strengths: string[];
  weakPoints: string[];
  invented: string[];
  next: string;
}

/** The `usage` of every Mi entrevista call. */
export interface MockCallUsage {
  costUsd: number;
  /** The model that answered; null when no call was made (the canned move-on). */
  model: string | null;
  /** From the request to Claude until its response; 0 when no call was made. */
  latencyMs: number;
  tokens: { input: number; output: number; cacheWrite: number; cacheRead: number };
  /** The caller's answers + reports today (also in an interviewer response). */
  today: { used: number; limit: number };
  /** What is left of Mi entrevista's budget this month. */
  remainingUsd: number;
}

/**
 * Mirror of the request limits of api/coach/interviewer.ts and api/coach/feedback.ts. The client
 * trims and clamps to them before sending (an answer over `answer` is cut at a word).
 */
export const MOCK_REQUEST_LIMITS = {
  /** A spoken answer, after trimming. */
  answer: 3000,
  /** What was asked (a spoken line), after trimming. */
  asked: 300,
  /** Earlier exchanges on this question the interviewer reads. */
  history: 3,
  followUps: 2,
  /** Seconds of an answer (0 = not measured). */
  seconds: 3600,
  /** Answers in one report and, per answer, its invented claims and mistakes. */
  reportAnswers: 24,
  reportInvented: 4,
  reportMistakes: 3,
  /** A report answer's `summary`. */
  summary: 500,
  /** `said`, `better`, `why`, `claim`. */
  line: 300,
} as const;

/** One earlier exchange on the same question. */
export interface TurnHistoryEntry {
  asked: string;
  /** May be empty (the server reads "(empty)"). */
  answer: string;
}

export interface TurnRequest {
  cardId: string;
  tone: MockTone;
  /** What was just asked: the card's question, a variant or a follow-up. */
  asked: string;
  /** Earlier exchanges on this question only (the last 3 are sent). */
  history: TurnHistoryEntry[];
  answer: string;
  seconds: number;
  /** 0 → the canned move-on, no Claude call. */
  followUpsLeft: number;
}

export interface FeedbackRequest {
  cardId: string;
  asked: string;
  isFollowUp: boolean;
  answer: string;
  seconds: number;
  stuck: boolean;
}

/** One corrected answer as the report reads it: what its feedback said, never the transcript. */
export interface ReportAnswer {
  cardId: string;
  asked: string;
  score: MockScore;
  summary: string;
  /** The `claim`s of that answer's `invented`. */
  invented: string[];
  /** Its first 3 mistakes. */
  mistakes: FeedbackMistake[];
}

export interface ReportRequest {
  tone: MockTone;
  answers: ReportAnswer[];
}

export interface TurnResult {
  next: InterviewerTurn;
  usage: MockCallUsage;
}

export interface FeedbackResult {
  feedback: AnswerFeedback;
  usage: MockCallUsage;
}

export interface ReportResult {
  report: MockReport;
  usage: MockCallUsage;
}

// ---- On the device (docs/mock-interview.md "Device") ----

/** `lang-lern:mock-interview:deck` (without its `v`). */
export interface StoredDeck {
  deck: InterviewDeck;
  /** The server's: when the deck was uploaded (ISO). */
  updatedAt: string;
  /** When this device downloaded it (ISO). */
  fetchedAt: string;
}

export type AttemptMode = "card" | "mock";

/** «¿Te sirvió?» 👍/👎 and «Tu nota» 1–5, after a correction. */
export interface AttemptRating {
  useful?: boolean;
  myScore?: MockScore;
}

/** One answer, stored in `lang-lern:mock-interview:attempts` (newest first). */
export interface MockAttempt {
  id: string;
  /** ISO date-time it was answered. */
  at: string;
  mode: AttemptMode;
  /** The simulacro it belongs to (`mode: "mock"`). */
  sessionId?: string;
  cardId: string;
  /** What was asked (English). */
  asked: string;
  isFollowUp: boolean;
  /** What the mic or the keyboard gave (may be empty). */
  transcript: string;
  /** How long the answer took (0 = not measured). */
  seconds: number;
  words: number;
  /** Words per minute (0 when not measured). */
  wpm: number;
  /** «Me he bloqueado»: the anchors were shown. */
  stuck: boolean;
  feedback?: AnswerFeedback;
  /** Why the last correction failed (Spanish, to show as is); cleared by a correction. */
  feedbackError?: string;
  rating?: AttemptRating;
  /** The corrector's model and the correction's cost. */
  model?: string;
  costUsd?: number;
}

/** One simulacro report, stored in `lang-lern:mock-interview:reports` (newest first). */
export interface SavedReport {
  id: string;
  /** ISO date-time it was received. */
  at: string;
  tone: MockTone;
  /** The simulacro whose attempts it reads (their `sessionId`). */
  sessionId?: string;
  /** Cards asked, in order, each once. */
  cardIds: string[];
  report: MockReport;
  costUsd: number;
  model?: string;
}

/** Derived per-card state (never stored): from the answers to the card's own question, follow-ups apart. */
export interface CardStats {
  /** Answers to the card's question (its follow-ups not counted). */
  answers: number;
  /** Answers to its follow-ups. */
  followUps: number;
  /** Score of the newest corrected answer to the card's question. */
  lastScore?: MockScore;
  bestScore?: MockScore;
  /** Newest attempt on the card, follow-ups included (ISO). */
  lastAt?: string;
  /** «Dominada»: the two newest corrected answers scored 4 or more. */
  mastered: boolean;
}
