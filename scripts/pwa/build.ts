/**
 * Runs after `next build` (npm "postbuild"). Writes into the static export:
 *   out/manifest.webmanifest  web app manifest (src/lib/pwa/manifest.ts)
 *   out/sw.js                 service worker (scripts/pwa/sw.template.js) precaching every file
 *                             in out/: pages, RSC payloads, JS/CSS, icons and all audio.
 * The SW version is a hash of every file, so any change ships a new SW (and the update prompt).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
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

const files = walk(OUT).sort();
const hash = createHash("sha256");
let bytes = 0;
const urls = files.map((file) => {
  const rel = relative(OUT, file).split(sep).join("/");
  const data = readFileSync(file);
  bytes += statSync(file).size;
  hash.update(rel).update("\0").update(data);
  // Pages are requested by their directory URL (trailingSlash: true).
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel}`;
});
const version = hash.digest("hex").slice(0, 16);

const template = readFileSync(join(ROOT, "scripts/pwa/sw.template.js"), "utf8");
if (!template.includes("/* __PRECACHE__ */ []") || !template.includes('"__VERSION__"')) {
  console.error("scripts/pwa/sw.template.js: placeholders not found.");
  process.exit(1);
}
const sw = template
  .replace('"__VERSION__"', JSON.stringify(version))
  .replace("/* __PRECACHE__ */ []", JSON.stringify(urls));
writeFileSync(join(OUT, "sw.js"), sw);

const pages = urls.filter((u) => u.endsWith("/")).length;
const audio = urls.filter((u) => u.startsWith("/audio/")).length;
console.log(
  `✓ out/sw.js ${version}: ${urls.length} files precached (${pages} pages, ${audio} audio), ${(bytes / 1048576).toFixed(1)} MB; out/manifest.webmanifest`,
);
