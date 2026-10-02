/**
 * POST /api/coach/interview/: next level-interview question, or the final assessment.
 * The first step (empty history) takes one of today's generations; later steps are billed only.
 */
import { authenticate } from "../_lib/access";
import { generateInterviewStep } from "../_lib/generators";
import { CoachError, json, readBody, route } from "../_lib/http";
import { getLanguage } from "../_lib/languages";
import { assertBudget, readUsage, recordCall, reserveGeneration } from "../_lib/ledger";
import { InterviewRequest } from "../_lib/schema";

export default route({
  async POST(request) {
    const caller = authenticate(request);
    const body = await readBody(request, InterviewRequest);
    const meta = getLanguage(body.lang);
    await assertBudget();

    const refund = body.history.length === 0 ? await reserveGeneration(caller) : undefined;
    let costMicro = 0;
    try {
      const step = await generateInterviewStep(body, meta, async (charges) => {
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
      await refund?.();
      throw error;
    }
  },
});
