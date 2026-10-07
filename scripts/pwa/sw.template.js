/*
 * Service worker template. scripts/pwa/build.ts fills in VERSION, PRECACHE (every file of the
 * static export except audio: pages, RSC payloads, JS/CSS, icons, audio lists), KEEP and the
 * audio names, and writes it to out/sw.js.
 *
 * - install: downloads everything into a versioned cache. Content-addressed files (/_next/static/)
 *   are copied from the previous version's cache instead of downloaded again. Then every listed
 *   audio file an older cache already holds (a precache from before per-language audio) is copied
 *   into its language's audio cache, so this update never downloads that audio again.
 * - Audio: one cache per language, AUDIO_PREFIX + lang (no version: mp3 names are content
 *   hashes), filled for the active language only. The page posts { type: AUDIO_SET_LANG, lang }
 *   at start and on every switch (src/lib/pwa/audio-cache.ts); the SW fills that cache from the
 *   build's list (AUDIO_LIST_DIR + lang + ".json"): files no longer listed are removed, missing
 *   ones are copied from any older cache that holds them, else downloaded. Once it is complete,
 *   the other languages' audio caches are deleted (only for a language with audio files: one
 *   without any, e.g. not recorded yet, keeps the others' caches). Progress goes to every page as
 *   { type: AUDIO_PROGRESS, lang, total, cached, state }.
 * - A new version waits until the page asks it to take over (SKIP_WAITING, from the "Actualizar"
 *   prompt), so a running lesson never switches code mid-way.
 * - fetch: cache first (query strings ignored), network as fallback; Range requests for audio
 *   are answered from the cache with 206 (Safari/WebKit needs them to play mp3s offline).
 * - /api/ (Prepárate backend) is never handled: those requests go straight to the network.
 * - KEEP: caches the page owns (generated coach audio) survive every update, and so do the audio
 *   caches. The SW never touches localStorage.
 */
const VERSION = "__VERSION__";
const PRECACHE = /* __PRECACHE__ */ [];
const KEEP = /* __KEEP__ */ [];
const AUDIO_PREFIX = "__AUDIO_PREFIX__";
const AUDIO_LIST_DIR = "__AUDIO_LIST_DIR__";
const AUDIO_LANGS = /* __AUDIO_LANGS__ */ [];
const AUDIO_SET_LANG = "AUDIO_SET_LANG";
const AUDIO_PROGRESS = "AUDIO_PROGRESS";
const PREFIX = "lang-lern-";
const CACHE = PREFIX + VERSION;
const IMMUTABLE = /^\/(_next\/static\/|audio\/.+\/[0-9a-f]{8,}\.mp3$)/;
const BATCH = 24;

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(adoptAudio));
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
        await cache.put(url, await clean(res));
      }),
    );
  }
}

/** Safari refuses redirected responses for navigations: store a clean copy. */
function clean(res) {
  return res.redirected ? res.blob().then((b) => new Response(b, { headers: res.headers })) : res;
}

// ---- Audio: one cache per language -------------------------------------------------------------

const isAudioCache = (name) => name.startsWith(AUDIO_PREFIX);

/** This build's audio list for `lang`: { v, lang, bytes, manifest: { url, sha256 } | null, files }. */
async function audioList(lang) {
  if (!AUDIO_LANGS.includes(lang)) return null;
  const url = AUDIO_LIST_DIR + lang + ".json";
  const res = (await caches.match(url, { cacheName: CACHE })) || (await fetch(url).catch(() => null));
  if (!res || !res.ok) return null;
  try {
    const list = await res.json();
    return list && Array.isArray(list.files) ? list : null;
  } catch {
    return null;
  }
}

/** Manifest first: with it the page knows which mp3s exist (missing ones fall back to speech). */
const listed = (list) => (list.manifest ? [list.manifest.url] : []).concat(list.files);

