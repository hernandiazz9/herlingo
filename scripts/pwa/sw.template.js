/*
 * Service worker template. scripts/pwa/build.ts fills in VERSION and PRECACHE (every file of the
 * static export: pages, RSC payloads, JS/CSS, icons, audio) and writes it to out/sw.js.
 *
 * - install: downloads everything into a versioned cache. Content-addressed files (/_next/static/,
 *   hashed mp3s) are copied from the previous version's cache instead of downloaded again.
 * - A new version waits until the page asks it to take over (SKIP_WAITING, from the "Actualizar"
 *   prompt), so a running lesson never switches code mid-way.
 * - fetch: cache first (query strings ignored), network as fallback; Range requests for audio
 *   are answered from the cache with 206 (Safari/WebKit needs them to play mp3s offline).
 */
const VERSION = "__VERSION__";
const PRECACHE = /* __PRECACHE__ */ [];
const PREFIX = "lang-lern-";
const CACHE = PREFIX + VERSION;
const IMMUTABLE = /^\/(_next\/static\/|audio\/.+\/[0-9a-f]{8,}\.mp3$)/;
const BATCH = 24;

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

async function precache() {
  const cache = await caches.open(CACHE);
  const todo = [];
  for (const url of PRECACHE) {
    if (IMMUTABLE.test(url)) {
      const hit = await caches.match(url, { ignoreVary: true });
      if (hit) {
        await cache.put(url, hit);
        continue;
      }
    }
    todo.push(url);
  }
  for (let i = 0; i < todo.length; i += BATCH) {
    await Promise.all(
      todo.slice(i, i + BATCH).map(async (url) => {
        const res = await fetch(new Request(url, { cache: "reload" }));
        if (!res.ok) throw new Error(`Precache failed: ${url} (${res.status})`);
        // Safari refuses redirected responses for navigations: store a clean copy.
        await cache.put(url, res.redirected ? new Response(await res.blob(), { headers: res.headers }) : res);
      }),
    );
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(respond(req, url));
});

async function respond(req, url) {
  const cache = await caches.open(CACHE);
  let path = url.pathname;
  // Pages are cached under their trailing-slash URL (/repaso/ → repaso/index.html).
  if (req.mode === "navigate" && !path.endsWith("/") && !/\.[a-z0-9]+$/i.test(path)) path += "/";
  const hit = await cache.match(path, { ignoreVary: true });
  if (hit) return req.headers.has("range") ? partial(req, hit) : hit;
  try {
    return await fetch(req);
  } catch (err) {
    if (req.mode === "navigate") {
      const fallback = await cache.match("/404.html");
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function partial(req, res) {
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
  let start = 0;
  let end = size - 1;
  if (m && m[1]) {
    start = Number(m[1]);
    if (m[2]) end = Math.min(Number(m[2]), size - 1);
  } else if (m && m[2]) {
    start = Math.max(size - Number(m[2]), 0);
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/octet-stream",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}
