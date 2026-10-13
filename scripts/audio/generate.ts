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
 *
 * Voices mapped to Gemini TTS need GEMINI_API_KEY (environment or .env.local) and ffmpeg. Lines are
 * generated one by one, waiting when the API says "too many requests"; the noise burst Gemini
 * leaves after the last word is cut; a clip whose length does not fit its text is retried once,
 * then left on its edge-tts mp3. Daily quota or key problems stop Gemini for the run; the next run
 * continues. Interrupting is safe: finished mp3s stay and are reused.
 *
 * `--lang=it` (comma list) limits the run to those packs; the others are not touched.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
const ONLY = process.argv.find((a) => a.startsWith("--lang="))?.slice("--lang=".length).split(",").filter(Boolean);

function envKey(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const env = join(ROOT, ".env.local");
  if (!existsSync(env)) return undefined;
  const line = readFileSync(env, "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() || undefined;
}
const elevenLabsKey = () => envKey("ELEVENLABS_API_KEY");

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

let geminiStopped: string | undefined;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 16-bit mono PCM from a Gemini audio part: a WAV file or raw L16 (`audio/L16;…;rate=24000`). */
function decodeGeminiAudio(data: Buffer, mime: string): { pcm: Int16Array; rate: number } {
  let rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  let body = data;
  if (data.subarray(0, 4).toString("latin1") === "RIFF") {
    rate = data.readUInt32LE(24);
    let at = 12;
    while (at + 8 <= data.length && data.subarray(at, at + 4).toString("latin1") !== "data") at += 8 + data.readUInt32LE(at + 4);
    body = data.subarray(at + 8, at + 8 + data.readUInt32LE(at + 4));
  }
  const pcm = new Int16Array(Math.floor(body.length / 2));
  for (let i = 0; i < pcm.length; i++) pcm[i] = body.readInt16LE(i * 2);
  return { pcm, rate };
}

/**
 * Gemini ends most clips with a short noise burst after a pause: drop a last sound of ≤ 300 ms that
 * follows ≥ 100 ms of silence, keep 120 ms of silence after the speech and fade out the last 40 ms.
 */
function trimTail(pcm: Int16Array, rate: number): Int16Array {
  const win = Math.max(1, Math.round(rate / 100)); // 10 ms windows
  const windows = Math.floor(pcm.length / win);
  const loud: boolean[] = [];
  for (let w = 0; w < windows; w++) {
    let sum = 0;
    for (let i = w * win; i < (w + 1) * win; i++) sum += pcm[i] * pcm[i];
    loud.push(Math.sqrt(sum / win) > 330); // ≈ -40 dBFS
  }
  let end = loud.lastIndexOf(true);
  if (end < 0) return pcm;
  let start = end;
  while (start > 0 && loud[start - 1]) start--;
  let gap = start;
  while (gap > 0 && !loud[gap - 1]) gap--;
  if (end - start + 1 <= 30 && start - gap >= 10 && gap > 0) end = gap - 1;
  const out = pcm.slice(0, Math.min(pcm.length, (end + 1 + 12) * win));
  const fade = Math.min(out.length, Math.round(rate * 0.04));
  for (let i = 0; i < fade; i++) out[out.length - fade + i] = Math.round(out[out.length - fade + i] * (1 - i / fade));
  return out;
}

/** A clip far longer or shorter than its text is a misread (Gemini is generative): retry it. */
const plausible = (seconds: number, text: string) => seconds >= 0.25 && seconds <= 2 + text.length * 0.15;

/** Generates the Gemini lines one by one until done, out of quota or stopped. */
async function generateGemini(jobs: AudioJob[], dir: string, locale: string): Promise<number> {
  const key = envKey("GEMINI_API_KEY");
  if (!key) geminiStopped ??= "no GEMINI_API_KEY";
  if (!geminiStopped && spawnSync("ffmpeg", ["-version"]).status !== 0) geminiStopped = "ffmpeg not found (brew install ffmpeg)";
  let done = 0;
  for (const j of jobs) {
    if (geminiStopped) break;
    if (j.render.provider !== "gemini") continue;
    const { voice, model } = j.render;
    let tries = 0;
    for (;;) {
      tries++;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key!, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: j.text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { languageCode: locale, voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      }).catch((e: Error) => e);
      if (res instanceof Error || !res.ok) {
        const body = res instanceof Error ? "" : await res.text();
        const status = res instanceof Error ? 0 : res.status;
        const detail = res instanceof Error ? res.message : `${status} ${body.slice(0, 200)}`;
        if (status === 429 && /PerDay/i.test(body)) geminiStopped = "daily quota reached";
        else if (status === 429 || status === 0 || status >= 500) {
          if (tries > 10) geminiStopped = detail;
          else {
            const wait = Number(/"retryDelay":\s*"(\d+)/.exec(body)?.[1] ?? 20);
            await sleep((wait + 1) * 1000);
            continue;
          }
        } else if ([401, 403].includes(status)) geminiStopped = detail;
        else console.error(`  x gemini ${j.key}: ${detail}`);
        break;
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[];
      };
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      const decoded = part ? decodeGeminiAudio(Buffer.from(part.data, "base64"), part.mimeType) : undefined;
      const pcm = decoded ? trimTail(decoded.pcm, decoded.rate) : undefined;
      if (!decoded || !pcm || !plausible(pcm.length / decoded.rate, j.text)) {
        if (tries < 2) continue;
        console.error(`  x gemini ${j.key}: no usable audio (kept on edge-tts)`);
        break;
      }
      const tmp = join(dir, `${j.file}.part`);
      const enc = spawnSync(
        "ffmpeg",
        ["-v", "error", "-y", "-f", "s16le", "-ar", String(decoded.rate), "-ac", "1", "-i", "pipe:0", "-b:a", "48k", "-f", "mp3", tmp],
        { input: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength) },
      );
      if (enc.status !== 0) {
        geminiStopped = `ffmpeg failed: ${enc.stderr.toString().slice(0, 160)}`;
        break;
      }
      renameSync(tmp, join(dir, j.file));
      done++;
      if (done % 25 === 0) console.log(`  gemini ${done}/${jobs.length}…`);
      break;
    }
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
  hiddenPacks?: Record<string, Pack>;
};

async function main() {
  let failed = false;
  for (const pack of [...Object.values(bundle.packs), ...Object.values(bundle.hiddenPacks ?? {})]) {
    const lang = pack.meta.lang;
    if (ONLY && !ONLY.includes(lang)) continue;
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
      const gemini = jobs.filter((j) => j.render.provider === "gemini" && !existsSync(join(dir, j.file)));
      console.log(
        `${relative(ROOT, dir)}: ${jobs.length} keys, would generate ${toGenerate.size} with edge-tts, keep ${present.length - toPrune.length}, ` +
          `prune ${toPrune.length}, manifest entries changed ${changedKeys}` +
          (eleven.length ? `; ElevenLabs ${eleven.length} lines, ${eleven.reduce((n, j) => n + j.text.length, 0)} characters` : "") +
          (gemini.length ? `; Gemini ${gemini.length} lines, ${gemini.reduce((n, j) => n + j.text.length, 0)} characters` : ""),
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
    const geminiTodo = jobs
      .filter((j) => j.render.provider === "gemini" && !existsSync(join(dir, j.file)))
      .sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
    if (geminiTodo.length) {
      console.log(`${lang}: Gemini ${geminiTodo.length} lines (${geminiTodo.reduce((n, j) => n + j.text.length, 0)} characters)…`);
      elevenDone += await generateGemini(geminiTodo, dir, pack.meta.speechLocale);
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
        (onFallback ? `, ${onFallback} ElevenLabs/Gemini line(s) still on edge-tts` : "") +
        (missing ? `, ${missing} FAILED` : ""),
    );
  }

  if (elevenStopped) console.log(`ElevenLabs stopped: ${elevenStopped}. Re-run \`npm run audio\` later to continue.`);
  if (geminiStopped) console.log(`Gemini stopped: ${geminiStopped}. Re-run \`npm run audio\` later to continue.`);

  if (failed) {
    console.error("Some lines failed (network?). Re-run `npm run audio` to retry only those.");
    process.exit(1);
  }
}

void main();
