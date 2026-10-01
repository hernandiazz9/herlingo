/**
 * Content tool. Discovers every pack under content/<lang>/ by glob, validates it and (build mode)
 * writes the bundle the app imports.
 *
 *   npm run content:check   validate only; exit 1 on any error
 *   npm run content:build   validate + write src/lib/content/generated/packs.json
 *   npm run content:check -- --strict-audio   also fail when a playable has no mp3 (npm run audio)
 *
 * Layout per pack: pack.json, units/*.json, dialogues/*.json, extras/*.json, stories/*.json
 * (see docs/content-guide.md). Guideline misses (story length, counts) print as ⚠ warnings only.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { buildPack, packStats, type SourceFile } from "../src/lib/content/build";
import { checkAudio } from "./audio/plan";
import type { Pack } from "../src/lib/content/types";

// npm scripts always run from the repo root.
const ROOT = process.cwd();
const CONTENT = join(ROOT, "content");
const OUT = join(ROOT, "src/lib/content/generated/packs.json");

const mode = process.argv[2] ?? "check";
const strictAudio = process.argv.includes("--strict-audio");
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

let failed = false;
const packs: Record<string, Pack> = {};

if (langs.length === 0) {
  console.error("No packs found: expected content/<lang>/pack.json");
  failed = true;
}

for (const lang of langs) {
  const dir = join(CONTENT, lang);
  const readErrors: string[] = [];
  const meta = read(join(dir, "pack.json"), readErrors);
  const { pack, errors, warnings } = buildPack({
    lang,
    meta,
    units: readDir(join(dir, "units"), readErrors),
    dialogues: readDir(join(dir, "dialogues"), readErrors),
    extras: readDir(join(dir, "extras"), readErrors),
    stories: readDir(join(dir, "stories"), readErrors),
  });
  for (const w of warnings) console.warn(`⚠ ${w}`);
  const all = [...readErrors, ...errors, ...(pack && strictAudio ? checkAudio(pack, ROOT) : [])];
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
  console.log(`✓ content/${lang}: ${stats}`);
}

if (failed) process.exit(1);

if (mode === "build") {
  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ defaultLang: langs[0], packs }));
  console.log(`→ ${relative(ROOT, OUT)}`);
}
