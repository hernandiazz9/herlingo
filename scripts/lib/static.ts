/**
 * Serves a static export directory like a static host would: `/route/` → index.html, 404.html,
 * Range requests (Safari audio). Used by `npm start` (scripts/serve.ts) and `npm run start:coach`.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
};

export function serveStatic(root: string, req: IncomingMessage, res: ServerResponse): void {
  const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  let file = normalize(join(root, pathname));
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith("/")) return void res.writeHead(308, { Location: `${pathname}/` }).end();
    file = join(file, "index.html");
  }
  let status = 200;
  if (!existsSync(file)) {
    status = 404;
    file = join(root, "404.html");
  }
  const size = statSync(file).size;
  const headers: Record<string, string | number> = {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (range && status === 200) {
    const start = range[1] ? Number(range[1]) : Math.max(size - Number(range[2]), 0);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return void res.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    return void createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(status, { ...headers, "Content-Length": size });
  if (req.method === "HEAD") return void res.end();
  createReadStream(file).pipe(res);
}
