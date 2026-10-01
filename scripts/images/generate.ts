/**
 * `npm run images`: writes every picture the content references to public/images/ (see plan.ts).
 *
 *   fluent:<icon>  → public/images/fluent/<icon>.svg  (from @iconify-json/fluent-emoji-flat)
 *   custom:<slug>  → public/images/custom/<slug>.svg  (minified assets/images/custom/<slug>.svg;
 *                    skipped with a warning while the drawing does not exist yet)
 *
 * Idempotent: unchanged files are not rewritten; files nothing references are deleted. Mostly
 * near-black pictures (rendered with resvg, see `isMostlyDark`) get `data-backdrop="dark"`, unless
 * assets/images/backdrop.json overrides it. Then refreshes the content bundle so `image` shows up
 * in the app. Commit public/images/ afterwards.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { imageFile } from "../../src/lib/content/keys";
import type { Pack } from "../../src/lib/content/types";
import { isMostlyDark } from "./dark";
import { PUBLIC_IMAGES, readBackdropOverrides, referencedImages, sourceSvg, withDarkMarker } from "./plan";

const ROOT = process.cwd();

// Validate content and refresh the bundle, then read it.
execFileSync("npm", ["run", "--silent", "content:build"], { stdio: "inherit" });
const bundlePath = join(ROOT, "src/lib/content/generated/packs.json");
const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as { packs: Record<string, Pack> };

const overrides = readBackdropOverrides(ROOT);
const keys = new Map<string, string[]>();
for (const pack of Object.values(bundle.packs)) {
  for (const [key, usedBy] of referencedImages(pack)) keys.set(key, [...(keys.get(key) ?? []), ...usedBy]);
}

const keep = new Set<string>();
let written = 0;
let unchanged = 0;
const skipped: string[] = [];
const darkKeys: string[] = [];
for (const [key, usedBy] of [...keys].sort(([a], [b]) => a.localeCompare(b))) {
  const file = imageFile(key);
  const svg = sourceSvg(ROOT, key);
  if (!file || !svg) {
    skipped.push(`${key} (${usedBy.slice(0, 3).join(", ")})`);
    continue;
  }
  const dark = overrides.dark.has(key) || (!overrides.light.has(key) && isMostlyDark(svg));
  if (dark) darkKeys.push(key);
  const out = withDarkMarker(svg, dark);
  const path = join(ROOT, PUBLIC_IMAGES, file);
  keep.add(file);
  if (existsSync(path) && readFileSync(path, "utf8") === out) {
    unchanged++;
    continue;
  }
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, out);
  written++;
}

let pruned = 0;
let bytes = 0;
for (const source of ["fluent", "custom"]) {
  const dir = join(ROOT, PUBLIC_IMAGES, source);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (keep.has(`${source}/${f}`)) bytes += statSync(join(dir, f)).size;
    else {
      rmSync(join(dir, f));
      pruned++;
    }
  }
}

for (const s of skipped) console.warn(`⚠ no source yet, skipped: ${s}`);
if (darkKeys.length) console.log(`dark backdrop: ${darkKeys.join(", ")}`);
console.log(
  `✓ ${relative(ROOT, join(ROOT, PUBLIC_IMAGES))}: ${keys.size} keys, ${keep.size} files (${(bytes / 1024).toFixed(1)} KB), ` +
    `written ${written}, unchanged ${unchanged}, pruned ${pruned}, skipped ${skipped.length}`,
);

// Re-bundle so the new files resolve as `image` in the running app.
if (written || pruned) execFileSync("npm", ["run", "--silent", "content:build"], { stdio: "inherit" });
