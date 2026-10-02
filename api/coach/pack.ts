/** POST /api/coach/pack/: generate a preparation pack, or refine one (docs/coach.md). */
import { randomUUID } from "node:crypto";
import { authenticate } from "../_lib/access";
import { generatePack } from "../_lib/generators";
import { CoachError, json, readBody, route } from "../_lib/http";
import { getLanguage, packVoices } from "../_lib/languages";
import {
  assertBudget,
  readUsage,
  recordCall,
  registerPack,
  reserveGeneration,
  reserveRefinement,
  type Refund,
} from "../_lib/ledger";
import { sumUsage, type Charge } from "../_lib/model";
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

    const refunds: Refund[] = [await reserveGeneration(caller)];
    let refinement = 0;
    let costMicro = 0;
    let charges: Charge[] = [];
    let charged = false;
    try {
      if (body.refine) {
        const slot = await reserveRefinement(caller, body.refine.packId);
        refunds.push(slot.refund);
        refinement = slot.count;
      }
      const generated = await generatePack(
        { meta, description: body.description, profile: body.profile, refine: body.refine },
        async (call) => {
          charged = true;
          charges = call;
          costMicro += await recordCall(caller, body.refine ? "refine" : "pack", call);
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
        refinements: refinement,
      });
      if (!body.refine) await registerPack(caller, pack.id);
      const summary = await readUsage(caller);
      return json({
        pack,
        usage: {
          costUsd: costMicro / 1_000_000,
          tokens: sumUsage(charges),
          remainingUsd: summary.remainingUsd,
          today: summary.today,
        },
      });
    } catch (error) {
      // A billed call keeps its slots: only a call that cost nothing (no response) gives them back.
      if (!charged) await Promise.all(refunds.map((refund) => refund()));
      throw error;
    }
  },
});