async function sha256(res) {
  const digest = await crypto.subtle.digest("SHA-256", await res.clone().arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function cachedPaths(cache) {
  return new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
}

/** /audio/ paths held by this SW's other caches (older precaches; not audio caches, not KEEP) → cache name. */
async function audioElsewhere() {
  const found = new Map();
  for (const name of await caches.keys()) {
    if (!name.startsWith(PREFIX) || isAudioCache(name) || KEEP.includes(name)) continue;
    for (const req of await (await caches.open(name)).keys()) {
      const path = new URL(req.url).pathname;
      if (path.startsWith("/audio/") && !found.has(path)) found.set(path, name);
    }
  }
  return found;
}

/** Copies one listed file from an older cache into `cache`; false when none holds a valid copy. */
async function adoptOne(cache, list, path, elsewhere) {
  const name = elsewhere.get(path);
  if (!name) return false;
  const res = await caches.match(path, { cacheName: name, ignoreVary: true });
  if (!res || !res.ok) return false;
  // The manifest keeps its name across builds: reuse it only when it is this build's.
  if (list.manifest && path === list.manifest.url && (await sha256(res)) !== list.manifest.sha256) return false;
  await cache.put(path, res);
  return true;
}

/** install: for every language, copies the listed audio files older caches already hold. No network. */
async function adoptAudio() {
  const elsewhere = await audioElsewhere();
  if (!elsewhere.size) return;
  for (const lang of AUDIO_LANGS) {
    const list = await audioList(lang);
    if (!list) continue;
    const found = listed(list).filter((p) => elsewhere.has(p));
    if (!found.length) continue;
    const cache = await caches.open(AUDIO_PREFIX + lang);
    const have = await cachedPaths(cache);
    for (const path of found) {
      if (!have.has(path) || (list.manifest && path === list.manifest.url)) await adoptOne(cache, list, path, elsewhere);
    }
  }
}

let activeLang = null;
const progress = new Map();
const jobs = new Map();

async function report(p) {
  progress.set(p.lang, p);
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage({ type: AUDIO_PROGRESS, ...p });
}

/** Makes `lang` the language whose audio is kept offline; starts (or joins) its fill. */
function setAudioLang(lang) {
  activeLang = lang;
  if (!jobs.has(lang)) jobs.set(lang, fillAudio(lang).finally(() => jobs.delete(lang)));
  else if (progress.has(lang)) report(progress.get(lang));
  return jobs.get(lang);
}

async function fillAudio(lang) {
  const list = await audioList(lang);
  const want = list ? listed(list) : [];
  if (!want.length) {
    // No audio for this language (speech only, or not recorded yet): nothing to download. The
    // other languages' audio caches stay: they only go once a language with audio is complete.
    await report({ lang, total: 0, cached: 0, state: "ready" });
    return;
  }
  const cache = await caches.open(AUDIO_PREFIX + lang);
  const wanted = new Set(want);
  const have = await cachedPaths(cache);
  // Files no longer listed (content changed) leave the cache.
  for (const path of have) {
    if (!wanted.has(path)) {
      await cache.delete(path);
      have.delete(path);
    }
  }
  // A stored manifest from another build is replaced.
  if (list.manifest && have.has(list.manifest.url)) {
    const res = await cache.match(list.manifest.url);
    if (!res || (await sha256(res)) !== list.manifest.sha256) have.delete(list.manifest.url);
  }
  const total = want.length;
  let cached = want.filter((p) => have.has(p)).length;
  const todo = want.filter((p) => !have.has(p));

  if (todo.length) {
    await report({ lang, total, cached, state: "downloading" });
    const elsewhere = await audioElsewhere();
    for (let i = 0; i < todo.length; i += BATCH) {
      // Switched to another language meanwhile: stop (what is cached stays for a later fill).
      if (activeLang !== lang) return;
      const results = await Promise.all(todo.slice(i, i + BATCH).map((path) => fetchAudio(cache, list, path, elsewhere)));
      const ok = results.filter(Boolean).length;
      cached += ok;
      // A whole batch failed (offline, server gone): stop; the next start or switch resumes.
      if (!ok) break;
      await report({ lang, total, cached, state: "downloading" });
    }
    if (cached < total) {
      await report({ lang, total, cached, state: "error" });
      return;
    }
  }
  await report({ lang, total, cached, state: "ready" });
  if (activeLang === lang) await dropOtherAudio(lang);
}

/** One missing file: from an older cache, else the network. */
async function fetchAudio(cache, list, path, elsewhere) {
  try {
    if (await adoptOne(cache, list, path, elsewhere)) return true;
    const res = await fetch(new Request(path, { cache: "reload" }));
    if (!res.ok) return false;
    if (list.manifest && path === list.manifest.url && (await sha256(res)) !== list.manifest.sha256) return false;
    await cache.put(path, await clean(res));
    return true;
  } catch {
    return false;
  }
}

/** After `lang` is complete, the other languages' audio caches go (never any other cache). */
async function dropOtherAudio(lang) {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => isAudioCache(k) && k !== AUDIO_PREFIX + lang).map((k) => caches.delete(k)));
}

// ---- Messages, activation, fetch --------------------------------------------------------------

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === AUDIO_SET_LANG && typeof data.lang === "string") event.waitUntil(setAudioLang(data.lang));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Only older versions of the precache go: audio caches and KEEP stay.
      const stale = keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE && !KEEP.includes(k) && !isAudioCache(k));
      await Promise.all(stale.map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(respond(req, url));
});

async function respond(req, url) {
  let path = url.pathname;
  // Pages are cached under their trailing-slash URL (/repaso/ → repaso/index.html).
  if (req.mode === "navigate" && !path.endsWith("/") && !/\.[a-z0-9]+$/i.test(path)) path += "/";
  // Audio lives in its language's cache (/audio/<lang>/…), everything else in the precache.
  const audio = /^\/audio\/([^/]+)\//.exec(path);
  const cacheName = audio ? AUDIO_PREFIX + audio[1] : CACHE;
  let hit = await caches.match(path, { cacheName, ignoreVary: true });
  // Ids with dots (/leccion/surv.l.cortesia) look like files: retry as a page.
  if (!hit && req.mode === "navigate" && !path.endsWith("/")) {
    hit = await caches.match(path + "/", { cacheName, ignoreVary: true });
  }
  if (hit) return req.headers.has("range") ? partial(req, hit) : hit;
  try {
    return await fetch(req);
  } catch (err) {
    if (req.mode === "navigate") {
      const fallback = await caches.match("/404.html", { cacheName: CACHE });
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
