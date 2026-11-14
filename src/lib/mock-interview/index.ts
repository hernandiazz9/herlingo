/**
 * Mi entrevista client layer (docs/mock-interview.md "Device"), framework-free. React hooks:
 * `@/lib/mock-interview/use-mock-interview` (`useDeck`, `useAttempts`, `useReports`).
 *
 *   const { deck } = await fetchDeck();                         // stored for offline use
 *   speak(mockPlayable(questionToAsk(card, stats.answers), "interviewer"), MOCK_SPEAK_OPTIONS);
 *   const attempt = addAttempt({ mode: "card", cardId, asked, isFollowUp: false, transcript, seconds, stuck });
 *   const { feedback } = await correctAttempt(attempt.id);      // stored on the attempt
 *   const { next } = await takeTurn({ cardId, tone, asked, history, answer, seconds, followUpsLeft });
 *   await createReport(sessionId, tone);                        // simulacro report, stored
 *
 * Errors are `CoachApiError`s from `@/lib/coach` (Spanish `message`, server `code`); owner only on
 * the server (403 `forbidden`). Storage keys `lang-lern:mock-interview:*` (./store.ts).
 */
export { fetchDeck, getFeedback, getReport, takeTurn } from "./api";
export {
  addAttempt,
  cardStats,
  correctAttempt,
  deleteAllAttempts,
  deleteAttempt,
  EMPTY_CARD_STATS,
  EXPORT_SUGGESTED_AT,
  getAttempt,
  getAttempts,
  rateAttempt,
  sessionAttempts,
  setAttemptFeedback,
  setAttemptFeedbackError,
  type NewAttempt,
} from "./attempts";
export { MOCK_LOCALE, MOCK_SPEAK_OPTIONS, MOCK_VOICES, mockPlayable, type MockSpeaker } from "./audio";
export { blockCards, cardQuestions, getCard, getStoredDeck, questionToAsk } from "./deck";
export { attemptsFileName, exportAttempts } from "./export";
export { addReport, createReport, deleteReport, getReports, reportAnswers } from "./reports";
export { MOCK_KEYS, MOCK_PREFIX } from "./store";
export { countWords, wordsPerMinute } from "./words";
export { updateMockCap } from "@/lib/coach/api";
export * from "./types";
