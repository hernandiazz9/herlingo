/**
 * GET /api/coach/usage/: this month's spend, today's generations, today's quick routes and today's
 * AI episodes (their own counters), plus Mi entrevista's own budget and counters for the owner
 * (`mock`). PUT { capUsd?, mockCapUsd? }: owner only.
 */
import { z } from "zod";
import { authenticate } from "../_lib/access.js";
import { CoachError, json, readBody, route } from "../_lib/http.js";
import { readUsage, setCapUsd, setMockCapUsd } from "../_lib/ledger.js";
import { CapRequest } from "../_lib/schema.js";

/** Prepárate's cap (`capUsd`) and/or Mi entrevista's (`mockCapUsd`), same range; at least one. */
const CapsRequest = z
  .object({ capUsd: CapRequest.shape.capUsd.optional(), mockCapUsd: CapRequest.shape.capUsd.optional() })
  .refine((body) => body.capUsd !== undefined || body.mockCapUsd !== undefined, { path: ["capUsd"] });

export default route({
  async GET(request) {
    return json(await readUsage(authenticate(request)));
  },
  async PUT(request) {
    const caller = authenticate(request);
    if (!caller.isOwner) throw new CoachError(403, "forbidden", "Solo el administrador puede cambiar el límite.");
    const { capUsd, mockCapUsd } = await readBody(request, CapsRequest);
    if (capUsd !== undefined) await setCapUsd(capUsd);
    if (mockCapUsd !== undefined) await setMockCapUsd(mockCapUsd);
    return json(await readUsage(caller));
  },
});
