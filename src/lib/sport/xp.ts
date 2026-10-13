/**
 * XP for a finished episode (docs/sport.md "XP"): once ≥ 90 % of an episode has really been played
 * (seeks and step jumps do not count), 10 XP with source "sport", once per episode per day and at
 * most 3 episodes a day; like any activity it counts for the streak (`recordActivity`).
 *
 * The day's bookkeeping lives in the existing daily key (`lang-lern:daily-xp:<lang>`, `countPlay`):
 * "sport:<episodeId>" per episode and "sport" for the day's total. No key of its own.
 */
import { countPlay, recordActivity } from "@/lib/progress/activity";
import { episodePlayer, type EpisodePlayerState } from "./player";
import type { PreparedChapter, PreparedEpisode } from "./prepare";

/** XP for a finished episode. */
export const SPORT_XP = 10;
/** Episodes that earn XP per pack and day. */
export const SPORT_XP_DAILY_EPISODES = 3;
/** Share of an episode that must have been played for it to count as finished. */
export const FINISHED_SHARE = 0.9;

/** Seconds a position may run ahead of the clock between two observations (event timing). */
const SLACK_SEC = 0.5;

const DAY_TOTAL = "sport";
const dayId = (episodeId: string) => `sport:${episodeId}`;

/**
 * Gives the XP of a finished episode of pack `lang`: `SPORT_XP` the first time today for this
 * episode, while fewer than `SPORT_XP_DAILY_EPISODES` episodes earned it today. Returns the XP (0
 * when nothing was given).
 */
export function awardFinishedEpisode(lang: string, episodeId: string): number {
  if (countPlay(lang, dayId(episodeId)) > 0) return 0;
  if (countPlay(lang, DAY_TOTAL) >= SPORT_XP_DAILY_EPISODES) return 0;
  recordActivity({ lang, xp: SPORT_XP, outcomes: [], source: "sport" });
  return SPORT_XP;
}

interface EpisodeSpan {
  episodeId: string;
  startSec: number;
  endSec: number;
  finished: boolean;
}

/** Each episode's span in a prepared file (one, or several joined), from its chapters. */
function spans(chapters: readonly PreparedChapter[], durationSec: number): EpisodeSpan[] {
  const out: EpisodeSpan[] = [];
  for (const chapter of chapters) {
    const last = out[out.length - 1];
    if (last?.episodeId === chapter.episodeId) continue;
    if (last) last.endSec = chapter.startSec;
    out.push({ episodeId: chapter.episodeId, startSec: out.length ? chapter.startSec : 0, endSec: durationSec, finished: false });
  }
  return out;
}

/** Played time as merged [start, end] intervals (s), sorted. */
function addInterval(list: [number, number][], start: number, end: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of list) {
    if (b < start || a > end) out.push([a, b]);
    else {
      start = Math.min(start, a);
      end = Math.max(end, b);
    }
  }
  out.push([start, end]);
  return out.sort((x, y) => x[0] - y[0]);
}

function coveredSec(list: readonly [number, number][], start: number, end: number): number {
  let sec = 0;
  for (const [a, b] of list) sec += Math.max(0, Math.min(b, end) - Math.max(a, start));
  return sec;
}

/**
 * Follows the playback of one prepared file (`observe` with every player state) and calls
 * `onFinished` once per episode in it as soon as `FINISHED_SHARE` of its span has been played.
 * Only time that really played counts: between two observations while playing, the position may
 * advance at most as much as the clock did, so seeks, step jumps and replays add nothing (a part
 * heard twice counts once). Observations may be minutes apart (a locked phone): the clock bounds
 * them too.
 */
export function createListenTracker(
  prepared: Pick<PreparedEpisode, "chapters" | "durationSec">,
  onFinished: (episodeId: string) => void,
) {
  const list = spans(prepared.chapters, prepared.durationSec);
  let played: [number, number][] = [];
  let last: { playing: boolean; timeSec: number; at: number } | null = null;

  function observe(state: Pick<EpisodePlayerState, "loaded" | "playing" | "timeSec">, at = Date.now()): void {
    if (!state.loaded) {
      last = null;
      return;
    }
    if (last?.playing) {
      const from = last.timeSec;
      const to = Math.min(state.timeSec, from + Math.max(0, (at - last.at) / 1000) + SLACK_SEC);
      if (to > from) {
        played = addInterval(played, from, to);
        for (const span of list) {
          const length = span.endSec - span.startSec;
          if (span.finished || length <= 0) continue;
          if (coveredSec(played, span.startSec, span.endSec) >= FINISHED_SHARE * length) {
            span.finished = true;
            onFinished(span.episodeId);
          }
        }
      }
    }
    last = { playing: state.playing, timeSec: state.timeSec, at };
  }

  return { observe };
}

/**
 * Awards the XP of every episode of `prepared` (pack `lang`) that gets played to the end on the
 * episode player (`prepared` must be the file loaded in it). `onAward(xp)` after each award.
 * Returns the unsubscribe function.
 */
export function trackEpisodeXp(lang: string, prepared: PreparedEpisode, onAward?: (xp: number) => void): () => void {
  if (prepared.durationSec <= 0) return () => {};
  const tracker = createListenTracker(prepared, (episodeId) => {
    const xp = awardFinishedEpisode(lang, episodeId);
    if (xp > 0) onAward?.(xp);
  });
  tracker.observe(episodePlayer.getState());
  return episodePlayer.subscribe((state) => tracker.observe(state));
}
