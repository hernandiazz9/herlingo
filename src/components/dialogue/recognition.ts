/**
 * Minimal, local speech-recognition helper for the dialogue simulator (Web Speech API).
 * Optional feature: always feature-detect with `canRecognize()` and keep the tap-to-pick path.
 */
import { fold } from "@/components/phrasebook/search";

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function canRecognize(): boolean {
  return ctor() !== undefined;
}

/**
 * Listens once and resolves with the heard alternatives (empty when nothing was understood or
 * on error). Returns `cancel` to abort. Call from a user gesture.
 */
export function listen(locale: string): { result: Promise<string[]>; cancel: () => void } {
  const Ctor = ctor();
  if (!Ctor) return { result: Promise.resolve([]), cancel: () => {} };
  const rec = new Ctor();
  rec.lang = locale;
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  const result = new Promise<string[]>((resolve) => {
    let heard: string[] = [];
    rec.onresult = (e) => {
      const first = e.results[0];
      heard = first ? Array.from(first, (alt) => alt.transcript) : [];
    };
    rec.onerror = () => resolve(heard);
    rec.onend = () => resolve(heard);
    try {
      rec.start();
    } catch {
      resolve([]);
    }
  });
  return { result, cancel: () => rec.abort() };
}

/** Word-overlap similarity (0..1) between two texts, accent- and punctuation-insensitive. */
function similarity(a: string, b: string): number {
  const wa = fold(a).split(" ").filter(Boolean);
  const wb = new Set(fold(b).split(" ").filter(Boolean));
  if (!wa.length || !wb.size) return 0;
  const common = wa.filter((w) => wb.has(w)).length;
  return (2 * common) / (wa.length + wb.size);
}

/** Index of the option that best matches what was heard, or -1 when nothing is close enough. */
export function bestMatch(heard: string[], options: string[], threshold = 0.6): number {
  let best = -1;
  let score = threshold;
  for (const h of heard) {
    options.forEach((o, i) => {
      const s = similarity(h, o);
      if (s >= score) {
        score = s;
        best = i;
      }
    });
  }
  return best;
}
