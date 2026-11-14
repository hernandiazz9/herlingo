/**
 * Mi entrevista's private deck (docs/mock-interview.md "Deck"): one JSON string per owner in the
 * store, `langlern:coach:mock:deck:<name>` = `{ updatedAt, deck }`, uploaded by `npm run deck:push`.
 * The deck is personal: never logged (paths and counts only). Fake mode starts with the invented
 * deck of fake.ts.
 */
import { z } from "zod";
import type { Caller } from "./access.js";
import { isFake } from "./config.js";
import { fakeDeck } from "./fake.js";
import { CoachError, readBody } from "./http.js";
import { DECK_LIMITS, InterviewDeck } from "./schema.js";
import { getStore } from "./store.js";

const deckKey = (name: string) => `langlern:coach:mock:deck:${name}`;

const StoredDeck = z.object({ updatedAt: z.string().min(1), deck: InterviewDeck });
export type StoredDeck = z.infer<typeof StoredDeck>;

/** Every Mi entrevista endpoint is owner only: checked right after the access code. */
export function assertOwner(caller: Caller): void {
  if (!caller.isOwner) throw new CoachError(403, "forbidden", "Mi entrevista es solo para la cuenta del dueño.");
}

/** The caller's stored deck, or null when none was uploaded (or the stored one no longer parses). */
export async function loadDeck(caller: Caller): Promise<StoredDeck | null> {
  const store = getStore();
  const key = deckKey(caller.name);
  let text = await store.getText(key);
  if (text === null && isFake()) {
    text = JSON.stringify({ updatedAt: new Date().toISOString(), deck: fakeDeck() } satisfies StoredDeck);
    await store.setText(key, text);
  }
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    console.error("[coach] stored deck is not JSON", text.length);
    return null;
  }
  const parsed = StoredDeck.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    console.error("[coach] stored deck does not match the schema", issue?.path.join("."), issue?.message);
    return null;
  }
  return parsed.data;
}

/** Replaces the caller's deck; returns its `updatedAt`. */
export async function saveDeck(caller: Caller, deck: InterviewDeck): Promise<string> {
  const updatedAt = new Date().toISOString();
  await getStore().setText(deckKey(caller.name), JSON.stringify({ updatedAt, deck } satisfies StoredDeck));
  return updatedAt;
}

function tooBig(): CoachError {
  return new CoachError(400, "bad_request", `Las tarjetas ocupan demasiado (máximo ${DECK_LIMITS.bytes / 1024} KB).`);
}

/** The `PUT` body: at most `DECK_LIMITS.bytes`, then the same JSON + zod check as every endpoint. */
export async function readDeckBody(request: Request): Promise<InterviewDeck> {
  if (Number(request.headers.get("content-length")) > DECK_LIMITS.bytes) throw tooBig();
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > DECK_LIMITS.bytes) throw tooBig();
  return readBody(new Request(request.url, { method: "PUT", body: bytes }), InterviewDeck);
}
