/**
 * Game mode (/jugar): topics, discovery deck, quick-round questions and scoring. Framework-free.
 * Topics are the pack's situations that have phrases or pictured words, plus "Mezcla" (every
 * topic). A card is a phrase or a pictured word; cards with the same text under two ids are shown
 * once and `aliases` gives the other ids (for SRS).
 */
import { getSituation, listVocab, type Pack, type Phrase, type PicturedVocab } from "@/lib/content";
import { createRng, type Rng } from "@/lib/exercises";
import { dedupeByText, textKey } from "@/lib/srs";

export { getGameState, markKnown, parseGameState, readGameRaw, saveRecord, subscribeGame, type GameState } from "./storage";

/** Topic id of the mix of every topic. */
export const MIX = "mezcla";
/** Round length. */
export const ROUND_MS = 60_000;
/** Cards per discovery deck. */
export const DECK_SIZE = 10;
/** Pictured words dealt first in a deck when the topic also has phrases (more if phrases run short). */
export const DECK_WORDS = 5;
/** Points per right answer, before the combo multiplier. */
export const POINTS = 10;
/** XP for finishing a round, plus one per right answer. */
export const XP_ROUND = 5;
export const OPTIONS = 4;

/** What the game deals and asks: a phrase or a pictured word (both playable, with `text` and `es`). */
export type GameCard = Phrase | PicturedVocab;

export function isWord(card: GameCard): card is PicturedVocab {
  return card.kind === "vocab";
}

export interface Topic {
  id: string;
  title: string;
  emoji?: string;
  /** Pictured words of the topic (dealt first in Descubrir). */
  words: PicturedVocab[];
  phrases: Phrase[];
}

export interface TopicPool {
  topic: Topic;
  /** Kept id → other ids with the same text. */
  aliases: Map<string, string[]>;
}

/** Every card of a topic: pictured words, then phrases. */
export function topicCards(topic: Topic): GameCard[] {
  return [...topic.words, ...topic.phrases];
}

function pool(id: string, title: string, emoji: string | undefined, words: PicturedVocab[], phrases: Phrase[]): TopicPool {
  const all: GameCard[] = [...words, ...phrases];
  const byId = new Map(all.map((c) => [c.id, c]));
  const { ids, aliases } = dedupeByText(
    all.map((c) => c.id),
    (cid) => byId.get(cid)?.text,
  );
  const kept = ids.map((cid) => byId.get(cid)!);
  return {
    topic: { id, title, emoji, words: kept.filter(isWord), phrases: kept.filter((c): c is Phrase => !isWord(c)) },
    aliases,
  };
}

/** Situations with phrases or pictured words (pack order), then "Mezcla" is `getTopicPool(MIX)`. */
export function listTopics(pack: Pack): Topic[] {
  return pack.meta.situations
    .map((s) => getTopicPool(s.id, pack)?.topic)
    .filter((t): t is Topic => !!t && t.phrases.length + t.words.length > 0);
}

export function getTopicPool(id: string, pack: Pack): TopicPool | undefined {
  if (id === MIX) return pool(MIX, "Mezcla", "🎲", listVocab({ withImage: true }, pack), pack.phrases);
  const situation = getSituation(id, pack);
  if (!situation) return undefined;
  return pool(
    situation.id,
    situation.title,
    situation.emoji,
    listVocab({ situation: id, withImage: true }, pack),
    pack.phrases.filter((p) => p.situation === id),
  );
}

/** Short Spanish explanation for a card: `explanation`, else `notes`, else nothing. */
export function explain(card: GameCard): string | undefined {
  return (isWord(card) ? card.notes : card.explanation || card.notes) || undefined;
}

/** Cards not marked "La sé" first (shuffled), then the known ones; at most `size`. */
function freshFirst<T extends GameCard>(cards: T[], known: ReadonlySet<string>, rng: Rng, size: number): T[] {
  const fresh = rng.shuffle(cards.filter((c) => !known.has(c.id)));
  const old = rng.shuffle(cards.filter((c) => known.has(c.id)));
  return [...fresh, ...old].slice(0, Math.max(0, size));
}

/**
 * Discovery deck: the topic's pictured words first (up to `DECK_WORDS`, more when there are few
 * phrases), then phrases. In each part, cards not marked "La sé" come first.
 */
