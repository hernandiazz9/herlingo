"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { clearAccessCode, parseAccessCode, readAccessRaw } from "./access";
import { checkAccessCode, fetchUsage, toCoachApiError, updateMonthlyCap, type CoachApiError } from "./api";
import { deletePack, parseSavedPacks, readPacksRaw, replacePack, savePack } from "./packs";
import { clearAssessments, parseLearnerProfile, readProfileRaw, saveAssessment, setAbout } from "./profile";
import { subscribeCoach } from "./store";
import type { CoachAssessment, CoachUsage } from "./types";
import { parseStoredUsage, readUsageRaw } from "./usage";

const empty = () => "";

/**
 * The access code on the device. `verify(code)` checks it with the server and stores it when
 * valid (rejects with a `CoachApiError`); a 401 on any request forgets it, so `code` turns null.
 * Null on the server and during hydration.
 */
export function useCoachAccess() {
  const raw = useSyncExternalStore(subscribeCoach, readAccessRaw, empty);
  const code = useMemo(() => parseAccessCode(raw), [raw]);
  return useMemo(() => ({ code, hasCode: code !== null, verify: checkAccessCode, clear: clearAccessCode }), [code]);
}

/**
 * "Mis situaciones" of a language pack, live, newest first. `save` (new pack, at the top) and
 * `replace` (refinement, in place) return false when storage failed; both start caching the
 * pack's audio. `remove` deletes it and its unused audio.
 */
export function useSavedPacks(lang: string) {
  const raw = useSyncExternalStore(subscribeCoach, () => readPacksRaw(lang), empty);
  const packs = useMemo(() => parseSavedPacks(raw), [raw]);
  const remove = useCallback((id: string) => deletePack(lang, id), [lang]);
  const get = useCallback((id: string) => packs.find((p) => p.id === id), [packs]);
  return useMemo(() => ({ packs, get, save: savePack, replace: replacePack, remove }), [packs, get, remove]);
}

/** "Sobre mí" notes and interview results of a language pack, live; `latest` = newest assessment. */
export function useLearnerProfile(lang: string) {
  const raw = useSyncExternalStore(subscribeCoach, () => readProfileRaw(lang), empty);
  const profile = useMemo(() => parseLearnerProfile(raw), [raw]);
  return useMemo(
    () => ({
      profile,
      latest: profile.assessments[0],
      setAbout: (about: string) => setAbout(lang, about),
      saveAssessment: (assessment: CoachAssessment) => saveAssessment(lang, assessment),
      clearAssessments: () => clearAssessments(lang),
    }),
    [lang, profile],
  );
}

/**
 * Usage of the AI: the last summary seen (stored on the device, so it shows offline; patched by
 * every generation), refreshed from the server on mount when a code is stored. `setCap` is owner
 * only (rejects with a 403 `CoachApiError` otherwise).
 */
export function useCoachUsage({ refreshOnMount = true }: { refreshOnMount?: boolean } = {}) {
  const raw = useSyncExternalStore(subscribeCoach, readUsageRaw, empty);
  const stored = useMemo(() => parseStoredUsage(raw), [raw]);
  const { code } = useCoachAccess();
  const [pending, setPending] = useState(0);
  const [settled, setSettled] = useState<string | null>(null);
  const [error, setError] = useState<CoachApiError | null>(null);

  useEffect(() => {
    if (!refreshOnMount || !code) return;
    const ctrl = new AbortController();
    fetchUsage({ signal: ctrl.signal })
      .then(
        () => setError(null),
        (e: unknown) => {
          const err = toCoachApiError(e);
          if (err.kind !== "aborted") setError(err);
        },
      )
      .finally(() => {
        if (!ctrl.signal.aborted) setSettled(code);
      });
    return () => ctrl.abort();
  }, [code, refreshOnMount]);

  const refresh = useCallback(async (): Promise<CoachUsage | null> => {
    setPending((n) => n + 1);
    try {
      const usage = await fetchUsage();
      setError(null);
      return usage;
    } catch (e) {
      setError(toCoachApiError(e));
      return null;
    } finally {
      setPending((n) => n - 1);
    }
  }, []);

  const loading = pending > 0 || (refreshOnMount && code !== null && settled !== code);
  return {
    usage: stored?.usage ?? null,
    /** Epoch ms of the summary shown (0 = never fetched). */
    updatedAt: stored?.at ?? 0,
    loading,
    error,
    refresh,
    setCap: updateMonthlyCap,
  };
}
