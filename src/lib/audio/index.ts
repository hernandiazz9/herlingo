/**
 * Audio API: the ONLY way UI code plays target-language audio.
 *
 *   import { speak, stop } from "@/lib/audio";
 *   <button onClick={() => speak(phrase)}>…</button>          // any Playable from @/lib/content
 *   <button onClick={() => speak(phrase, { slow: true })}>…</button>
 *   speak("Buongiorno!")                                       // free text (TTS only)
 *
 * Contract (stable):
 * - `speak()` stops whatever is playing, then plays. It returns a promise that resolves when
 *   playback ends, fails or is interrupted; it never rejects. Call it directly inside a user
 *   gesture handler (iOS), do not `await` anything before calling it.
 * - A Playable (`{ text, audioKey, voice }`) plays its neural mp3 when
 *   `public/audio/<lang>/manifest.json` lists its key (`npm run audio`). Plain strings, keys
 *   without mp3, a manifest not loaded yet, or an mp3 that fails to load/play use browser
 *   speechSynthesis in the pack's `speechLocale`.
 * - A generated playable (`generatedPlayable(text, voice)`: Prepárate lines, `audioKey` "gen:…")
 *   plays its mp3 from Cache Storage, else downloads it once through the registered source (the
 *   coach TTS endpoint, see `./generated`) and caches it; no mp3 → speechSynthesis.
 * - The pack's stress marks (`pack.json` `stress`) are stripped from every text sent to a voice.
 * - `slow: true` plays at `SLOW_RATE` (mp3 keeps its pitch). With the "Audio lento" setting on
 *   (`@/lib/progress/settings`), everything plays slow.
 * - The first tap/key anywhere unlocks audio for iOS (see `unlockOnFirstGesture`).
 */
import { getPack, stripStress, type Playable } from "@/lib/content";
import { getActiveLang, subscribeActiveLang } from "@/lib/content/active";
import { getSettings } from "@/lib/progress/settings";
import { isGenerated, playGenerated } from "./generated";
import { mp3Available, mp3Play, mp3Stop, mp3Url, preloadManifest, unlockOnFirstGesture } from "./mp3";
import { ttsAvailable, ttsSpeak, ttsStop } from "./speech-synthesis";

export {
  clearGeneratedAudio,
  GENERATED_AUDIO_CACHE,
  generatedKey,
  generatedPlayable,
  isGenerated,
  prefetchGenerated,
  pruneGenerated,
  setGeneratedAudioSource,
  type GeneratedAudioSource,
  type PrefetchResult,
} from "./generated";

export type SpeakInput = Playable | string;

export interface SpeakOptions {
  /** Slower playback for learners. */
  slow?: boolean;
  /** Language pack whose locale/audio to use; defaults to the active language (else the default pack). */
  lang?: string;
}

/** Playback rate for slow mode (mp3 and speech). */
export const SLOW_RATE = 0.7;

/** Bumped by every speak()/stop(), so a late mp3 failure never starts a stale fallback. */
let generation = 0;

if (mp3Available()) {
  // The active language's manifest, now and after every switch (the default pack's on first launch).
  const preloadActive = () => preloadManifest(getPack(getActiveLang() ?? undefined).meta.lang);
  preloadActive();
  subscribeActiveLang(preloadActive);
  unlockOnFirstGesture();
}

export function speak(input: SpeakInput, options: SpeakOptions = {}): Promise<void> {
  stop();
  const my = generation;
  const { meta } = getPack(options.lang ?? getActiveLang() ?? undefined);
  // Written stress marks are for the eyes: never sent to a voice.
  const text = stripStress(typeof input === "string" ? input : input.text, meta);
  const rate = options.slow || getSettings().slowAudio ? SLOW_RATE : 1;
  if (typeof input !== "string" && isGenerated(input)) {
    return playGenerated({ ...input, text }, rate, () => my === generation, () => ttsSpeak(text, meta.speechLocale, rate));
  }
  const url = typeof input === "string" ? undefined : mp3Url(meta.lang, input.audioKey);
  if (!url) return ttsSpeak(text, meta.speechLocale, rate);
  return mp3Play(url, rate).then((result) => {
    if (result === "failed" && my === generation) return ttsSpeak(text, meta.speechLocale, rate);
  });
}

/** Stops any audio that is playing. */
export function stop(): void {
  generation++;
  mp3Stop();
  ttsStop();
}

/** True when some audio output is possible in this browser. */
export function canSpeak(): boolean {
  return mp3Available() || ttsAvailable();
}
