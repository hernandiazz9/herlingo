/**
 * Runs after `next build` (npm "postbuild"). Writes into the static export:
 *   out/manifest.webmanifest  web app manifest (src/lib/pwa/manifest.ts)
 *   out/sw-audio/<lang>.json  the audio list of each language (every file of out/audio/<lang>/),
 *                             read by the SW to fill `lang-lern-audio-<lang>` for the active language.
 *   out/sw.js                 service worker (scripts/pwa/sw.template.js) precaching every file
 *                             in out/ except audio: pages, RSC payloads, JS/CSS, icons, audio lists.
 * The SW version is a hash of every file (audio included), so any change ships a new SW (and the
 * update prompt). It never handles /api/ and keeps the generated-audio cache
 * (src/lib/audio/generated.ts) and the per-language audio caches.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { GENERATED_AUDIO_CACHE } from "../../src/lib/audio/generated";
import { AUDIO_CACHE_PREFIX, AUDIO_LIST_DIR } from "../../src/lib/pwa/audio-constants";
import { webManifest, MANIFEST_PATH } from "../../src/lib/pwa/manifest";

const ROOT = process.cwd();
const OUT = join(ROOT, "out");
const SKIP = new Set(["sw.js", ".DS_Store"]);

if (!existsSync(OUT)) {
  console.error("out/ not found: run `next build` first.");
  process.exit(1);
}

writeFileSync(join(OUT, MANIFEST_PATH.slice(1)), JSON.stringify(webManifest(), null, 2) + "\n");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return walk(path);
    return SKIP.has(e.name) ? [] : [path];
  });
}

// Audio lists: one per out/audio/<lang>/ folder. Written before hashing so they are precached.
const AUDIO_DIR = join(OUT, "audio");
const LIST_DIR = join(OUT, AUDIO_LIST_DIR.slice(1));
rmSync(LIST_DIR, { recursive: true, force: true });
const audioLangs = existsSync(AUDIO_DIR)
  ? readdirSync(AUDIO_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
  : [];
let audioBytes = 0;
let audioFiles = 0;
for (const lang of audioLangs) {
  const dir = join(AUDIO_DIR, lang);
  const names = readdirSync(dir).filter((n) => !SKIP.has(n)).sort();
  const mp3 = names.filter((n) => n !== "manifest.json");
  const bytes = names.reduce((sum, n) => sum + statSync(join(dir, n)).size, 0);
  const manifest = names.includes("manifest.json")
    ? {
        url: `/audio/${lang}/manifest.json`,
        sha256: createHash("sha256").update(readFileSync(join(dir, "manifest.json"))).digest("hex"),
      }
    : null;
  const list = { v: 1, lang, bytes, manifest, files: mp3.map((n) => `/audio/${lang}/${n}`) };
  mkdirSync(LIST_DIR, { recursive: true });
  writeFileSync(join(LIST_DIR, `${lang}.json`), JSON.stringify(list));
  audioBytes += bytes;
  audioFiles += names.length;
}

const files = walk(OUT).sort();
const hash = createHash("sha256");
let bytes = 0;
const urls = files.flatMap((file) => {
  const rel = relative(OUT, file).split(sep).join("/");
  const data = readFileSync(file);
  hash.update(rel).update("\0").update(data);
  // Audio is not precached: the SW fills one cache per language (the active one) from the lists.
  if (rel.startsWith("audio/")) return [];
  bytes += statSync(file).size;
  // Pages are requested by their directory URL (trailingSlash: true).
  if (rel === "index.html") return ["/"];
  if (rel.endsWith("/index.html")) return [`/${rel.slice(0, -"index.html".length)}`];
  return [`/${rel}`];
});
const version = hash.digest("hex").slice(0, 16);

const template = readFileSync(join(ROOT, "scripts/pwa/sw.template.js"), "utf8");
const placeholders = [
  "/* __PRECACHE__ */ []",
  "/* __KEEP__ */ []",
  '"__VERSION__"',
  '"__AUDIO_PREFIX__"',
  '"__AUDIO_LIST_DIR__"',
  "/* __AUDIO_LANGS__ */ []",
];
if (!placeholders.every((p) => template.includes(p))) {
  console.error("scripts/pwa/sw.template.js: placeholders not found.");
  process.exit(1);
}
const sw = template
  .replace('"__VERSION__"', JSON.stringify(version))
  .replace("/* __PRECACHE__ */ []", JSON.stringify(urls))
  .replace("/* __KEEP__ */ []", JSON.stringify([GENERATED_AUDIO_CACHE]))
  .replace('"__AUDIO_PREFIX__"', JSON.stringify(AUDIO_CACHE_PREFIX))
  .replace('"__AUDIO_LIST_DIR__"', JSON.stringify(AUDIO_LIST_DIR))
  .replace("/* __AUDIO_LANGS__ */ []", JSON.stringify(audioLangs));
if (urls.some((u) => u.startsWith("/audio/"))) {
  console.error("out/sw.js: the precache must not hold /audio/ URLs.");
  process.exit(1);
}
writeFileSync(join(OUT, "sw.js"), sw);

const pages = urls.filter((u) => u.endsWith("/")).length;
console.log(
  `✓ out/sw.js ${version}: ${urls.length} files precached (${pages} pages), ${(bytes / 1048576).toFixed(1)} MB; ` +
    `audio lists ${audioLangs.join(", ") || "none"} (${audioFiles} files, ${(audioBytes / 1048576).toFixed(1)} MB, cached per language); out/manifest.webmanifest`,
);
