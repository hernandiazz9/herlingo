/**
 * The speech engine: one listen session over the browser Web Speech API (docs/speech.md).
 *
 * idle → starting → listening → hearing → processing → done | error. Every path settles:
 * silence auto-stop (timed from the last result, since Safari's `onspeechend` is unreliable),
 * a hard cap, a no-speech timeout, a start timeout, and a grace period after stopping after
 * which the recognizer is aborted and the session settles with what was heard (interim counts).
 * Only one session is live at a time; the page going to the background cancels it.
 * `answer` mode only: when the browser ends the session on its own, a continuation recognizer
 * starts and its text is appended (at most `ANSWER_MAX_CONTINUATIONS`).
 */
import { appendSpeechLog, type ListenEndReason, type SpeechLogEntry } from "./log";
import { errorKindFromCode, listenErrorMessage, type ListenErrorKind } from "./messages";
import { browserFamily, isStandalone, recognitionCtor, type RecognitionEventLike, type RecognitionLike } from "./platform";

export type ListenMode = "phrase" | "long" | "answer";
export type ListenStatus = "idle" | "starting" | "listening" | "hearing" | "processing" | "done" | "error";

export interface ListenTimings {
  /** Silence after speech (ms since the last result) that ends the session. */
  silenceMs: number;
  /** Hard cap (ms since listening began). */
  maxMs: number;
  /** No speech within this many ms of listening = error `no-speech`. */
  noSpeechMs: number;
  /** `starting` that never reaches `listening` within this = error `start-timeout`. */
  startTimeoutMs: number;
  /** After stopping, wait this long for `onend`, then abort and settle with what was heard. */
  endGraceMs: number;
}

/** Defaults per mode (Hernán: "según pantalla"). */
export const LISTEN_TIMINGS: Readonly<Record<ListenMode, Readonly<ListenTimings>>> = {
  phrase: { silenceMs: 1500, maxMs: 10_000, noSpeechMs: 4000, startTimeoutMs: 5000, endGraceMs: 1500 },
  long: { silenceMs: 2500, maxMs: 45_000, noSpeechMs: 4000, startTimeoutMs: 5000, endGraceMs: 1500 },
  /** A spoken answer of 30 s – 3 min (Mi entrevista). */
  answer: { silenceMs: 5000, maxMs: 180_000, noSpeechMs: 8000, startTimeoutMs: 5000, endGraceMs: 1500 },
};

/**
 * `answer` mode: continuation sessions allowed when the browser ends on its own before the cap and
 * before `finish()`. The next end (or a continuation that cannot start) settles with
 * `continued: "failed"`.
 */
export const ANSWER_MAX_CONTINUATIONS = 5;

export interface ListenOptions extends Partial<ListenTimings> {
  /** BCP 47 locale, e.g. the pack's `speechLocale` or "es-ES". */
  locale: string;
  /** Default "phrase". */
  mode?: ListenMode;
  /** Keep listening across pauses. Default: false for "phrase", true for "long" and "answer". */
  continuous?: boolean;
  /** Default 5. */
  maxAlternatives?: number;
}

export interface ListenResult {
  /** Best full transcript (every result joined), trimmed. Never empty. */
  transcript: string;
  /** Distinct full transcripts, best first (includes `transcript`). */
  alternatives: string[];
  /** Ms from listening to the end. */
  durationMs: number;
  /** `answer` mode only: continuation sessions started after the browser ended on its own. */
  continuations?: number;
  /**
   * `answer` mode only: the browser ended and listening could not continue (a continuation could
   * not start, or the limit was reached). The text is what was heard up to there; the UI offers
   * «Seguir hablando».
   */
  continued?: "failed";
}

export interface ListenError {
  kind: ListenErrorKind;
  /** Spanish message with a concrete fix (from the messages table). */
  message: string;
}

interface Base {
  /** Live text heard so far (interim + final), "" before any result. */
  interim: string;
  /** `Date.now()` when listening began (for a countdown to `maxMs`), null before. */
  listeningAt: number | null;
}
export type ListenState =
  | (Base & { status: "idle" | "starting" | "listening" | "hearing" | "processing" })
  | (Base & { status: "done"; result: ListenResult })
  | (Base & { status: "error"; error: ListenError });
export type ListenOutcome = Extract<ListenState, { status: "done" | "error" }>;

