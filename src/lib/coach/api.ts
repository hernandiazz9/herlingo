/**
 * Client for the Prepárate backend (`/api/coach/<endpoint>/`, docs/coach.md). Every call sends
 * the stored access code and either resolves with checked data or rejects with a `CoachApiError`
 * whose `message` is Spain Spanish UI copy (the server's own message when it sent one).
 */
import { clearAccessCode, getAccessCode, setAccessCode } from "./access";
import { parseAssessment, parseGenerationUsage, parsePack, parseQuestion, parseUsage, isObject } from "./parse";
import { buildLearnerContext } from "./profile";
import { noteGeneration, storeUsage } from "./usage";
import { COACH_LIMITS, type CoachPack, type CoachUsage, type InterviewResult, type InterviewTurn, type PackResult } from "./types";

/** Same origin as the app (Vercel functions next to the static export, or `npm run dev:coach`). */
export const COACH_API_BASE = "/api/coach/";
/** Generations may take up to the function's 60 s limit. */
const TIMEOUT_MS = 75_000;

export type CoachErrorKind =
  /** No connection, server unreachable or too slow. */
  | "offline"
  /** 401: missing or wrong code (the stored code is forgotten: ask for it again). */
  | "unauthorized"
  /** 429: `code` is daily_limit, budget or refine_limit. */
  | "limit"
  /** 502: Claude could not produce a valid answer; nothing was stored or charged as a pack. */
  | "failed"
  /** The caller aborted the request: show nothing. */
  | "aborted"
  /** Anything else (400, 403, 5xx, no backend on this server, invalid response). */
  | "other";

export class CoachApiError extends Error {
  constructor(
    readonly kind: CoachErrorKind,
    message: string,
    /** HTTP status (0 when no response). */
    readonly status = 0,
    /** Server error code (`daily_limit`, `budget`, `generation_failed`…) or a client one. */
    readonly code: string = kind,
  ) {
    super(message);
    this.name = "CoachApiError";
  }
}

const MESSAGES = {
  offline: "No hay conexión. Prepárate necesita internet para preparar situaciones; las guardadas funcionan sin conexión.",
  unreachable: "No he podido conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
  timeout: "Está tardando demasiado. Inténtalo de nuevo.",
  noCode: "Escribe tu código de acceso.",
  badCode: "Ese código de acceso no es válido.",
  unavailable: "Prepárate no está disponible en este servidor.",
  invalid: "La respuesta del servidor no es válida. Inténtalo de nuevo.",
  generic: "Algo ha fallado. Inténtalo de nuevo.",
  refineLimit: `Ya has ajustado esta situación ${COACH_LIMITS.refinementsPerPack} veces.`,
};

/** `e` as a `CoachApiError` (anything else becomes kind "other" with a generic message): for catch blocks. */
export function toCoachApiError(e: unknown): CoachApiError {
  return e instanceof CoachApiError ? e : new CoachApiError("other", MESSAGES.generic);
}

function kindFor(status: number): CoachErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 429) return "limit";
  if (status === 502) return "failed";
  return "other";
}

async function errorFrom(res: Response, code: string): Promise<CoachApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  const err = isObject(body) && isObject(body.error) ? body.error : {};
  const serverCode = typeof err.code === "string" ? err.code : undefined;
  const kind = kindFor(res.status);
  // Only an error the coach backend wrote carries its own message (a 404 from a plain static host does not).
  const message =
    typeof err.message === "string" && err.message
      ? err.message
      : res.status === 404
        ? MESSAGES.unavailable
        : kind === "unauthorized"
          ? MESSAGES.noCode
          : MESSAGES.generic;
  if (kind === "unauthorized" && code === getAccessCode()) clearAccessCode();
  return new CoachApiError(kind, message, res.status, serverCode ?? kind);
}

interface CallOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  /** Code to send instead of the stored one (checking a new code). */
  code?: string;
  signal?: AbortSignal;
}

