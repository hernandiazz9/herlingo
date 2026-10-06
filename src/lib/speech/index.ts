/**
 * Speech input (the learner speaking): recognition helper and the "No puedo hablar ahora" pause.
 * Audio output lives in `@/lib/audio`.
 */
import { similarity, spellNumbers } from "@/lib/exercises/normalize";

export {
  canRecognize,
  listenOnce,
  type RecognitionError,
  type RecognitionResult,
  type RecognitionSession,
} from "./recognition";
export {
  SPEAKING_PAUSE_MINUTES,
  isSpeakingPaused,
  pauseSpeaking,
  resumeSpeaking,
  speakingPausedUntil,
  subscribeSpeakingPause,
} from "./pause";
export {
  SPEECH_PASS_THRESHOLD,
  bestOption,
  scoreHeard,
  type NumberWords,
  type ScoredWord,
  type SpeechScore,
  type WordStatus,
} from "./score";

/** Similarity (0–1, accents/case/punctuation ignored) from which a spoken answer counts as right. */
export const SPEECH_MATCH_THRESHOLD = 0.7;

/**
 * Best alternative heard against the expected text(s). Digits on either side are written out with
 * `numberWords` (the pack's `meta.numberWords`), so "40" heard matches "quaranta".
 */
export function scoreSpeech(
  transcripts: readonly string[],
  expected: string | readonly string[],
  numberWords?: Readonly<Record<string, string>>,
): { score: number; heard: string; passed: boolean } {
  const targets = (typeof expected === "string" ? [expected] : expected).map((t) => spellNumbers(t, numberWords));
  const heards = transcripts.map((t) => spellNumbers(t, numberWords));
  let best = { score: 0, heard: heards[0] ?? "" };
  for (const heard of heards) {
    for (const t of targets) {
      const score = similarity(heard, t);
      if (score > best.score) best = { score, heard };
    }
  }
  return { ...best, passed: best.score >= SPEECH_MATCH_THRESHOLD };
}
