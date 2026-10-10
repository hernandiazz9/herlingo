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
 * files, files it would prune, manifest changes, ElevenLabs characters) and writes nothing under
 * public/audio/.
 *
 * Voices mapped to ElevenLabs in pack.json `ttsVoices` need ELEVENLABS_API_KEY (environment or
 * .env.local). Those lines are generated first, dialogue and story lines before the rest, and a
 * line that cannot be generated (no key, out of credits, `--max-credits` reached) keeps its
 * edge-tts mp3; the next run picks up where this one stopped. `--max-credits=N` caps the
 * ElevenLabs characters spent in one run.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Pack } from "../../src/lib/content/types";
import { audioDir, currentFile, MANIFEST, planAudio, readManifest, type AudioJob, type Manifest } from "./plan";

const ROOT = process.cwd();
const VENV = join(ROOT, ".venv");
const PY = join(VENV, "bin", "python");
const HERE = join(ROOT, "scripts", "audio");
const DRY_RUN = process.argv.includes("--dry-run");
const MAX_CREDITS = Number(process.argv.find((a) => a.startsWith("--max-credits="))?.split("=")[1] ?? Infinity);
const ELEVENLABS_FORMAT = "mp3_22050_32";

function elevenLabsKey(): string | undefined {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const env = join(ROOT, ".env.local");
  if (!existsSync(env)) return undefined;
  const line = readFileSync(env, "utf8").split("\n").find((l) => l.startsWith("ELEVENLABS_API_KEY="));
  return line?.slice("ELEVENLABS_API_KEY=".length).trim() || undefined;
}

let credits = MAX_CREDITS;
let elevenStopped: string | undefined;

/** Generates the ElevenLabs lines in priority order until done, out of credits or capped. */
async function generateElevenLabs(jobs: AudioJob[], dir: string, language: string): Promise<number> {
  const key = elevenLabsKey();
  let done = 0;
  for (const j of jobs) {
    if (j.render.provider !== "elevenlabs") continue;
    if (!key) elevenStopped ??= "no ELEVENLABS_API_KEY";
    if (elevenStopped) break;
    if (j.text.length > credits) {
      elevenStopped = "--max-credits reached";
      break;
    }
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${j.render.voiceId}?output_format=${ELEVENLABS_FORMAT}`,
      {
        method: "POST",
        headers: { "xi-api-key": key!, "Content-Type": "application/json" },
        body: JSON.stringify({ text: j.text, model_id: j.render.model, language_code: language }),
      },
    ).catch((e: Error) => e);
    if (res instanceof Error || !res.ok) {
      const detail = res instanceof Error ? res.message : `${res.status} ${(await res.text()).slice(0, 160)}`;
      // Credits, plan or key problems stop ElevenLabs for this run; a single bad line is skipped.
      if (res instanceof Error || [401, 402, 403, 429].includes(res.status)) elevenStopped = detail;
      else console.error(`  x elevenlabs ${j.key}: ${detail}`);
      continue;
    }
    writeFileSync(join(dir, j.file), Buffer.from(await res.arrayBuffer()));
    credits -= j.text.length;
    done++;
    if (done % 25 === 0) console.log(`  elevenlabs ${done}…`);
  }
  return done;
}

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

async function main() {
  let failed = false;
  for (const pack of Object.values(bundle.packs)) {
    const lang = pack.meta.lang;
    const dir = audioDir(ROOT, lang);
    const jobs = planAudio(pack);

    if (DRY_RUN) {
      // ElevenLabs lines keep their edge-tts fallback until their own mp3 exists.
      const wanted = new Set(jobs.flatMap((j) => (j.fallback ? [j.file, j.fallback.file] : [j.file])));
      const present = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".mp3")) : [];
      const toGenerate = new Set(
        jobs
          .filter((j) => j.render.provider === "edge" || (j.fallback && !existsSync(join(dir, j.fallback.file))))
          .map((j) => (j.render.provider === "edge" ? j.file : j.fallback!.file))
          .filter((f) => !existsSync(join(dir, f))),
      );
      const toPrune = present.filter((f) => !wanted.has(f));
      const old = readManifest(dir);
      const changedKeys =
        jobs.filter((j) => old[j.key] !== j.file).length + Object.keys(old).filter((k) => !jobs.some((j) => j.key === k)).length;
      const eleven = jobs.filter((j) => j.render.provider === "elevenlabs" && !existsSync(join(dir, j.file)));
      console.log(
        `${relative(ROOT, dir)}: ${jobs.length} keys, would generate ${toGenerate.size} with edge-tts, keep ${present.length - toPrune.length}, ` +
          `prune ${toPrune.length}, manifest entries changed ${changedKeys}` +
          (eleven.length ? `; ElevenLabs ${eleven.length} lines, ${eleven.reduce((n, j) => n + j.text.length, 0)} characters` : ""),
      );
      continue;
    }
    mkdirSync(dir, { recursive: true });

    const elevenTodo = jobs
      .filter((j) => j.render.provider === "elevenlabs" && !existsSync(join(dir, j.file)))
      .sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
    let elevenDone = 0;
    if (elevenTodo.length) {
      console.log(`${lang}: ElevenLabs ${elevenTodo.length} lines (${elevenTodo.reduce((n, j) => n + j.text.length, 0)} characters)…`);
      elevenDone = await generateElevenLabs(elevenTodo, dir, pack.meta.speechLocale.slice(0, 2));
    }

    // edge-tts: edge lines without mp3, and ElevenLabs lines still without theirs (their fallback).
    const todo = new Map<string, { text: string; voice: string; out: string }>();
    for (const j of jobs) {
      if (existsSync(join(dir, j.file))) continue;
      if (j.render.provider === "edge") todo.set(j.file, { text: j.text, voice: j.render.voice, out: join(dir, j.file) });
      else if (j.fallback && !existsSync(join(dir, j.fallback.file)))
        todo.set(j.fallback.file, { text: j.text, voice: j.fallback.voice, out: join(dir, j.fallback.file) });
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
    for (const j of jobs) {
      const file = currentFile(j, dir);
      if (file) manifest[j.key] = file;
    }
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
    const generated = [...todo.keys()].filter((f) => keep.has(f)).length + elevenDone;
    const onFallback = jobs.filter((j) => j.fallback && manifest[j.key] === j.fallback.file).length;
    console.log(
      `✓ ${relative(ROOT, dir)}: ${jobs.length} keys, ${keep.size} files, generated ${generated}, pruned ${pruned}` +
        (onFallback ? `, ${onFallback} ElevenLabs line(s) still on edge-tts` : "") +
        (missing ? `, ${missing} FAILED` : ""),
    );
  }

  if (elevenStopped) console.log(`ElevenLabs stopped: ${elevenStopped}. Re-run \`npm run audio\` later to continue.`);

  if (failed) {
    console.error("Some lines failed (network?). Re-run `npm run audio` to retry only those.");
    process.exit(1);
  }
}

void main();
