/**
 * Content tool. Discovers every pack under content/<lang>/ by glob, validates it and (build mode)
 * writes the bundle the app imports.
 *
 *   npm run content:check   validate only; exit 1 on any error
 *   npm run content:build   validate + write src/lib/content/generated/packs.json
 *   npm run content:check -- --strict-audio   also fail when a playable has no mp3 (npm run audio)
 *   npm run content:check -- --strict-images  also fail when a referenced picture is missing from
 *                                             public/images/ or stale (npm run images)
 *
 * Pictures: vocab `image` / dialogue `avatars` resolve to `{ src, dark? }` only when the file
 * exists in public/images/ (scripts/images/plan.ts). Unknown Fluent icons are errors; custom
 * drawings that do not exist yet are ⚠ warnings.
 *
 * Layout per pack: pack.json, units/*.json, dialogues/*.json, extras/*.json, stories/*.json
 * (see docs/content-guide.md). Guideline misses (story length, counts) print as ⚠ warnings only.
 *
 * Several packs: ids are unique across every pack (routes like /leccion/<id>/ are shared), and
 * exactly one pack.json sets `"default": true` (written to the bundle as `defaultLang`). A pack
 * with no units yet is accepted (reported as empty).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { buildPack, packStats, type SourceFile } from "../src/lib/content/build";
import { checkAudio } from "./audio/plan";
import { checkImageKeys, checkImages, checkUnusedImages, imageResolver } from "./images/plan";
import type { Pack } from "../src/lib/content/types";

// npm scripts always run from the repo root.
const ROOT = process.cwd();
const CONTENT = join(ROOT, "content");
const OUT = join(ROOT, "src/lib/content/generated/packs.json");

const mode = process.argv[2] ?? "check";
const strictAudio = process.argv.includes("--strict-audio");
const strictImages = process.argv.includes("--strict-images");
if (mode !== "check" && mode !== "build") {
  console.error(`Unknown mode "${mode}". Use "check" or "build".`);
  process.exit(2);
}

function read(path: string, errors: string[]): SourceFile {
  const file = relative(ROOT, path);
  try {
    return { file, data: JSON.parse(readFileSync(path, "utf8")) };
  } catch (e) {
    errors.push(`${file}: invalid JSON: ${(e as Error).message}`);
    return { file, data: undefined };
  }
}

function readDir(dir: string, errors: string[]): SourceFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => read(join(dir, f), errors))
    .filter((s) => s.data !== undefined);
}

const langs = existsSync(CONTENT)
  ? readdirSync(CONTENT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(CONTENT, d.name, "pack.json")))
      .map((d) => d.name)
      .sort()
  : [];
// Default pack first, so an id reused across packs is reported on the newer pack, not the default.
const isDefault = (lang: string) => {
  try {
    return JSON.parse(readFileSync(join(CONTENT, lang, "pack.json"), "utf8"))?.default === true;
  } catch {
    return false;
  }
};
langs.sort((a, b) => Number(isDefault(b)) - Number(isDefault(a)));

let failed = false;
const packs: Record<string, Pack> = {};
/** Id → `<file>` of every pack checked so far, to reject an id reused by another pack. */
const globalIds = new Map<string, string>();
const defaults: string[] = [];
/** Every pack that built (even with errors), for the cross-pack unused-picture check. */
const builtPacks: Pack[] = [];

if (langs.length === 0) {
  console.error("No packs found: expected content/<lang>/pack.json");
  failed = true;
}

for (const lang of langs) {
  const dir = join(CONTENT, lang);
  const readErrors: string[] = [];
  const meta = read(join(dir, "pack.json"), readErrors);
  const { pack, errors, warnings, ids } = buildPack({
    lang,
    meta,
    units: readDir(join(dir, "units"), readErrors),
    dialogues: readDir(join(dir, "dialogues"), readErrors),
    extras: readDir(join(dir, "extras"), readErrors),
    stories: readDir(join(dir, "stories"), readErrors),
    resolveImage: imageResolver(ROOT),
  });
  const crossPack: string[] = [];
  for (const [id, file] of ids) {
    const prev = globalIds.get(id);
    if (prev) crossPack.push(`${file}: id "${id}" is already used by another pack (${prev}); ids must be unique across every pack`);
    else globalIds.set(id, file);
  }
  if (pack?.meta.default) defaults.push(lang);
  if (pack) builtPacks.push(pack);
  const images = pack ? checkImageKeys(pack, ROOT) : { errors: [], warnings: [] };
  for (const w of [...warnings, ...images.warnings]) console.warn(`⚠ ${w}`);
  const all = [
    ...readErrors,
    ...errors,
    ...crossPack,
    ...images.errors,
    ...(pack && strictAudio ? checkAudio(pack, ROOT) : []),
    ...(pack && strictImages ? checkImages(pack, ROOT) : []),
  ];
  if (all.length || !pack) {
    failed = true;
    console.error(`✗ content/${lang}: ${all.length} error(s)`);
    for (const e of all) console.error(`  - ${e}`);
    continue;
  }
  packs[lang] = pack;
  const stats = Object.entries(packStats(pack))
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  const empty = pack.units.length === 0 ? " (empty: no units yet)" : "";
  console.log(`✓ content/${lang}${pack.meta.default ? " (default)" : ""}: ${stats}${empty}`);
}

if (strictImages) {
  // A picture is unused only when no pack references it (checked once, across every pack).
  const unused = checkUnusedImages(builtPacks, ROOT);
  if (unused.length) {
    failed = true;
    console.error(`✗ public/images: ${unused.length} error(s)`);
    for (const e of unused) console.error(`  - ${e}`);
  }
}

if (!failed && defaults.length !== 1) {
  failed = true;
  console.error(
    defaults.length === 0
      ? `✗ no default pack: set "default": true in exactly one content/<lang>/pack.json`
      : `✗ ${defaults.length} default packs (${defaults.join(", ")}): only one pack.json may set "default": true`,
  );
}

if (failed) process.exit(1);

if (mode === "build") {
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ defaultLang: defaults[0], packs }));
  console.log(`→ ${relative(ROOT, OUT)}`);
}
