/**
 * Audio API: the ONLY way UI code plays target-language audio.
 *
 *   import { speak, stop } from "@/lib/audio";
 *   <button onClick={() => speak(phrase)}>…</button>          // any Playable from @/lib/content
 *   <button onClick={() => speak(phrase, { slow: true })}>…</button>
 *   speak("Buongiorno!")                                       // free text (TTS only)
 *
 * Contract (stable; T03 adds pre-generated mp3 behind it without changing callers):
 * - `speak()` stops whatever is playing, then plays. It returns a promise that resolves when
 *   playback ends, fails or is interrupted; it never rejects. Call it directly inside a user
 *   gesture handler (iOS), do not `await` anything before calling it.
 * - A Playable (`{ text, audioKey, voice }`) may use its mp3 (`/audio/<lang>/<audioKey>.mp3`)
 *   once T03 lands; plain strings and missing mp3s use browser speechSynthesis in the pack's
 *   `speechLocale`.
 * - `slow: true` plays at `SLOW_RATE`.
 */
import { getPack, type Playable } from "@/lib/content";
import { ttsAvailable, ttsSpeak, ttsStop } from "./speech-synthesis";

export type SpeakInput = Playable | string;

export interface SpeakOptions {
  /** Slower playback for learners. */
  slow?: boolean;
  /** Language pack whose locale/audio to use; defaults to the default pack. */
  lang?: string;
}

/** Playback rate for slow mode (speech and, later, mp3). */
export const SLOW_RATE = 0.7;

export function speak(input: SpeakInput, options: SpeakOptions = {}): Promise<void> {
  const text = typeof input === "string" ? input : input.text;
  const locale = getPack(options.lang).meta.speechLocale;
  return ttsSpeak(text, locale, options.slow ? SLOW_RATE : 1);
}

/** Stops any audio that is playing. */
export function stop(): void {
  ttsStop();
}

/** True when some audio output is possible in this browser. */
export function canSpeak(): boolean {
  return ttsAvailable();
}
