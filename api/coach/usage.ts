/**
 * GET /api/coach/usage/: this month's spend, today's generations and today's quick routes (their
 * own counter). PUT { capUsd }: owner only.
 */
import { authenticate } from "../_lib/access.js";
import { CoachError, json, readBody, route } from "../_lib/http.js";
import { readUsage, setCapUsd } from "../_lib/ledger.js";
import { CapRequest } from "../_lib/schema.js";

export default route({
  async GET(request) {
    return json(await readUsage(authenticate(request)));
  },
  async PUT(request) {
    const caller = authenticate(request);
    if (!caller.isOwner) throw new CoachError(403, "forbidden", "Solo el administrador puede cambiar el límite.");
    const { capUsd } = await readBody(request, CapRequest);
    await setCapUsd(capUsd);
    return json(await readUsage(caller));
  },
});
