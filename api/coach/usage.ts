/** GET /api/coach/usage/: this month's spend and today's generations. PUT { capUsd }: owner only. */
import { authenticate } from "../_lib/access";
import { CoachError, json, readBody, route } from "../_lib/http";
import { readUsage, setCapUsd } from "../_lib/ledger";
import { CapRequest } from "../_lib/schema";

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
