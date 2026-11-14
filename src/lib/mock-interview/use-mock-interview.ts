"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toCoachApiError, type CoachApiError } from "@/lib/coach/api";
import { useCoachAccess } from "@/lib/coach/use-coach";
import { fetchDeck } from "./api";
import {
  addAttempt,
  cardStats,
  correctAttempt,
  deleteAllAttempts,
  deleteAttempt,
  EMPTY_CARD_STATS,
  EXPORT_SUGGESTED_AT,
  rateAttempt,
  readAttemptsRaw,
} from "./attempts";
import { readDeckRaw } from "./deck";
import { exportAttempts } from "./export";
import { parseAttempts, parseReports, parseStoredDeck } from "./parse";
import { createReport, deleteReport, readReportsRaw } from "./reports";
import { subscribeMock } from "./store";
import type { CardStats, StoredDeck } from "./types";

const empty = () => "";

/**
 * The deck: the stored one at once (offline too), downloaded again on mount when an access code is
 * stored (`refreshOnMount`), and by `refresh()` («Actualizar tarjetas»). A failed download keeps
 * the stored deck and sets `error` (kind `offline` when there is no connection; code `no_deck`
 * when none was uploaded, `forbidden` for a code that is not the owner's). `deck` is null until
 * one was downloaded on this device.
 */
export function useDeck({ refreshOnMount = true }: { refreshOnMount?: boolean } = {}) {
  const raw = useSyncExternalStore(subscribeMock, readDeckRaw, empty);
  const stored = useMemo(() => parseStoredDeck(raw), [raw]);
  const { code } = useCoachAccess();
  /** A deck downloaded but not stored (storage full): shown for this page anyway. */
  const [unsaved, setUnsaved] = useState<StoredDeck | null>(null);
  const [pending, setPending] = useState(0);
  const [settled, setSettled] = useState<string | null>(null);
  const [error, setError] = useState<CoachApiError | null>(null);

  const apply = useCallback((fetched: StoredDeck & { saved: boolean }) => {
    setUnsaved(fetched.saved ? null : fetched);
    setError(null);
  }, []);

  useEffect(() => {
    if (!refreshOnMount || !code) return;
    const ctrl = new AbortController();
    fetchDeck({ signal: ctrl.signal })
      .then(apply, (e: unknown) => {
        const err = toCoachApiError(e);
        if (err.kind !== "aborted") setError(err);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setSettled(code);
      });
    return () => ctrl.abort();
  }, [apply, code, refreshOnMount]);

  const refresh = useCallback(async (): Promise<boolean> => {
    setPending((n) => n + 1);
    try {
      apply(await fetchDeck());
      return true;
    } catch (e) {
      setError(toCoachApiError(e));
      return false;
    } finally {
      setPending((n) => n - 1);
    }
  }, [apply]);

  const current = unsaved && (!stored || unsaved.fetchedAt > stored.fetchedAt) ? unsaved : stored;
  return {
    deck: current?.deck ?? null,
    /** When the deck shown was uploaded and downloaded (ISO; "" when unknown). */
    updatedAt: current?.updatedAt ?? "",
    fetchedAt: current?.fetchedAt ?? "",
    loading: pending > 0 || (refreshOnMount && code !== null && settled !== code),
    error,
    refresh,
  };
}

/**
 * The attempts, live, newest first, with the derived per-card state (`stats`, `statsFor(cardId)`).
 * `add` stores an answer (null when storage failed); `correct` corrects one and stores the result;
 * `rate` stores «¿Te sirvió?» / «Tu nota»; `remove` / `removeAll` are explicit deletions only;
 * `exportAll` writes the file (call it straight from the tap); `suggestExport` from 400 attempts.
 */
export function useAttempts() {
  const raw = useSyncExternalStore(subscribeMock, readAttemptsRaw, empty);
  const attempts = useMemo(() => parseAttempts(raw), [raw]);
  const stats = useMemo(() => cardStats(attempts), [attempts]);
  const statsFor = useCallback((cardId: string): Readonly<CardStats> => stats.get(cardId) ?? EMPTY_CARD_STATS, [stats]);
  return useMemo(
    () => ({
      attempts,
      stats,
      statsFor,
      suggestExport: attempts.length >= EXPORT_SUGGESTED_AT,
      add: addAttempt,
      correct: correctAttempt,
      rate: rateAttempt,
      remove: deleteAttempt,
      removeAll: deleteAllAttempts,
      exportAll: exportAttempts,
    }),
    [attempts, stats, statsFor],
  );
}

/** The simulacro reports, live, newest first. `create(sessionId, tone)` asks for one and stores it; `remove` deletes one. */
export function useReports() {
  const raw = useSyncExternalStore(subscribeMock, readReportsRaw, empty);
  const reports = useMemo(() => parseReports(raw), [raw]);
  const get = useCallback((id: string) => reports.find((r) => r.id === id), [reports]);
  const forSession = useCallback((sessionId: string) => reports.find((r) => r.sessionId === sessionId), [reports]);
  return useMemo(
    () => ({ reports, get, forSession, create: createReport, remove: deleteReport }),
    [reports, get, forSession],
  );
}
