/**
 * One mp3 per episode: every clip through `synthesize` (api/_lib/tts.ts: edge-tts via msedge-tts,
 * 24 kHz 48 kbps mono, slow = the voice at −30 %), cached by a hash of voice + speed + text in
 * `<out>/clips/`, then joined with silent gaps by ffmpeg into `<out>/mp3/<id>-<slug>.mp3`
 * (64 kbps mono, ID3 title / artist / album / track).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { synthesize } from "../../api/_lib/tts";
import { compileEpisode, type Segment } from "./episode";
import type { ListeningEpisode, Topic } from "./schema";
import type { Store } from "./state";

/** edge-tts answers 429 above ~4 parallel sockets. */
const CONCURRENCY = 3;
/** Extra rounds around `synthesize` (which already tries twice), with these pauses. */
const OUTER_PAUSES_MS = [3_000, 10_000, 30_000];

export const TOPIC_LABEL: Record<Topic, string> = {
  interview: "Interviews",
  work: "English at work",
  story: "Stories and conversations",
};

function ffmpeg(args: string[]): void {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr || r.error?.message}`);
}

function seconds(file: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
    encoding: "utf8",
  });
  return Number(r.stdout.trim());
}

function clipFile(store: Store, s: Extract<Segment, { kind: "clip" }>): string {
  const hash = createHash("sha1").update(`${s.voice}|${s.slow ? "slow" : "normal"}|${s.text}`).digest("hex").slice(0, 20);
  return join(store.clipsDir, `${hash}.mp3`);
}

function silenceFile(store: Store, ms: number): string {
  const file = join(store.clipsDir, `silence-${ms}.mp3`);
  if (!existsSync(file)) {
    ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(ms / 1000), "-c:a", "libmp3lame", "-b:a", "48k", file]);
  }
  return file;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function makeClip(file: string, s: Extract<Segment, { kind: "clip" }>): Promise<void> {
  for (let round = 0; ; round++) {
    try {
      const bytes = await synthesize(s.text, s.voice, { slow: s.slow });
      writeFileSync(`${file}.tmp`, bytes);
      renameSync(`${file}.tmp`, file);
      return;
    } catch (error) {
      const pause = OUTER_PAUSES_MS[round];
      if (pause === undefined) throw new Error(`TTS failed for ${s.voice}: "${s.text.slice(0, 60)}…" (${String(error)})`);
      await sleep(pause);
    }
  }
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

export async function renderEpisode(
  store: Store,
  episode: ListeningEpisode,
): Promise<{ file: string; seconds: number; renderedAt: string }> {
  const segments = compileEpisode(episode);
  const clips = segments.filter((s): s is Extract<Segment, { kind: "clip" }> => s.kind === "clip");
  const todo = new Map<string, Extract<Segment, { kind: "clip" }>>();
  for (const c of clips) {
    const file = clipFile(store, c);
    if (!existsSync(file)) todo.set(file, c);
  }
  const queue = [...todo.entries()];
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        await makeClip(next[0], next[1]);
        done++;
        if (done % 25 === 0) console.log(`    ${episode.id}: ${done}/${todo.size} clips`);
      }
    }),
  );

  const list = segments.map((s) => (s.kind === "clip" ? clipFile(store, s) : silenceFile(store, s.ms)));
  const listFile = join(store.clipsDir, `${episode.id}.concat.txt`);
  writeFileSync(listFile, list.map((f) => `file '${f}'`).join("\n"));
  const name = `${episode.id}-${slug(episode.title)}.mp3`;
  const out = join(store.mp3Dir, name);
  const tmp = join(store.mp3Dir, `.${name}.tmp.mp3`);
  ffmpeg([
    "-f", "concat", "-safe", "0", "-i", listFile,
    "-c:a", "libmp3lame", "-b:a", "64k", "-ar", "24000", "-ac", "1",
    "-id3v2_version", "3",
    "-metadata", `title=${TOPIC_LABEL[episode.topic]} ${episode.number} · ${episode.title}`,
    "-metadata", "artist=Herlingo Listening",
    "-metadata", `album=${TOPIC_LABEL[episode.topic]}`,
    "-metadata", `track=${episode.number}`,
    tmp,
  ]);
  renameSync(tmp, out);
  rmSync(listFile);
  return { file: `mp3/${name}`, seconds: seconds(out), renderedAt: new Date().toISOString() };
}