/** One request to `/api/coach/<path>/`: the Response when 2xx, else a `CoachApiError`. */
async function call(path: string, { method = "GET", body, code = getAccessCode() ?? "", signal }: CallOptions = {}): Promise<Response> {
  if (!code) throw new CoachApiError("unauthorized", MESSAGES.noCode, 0, "no_code");
  // A header value must be Latin-1; real codes are printable ASCII.
  if (/[^\x20-\x7e]/.test(code)) throw new CoachApiError("unauthorized", MESSAGES.badCode, 0, "bad_code");
  if (signal?.aborted) throw new CoachApiError("aborted", "", 0);
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new CoachApiError("offline", MESSAGES.offline);
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(`${COACH_API_BASE}${path}/`, {
      method,
      headers: { "x-coach-code": code, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw await errorFrom(res, code);
    return res;
  } catch (e) {
    if (e instanceof CoachApiError) throw e;
    if (signal?.aborted) throw new CoachApiError("aborted", "", 0);
    if (timedOut) throw new CoachApiError("offline", MESSAGES.timeout, 0, "timeout");
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    throw new CoachApiError("offline", offline ? MESSAGES.offline : MESSAGES.unreachable);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function callJson(path: string, options?: CallOptions): Promise<unknown> {
  const res = await call(path, options);
  try {
    return await res.json();
  } catch {
    throw new CoachApiError("other", MESSAGES.invalid, res.status, "invalid_response");
  }
}

const invalid = () => new CoachApiError("other", MESSAGES.invalid, 200, "invalid_response");

function packResult(data: unknown, newPack: boolean): PackResult {
  const pack = isObject(data) ? parsePack(data.pack) : null;
  if (!pack || !isObject(data)) throw invalid();
  const usage = parseGenerationUsage(data.usage);
  noteGeneration(usage, newPack);
  return { pack, usage };
}

/** A new preparation pack for `description` (the learner context is added). Not saved: see `savePack`. */
export async function generatePack(lang: string, description: string, opts: { signal?: AbortSignal } = {}): Promise<PackResult> {
  const body = { lang, description, profile: buildLearnerContext(lang) };
  return packResult(await callJson("pack", { method: "POST", body, signal: opts.signal }), true);
}

/**
 * "Ajustar" (`instruction`) or "Generar otra vez" (`instruction` empty): the same pack id with
 * `refinements + 1`. At most `COACH_LIMITS.refinementsPerPack` (checked here and on the server).
 * Not saved: see `replacePack`.
 */
export async function refinePack(previous: CoachPack, instruction: string, opts: { signal?: AbortSignal } = {}): Promise<PackResult> {
  if (previous.refinements >= COACH_LIMITS.refinementsPerPack) {
    throw new CoachApiError("limit", MESSAGES.refineLimit, 0, "refine_limit");
  }
  const body = {
    lang: previous.lang,
    description: previous.description,
    profile: buildLearnerContext(previous.lang),
    refine: { packId: previous.id, instruction: instruction.trim(), previous },
  };
  return packResult(await callJson("pack", { method: "POST", body, signal: opts.signal }), false);
}

/**
 * One step of the level interview: `history` = the questions answered so far (empty to start).
 * Returns the next question or the final assessment (store it with `saveAssessment`).
 */
export async function interviewStep(lang: string, history: InterviewTurn[], opts: { signal?: AbortSignal } = {}): Promise<InterviewResult> {
  const body = { lang, profile: buildLearnerContext(lang), history: history.slice(0, COACH_LIMITS.interviewTurns) };
  const data = await callJson("interview", { method: "POST", body, signal: opts.signal });
  if (!isObject(data)) throw invalid();
  const usage = parseGenerationUsage(data.usage);
  noteGeneration(usage, false);
  if (data.done === true) {
    const assessment = parseAssessment(data.assessment);
    if (!assessment) throw invalid();
    return { done: true, assessment, usage };
  }
  const question = parseQuestion(data.question);
  if (!question) throw invalid();
  const turn = typeof data.turn === "number" ? data.turn : history.length + 1;
  return { done: false, question, turn, usage };
}

function usageFrom(data: unknown): CoachUsage {
  const usage = parseUsage(data);
  if (!usage) throw invalid();
  storeUsage(usage);
  return usage;
}

/** This month's spend, the cap and today's generations (also stored for the budget line). */
export async function fetchUsage(opts: { signal?: AbortSignal } = {}): Promise<CoachUsage> {
  return usageFrom(await callJson("usage", { signal: opts.signal }));
}

/** Owner only (others get kind "other", status 403): sets the monthly cap in USD. */
export async function updateMonthlyCap(capUsd: number): Promise<CoachUsage> {
  return usageFrom(await callJson("usage", { method: "PUT", body: { capUsd } }));
}

/** Checks a code with the server; when valid, stores it and returns its usage. */
export async function checkAccessCode(code: string, opts: { signal?: AbortSignal } = {}): Promise<CoachUsage> {
  const trimmed = code.trim();
  const data = await callJson("usage", { code: trimmed, signal: opts.signal });
  const usage = parseUsage(data);
  if (!usage) throw invalid();
  setAccessCode(trimmed);
  storeUsage(usage);
  return usage;
}

/** The mp3 of one line (`POST /api/coach/tts/`); rejects on any failure (the caller uses the device voice). */
export async function fetchSpeech(text: string, voice: string, signal?: AbortSignal): Promise<Blob> {
  const res = await call("tts", { method: "POST", body: { text, voice }, signal });
  const type = res.headers.get("Content-Type") ?? "";
  if (!type.startsWith("audio/")) throw invalid();
  return res.blob();
}
