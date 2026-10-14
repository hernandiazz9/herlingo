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
/** A player state whose duration differs from the tracked file's by more than this is another file. */
const SAME_FILE_SEC = 0.001;

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

/**
 * What has been heard of each episode, kept across the files of one player screen (in memory, never
 * stored): when the file is prepared again (missing clips completed) and reloaded, its tracker
 * starts from the seconds already heard of each chapter of the same episode (opening, steps, final
 * scene), keyed by episode id. The new file's positions differ; its chapters are the same, and a
 * chapter heard in both files counts once (the longer of the two). One per player screen.
 */
export type HeardLog = Map<string, { chapterSec: number[]; finished: boolean }>;

export function createHeardLog(): HeardLog {
  return new Map();
}

interface EpisodeSpan {
  episodeId: string;
  startSec: number;
  endSec: number;
  /** Its chapters' ranges [start, end] in this file (s), in order. */
  chapters: [number, number][];
  /** Seconds of each chapter heard in earlier files (`HeardLog`), at most its length here. */
  before: number[];
  finished: boolean;
}

/** Each episode's span in a prepared file (one, or several joined), from its chapters. */
function spans(chapters: readonly PreparedChapter[], durationSec: number): EpisodeSpan[] {
  const out: EpisodeSpan[] = [];
  chapters.forEach((chapter, i) => {
    const startSec = i === 0 ? 0 : chapter.startSec;
    const endSec = chapters[i + 1]?.startSec ?? durationSec;
    let span = out[out.length - 1];
    if (span?.episodeId !== chapter.episodeId) {
      span = { episodeId: chapter.episodeId, startSec, endSec, chapters: [], before: [], finished: false };
      out.push(span);
    }
    span.endSec = endSec;
    span.chapters.push([startSec, endSec]);
  });
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
 * them too. With `heard` (one per player screen), what earlier files of the same episodes played
 * counts too, and what this one plays is written to it for the next file; states of another file
 * (another duration) are ignored.
 */
export function createListenTracker(
  prepared: Pick<PreparedEpisode, "chapters" | "durationSec">,
  onFinished: (episodeId: string) => void,
  heard: HeardLog = createHeardLog(),
) {
  const list = spans(prepared.chapters, prepared.durationSec);
  for (const span of list) {
    const earlier = heard.get(span.episodeId);
    span.finished = earlier?.finished ?? false;
    span.before = span.chapters.map(([a, b], k) => Math.min(b - a, earlier?.chapterSec[k] ?? 0));
  }
  let played: [number, number][] = [];
  let last: { playing: boolean; timeSec: number; at: number } | null = null;

  function observe(state: Pick<EpisodePlayerState, "loaded" | "playing" | "timeSec" | "durationSec">, at = Date.now()): void {
    if (!state.loaded || Math.abs(state.durationSec - prepared.durationSec) > SAME_FILE_SEC) {
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
          const chapterSec = span.chapters.map(([a, b], k) => Math.max(span.before[k], coveredSec(played, a, b)));
          span.finished = chapterSec.reduce((sum, sec) => sum + sec, 0) >= FINISHED_SHARE * length;
          heard.set(span.episodeId, { chapterSec, finished: span.finished });
          if (span.finished) onFinished(span.episodeId);
        }
      }
    }
    last = { playing: state.playing, timeSec: state.timeSec, at };
  }

  return { observe };
}

/**
 * Awards the XP of every episode of `prepared` (pack `lang`) that gets played to the end on the
 * episode player (`prepared` must be the file loaded in it). `onAward(xp)` after each award. Pass
 * the screen's `heard` log so a reloaded file (missing clips completed) keeps what was heard.
 * Returns the unsubscribe function.
 */
export function trackEpisodeXp(
  lang: string,
  prepared: PreparedEpisode,
  onAward?: (xp: number) => void,
  heard?: HeardLog,
): () => void {
  if (prepared.durationSec <= 0) return () => {};
  const tracker = createListenTracker(
    prepared,
    (episodeId) => {
      const xp = awardFinishedEpisode(lang, episodeId);
      if (xp > 0) onAward?.(xp);
    },
    heard,
  );
  tracker.observe(episodePlayer.getState());
  return episodePlayer.subscribe((state) => tracker.observe(state));
}
