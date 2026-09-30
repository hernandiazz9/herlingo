/** Browser text-to-speech backend (Web Speech API `speechSynthesis`). Client-only. */

let voices: SpeechSynthesisVoice[] = [];
/** Kept referenced so Chrome does not garbage-collect it mid-sentence (and drop `onend`). */
let current: SpeechSynthesisUtterance | null = null;

export function ttsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
}

if (ttsAvailable()) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

function norm(lang: string) {
  return lang.replace("_", "-").toLowerCase();
}

/** Best installed voice for a BCP-47 locale ("it-IT"), or undefined to let the browser choose. */
function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  if (!voices.length) loadVoices();
  const want = norm(locale);
  const base = want.split("-")[0];
  const exact = voices.filter((v) => norm(v.lang) === want);
  const pool = exact.length ? exact : voices.filter((v) => norm(v.lang).split("-")[0] === base);
  return pool.find((v) => v.localService) ?? pool[0];
}

/**
 * Speaks `text`. Resolves when it ends, errors or is cancelled (never rejects).
 * Call synchronously from a user gesture: iOS blocks speech started later.
 */
export function ttsSpeak(text: string, locale: string, rate: number): Promise<void> {
  if (!ttsAvailable()) return Promise.resolve();
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale;
  u.rate = rate;
  const voice = pickVoice(locale);
  if (voice) u.voice = voice;
  current = u;
  return new Promise((resolve) => {
    const done = () => {
      if (current === u) current = null;
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  });
}

export function ttsStop(): void {
  if (!ttsAvailable()) return;
  window.speechSynthesis.cancel();
  current = null;
}
