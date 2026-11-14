/**
 * Speech input (the learner speaking): the listen engine (docs/speech.md), its diagnostics log,
 * and the "No puedo hablar ahora" pause. Audio output lives in `@/lib/audio`.
 */
export {
  ANSWER_MAX_CONTINUATIONS,
  LISTEN_TIMINGS,
  cancelListening,
  createListenSession,
  type ListenError,
  type ListenMode,
  type ListenOptions,
  type ListenOutcome,
  type ListenResult,
  type ListenSession,
  type ListenState,
  type ListenStatus,
  type ListenTimings,
} from "./session";
export { LISTEN_ERROR_MESSAGES, listenErrorMessage, type ListenErrorKind } from "./messages";
export {
  SPEECH_LOG_KEY,
  SPEECH_LOG_MAX,
  clearSpeechLog,
  readSpeechLog,
  subscribeSpeechLog,
  type ListenEndReason,
  type SpeechLogEntry,
} from "./log";
export { browserFamily, canRecognize, isStandalone, type BrowserFamily } from "./platform";
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
  type Matching,
  type NumberWords,
  type ScoredWord,
  type SpeechScore,
  type WordStatus,
} from "./score";

