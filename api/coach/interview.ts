/**
 * POST /api/coach/interview/: next level-interview question, or the final assessment.
 * Every step takes one of the code's daily interview steps (the client's `history` is not
 * trusted for that); the first step (empty history) also takes one of today's generations.
 */
import { authenticate } from "../_lib/access";
import { generateInterviewStep } from "../_lib/generators";
import { CoachError, json, readBody, route } from "../_lib/http";
import { getLanguage } from "../_lib/languages";
import { assertBudget, readUsage, recordCall, reserveGeneration, reserveInterviewStep, type Refund } from "../_lib/ledger";
import { InterviewRequest } from "../_lib/schema";

export default route({
  async POST(request) {
    const caller = authenticate(request);
    const body = await readBody(request, InterviewRequest);
    const meta = getLanguage(body.lang);
    await assertBudget();

    const refunds: Refund[] = [await reserveInterviewStep(caller)];
    let costMicro = 0;
    let charged = false;
    try {
      if (body.history.length === 0) refunds.push(await reserveGeneration(caller));
      const step = await generateInterviewStep(body, meta, async (charges) => {
        charged = true;
        costMicro += await recordCall(caller, "interview", charges);
      });
      if (step.done ? !step.assessment : !step.question) {
        throw new CoachError(502, "generation_failed", "No he podido preparar la siguiente pregunta. Inténtalo de nuevo.");
      }
      const summary = await readUsage(caller);
      const usage = { costUsd: costMicro / 1_000_000, remainingUsd: summary.remainingUsd, today: summary.today };
      return json(
        step.done
          ? { done: true, assessment: step.assessment, usage }
          : { done: false, question: step.question, turn: body.history.length + 1, usage },
      );
    } catch (error) {
      // A billed call keeps its slots: only a call that cost nothing (no response) gives them back.
      if (!charged) await Promise.all(refunds.map((refund) => refund()));
      throw error;
    }
  },
});
