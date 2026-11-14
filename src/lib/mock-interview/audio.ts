/**
 * Mi entrevista's voices on the client: generated playables for `speak()` from `@/lib/audio` (the
 * mp3 from the device cache, else `/api/coach/tts/` once, else the device voice). Importing this
 * module registers the coach TTS endpoint as the generated-audio source (`@/lib/coach/audio`).
 */
import "@/lib/coach/audio";
import { generatedPlayable } from "@/lib/audio/generated";
import type { Playable } from "@/lib/content";

/**
 * Mirror of the server's `MOCK_VOICES` (api/_lib/languages.ts), which the TTS endpoint accepts on
 * its own (no pack declares them): Natasha asks, William reads the model answers.
 */
export const MOCK_VOICES = {
  interviewer: "en-AU-NatashaNeural",
  answer: "en-AU-WilliamMultilingualNeural",
} as const;

/** Locale of the device-voice fallback (and `lang` of the English lines on screen: "en"). */
export const MOCK_LOCALE = "en-AU";

/**
 * Options for `speak()` / `speakSequence()` of an interview line: its device-voice fallback speaks
 * Australian English, whatever the active language pack.
 */
export const MOCK_SPEAK_OPTIONS = { locale: MOCK_LOCALE } as const;

/** Who reads a line: the interviewer (questions, follow-ups, acknowledgements) or the model-answer voice. */
export type MockSpeaker = "interviewer" | "model";

/** A line of Mi entrevista, read by Natasha (`interviewer`) or William (`model`). Play it with `MOCK_SPEAK_OPTIONS`. */
export function mockPlayable(text: string, speaker: MockSpeaker): Playable {
  return generatedPlayable(text, speaker === "model" ? MOCK_VOICES.answer : MOCK_VOICES.interviewer);
}
