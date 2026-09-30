/**
 * Web Speech recognition helper (client-only). Chrome/Safari expose it as
 * `webkitSpeechRecognition`; Chrome on iOS usually does not have it, so always feature-detect
 * with `canRecognize()` and fall back to self-evaluation.
 */

interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface RecognitionEventLike {
  results: ArrayLike<ArrayLike<RecognitionAlternative>>;
}
interface RecognitionErrorLike {
  error: string;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** True when this browser can do speech recognition. */
export function canRecognize(): boolean {
  return ctor() !== undefined;
}

export type RecognitionError = "unsupported" | "not-allowed" | "no-speech" | "aborted" | "network" | "other";

export type RecognitionResult = { ok: true; transcripts: string[] } | { ok: false; error: RecognitionError };

export interface RecognitionSession {
  /** Resolves once (never rejects) with every alternative heard, or an error. */
  result: Promise<RecognitionResult>;
  /** Stop listening and keep what was heard. */
  stop(): void;
  /** Cancel (resolves with `aborted`). */
  abort(): void;
}

const ERRORS: Record<string, RecognitionError> = {
  "not-allowed": "not-allowed",
  "service-not-allowed": "not-allowed",
  "no-speech": "no-speech",
  aborted: "aborted",
  network: "network",
};

/**
 * Listens once in `locale` (e.g. the pack's `speechLocale`). Call it from a user gesture:
 * the browser asks for the microphone the first time.
 */
export function listenOnce(locale: string, timeoutMs = 8000): RecognitionSession {
  const Ctor = ctor();
  if (!Ctor) return { result: Promise.resolve({ ok: false, error: "unsupported" }), stop() {}, abort() {} };

  const rec = new Ctor();
  rec.lang = locale;
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 5;

  const transcripts: string[] = [];
  let error: RecognitionError | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveResult: (r: RecognitionResult) => void = () => {};
  let settled = false;
  const result = new Promise<RecognitionResult>((resolve) => {
    resolveResult = resolve;
  });
  const settle = (r: RecognitionResult) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    resolveResult(r);
  };

  rec.onresult = (e) => {
    for (let i = 0; i < e.results.length; i++) {
      const alts = e.results[i];
      for (let j = 0; j < alts.length; j++) {
        const t = alts[j].transcript?.trim();
        if (t) transcripts.push(t);
      }
    }
  };
  rec.onerror = (e) => {
    error = ERRORS[e.error] ?? "other";
  };
  rec.onend = () => {
    if (transcripts.length && error !== "aborted") settle({ ok: true, transcripts });
    else settle({ ok: false, error: error ?? "no-speech" });
  };

  try {
    rec.start();
    timer = setTimeout(() => rec.stop(), timeoutMs);
  } catch {
    settle({ ok: false, error: "other" });
  }

  return {
    result,
    stop: () => rec.stop(),
    abort: () => {
      error = "aborted";
      rec.abort();
      settle({ ok: false, error: "aborted" });
    },
  };
}
