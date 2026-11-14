/**
 * GET /api/coach/deck/ → { deck, updatedAt } (none uploaded → 404 `no_deck`). PUT, body =
 * `InterviewDeck` (≤ 512 KB) → { updatedAt, blocks, cards }. Mi entrevista's private deck
 * (docs/mock-interview.md "API"): owner only, checked after the code and before the body; no Claude
 * call, no counter. `npm run deck:push` is the only writer.
 */
import { authenticate } from "../_lib/access.js";
import { assertOwner, loadDeck, readDeckBody, saveDeck } from "../_lib/deck.js";
import { CoachError, json, route } from "../_lib/http.js";

export default route({
  async GET(request) {
    const caller = authenticate(request);
    assertOwner(caller);
    const stored = await loadDeck(caller);
    if (!stored) throw new CoachError(404, "no_deck", "Todavía no hay tarjetas. Súbelas con npm run deck:push.");
    return json({ deck: stored.deck, updatedAt: stored.updatedAt });
  },
  async PUT(request) {
    const caller = authenticate(request);
    assertOwner(caller);
    const deck = await readDeckBody(request);
    const updatedAt = await saveDeck(caller, deck);
    return json({ updatedAt, blocks: deck.blocks.length, cards: deck.cards.length });
  },
});
