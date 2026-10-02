/** POST /api/coach/pack/: generate a preparation pack, or refine one (docs/coach.md). */
import { randomUUID } from "node:crypto";
import { authenticate } from "../_lib/access";
import { generatePack } from "../_lib/generators";
import { CoachError, json, readBody, route } from "../_lib/http";
import { getLanguage, packVoices } from "../_lib/languages";
import { assertBudget, readUsage, recordCall, reserveGeneration, reserveRefinement } from "../_lib/ledger";
import { Pack, PackRequest } from "../_lib/schema";

export default route({
  async POST(request) {
    const caller = authenticate(request);
    const body = await readBody(request, PackRequest);
    const meta = getLanguage(body.lang);
    if (body.refine && (body.refine.packId !== body.refine.previous.id || body.refine.previous.lang !== meta.lang)) {
      throw new CoachError(400, "bad_request", "La petición no es válida (refine).");
    }
    await assertBudget();

    const refunds = [await reserveGeneration(caller)];
    let costMicro = 0;
    let tokens = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
    try {
      if (body.refine) refunds.push(await reserveRefinement(body.refine.packId, body.refine.previous.refinements));
      const generated = await generatePack(
        { meta, description: body.description, profile: body.profile, refine: body.refine },
        async (model, usage) => {
          tokens = usage;
          costMicro += await recordCall(caller, body.refine ? "refine" : "pack", model, usage);
        },
      );
      const pack = Pack.parse({
        ...generated,
        id: body.refine?.packId ?? randomUUID(),
        createdAt: new Date().toISOString(),
        lang: meta.lang,
        description: body.description,
        voices: packVoices(meta),
        dialogue: {
          title: generated.dialogue.title,
          turns: generated.dialogue.turns.map((turn, i) => ({ ...turn, id: `t${i + 1}` })),
        },
        refinements: body.refine ? body.refine.previous.refinements + 1 : 0,
      });
      const summary = await readUsage(caller);
      return json({
        pack,
        usage: {
          costUsd: costMicro / 1_000_000,
          tokens,
          remainingUsd: summary.remainingUsd,
          today: summary.today,
        },
      });
    } catch (error) {
      await Promise.all(refunds.map((refund) => refund()));
      throw error;
    }
  },
});