export function buildDeck(topic: Topic, known: ReadonlySet<string>, rng: Rng, size = DECK_SIZE): GameCard[] {
  const words = freshFirst(topic.words, known, rng, Math.max(DECK_WORDS, size - topic.phrases.length));
  const phrases = freshFirst(topic.phrases, known, rng, size - words.length);
  return [...words, ...phrases];
}

/** Question order for a round: the deck first, then the rest of the topic, shuffled. */
export function roundOrder(cards: GameCard[], deck: GameCard[], rng: Rng): GameCard[] {
  const inDeck = new Set(deck.map((c) => c.id));
  return [...rng.shuffle(deck), ...rng.shuffle(cards.filter((c) => !inDeck.has(c.id)))];
}

export interface RoundSetup {
  rng: Rng;
  /** Cards in question order (`roundOrder`). */
  order: GameCard[];
  startedAt: number;
  /** Epoch ms when time is up. */
  deadline: number;
}

/** A fresh round: random seed, question order and deadline from now. */
export function setupRound(topic: Topic, deck: GameCard[]): RoundSetup {
  const startedAt = Date.now();
  const rng = createRng(`${topic.id}:${startedAt}`);
  return { rng, order: roundOrder(topicCards(topic), deck, rng), startedAt, deadline: startedAt + ROUND_MS };
}

/**
 * listen: hear the target language, pick the Spanish meaning (text options). reverse: read the Spanish,
 * pick the target language (text options). listen-picture: hear the word, pick its picture. es-picture:
 * read the Spanish ("¿Cuál es «el café»?"), pick the picture.
 */
export type QuestionKind = "listen" | "reverse" | "listen-picture" | "es-picture";

export interface Question {
  kind: QuestionKind;
  card: GameCard;
  /**
   * 4 cards (the right one included), shuffled. Label = `es` (listen) or `text` (reverse); picture
   * kinds show `image` (all pictured words, never two with the same `image.src`).
   */
  options: GameCard[];
}

export function isPictureQuestion(kind: QuestionKind): kind is "listen-picture" | "es-picture" {
  return kind === "listen-picture" || kind === "es-picture";
}

/** Right card + distractors from each list in turn; no two share a Spanish or target-language text, or a `key`. */
function fillOptions<T extends GameCard>(right: T, lists: T[][], rng: Rng, key?: (c: T) => string): T[] {
  const seenEs = new Set([textKey(right.es)]);
  const seenIt = new Set([textKey(right.text)]);
  const seenKey = new Set(key ? [key(right)] : []);
  const options = [right];
  for (const candidates of lists) {
    for (const c of rng.shuffle(candidates)) {
      if (options.length >= OPTIONS) break;
      const es = textKey(c.es);
      const it = textKey(c.text);
      const k = key?.(c);
      if (seenEs.has(es) || seenIt.has(it) || (k !== undefined && seenKey.has(k))) continue;
      seenEs.add(es);
      seenIt.add(it);
      if (k !== undefined) seenKey.add(k);
      options.push(c);
    }
  }
  return rng.shuffle(options);
}

/**
 * A pictured word gets a picture question: options are the topic's pictured words, then the whole
 * pack's, never the same picture twice. A phrase gets listen/reverse with options from the topic's
 * phrases, then the pack's. A word falls back to listen/reverse when the pack has fewer than
 * `OPTIONS` different pictures.
 */
export function makeQuestion(card: GameCard, topic: Topic, pack: Pack, rng: Rng): Question {
  if (isWord(card)) {
    const options = fillOptions(card, [topic.words, listVocab({ withImage: true }, pack)], rng, (c) => c.image.src);
    if (options.length >= OPTIONS) return { kind: rng.next() < 0.5 ? "listen-picture" : "es-picture", card, options };
  }
  const kind: QuestionKind = rng.next() < 0.5 ? "listen" : "reverse";
  const lists: GameCard[][] = isWord(card) ? [topic.words, topic.phrases, pack.phrases] : [topic.phrases, pack.phrases];
  return { kind, card, options: fillOptions(card, lists, rng) };
}

/** Combo multiplier: x1, then x2 from 3 right in a row, x3 from 6, x4 from 9. */
export function multiplier(combo: number): number {
  return Math.min(4, 1 + Math.floor(combo / 3));
}

export function roundXp(correct: number): number {
  return XP_ROUND + correct;
}
