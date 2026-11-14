/**
 * Simulacro reports on the device (`lang-lern:mock-interview:reports` = `{ v: 1, reports }`, newest
 * first, unique ids). Deleted only by an explicit action.
 */
import { getAttempts, sessionAttempts } from "./attempts";
import { getReport } from "./api";
import { parseReports } from "./parse";
import { MOCK_KEYS, newId, readRaw, writeStored } from "./store";
import { MOCK_REQUEST_LIMITS, type MockAttempt, type MockTone, type ReportAnswer, type ReportResult, type SavedReport } from "./types";

export const readReportsRaw = (): string => readRaw(MOCK_KEYS.reports);

export function getReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  return parseReports(readReportsRaw());
}

function write(reports: SavedReport[]): boolean {
  return writeStored(MOCK_KEYS.reports, { reports });
}

/** Stores a report at the top of the list. Null when storage failed. */
export function addReport(input: Omit<SavedReport, "id" | "at">): SavedReport | null {
  const saved: SavedReport = { id: newId(), at: new Date().toISOString(), ...input };
  return write([saved, ...getReports()]) ? saved : null;
}

/** Deletes one report (an explicit action only). */
export function deleteReport(id: string): boolean {
  const reports = getReports();
  return reports.some((r) => r.id === id) ? write(reports.filter((r) => r.id !== id)) : true;
}

/**
 * What the report reads of each corrected attempt, in the order given (the first 24): its score,
 * summary, the claims of its invented findings and its first 3 mistakes. Attempts without feedback
 * are skipped.
 */
export function reportAnswers(attempts: readonly MockAttempt[]): ReportAnswer[] {
  return attempts.flatMap((a) =>
    a.feedback
      ? [
          {
            cardId: a.cardId,
            asked: a.asked,
            score: a.feedback.score,
            summary: a.feedback.summary,
            invented: a.feedback.invented.map((i) => i.claim),
            mistakes: a.feedback.mistakes.slice(0, MOCK_REQUEST_LIMITS.reportMistakes),
          },
        ]
      : [],
  ).slice(0, MOCK_REQUEST_LIMITS.reportAnswers);
}

/**
 * The report of simulacro `sessionId` from its corrected attempts (oldest first), stored on the
 * device. Resolves with the result and the stored entry (null when storage failed); rejects like
 * `getReport` (code `no_answers` when none of its attempts is corrected).
 */
export async function createReport(
  sessionId: string,
  tone: MockTone,
  opts: { signal?: AbortSignal } = {},
): Promise<ReportResult & { saved: SavedReport | null }> {
  const attempts = sessionAttempts(getAttempts(), sessionId);
  const result = await getReport({ tone, answers: reportAnswers(attempts) }, opts);
  const saved = addReport({
    tone,
    sessionId,
    cardIds: [...new Set(attempts.map((a) => a.cardId))],
    report: result.report,
    costUsd: result.usage.costUsd,
    ...(result.usage.model ? { model: result.usage.model } : {}),
  });
  return { ...result, saved };
}
