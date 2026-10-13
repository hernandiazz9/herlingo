/**
 * POST /api/coach/episode/: a Modo deporte episode (docs/sport.md). Its own daily counter
 * (`reserveEpisode`), never the generations or the routes; shared monthly budget; no refinements.
 * Checks, billing, refunds and 502s exactly as `/api/coach/route/`.
 */
import { randomUUID } from "node:crypto";
import { authenticate } from "../_lib/access.js";
import { generateEpisode } from "../_lib/generators.js";
import { json, readBody, route } from "../_lib/http.js";
import { getLanguage, packVoices } from "../_lib/languages.js";
import { assertBudget, readUsage, recordCall, reserveEpisode } from "../_lib/ledger.js";
import { sumUsage, type Charge } from "../_lib/model.js";
import { Episode, EpisodeRequest } from "../_lib/schema.js";

export default route({
  async POST(request) {
    const caller = authenticate(request);
    const body = await readBody(request, EpisodeRequest);
    const meta = getLanguage(body.lang);
    await assertBudget();

    const refund = await reserveEpisode(caller);
    let costMicro = 0;
    let charges: Charge[] = [];
    let charged = false;
    try {
      const generated = await generateEpisode(
        { meta, description: body.description, profile: body.profile },
        async (call) => {
          charged = true;
          charges = call;
          costMicro += await recordCall(caller, "episode", call);
        },
      );
      const episode = Episode.parse({
        ...generated,
        id: randomUUID(),
        source: "ai",
        createdAt: new Date().toISOString(),
        lang: meta.lang,
        description: body.description,
        voices: packVoices(meta),
      });
      const summary = await readUsage(caller);
      return json({
        episode,
        usage: {
          costUsd: costMicro / 1_000_000,
          tokens: sumUsage(charges),
          remainingUsd: summary.remainingUsd,
          today: summary.episodesToday,
        },
      });
    } catch (error) {
      // A billed call keeps its slot: only a call that cost nothing (no response) gives it back.
      if (!charged) await refund();
      throw error;
    }
  },
});