export interface ListenSession {
  readonly state: ListenState;
  readonly mode: ListenMode;
  readonly locale: string;
  /** Effective timings (defaults + overrides). */
  readonly timings: Readonly<ListenTimings>;
  /** Opens the mic (call from a user gesture). Cancels any other live session. Only the first call counts. */
  start(): void;
  /** Stop and KEEP what was heard. Before listening it behaves like cancel(). */
  finish(): void;
  /** Stop and discard: settles as error `aborted`. */
  cancel(): void;
  /** Called on every state change (not immediately). Returns an unsubscribe. */
  subscribe(listener: (state: ListenState) => void): () => void;
  /** Resolves once, never rejects, with the final state. */
  readonly result: Promise<ListenOutcome>;
}

let live: { cancel(reason: ListenEndReason): void } | null = null;

/** Cancels whatever session is live (e.g. before playing audio). */
export function cancelListening(): void {
  live?.cancel("cancel");
}

function joinResults(e: RecognitionEventLike, alt: number): string {
  const parts: string[] = [];
  for (let i = 0; i < e.results.length; i++) {
    const r = e.results[i];
    const a = r[alt] ?? r[0];
    const t = a?.transcript?.trim();
    if (t) parts.push(t);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function createListenSession(options: ListenOptions): ListenSession {
  const mode: ListenMode = options.mode ?? "phrase";
  const d = LISTEN_TIMINGS[mode];
  const timings: ListenTimings = {
    silenceMs: options.silenceMs ?? d.silenceMs,
    maxMs: options.maxMs ?? d.maxMs,
    noSpeechMs: options.noSpeechMs ?? d.noSpeechMs,
    startTimeoutMs: options.startTimeoutMs ?? d.startTimeoutMs,
    endGraceMs: options.endGraceMs ?? d.endGraceMs,
  };
  const continuous = options.continuous ?? mode !== "phrase";
  const maxAlternatives = options.maxAlternatives ?? 5;
  const locale = options.locale;

  let state: ListenState = { status: "idle", interim: "", listeningAt: null };
  const listeners = new Set<(s: ListenState) => void>();
  let resolveResult: (s: ListenOutcome) => void = () => {};
  const result = new Promise<ListenOutcome>((r) => {
    resolveResult = r;
  });

  let rec: RecognitionLike | null = null;
  let started = false;
  let settled = false;
  let ended = false;
  let startedAt = 0;
  let startedIso = "";
  let lastCode: string | undefined;
  let errorKind: ListenErrorKind | undefined;
  let alternatives: string[] = [];
  /** Why we stopped, reported when `onend` then arrives in time. */
  let pendingReason: ListenEndReason = "ended";
  const stamps: SpeechLogEntry["timings"] = {};
  const timers: Partial<
    Record<"start" | "noSpeech" | "silence" | "cap" | "grace" | "restart", ReturnType<typeof setTimeout>>
  > = {};
  /** `answer` mode: continuation sessions started, one is starting, the last end could not continue. */
  const maxContinuations = mode === "answer" ? ANSWER_MAX_CONTINUATIONS : 0;
  let continuations = 0;
  let restarting = false;
  let continuedFailed = false;
  /** `answer` mode: best transcript of the earlier sessions, prefixed to the current one's. */
  let carried = "";

  const clear = (name: keyof typeof timers) => {
    if (timers[name] !== undefined) clearTimeout(timers[name]);
    delete timers[name];
  };
  const set = (name: keyof typeof timers, ms: number, fn: () => void) => {
    clear(name);
    timers[name] = setTimeout(fn, ms);
  };

  const emit = (next: ListenState) => {
    state = next;
    for (const l of [...listeners]) {
      try {
        l(next);
      } catch {
        // A broken listener must not break the session.
      }
    }
  };
  const move = (status: "starting" | "listening" | "hearing" | "processing", patch: Partial<Base> = {}) => {
    if (status !== "starting" && stamps[status] === undefined) stamps[status] = Date.now() - startedAt;
    emit({ ...state, ...patch, status } as ListenState);
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") handle.cancel("hidden");
  };

  const settle = (outcome: { ok: true } | { ok: false; kind: ListenErrorKind }, reason: ListenEndReason) => {
    if (settled) return;
    settled = true;
    for (const k of Object.keys(timers) as (keyof typeof timers)[]) clear(k);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
    if (live === handle) live = null;
    if (rec) {
      const r = rec;
      r.onstart = r.onaudiostart = r.onspeechstart = r.onspeechend = r.onend = null;
      r.onresult = null;
      r.onerror = null;
      if (!ended) {
        try {
          r.abort();
        } catch {
          // Already stopped.
        }
      }
    }
    const now = Date.now();
    if (started) stamps.end = now - startedAt;
    const durationMs = state.listeningAt ? now - state.listeningAt : 0;
    const transcript = alternatives[0] ?? "";
    let final: ListenOutcome;
    if (outcome.ok && transcript) {
      const extra: Partial<ListenResult> =
        mode === "answer" ? { continuations, ...(continuedFailed ? { continued: "failed" as const } : {}) } : {};
      final = { ...state, status: "done", result: { transcript, alternatives: [...alternatives], durationMs, ...extra } };
    } else {
      const kind = outcome.ok ? "no-speech" : outcome.kind;
      final = { ...state, status: "error", error: { kind, message: listenErrorMessage(kind) } };
    }
    if (started) {
      appendSpeechLog({
        at: startedIso,
        locale,
        mode,
        timings: { ...stamps },
        reason,
        outcome: final.status,
        ...(final.status === "error" ? { error: final.error.kind } : {}),
        ...(lastCode ? { code: lastCode } : {}),
        chars: final.status === "done" ? transcript.length : 0,
        alternatives: final.status === "done" ? alternatives.length : 0,
        standalone: isStandalone(),
        browser: browserFamily(),
        ...(mode === "answer" ? { continuations } : {}),
      });
    }
    emit(final);
    resolveResult(final);
  };

  /** Settle with what was heard, or with the pending error kind / no-speech. */
  const settleHeard = (reason: ListenEndReason) => {
    if (alternatives.length) settle({ ok: true }, reason);
    else settle({ ok: false, kind: errorKind ?? "no-speech" }, errorKind ? "error" : reason);
  };

  /** Stop listening and wait (bounded) for the final result. */
  const stopAndWait = (reason: ListenEndReason) => {
    if (settled || state.status === "processing") return;
    clear("silence");
    clear("cap");
    clear("noSpeech");
    clear("restart");
    move("processing");
    try {
      rec?.stop();
    } catch {
      settleHeard(reason);
      return;
    }
    pendingReason = reason;
    set("grace", timings.endGraceMs, () => settleHeard("end-timeout"));
  };

  const onListening = () => {
    if (settled || state.status !== "starting") return;
    clear("start");
    move("listening", { listeningAt: Date.now() });
    set("noSpeech", timings.noSpeechMs, () => {
      if (alternatives.length) return;
      settle({ ok: false, kind: "no-speech" }, "no-speech");
    });
    set("cap", timings.maxMs, () => stopAndWait("cap"));
  };

  const onHearing = () => {
    if (settled) return;
    if (state.status === "starting") onListening();
    if (state.status === "listening") {
      clear("noSpeech");
      move("hearing");
    }
  };

  const handle = {
    cancel(reason: ListenEndReason) {
      if (!started) {
        started = true; // never start later
        settled = true;
        const final: ListenOutcome = {
          ...state,
          status: "error",
          error: { kind: "aborted", message: listenErrorMessage("aborted") },
        };
        emit(final);
        resolveResult(final);
        return;
      }
      settle({ ok: false, kind: "aborted" }, reason);
    },
  };

  let Ctor: ReturnType<typeof recognitionCtor> = undefined;

  /** A configured recognizer (throws like the constructor). */
  const create = (C: NonNullable<typeof Ctor>): RecognitionLike => {
    const r = new C();
    r.lang = locale;
    r.interimResults = true;
    r.continuous = continuous;
    r.maxAlternatives = maxAlternatives;
    return r;
  };

  /**
   * Silence after the last result ends the answer. While a continuation is still starting, the
   * gap is the browser's, not the learner's: listening could not continue.
   */
  const onSilence = () => {
    if (restarting) failContinuation();
    else stopAndWait("silence");
  };

  /** A continuation recognizer is alive (any event from it): it did start. */
  const resumed = () => {
    if (!restarting) return;
    restarting = false;
    clear("restart");
  };

  /** `answer` mode: the browser ended and listening cannot continue; settle with what was heard. */
  const failContinuation = () => {
    if (settled) return;
    continuedFailed = true;
    settleHeard("ended");
  };

  /**
   * `answer` mode, on the browser's own end (not stopping): start a continuation recognizer and
   * append its text. False when the session should settle as before (other modes, not listening yet).
   */
  const continueOnEnd = (): boolean => {
    if (mode !== "answer" || state.listeningAt === null) return false;
    if (restarting || continuations >= maxContinuations || !Ctor) {
      continuedFailed = true; // a continuation ended before starting, or no continuation left
      return false;
    }
    if (rec) {
      // The ended recognizer is done: detach it before the continuation replaces it.
      rec.onstart = rec.onaudiostart = rec.onspeechstart = rec.onspeechend = rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
    }
    continuations++;
    restarting = true;
    carried = alternatives[0] ?? "";
    set("restart", timings.startTimeoutMs, failContinuation);
    let r: RecognitionLike;
    try {
      r = create(Ctor);
    } catch {
      failContinuation();
      return true;
    }
    rec = r;
    ended = false;
    wire(r);
    try {
      r.start();
    } catch {
      failContinuation();
    }
    return true;
  };

  const wire = (r: RecognitionLike) => {
    r.onstart = () => {
      resumed();
      onListening();
    };
    r.onaudiostart = () => {
      resumed();
      onListening();
    };
    r.onspeechstart = () => {
      resumed();
      onHearing();
      // Speech detected but no words yet: give it noSpeechMs to produce a result.
      if (!alternatives.length && state.status === "hearing") {
        set("silence", Math.max(timings.silenceMs, timings.noSpeechMs), onSilence);
      }
    };
    r.onspeechend = null; // unreliable on Safari: silence is timed from results instead
    r.onresult = (e) => {
      if (settled) return;
      resumed();
      const n = Math.max(1, ...Array.from({ length: e.results.length }, (_, i) => e.results[i].length));
      const seen = new Set<string>();
      const alts: string[] = [];
      for (let a = 0; a < n; a++) {
        const t = joinResults(e, a);
        if (t && !seen.has(t)) {
          seen.add(t);
          alts.push(t);
        }
      }
      if (!alts.length) return;
      // A continuation's results start from scratch: put the earlier text first, with a space.
      alternatives = carried ? alts.map((t) => `${carried} ${t}`) : alts;
      if (state.status === "processing") {
        emit({ ...state, interim: alternatives[0] });
        return;
      }
      onHearing();
      emit({ ...state, interim: alternatives[0] });
      set("silence", timings.silenceMs, onSilence);
    };
    r.onerror = (e) => {
      if (settled) return;
      lastCode = e.error;
      const kind = errorKindFromCode(e.error);
      if (kind === "aborted") return; // our own abort, or iOS noise: onend / timers settle it
      // `answer` mode: the browser's own no-speech is the browser ending on its own: `onend` continues
      // the session, and our noSpeechMs / silenceMs decide when the answer is over.
      if (kind === "no-speech" && mode === "answer" && state.listeningAt !== null && !restarting) return;
      errorKind = kind;
      if (restarting && state.status !== "processing") failContinuation();
      else if (alternatives.length) settle({ ok: true }, "error");
      else settle({ ok: false, kind }, kind === "no-speech" ? "no-speech" : "error");
    };
    r.onend = () => {
      ended = true;
      if (settled) return;
      if (state.status !== "processing" && continueOnEnd()) return;
      settleHeard(state.status === "processing" ? pendingReason : "ended");
    };
  };

  const start = () => {
    if (started || settled) return;
    started = true;
    startedAt = Date.now();
    startedIso = new Date(startedAt).toISOString();
    live?.cancel("replaced");
    live = handle;
    move("starting");

    Ctor = recognitionCtor();
    if (!Ctor) {
      settle({ ok: false, kind: "unsupported" }, "error");
      return;
    }
    let r: RecognitionLike;
    try {
      r = create(Ctor);
    } catch {
      settle({ ok: false, kind: "other" }, "error");
      return;
    }
    rec = r;
    wire(r);

    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    set("start", timings.startTimeoutMs, () => settle({ ok: false, kind: "start-timeout" }, "start-timeout"));
    try {
      r.start();
    } catch {
      settle({ ok: false, kind: "other" }, "error");
    }
  };

  return {
    get state() {
      return state;
    },
    mode,
    locale,
    timings,
    start,
    finish() {
      if (settled) return;
      if (!started || state.status === "starting") handle.cancel("cancel");
      else stopAndWait("finish");
    },
    cancel() {
      if (!settled) handle.cancel("cancel");
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    result,
  };
}
