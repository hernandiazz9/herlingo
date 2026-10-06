/**
 * Game mode data on the device (localStorage `lang-lern:game:<lang>`): best score per topic and
 * cards (phrases, pictured words) marked "La sé" (they go to the end of the next discovery decks). Tolerant parsing;
 * nothing here throws.
 */
const PREFIX = "lang-lern:game:";
const EVENT = "lang-lern:game-change";

export interface GameState {
  /** Topic id → best round score. */
  records: Record<string, number>;
  /** Card ids (phrases, pictured words) marked "La sé". */
  known: string[];
}

const key = (lang: string) => PREFIX + lang;

export function readGameRaw(lang: string): string {
  try {
    return window.localStorage.getItem(key(lang)) ?? "";
  } catch {
    return "";
  }
}

export function parseGameState(raw: string): GameState {
  const out: GameState = { records: {}, known: [] };
  if (!raw) return out;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return out;
    const o = v as Record<string, unknown>;
    if (o.records && typeof o.records === "object") {
      for (const [id, n] of Object.entries(o.records)) {
        if (typeof n === "number" && Number.isFinite(n) && n > 0) out.records[id] = Math.round(n);
      }
    }
    if (Array.isArray(o.known)) out.known = o.known.filter((x): x is string => typeof x === "string");
  } catch {
    // Corrupt value: start empty.
  }
  return out;
}

export function getGameState(lang: string): GameState {
  if (typeof window === "undefined") return parseGameState("");
  return parseGameState(readGameRaw(lang));
}

function save(lang: string, state: GameState): void {
  try {
    window.localStorage.setItem(key(lang), JSON.stringify(state));
  } catch {
    // Storage unavailable: nothing persists.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeGame(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stores `score` when it beats the topic's record. Returns the previous record. */
export function saveRecord(lang: string, topicId: string, score: number): number {
  const state = getGameState(lang);
  const prev = state.records[topicId] ?? 0;
  if (score > prev) {
    state.records[topicId] = score;
    save(lang, state);
  }
  return prev;
}

/** Marks a card "La sé". Returns true when it was not known yet. */
export function markKnown(lang: string, phraseId: string): boolean {
  const state = getGameState(lang);
  if (state.known.includes(phraseId)) return false;
  state.known.push(phraseId);
  save(lang, state);
  return true;
}

/** Deletes the pack's game records and "La sé" phrases (part of "Borrar progreso"). */
export function clearGame(lang: string): void {
  try {
    window.localStorage.removeItem(key(lang));
  } catch {
    // Nothing stored.
  }
  window.dispatchEvent(new Event(EVENT));
}
