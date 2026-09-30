/**
 * Game mode (/jugar): topics, discovery deck, quick-round questions and scoring. Framework-free.
 * Topics are the pack's situations that have phrases, plus "Mezcla" (every topic). Phrases with
 * the same text under two ids are shown once; `aliases` gives the other ids (for SRS).
 */
import { getPack, getSituation, type Pack, type Phrase } from "@/lib/content";
import { createRng, type Rng } from "@/lib/exercises";
import { dedupeByText, textKey } from "@/lib/srs";

export { getGameState, markKnown, parseGameState, readGameRaw, saveRecord, subscribeGame, type GameState } from "./storage";

/** Topic id of the mix of every topic. */
export const MIX = "mezcla";
/** Round length. */
export const ROUND_MS = 60_000;
/** Cards per discovery deck. */
export const DECK_SIZE = 10;
/** Points per right answer, before the combo multiplier. */
export const POINTS = 10;
/** XP for finishing a round, plus one per right answer. */
export const XP_ROUND = 5;
export const OPTIONS = 4;

export interface Topic {
  id: string;
  title: string;
  emoji?: string;
  phrases: Phrase[];
}

export interface TopicPool {
  topic: Topic;
  /** Kept id → other ids with the same text. */
  aliases: Map<string, string[]>;
}

function pool(id: string, title: string, emoji: string | undefined, phrases: Phrase[]): TopicPool {
  const byId = new Map(phrases.map((p) => [p.id, p]));
  const { ids, aliases } = dedupeByText(
    phrases.map((p) => p.id),
    (pid) => byId.get(pid)?.text,
  );
  return { topic: { id, title, emoji, phrases: ids.map((pid) => byId.get(pid)!) }, aliases };
}

/** Situations with phrases (pack order), then "Mezcla" is `getTopicPool(MIX)`. */
export function listTopics(pack: Pack = getPack()): Topic[] {
  return pack.meta.situations
    .map((s) => getTopicPool(s.id, pack)?.topic)
    .filter((t): t is Topic => !!t && t.phrases.length > 0);
}

export function getTopicPool(id: string, pack: Pack = getPack()): TopicPool | undefined {
  if (id === MIX) return pool(MIX, "Mezcla", "🎲", pack.phrases);
  const situation = getSituation(id, pack);
  if (!situation) return undefined;
  return pool(situation.id, situation.title, situation.emoji, pack.phrases.filter((p) => p.situation === id));
}

/** Short Spanish explanation for a card: `explanation`, else `notes`, else nothing. */
export function explain(p: Phrase): string | undefined {
  return p.explanation || p.notes || undefined;
}

/** Discovery deck: phrases not marked "La sé" first (shuffled), then the known ones. */
export function buildDeck(phrases: Phrase[], known: ReadonlySet<string>, rng: Rng, size = DECK_SIZE): Phrase[] {
  const fresh = rng.shuffle(phrases.filter((p) => !known.has(p.id)));
  const old = rng.shuffle(phrases.filter((p) => known.has(p.id)));
  return [...fresh, ...old].slice(0, size);
}

/** Question order for a round: the deck first, then the rest of the topic, shuffled. */
export function roundOrder(phrases: Phrase[], deck: Phrase[], rng: Rng): Phrase[] {
  const inDeck = new Set(deck.map((p) => p.id));
  return [...rng.shuffle(deck), ...rng.shuffle(phrases.filter((p) => !inDeck.has(p.id)))];
}

export interface RoundSetup {
  rng: Rng;
  /** Phrases in question order (`roundOrder`). */
  order: Phrase[];
  startedAt: number;
  /** Epoch ms when time is up. */
  deadline: number;
}

/** A fresh round: random seed, question order and deadline from now. */
export function setupRound(topicId: string, phrases: Phrase[], deck: Phrase[]): RoundSetup {
  const startedAt = Date.now();
  const rng = createRng(`${topicId}:${startedAt}`);
  return { rng, order: roundOrder(phrases, deck, rng), startedAt, deadline: startedAt + ROUND_MS };
}

export type QuestionKind = "listen" | "reverse";

export interface Question {
  kind: QuestionKind;
  phrase: Phrase;
  /** 4 phrases (the right one included), shuffled. Label = `es` (listen) or `text` (reverse). */
  options: Phrase[];
}

/**
 * listen: hear the Italian, pick the Spanish meaning. reverse: read the Spanish, pick the
 * Italian. Distractors come from the topic, then the whole pack when the topic is small; no two
 * options share a Spanish or Italian text.
 */
export function makeQuestion(phrase: Phrase, topic: Phrase[], pack: Pack, rng: Rng): Question {
  const kind: QuestionKind = rng.next() < 0.5 ? "listen" : "reverse";
  const seenEs = new Set([textKey(phrase.es)]);
  const seenIt = new Set([textKey(phrase.text)]);
  const options = [phrase];
  for (const candidates of [topic, pack.phrases]) {
    for (const p of rng.shuffle(candidates)) {
      if (options.length >= OPTIONS) break;
      const es = textKey(p.es);
      const it = textKey(p.text);
      if (seenEs.has(es) || seenIt.has(it)) continue;
      seenEs.add(es);
      seenIt.add(it);
      options.push(p);
    }
  }
  return { kind, phrase, options: rng.shuffle(options) };
}

/** Combo multiplier: x1, then x2 from 3 right in a row, x3 from 6, x4 from 9. */
export function multiplier(combo: number): number {
  return Math.min(4, 1 + Math.floor(combo / 3));
}

export function roundXp(correct: number): number {
  return XP_ROUND + correct;
}
