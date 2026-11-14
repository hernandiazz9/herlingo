/**
 * The deck on the device (`lang-lern:mock-interview:deck`): downloaded with `fetchDeck` when the
 * screen opens online and kept for offline use; a failed download never touches it.
 */
import { parseStoredDeck } from "./parse";
import { MOCK_KEYS, readRaw, writeStored } from "./store";
import type { DeckCard, InterviewDeck, StoredDeck } from "./types";

export const readDeckRaw = (): string => readRaw(MOCK_KEYS.deck);

/** The stored deck, or null (none yet, or unreadable). */
export function getStoredDeck(): StoredDeck | null {
  if (typeof window === "undefined") return null;
  return parseStoredDeck(readDeckRaw());
}

/** Replaces the stored deck. False when storage failed (the old one stays). */
export function storeDeck(stored: StoredDeck): boolean {
  return writeStored(MOCK_KEYS.deck, { deck: stored.deck, updatedAt: stored.updatedAt, fetchedAt: stored.fetchedAt });
}

export function getCard(deck: InterviewDeck, cardId: string): DeckCard | undefined {
  return deck.cards.find((c) => c.id === cardId);
}

/** The cards of a block, in deck order. */
export function blockCards(deck: InterviewDeck, blockId: string): DeckCard[] {
  return deck.cards.filter((c) => c.block === blockId);
}

/** Every way the card can be asked: its question, then its variants. */
export function cardQuestions(card: DeckCard): string[] {
  return [card.question, ...card.variants];
}

/** The line to ask after `answers` answers to the card (`CardStats.answers`): the card rotates its question and variants. */
export function questionToAsk(card: DeckCard, answers: number): string {
  const lines = cardQuestions(card);
  const n = Number.isFinite(answers) && answers > 0 ? Math.floor(answers) : 0;
  return lines[n % lines.length];
}
