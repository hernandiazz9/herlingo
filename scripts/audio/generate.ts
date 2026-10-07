/**
 * `npm run audio`: neural mp3 for every playable of every pack (edge-tts, needs internet).
 *
 * Idempotent: files are named by a hash of voice + text (see plan.ts), so only new or changed
 * lines are generated; a second run generates 0 files. Writes public/audio/<lang>/manifest.json
 * and deletes mp3s no longer referenced. Commit public/audio/ afterwards.
 *
 * edge-tts lives in a project-local venv (.venv, git-ignored) created on first run from
 * scripts/audio/requirements.txt (pinned).
 *
 * `npm run audio -- --dry-run` only prints what a real run would do per pack (new mp3s, unchanged
 * files, files it would prune, manifest changes) and writes nothing under public/audio/.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Pack } from "../../src/lib/content/types";
import { audioDir, MANIFEST, planAudio, readManifest, type Manifest } from "./plan";

const ROOT = process.cwd();
const VENV = join(ROOT, ".venv");
const PY = join(VENV, "bin", "python");
const HERE = join(ROOT, "scripts", "audio");
const DRY_RUN = process.argv.includes("--dry-run");

function ensureVenv() {
  if (existsSync(PY) && spawnSync(PY, ["-c", "import edge_tts"]).status === 0) return;
  console.log("Setting up .venv with edge-tts…");
  if (!existsSync(PY)) execFileSync("python3", ["-m", "venv", VENV], { stdio: "inherit" });
  execFileSync(PY, ["-m", "pip", "install", "-q", "-r", join(HERE, "requirements.txt")], { stdio: "inherit" });
}

// Validate content and refresh the bundle, then read it.
execFileSync("npm", ["run", "--silent", "content:build"], { stdio: "inherit" });
const bundle = JSON.parse(readFileSync(join(ROOT, "src/lib/content/generated/packs.json"), "utf8")) as {
  packs: Record<string, Pack>;
};

let failed = false;
for (const pack of Object.values(bundle.packs)) {
  const lang = pack.meta.lang;
  const dir = audioDir(ROOT, lang);
  const jobs = planAudio(pack);

  if (DRY_RUN) {
    const wanted = new Set(jobs.map((j) => j.file));
    const present = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".mp3")) : [];
    const toGenerate = new Set(jobs.filter((j) => !existsSync(join(dir, j.file))).map((j) => j.file));
    const toPrune = present.filter((f) => !wanted.has(f));
    const old = readManifest(dir);
    const changedKeys =
      jobs.filter((j) => old[j.key] !== j.file).length + Object.keys(old).filter((k) => !jobs.some((j) => j.key === k)).length;
    console.log(
      `${relative(ROOT, dir)}: ${jobs.length} keys, would generate ${toGenerate.size}, keep ${present.length - toPrune.length}, ` +
        `prune ${toPrune.length}, manifest entries changed ${changedKeys}`,
    );
    continue;
  }
  mkdirSync(dir, { recursive: true });

  const todo = new Map<string, { text: string; voice: string; out: string }>();
  for (const j of jobs) {
    if (!existsSync(join(dir, j.file))) todo.set(j.file, { text: j.text, voice: j.voice, out: join(dir, j.file) });
  }
  if (todo.size) {
    ensureVenv();
    console.log(`${lang}: generating ${todo.size} mp3…`);
    const res = spawnSync(PY, [join(HERE, "tts.py")], {
      input: JSON.stringify([...todo.values()]),
      stdio: ["pipe", "inherit", "inherit"],
    });
    if (res.status !== 0) failed = true;
  }

  // Manifest lists only files that really exist (a failed line falls back to speechSynthesis).
  const manifest: Manifest = {};
  for (const j of jobs) if (existsSync(join(dir, j.file))) manifest[j.key] = j.file;
  writeFileSync(join(dir, MANIFEST), JSON.stringify(manifest, null, 1) + "\n");

  const keep = new Set(Object.values(manifest));
  let pruned = 0;
  for (const f of readdirSync(dir)) {
    if ((f.endsWith(".mp3") && !keep.has(f)) || f.endsWith(".part")) {
      rmSync(join(dir, f));
      pruned++;
    }
  }
  const missing = jobs.length - Object.keys(manifest).length;
  const generated = [...todo.keys()].filter((f) => keep.has(f)).length;
  console.log(
    `✓ ${relative(ROOT, dir)}: ${jobs.length} keys, ${keep.size} files, generated ${generated}, pruned ${pruned}` +
      (missing ? `, ${missing} FAILED` : ""),
  );
}

if (failed) {
  console.error("Some lines failed (network?). Re-run `npm run audio` to retry only those.");
  process.exit(1);
}
