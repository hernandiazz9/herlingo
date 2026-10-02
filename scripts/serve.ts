/**
 * `npm start`: serves the static export (out/) like a static host would, on every network
 * interface so a phone on the same wifi can open it. Supports Range requests (Safari audio).
 *   PORT=4000 npm start
 */
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { serveStatic } from "./lib/static";

const OUT = join(process.cwd(), "out");
const PORT = Number(process.env.PORT ?? 4173);

if (!existsSync(OUT)) {
  console.error("out/ not found: run `npm run build` first.");
  process.exit(1);
}

createServer((req, res) => serveStatic(OUT, req, res)).listen(PORT, "0.0.0.0", () => {
  console.log(`Serving out/ at http://localhost:${PORT}`);
  for (const nets of Object.values(networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === "IPv4" && !net.internal) console.log(`  on your wifi: http://${net.address}:${PORT}`);
    }
  }
});
