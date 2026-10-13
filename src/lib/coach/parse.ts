/**
 * Hand-written shape checks for stored values and server responses (no zod in src/). A pack,
 * route or assessment is either valid as a whole or rejected (null); nothing here throws.
 */
import { readVersioned } from "./store";
import {
  COACH_ROUTE_LIMITS,
  type CoachAssessment,
  type CoachLevel,
  type CoachOption,
  type CoachPack,
  type CoachRoute,
  type CoachRouteLine,
  type CoachRouteTurn,
  type CoachTurn,
  type CoachUsage,
  type GenerationUsage,
  type InterviewQuestion,
} from "./types";

type Obj = Record<string, unknown>;

export const isObject = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const num = (v: unknown) => (isNum(v) ? v : 0);

const LEVELS: readonly CoachLevel[] = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
const VERDICTS: readonly CoachOption["verdict"][] = ["correct", "acceptable", "wrong"];
const KINDS: readonly InterviewQuestion["kind"][] = ["comprehension", "reply", "personal"];

/** Maps every element with `fn`; null when the input is not an array or any element is invalid. */
function all<T>(v: unknown, fn: (x: unknown) => T | null, min = 1): T[] | null {
  if (!Array.isArray(v) || v.length < min) return null;
  const out: T[] = [];
  for (const x of v) {
    const parsed = fn(x);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

/** Non-empty strings of an array, at most `max`, each cut at `len` (the server's limits). */
const strings = (v: unknown, max: number, len = 200): string[] =>
  Array.isArray(v) ? v.filter(isText).slice(0, max).map((s) => s.slice(0, len)) : [];

function option(v: unknown): CoachOption | null {
  if (!isObject(v) || !isText(v.text) || !isText(v.es) || !isText(v.feedback)) return null;
  const verdict = VERDICTS.find((x) => x === v.verdict);
  return verdict ? { text: v.text, es: v.es, verdict, feedback: v.feedback } : null;
}

function turn(v: unknown): CoachTurn | null {
  if (!isObject(v) || !isText(v.id)) return null;
  if (v.speaker === "native") {
    if (!isText(v.text) || !isText(v.es)) return null;
    return { id: v.id, speaker: "native", ...(isText(v.name) ? { name: v.name } : {}), text: v.text, es: v.es };
  }
  if (v.speaker === "learner") {
    const options = all(v.options, option, 2);
    if (!isText(v.prompt) || !options) return null;
    return { id: v.id, speaker: "learner", prompt: v.prompt, options };
  }
  return null;
}

export function parsePack(v: unknown): CoachPack | null {
  if (!isObject(v)) return null;
  const { id, createdAt, lang, description, title, register, voices, dialogue, refinements } = v;
  if (![id, createdAt, lang, description, title].every(isText)) return null;
  if (register !== "formal" && register !== "informal") return null;
  if (!isObject(voices) || !isText(voices.native) || !isText(voices.learner)) return null;
  if (!isObject(dialogue) || !isText(dialogue.title)) return null;
  const guide = all(v.guide, (g) => (isObject(g) && isText(g.es) ? { es: g.es } : null));
  const keyPhrases = all(v.keyPhrases, (k) =>
    isObject(k) && isText(k.text) && isText(k.es)
      ? { text: k.text, es: k.es, ...(isText(k.note) ? { note: k.note } : {}) }
      : null,
  );
  const turns = all(dialogue.turns, turn);
  if (!guide || !keyPhrases || !turns) return null;
  return {
    id: id as string,
    createdAt: createdAt as string,
    lang: lang as string,
    description: description as string,
    title: title as string,
    register,
    voices: { native: voices.native, learner: voices.learner },
    guide,
    keyPhrases,
    dialogue: { title: dialogue.title, turns },
    refinements: isNum(refinements) && refinements > 0 ? Math.round(refinements) : 0,
  };
}

/** Valid target-language lines of an array (others skipped), at most `max`; [] when not an array. */
const routeLines = (v: unknown, max: number): CoachRouteLine[] =>
  Array.isArray(v)
    ? v
        .filter((l): l is { text: string; es: string } => isObject(l) && isText(l.text) && isText(l.es))
        .slice(0, max)
        .map((l) => ({ text: l.text, es: l.es }))
    : [];

function routeTurn(v: unknown): CoachRouteTurn | null {
  if (!isObject(v) || !isText(v.id) || !isText(v.text) || !isText(v.es)) return null;
  if (v.speaker !== "native" && v.speaker !== "learner") return null;
  return {
    id: v.id,
    speaker: v.speaker,
    text: v.text,
    es: v.es,
    alts: routeLines(v.alts, COACH_ROUTE_LIMITS.alts),
    words: routeLines(v.words, COACH_ROUTE_LIMITS.words),
  };
}

/** A quick route, or null when any required part (or any turn) is invalid. Extra alts/words are dropped. */
export function parseRoute(v: unknown): CoachRoute | null {
  if (!isObject(v)) return null;
  const { id, createdAt, lang, description, title, register, voices } = v;
  if (![id, createdAt, lang, description, title].every(isText)) return null;
  if (register !== "formal" && register !== "informal") return null;
  if (!isObject(voices) || !isText(voices.native) || !isText(voices.learner)) return null;
  const turns = all(v.turns, routeTurn);
  if (!turns) return null;
  return {
    id: id as string,
    createdAt: createdAt as string,
    lang: lang as string,
    description: description as string,
    title: title as string,
    register,
    voices: { native: voices.native, learner: voices.learner },
    turns: turns.slice(0, COACH_ROUTE_LIMITS.turns.max),
  };
}

/** Version of the stored lists `lang-lern:coach:packs:<lang>` and `lang-lern:coach:routes:<lang>`. */
export const SAVED_LIST_VERSION = 1;

/** The valid items of a stored `{ v, [field]: T[] }`, first of each id kept; [] when absent or corrupt. */
function savedList<T extends { id: string }>(raw: string, field: string, item: (v: unknown) => T | null): T[] {
  const list = readVersioned(raw, SAVED_LIST_VERSION)?.[field];
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of list) {
    const parsed = item(v);
    if (parsed && !seen.has(parsed.id)) {
      seen.add(parsed.id);
      out.push(parsed);
    }
  }
  return out;
}

/** Saved packs of a raw `lang-lern:coach:packs:<lang>` value; invalid packs are dropped. */
export const parseSavedPacks = (raw: string): CoachPack[] => savedList(raw, "packs", parsePack);

/** Saved routes of a raw `lang-lern:coach:routes:<lang>` value; invalid routes are dropped. */
export const parseSavedRoutes = (raw: string): CoachRoute[] => savedList(raw, "routes", parseRoute);

export function parseAssessment(v: unknown): CoachAssessment | null {
  if (!isObject(v) || !isText(v.summary)) return null;
  const level = LEVELS.find((x) => x === v.level);
  if (!level) return null;
  return {
    level,
    summary: v.summary.slice(0, 600),
    strengths: strings(v.strengths, 8),
    weakPoints: strings(v.weakPoints, 8),
    facts: strings(v.facts, 10),
  };
}

export function parseQuestion(v: unknown): InterviewQuestion | null {
  if (!isObject(v) || !isText(v.prompt)) return null;
  const kind = KINDS.find((x) => x === v.kind);
  if (!kind) return null;
  return { kind, prompt: v.prompt, ...(isText(v.text) ? { text: v.text } : {}) };
}

const today = (v: unknown) => (isObject(v) ? { used: num(v.used), limit: num(v.limit) } : { used: 0, limit: 0 });

export function parseUsage(v: unknown): CoachUsage | null {
  if (!isObject(v) || !isText(v.month) || !isNum(v.capUsd) || !isNum(v.remainingUsd)) return null;
  const t = isObject(v.tokens) ? v.tokens : {};
  return {
    month: v.month,
    spentUsd: num(v.spentUsd),
    capUsd: v.capUsd,
    remainingUsd: v.remainingUsd,
    tokens: { input: num(t.input), output: num(t.output), cacheRead: num(t.cacheRead), cacheWrite: num(t.cacheWrite) },
    packs: num(v.packs),
    avgPackUsd: num(v.avgPackUsd),
    today: today(v.today),
    isOwner: v.isOwner === true,
    mineUsd: num(v.mineUsd),
    // Optional: older servers and summaries stored before Modo rápido have none of them.
    ...(isNum(v.routes) ? { routes: v.routes } : {}),
    ...(isNum(v.avgRouteUsd) ? { avgRouteUsd: v.avgRouteUsd } : {}),
    ...(isObject(v.routesToday) ? { routesToday: today(v.routesToday) } : {}),
  };
}

export function parseGenerationUsage(v: unknown): GenerationUsage {
  const o = isObject(v) ? v : {};
  return { costUsd: num(o.costUsd), remainingUsd: num(o.remainingUsd), today: today(o.today) };
}
