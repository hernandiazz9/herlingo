/**
 * Practice outside lessons (game mode, stories): XP, streak day and SRS outcomes in one call.
 * Built only on `recordReviewResult()` (same rules as /repaso): XP added, today marked as
 * practised, each outcome scheduled in the Leitner boxes (wrong → box 1, due at once).
 */
import { DEFAULT_LANG } from "@/lib/content";
import type { ItemOutcome } from "@/lib/exercises";
import { recordReviewResult, type Progress, type XpSource } from "./index";

export interface ActivityOutcome {
  itemId: string;
  correct: boolean;
}

export interface Activity {
  /** Defaults to the default pack. */
  lang?: string;
  xp: number;
  /**
   * Items to schedule in SRS (send only the ones that should move). Repeated ids merge.
   * Game mode sends only the wrong ones; stories send every practised key word.
   */
  outcomes: ActivityOutcome[];
  /** What earned the XP (Liga event source). Defaults to the current screen: /jugar/ → game, /historias/ → story. */
  source?: XpSource;
}

/** Source of an activity whose caller did not say: guessed from the route it was played on. */
function sourceFromRoute(): XpSource {
  const path = typeof window === "undefined" ? "" : window.location.pathname;
  if (path.startsWith("/jugar")) return "game";
  if (path.startsWith("/historias")) return "story";
  return "activity";
}

export function recordActivity({ lang = DEFAULT_LANG, xp, outcomes, source }: Activity): Progress {
  const items = new Map<string, ItemOutcome>();
  for (const { itemId, correct } of outcomes) {
    const o = items.get(itemId) ?? { itemId, attempts: 0, mistakes: 0 };
    o.attempts += 1;
    if (!correct) o.mistakes += 1;
    items.set(itemId, o);
  }
  const now = Date.now();
  return recordReviewResult({
    lessonId: "activity",
    lang,
    seed: "",
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
    xp,
    exercises: outcomes.length,
    firstTryCorrect: outcomes.filter((o) => o.correct).length,
    items: [...items.values()],
  }, source ?? sourceFromRoute());
}
