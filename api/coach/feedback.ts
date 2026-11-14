/**
 * POST /api/coach/feedback/: Mi entrevista's corrector (docs/mock-interview.md "API"). `kind:
 * "answer"` → one answer's feedback; `kind: "report"` → the simulacro's report from its answers'
 * corrections. Owner only; each card comes from the stored deck by `cardId` (the client never sends
 * the model answer). Checks: code → owner → body → the corrector's model → deck and cards → Mi
 * entrevista's budget → its daily answers (an answer or a report takes one) → Claude → bill
 * (`answer` | `report`).
 */
import { z } from "zod";
import { authenticate } from "../_lib/access.js";
import { feedbackModel } from "../_lib/config.js";
import { assertOwner, loadDeck } from "../_lib/deck.js";
import { generateFeedback, generateReport } from "../_lib/generators.js";
import { CoachError, json, readBody, route } from "../_lib/http.js";
import { runMockCall } from "../_lib/ledger.js";
import { AnswerFeedback, DECK_LIMITS, LIMITS, MOCK_LIMITS, MockTone, type DeckCard } from "../_lib/schema.js";

/** A spoken answer: what the mic or the keyboard gave, trimmed. */
const ANSWER_MAX = 3000;
/** Answers in one simulacro report (5–8 questions, up to 2 follow-ups each). */
const REPORT_ANSWERS_MAX = 24;
/** Mistakes per answer the report reads (the most important first). */
const REPORT_MISTAKES_MAX = 3;

const cardId = z.string().min(1).max(DECK_LIMITS.id);
/** What was asked: the card's question, a variant or a follow-up (every one is a spoken line). */
const asked = z.string().trim().min(1).max(LIMITS.ttsText);

const AnswerRequest = z.object({
  kind: z.literal("answer"),
  cardId,
  asked,
  isFollowUp: z.boolean(),
  answer: z.string().trim().min(1).max(ANSWER_MAX),
  /** How long the answer took; 0 = not measured. */
  seconds: z.number().min(0).max(3600),
  /** «Me he bloqueado»: the anchors were shown while answering. */
  stuck: z.boolean(),
});

/** One corrected answer as the report reads it: what its feedback said, never the transcript. */
const ReportAnswer = z.object({
  cardId,
  asked,
  score: AnswerFeedback.shape.score,
  summary: AnswerFeedback.shape.summary,
  /** The `claim`s of that answer's `invented`. */
  invented: z.array(z.string().min(1).max(300)).max(MOCK_LIMITS.invented),
  mistakes: z.array(AnswerFeedback.shape.mistakes.element).max(REPORT_MISTAKES_MAX),
});

const ReportRequest = z.object({
  kind: z.literal("report"),
  tone: MockTone,
  answers: z.array(ReportAnswer).min(1).max(REPORT_ANSWERS_MAX),
});

const FeedbackRequest = z.discriminatedUnion("kind", [AnswerRequest, ReportRequest]);

export default route({
  async POST(request) {
    const caller = authenticate(request);
    assertOwner(caller);
    const body = await readBody(request, FeedbackRequest);
    const model = feedbackModel();
    const stored = await loadDeck(caller);
    if (!stored) throw new CoachError(404, "no_deck", "Todavía no hay tarjetas. Súbelas con npm run deck:push.");
    const cards = new Map(stored.deck.cards.map((card) => [card.id, card]));
    const cardOf = (id: string): DeckCard => {
      const card = cards.get(id);
      if (!card) throw new CoachError(400, "bad_request", "Esa tarjeta ya no existe. Toca «Actualizar tarjetas».");
      return card;
    };
    const learner = stored.deck.learner;

    if (body.kind === "answer") {
      const card = cardOf(body.cardId);
      const { result, usage } = await runMockCall(caller, "answer", model, (onUsage) =>
        generateFeedback(
          {
            learner,
            card,
            asked: body.asked,
            isFollowUp: body.isFollowUp,
            answer: body.answer,
            seconds: body.seconds,
            stuck: body.stuck,
          },
          model,
          onUsage,
        ),
      );
      return json({ feedback: result, usage });
    }

    const answers = body.answers.map(({ cardId, ...answer }) => ({ ...answer, card: cardOf(cardId) }));
    const { result, usage } = await runMockCall(caller, "report", model, (onUsage) =>
      generateReport({ learner, tone: body.tone, answers }, model, onUsage),
    );
    return json({ report: result, usage });
  },
});
