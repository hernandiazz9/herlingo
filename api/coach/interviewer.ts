/**
 * POST /api/coach/interviewer/: Mi entrevista's interviewer after an answer (docs/mock-interview.md
 * "API"): one follow-up question, or move on. Owner only; the card comes from the stored deck by
 * `cardId` (the client never sends the model answer). Checks: code → owner → body → the
 * interviewer's model → deck and card → Mi entrevista's budget → its interviewer turns → Claude →
 * bill (`turn`). `followUpsLeft: 0` → the canned move-on, no Claude call, no counter.
 */
import { z } from "zod";
import { authenticate } from "../_lib/access.js";
import { interviewerModel } from "../_lib/config.js";
import { assertOwner, loadDeck } from "../_lib/deck.js";
import { cannedMoveOn, generateTurn } from "../_lib/generators.js";
import { CoachError, json, readBody, route } from "../_lib/http.js";
import { noMockCall, runMockCall } from "../_lib/ledger.js";
import { DECK_LIMITS, LIMITS, MockTone } from "../_lib/schema.js";

/** A spoken answer: what the mic or the keyboard gave, trimmed. */
const ANSWER_MAX = 3000;
/** Earlier exchanges on this question the interviewer reads. */
const HISTORY_MAX = 3;

/** What was asked: the card's question, a variant or a follow-up (every one is a spoken line). */
const asked = z.string().trim().min(1).max(LIMITS.ttsText);
const answer = z.string().trim().min(1).max(ANSWER_MAX);

const InterviewerRequest = z.object({
  cardId: z.string().min(1).max(DECK_LIMITS.id),
  tone: MockTone,
  asked,
  history: z.array(z.object({ asked, answer: z.string().trim().max(ANSWER_MAX) })).max(HISTORY_MAX),
  answer,
  /** How long the answer took; 0 = not measured. */
  seconds: z.number().min(0).max(3600),
  followUpsLeft: z.number().int().min(0).max(2),
});

export default route({
  async POST(request) {
    const caller = authenticate(request);
    assertOwner(caller);
    const body = await readBody(request, InterviewerRequest);
    const model = interviewerModel();
    const stored = await loadDeck(caller);
    if (!stored) throw new CoachError(404, "no_deck", "Todavía no hay tarjetas. Súbelas con npm run deck:push.");
    const card = stored.deck.cards.find((c) => c.id === body.cardId);
    if (!card) throw new CoachError(400, "bad_request", "Esa tarjeta ya no existe. Toca «Actualizar tarjetas».");

    if (body.followUpsLeft === 0) return json({ next: cannedMoveOn(), usage: await noMockCall(caller) });

    const { result, usage } = await runMockCall(caller, "turn", model, (onUsage) =>
      generateTurn(
        {
          learner: stored.deck.learner,
          card,
          tone: body.tone,
          asked: body.asked,
          history: body.history,
          answer: body.answer,
          seconds: body.seconds,
        },
        model,
        onUsage,
      ),
    );
    return json({ next: result, usage });
  },
});
