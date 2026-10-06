/**
 * Legacy one-shot API, kept so screens keep working until they move to `createListenSession`
 * (docs/speech.md). A thin wrapper over the engine: same signature and result shape as before.
 */
import { createListenSession } from "./session";
import type { ListenErrorKind } from "./messages";

export type RecognitionError = "unsupported" | "not-allowed" | "no-speech" | "aborted" | "network" | "other";

export type RecognitionResult = { ok: true; transcripts: string[] } | { ok: false; error: RecognitionError };

export interface RecognitionSession {
  /** Resolves once (never rejects) with every alternative heard (best first), or an error. */
  result: Promise<RecognitionResult>;
  /** Stop listening and keep what was heard. */
  stop(): void;
  /** Cancel (resolves with `aborted`). */
  abort(): void;
}

function legacyError(kind: ListenErrorKind): RecognitionError {
  switch (kind) {
    case "unsupported":
    case "not-allowed":
    case "no-speech":
    case "aborted":
    case "network":
      return kind;
    default:
      return "other";
  }
}

/**
 * Listens once in `locale`. Call it from a user gesture. `timeoutMs` (optional) becomes the hard
 * cap; above 10 s the session uses the "long" mode (longer silence before auto-stop).
 * @deprecated Use `createListenSession`.
 */
export function listenOnce(locale: string, timeoutMs?: number): RecognitionSession {
  const session = createListenSession({
    locale,
    mode: timeoutMs !== undefined && timeoutMs > 10_000 ? "long" : "phrase",
    ...(timeoutMs !== undefined ? { maxMs: timeoutMs } : {}),
  });
  const result = session.result.then<RecognitionResult>((s) =>
    s.status === "done"
      ? { ok: true, transcripts: s.result.alternatives }
      : { ok: false, error: legacyError(s.error.kind) },
  );
  session.start();
  return { result, stop: () => session.finish(), abort: () => session.cancel() };
}
