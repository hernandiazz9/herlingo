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
 * - `locale` marks a line that is not in the pack's language (a meaning read aloud in the
 *   learner's language): its device voice uses that locale and no stress marks are stripped.
 * - `speakSequence(lines, { gapMs })` plays lines one after another and ends as soon as anything
 *   else calls `speak()` or `stop()`. «Escuchar todo» (routes, stories, grammar) prefers one joined
 *   file (`joinLines`, played by `useSequencePlayer` from `./use-sequence-player`), which keeps
 *   playing with the screen locked; the chain is its fallback.
 * - Long media (Modo deporte's joined episode, `@/lib/sport`): `mp3Media(url, events)` on the same
 *   shared element, with play/pause/seek; `speak()` and `stop()` release it. `generatedBytes` and
 *   `mp3UrlWhenReady` give the clips it is joined from.
 * - The first tap/key anywhere unlocks audio for iOS (see `unlockOnFirstGesture`).
 */
import { getPack, stripStress, type Playable } from "@/lib/content";
import { getActiveLang, subscribeActiveLang } from "@/lib/content/active";
import { getSettings } from "@/lib/progress/settings";
import { isGenerated, playGenerated } from "./generated";
import { mp3Available, mp3Play, mp3Silence, mp3Stop, mp3Url, preloadManifest, unlockOnFirstGesture } from "./mp3";
import { ttsAvailable, ttsSpeak, ttsStop } from "./speech-synthesis";

export {
  clearGeneratedAudio,
  GENERATED_AUDIO_CACHE,
  GeneratedAudioError,
  generatedBytes,
  generatedFailure,
  generatedKey,
  type GeneratedBytesOptions,
  type GeneratedFailure,
  generatedPlayable,
  isGenerated,
  prefetchGenerated,
  pruneGenerated,
  setGeneratedAudioSource,
  type GeneratedAudioSource,
  type GeneratedSourceOptions,
  type PrefetchResult,
} from "./generated";
export { joinLines, type JoinedLines, type JoinLinesOptions } from "./joined";
export { mp3Media, mp3UrlWhenReady, type Mp3Media, type Mp3MediaEvents } from "./mp3";

export type SpeakInput = Playable | string;

export interface SpeakOptions {
  /** Slower playback for learners. */
  slow?: boolean;
  /** Language pack whose locale/audio to use; defaults to the active language (else the default pack). */
  lang?: string;
  /**
   * BCP-47 locale of a line that is not in the pack's language (e.g. a meaning read aloud in the
   * learner's own language): its device voice uses this locale instead of the pack's
   * `speechLocale`, and the pack's stress marks are not stripped from it.
   */
  locale?: string;
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
  const raw = typeof input === "string" ? input : input.text;
  // Written stress marks are for the eyes: never sent to a voice (a line in another language has none).
  const text = options.locale ? raw : stripStress(raw, meta);
  const locale = options.locale ?? meta.speechLocale;
  const rate = options.slow || getSettings().slowAudio ? SLOW_RATE : 1;
  if (typeof input !== "string" && isGenerated(input)) {
    return playGenerated({ ...input, text }, rate, () => my === generation, () => ttsSpeak(text, locale, rate));
  }
  const url = typeof input === "string" ? undefined : mp3Url(meta.lang, input.audioKey);
  if (!url) return ttsSpeak(text, locale, rate);
  return mp3Play(url, rate).then((result) => {
    if (result === "failed" && my === generation) return ttsSpeak(text, locale, rate);
  });
}

/** One line of `speakSequence`: what `speak()` would get. */
export interface SequenceLine {
  input: SpeakInput;
  options?: SpeakOptions;
}

export interface SequenceOptions {
  /** Silence between two lines, in ms (none after the last). */
  gapMs?: number;
  /** Index of the first line to play (default 0). */
  from?: number;
  /** Runs as line `i` starts (synchronously, before it plays). */
  onLine?: (i: number) => void;
}

/**
 * Silence between two lines of a sequence: played on the shared audio element when possible, so
 * the page keeps one running media session (lock screen, headphones), else a timer. Resolves at
 * once when it is interrupted.
 */
function silence(ms: number): Promise<void> {
  const url = ms > 0 ? mp3Silence(ms) : undefined;
  const timer = (left: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, left)));
  if (!url) return timer(ms);
  const started = Date.now();
  return mp3Play(url, 1).then((result) => {
    if (result === "failed") return timer(ms - (Date.now() - started));
  });
}

/**
 * Plays `lines` one after another, starting at `from`, with `gapMs` of silence between them (each
 * line like `speak(input, options)`, mp3 or device voice). Call it inside the tap handler, like
 * `speak()`: the first line starts at once. Resolves `true` after the last line and `false` as soon
 * as anything else calls `speak()` or `stop()` (a tap on a single line, leaving the screen): that
 * ends the sequence for good. Never rejects.
 */
export function speakSequence(lines: readonly SequenceLine[], options: SequenceOptions = {}): Promise<boolean> {
  const { gapMs = 0, from = 0, onLine } = options;
  return new Promise<boolean>((resolve) => {
    const step = (i: number) => {
      if (i >= lines.length) return resolve(true);
      onLine?.(i);
      const played = speak(lines[i].input, lines[i].options);
      // speak() bumped `generation`: any later speak()/stop() changes it again.
      const mine = generation;
      const current = () => mine === generation;
      void played
        .then(() => (current() && i + 1 < lines.length ? silence(gapMs) : undefined))
        .then(() => (current() ? step(i + 1) : resolve(false)));
    };
    step(from);
  });
}

/**
 * A check that stays true until anything calls `speak()` or `stop()` (a tap on one line, leaving a
 * screen): tells audio that starts after a wait, or long media that stopped, whether it was
 * interrupted.
 */
export function audioTurn(): () => boolean {
  const mine = generation;
  return () => mine === generation;
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
