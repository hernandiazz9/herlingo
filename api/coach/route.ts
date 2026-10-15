/**
 * POST /api/coach/route/: a quick route (Modo rápido, docs/coach.md). Its own daily counter
 * (`reserveRoute`), never the generations; shared monthly budget; no refinements. An answer the
 * stored shape rejects is the 502 of an invalid answer (`storedShape`), billed like any answer.
 */
import { randomUUID } from "node:crypto";
import { authenticate } from "../_lib/access.js";
import { storedShape } from "../_lib/claude.js";
import { generateRoute } from "../_lib/generators.js";
import { json, readBody, route } from "../_lib/http.js";
import { getLanguage, packVoices } from "../_lib/languages.js";
import { assertBudget, readUsage, recordCall, reserveRoute } from "../_lib/ledger.js";
import { sumUsage, type Charge } from "../_lib/model.js";
import { Route, RouteRequest } from "../_lib/schema.js";

export default route({
  async POST(request) {
    const caller = authenticate(request);
    const body = await readBody(request, RouteRequest);
    const meta = getLanguage(body.lang);
    await assertBudget();

    const refund = await reserveRoute(caller);
    let costMicro = 0;
    let charges: Charge[] = [];
    let charged = false;
    try {
      const generated = await generateRoute(
        { meta, description: body.description, profile: body.profile },
        async (call) => {
          charged = true;
          charges = call;
          costMicro += await recordCall(caller, "route", call);
        },
      );
      const quick = storedShape(
        Route,
        {
          ...generated,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          lang: meta.lang,
          description: body.description,
          voices: packVoices(meta),
          turns: generated.turns.map((turn, i) => ({ ...turn, id: `r${i + 1}` })),
        },
        "route",
      );
      const summary = await readUsage(caller);
      return json({
        route: quick,
        usage: {
          costUsd: costMicro / 1_000_000,
          tokens: sumUsage(charges),
          remainingUsd: summary.remainingUsd,
          today: summary.routesToday,
        },
      });
    } catch (error) {
      // A billed call keeps its slot: only a call that cost nothing (no response) gives it back.
      if (!charged) await refund();
      throw error;
    }
  },
});
