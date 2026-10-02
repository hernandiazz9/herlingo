/**
 * Local Prepárate server: the app plus working `/api/*` functions on one origin.
 *
 *   npm run dev:coach      next dev (live reload) behind http://localhost:3000
 *   npm run start:coach    the built static export (out/, with the service worker) on :4173
 *
 * `/api/<path>` runs `api/<path>.ts` (the same Web-standard handler Vercel deploys); everything
 * else goes to `next dev` (proxied, HMR websocket included) or to out/. Reads `.env.local`. Fake
 * mode when `COACH_FAKE=1` or `ANTHROPIC_API_KEY` is missing; dev access codes when
 * `COACH_ACCESS_CODES` is missing, in fake mode only (with a real key it refuses to start, so a
 * known code can never spend real money). Listens on 127.0.0.1 only; `COACH_LAN=1` opens it to
 * the local network (to try it on the phone).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { connect } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { serveStatic } from "../lib/static";

const ROOT = process.cwd();
const STATIC = process.argv.includes("--out");
const PORT = Number(process.env.PORT ?? (STATIC ? 4173 : 3000));
const NEXT_PORT = Number(process.env.NEXT_PORT ?? PORT + 1);
const LAN = process.env.COACH_LAN === "1";
const HOST = LAN ? "0.0.0.0" : "127.0.0.1";

if (existsSync(join(ROOT, ".env.local"))) process.loadEnvFile(join(ROOT, ".env.local"));
process.env.COACH_DEV = "1";
/** Same rule as `isFake()` in api/_lib/config.ts (COACH_DEV is set). */
const FAKE = process.env.COACH_FAKE === "1" || !process.env.ANTHROPIC_API_KEY;
const DEV_CODES = "hernan:dev-owner,invitado:dev-guest";
if (!process.env.COACH_ACCESS_CODES) {
  if (!FAKE) {
    console.error(
      "ANTHROPIC_API_KEY is set but COACH_ACCESS_CODES is not: the dev codes only work in fake mode.\n" +
        "Add COACH_ACCESS_CODES (and COACH_OWNER) to .env.local, or set COACH_FAKE=1.",
    );
    process.exit(1);
  }
  process.env.COACH_ACCESS_CODES = DEV_CODES;
  process.env.COACH_OWNER = "hernan";
}

type FetchHandler = (request: Request) => Promise<Response>;
interface FunctionModule {
  default?: { fetch?: FetchHandler; default?: { fetch?: FetchHandler } };
}

async function loadFunction(pathname: string): Promise<FetchHandler | undefined> {
  const segments = pathname.replace(/^\/api\//, "").replace(/\/$/, "").split("/");
  if (!segments.every((s) => /^[a-z0-9][a-z0-9-]*$/.test(s))) return undefined;
  const file = join(ROOT, "api", ...segments) + ".ts";
  if (!existsSync(file)) return undefined;
  const mod = (await import(pathToFileURL(file).href)) as FunctionModule;
  return mod.default?.fetch ?? mod.default?.default?.fetch;
}

async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const handler = await loadFunction(url.pathname);
  if (!handler) {
    res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { code: "not_found" } }));
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const response = await handler(
    new Request(url, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined }),
  );
  const body = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, { ...Object.fromEntries(response.headers), "Content-Length": body.length });
  res.end(body);
  console.log(`${req.method} ${url.pathname} → ${response.status}`);
}

function proxyToNext(req: IncomingMessage, res: ServerResponse): void {
  const upstream = httpRequest(
    { host: "127.0.0.1", port: NEXT_PORT, method: req.method, path: req.url, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("next dev is not ready yet; reload in a moment.");
  });
  req.pipe(upstream);
}

if (STATIC && !existsSync(join(ROOT, "out"))) {
  console.error("out/ not found: run `npm run build` first.");
  process.exit(1);
}

if (!STATIC) {
  spawnSync("npm", ["run", "content:build"], { stdio: "inherit" });
  const next = spawn(join(ROOT, "node_modules/.bin/next"), ["dev", "-p", String(NEXT_PORT), "-H", "127.0.0.1"], { stdio: "inherit" });
  const stop = () => next.kill("SIGTERM");
  process.on("SIGINT", () => (stop(), process.exit(0)));
  process.on("SIGTERM", () => (stop(), process.exit(0)));
  next.on("exit", (code) => process.exit(code ?? 0));
}

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://x").pathname;
  if (pathname.startsWith("/api/")) {
    handleApi(req, res).catch((error: unknown) => {
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  } else if (STATIC) {
    serveStatic(join(ROOT, "out"), req, res);
  } else {
    proxyToNext(req, res);
  }
});

// HMR websocket of next dev.
server.on("upgrade", (req, socket, head) => {
  if (STATIC) return void socket.destroy();
  const upstream = connect(NEXT_PORT, "127.0.0.1", () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(lines.join("\r\n") + "\r\n\r\n");
    upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PORT, HOST, () => {
  const mode = FAKE ? "fake" : "real Claude";
  console.log(`Prepárate dev server at http://localhost:${PORT} (${STATIC ? "out/" : "next dev"}, /api in ${mode} mode)`);
  console.log(LAN ? "  also on the local network (COACH_LAN=1)" : "  this computer only (COACH_LAN=1 opens it to the LAN)");
  if (process.env.COACH_ACCESS_CODES === DEV_CODES) {
    console.log("  dev access codes: dev-owner (owner), dev-guest");
  }
});
