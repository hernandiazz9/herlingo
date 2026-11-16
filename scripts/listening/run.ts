/**
 * Listening library: English listening episodes for running and walking (scripts/listening/README.md).
 *
 *   npx tsx scripts/listening/run.ts <command> [options]
 *
 * Commands
 *   status                 Budget (spent, reserved, free), episodes, hours of audio, sent.
 *   topics [--per 120]     Topic plan: --per ideas for each topic (interview, work, story), no repeats.
 *   write --count N        Writes the next N episodes (interleaved by topic) and waits for them.
 *   collect                Collects ended batches (bills them, stores the scripts).
 *   audio                  Renders every script without an mp3 (edge-tts, free; needs ffmpeg).
 *   send                   Sends every mp3 not sent yet to Telegram.
 *   auto [--chunk N]       Until the cap: write batches as large as the free budget allows (at most
 *                          --chunk), collect, render, send. Safe to stop and run again.
 *
 * Options
 *   --out <dir>            Output folder (default ./listening-out, git-ignored).
 *   --cap <usd>            Spending cap of the folder, set on its first run (default 20).
 *   --env <file>           File with ANTHROPIC_API_KEY (default ./.env.local); only that name is read.
 *   --direct               Messages API instead of Message Batches (full price, no waiting).
 *   --effort <level>       low | medium | high | xhigh | max (default high).
 *   --max-tokens <n>       Per request, thinking included (default 16000; topics 32000).
 *   --no-wait              write: submit and return.
 *   --ids a,b              audio / send: only these episodes.
 *   --telegram-config <f>  JSON {"telegram": {"bot_token", "chat_id"}} (or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs, parseEnv } from "node:util";
import { collectBatches, episodeJob, jobWorstCase, runDirect, submitBatch, topicsJob, type Effort, type Job } from "./claude";
import { buildEpisode } from "./episode";
import { EpisodeDraft, TOPICS, TopicPlan, type Topic, type TopicIdea } from "./schema";
import { BATCH_FACTOR, MODEL, playOrder, Store, usd, type LedgerEntry } from "./state";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: "listening-out" },
    cap: { type: "string", default: "20" },
    env: { type: "string", default: ".env.local" },
    direct: { type: "boolean", default: false },
    effort: { type: "string", default: "high" },
    "max-tokens": { type: "string" },
    "no-wait": { type: "boolean", default: false },
    count: { type: "string" },
    per: { type: "string", default: "120" },
    chunk: { type: "string", default: "100" },
    ids: { type: "string" },
    "telegram-config": { type: "string" },
  },
});

const command = positionals[0] ?? "status";
const store = new Store(resolve(values.out!), Number(values.cap));
const effort = values.effort as Effort;
const idsFilter = values.ids ? new Set(values.ids.split(",")) : undefined;

function loadKey(): void {
  if (process.env.ANTHROPIC_API_KEY) return;
  const file = resolve(values.env!);
  if (existsSync(file)) {
    const key = parseEnv(readFileSync(file, "utf8")).ANTHROPIC_API_KEY;
    if (key) process.env.ANTHROPIC_API_KEY = key;
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error(`ANTHROPIC_API_KEY not found (environment or ${file}).`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Results

function ideaOf(id: string): TopicIdea {
  const idea = store.state.topics.find((t) => t.id === id);
  if (!idea) throw new Error(`Unknown episode id ${id}`);
  return idea;
}

function jobById(id: string, kind: "topics" | "episode"): Job {
  if (kind === "topics") return topicsJob(id.replace(/^topics-/, "") as Topic, 0);
  return episodeJob(ideaOf(id));
}

function onResult(job: Job, data: unknown, entry: LedgerEntry): void {
  if (job.kind === "topics") {
    const topic = job.id.replace(/^topics-/, "") as Topic;
    const plan = data as TopicPlan;
    store.state.topics = store.state.topics.filter((t) => t.topic !== topic);
    plan.ideas.forEach((idea, i) => {
      const number = i + 1;
      store.state.topics.push({
        id: `${topic}-${String(number).padStart(3, "0")}`,
        topic,
        number,
        title: idea.title.trim(),
        brief: idea.brief.trim(),
      });
    });
    console.log(`  → ${plan.ideas.length} ${topic} ideas`);
    store.save();
    return;
  }
  const idea = ideaOf(job.id);
  const episode = buildEpisode(idea, data as EpisodeDraft, {
    model: entry.model,
    mode: entry.mode,
    batchId: entry.batchId,
    effort,
    usage: entry.usage,
    costMicro: entry.costMicro,
  });
  store.writeEpisode(episode);
  const s = episode.stats;
  console.log(
    `  → ${episode.id} "${episode.title}": ${s.steps} steps, ${s.focus} focus, ${s.words} words${s.warnings.length ? ` · ⚠ ${s.warnings.join("; ")}` : ""}`,
  );
}

async function collect(): Promise<number> {
  return collectBatches(store, jobById, onResult);
}

async function waitAll(): Promise<void> {
  for (;;) {
    const running = await collect();
    if (running === 0) return;
    await sleep(60_000);
  }
}

// ---------------------------------------------------------------------------------------------
// Commands

async function topics(): Promise<void> {
  const per = Number(values.per);
  const missing = TOPICS.filter((t) => !store.state.topics.some((i) => i.topic === t));
  if (missing.length === 0) {
    console.log(`Topic plan already there (${store.state.topics.length} ideas).`);
    return;
  }
  const jobs = missing.map((t) => topicsJob(t, per));
  const maxTokens = Number(values["max-tokens"] ?? 32000);
  if (values.direct) await runDirect(store, jobs, effort, maxTokens, onResult);
  else {
    await submitBatch(store, jobs, effort, maxTokens);
    await waitAll();
  }
}

async function write(count: number): Promise<number> {
  const maxTokens = Number(values["max-tokens"] ?? 16000);
  const factor = values.direct ? 2 : BATCH_FACTOR;
  const ideas = store.nextIdeas(count);
  const jobs: Job[] = [];
  let free = store.freeMicro;
  for (const idea of ideas) {
    const job = episodeJob(idea);
    const worst = jobWorstCase(job, maxTokens, factor);
    if (worst > free) break;
    free -= worst;
    jobs.push(job);
  }
  if (jobs.length === 0) {
    console.log(ideas.length === 0 ? "No ideas left to write." : `Budget: free ${usd(store.freeMicro)} is less than one request's worst case.`);
    return 0;
  }
  if (values.direct) await runDirect(store, jobs, effort, maxTokens, onResult);
  else await submitBatch(store, jobs, effort, maxTokens);
  return jobs.length;
}

function status(): void {
  const eps = store.episodes();
  const seconds = eps.reduce((sum, e) => sum + (e.audio?.seconds ?? 0), 0);
  const ok = store.state.ledger.filter((e) => e.kind === "episode" && e.outcome === "ok");
  const avg = ok.length ? ok.reduce((s, e) => s + e.costMicro, 0) / ok.length : 0;
  console.log(`Folder ${store.dir}`);
  console.log(`Model ${MODEL} · cap ${usd(store.capMicro)} · spent ${usd(store.spentMicro)} · reserved ${usd(store.reservedMicro)} · free ${usd(store.freeMicro)}`);
  console.log(`Ideas ${store.state.topics.length} · episodes ${eps.length} (avg ${usd(avg)}) · pending ${store.pendingIds().size}`);
  for (const t of TOPICS) {
    const of = eps.filter((e) => e.topic === t);
    console.log(`  ${t}: ${of.length} episodes, ${of.filter((e) => e.audio).length} mp3`);
  }
  console.log(`Audio ${(seconds / 3600).toFixed(2)} h (${eps.filter((e) => e.audio).length} mp3) · sent ${Object.keys(store.state.sent).length}`);
}

async function audio(): Promise<void> {
  const { renderEpisode } = await import("./audio");
  const todo = store.episodes().filter((e) => (idsFilter ? idsFilter.has(e.id) : !e.audio || !existsSync(join(store.dir, e.audio.file))));
  for (const episode of todo) {
    try {
      const rendered = await renderEpisode(store, episode);
      store.writeEpisode({ ...episode, audio: rendered });
      console.log(`  ♪ ${rendered.file} · ${(rendered.seconds / 60).toFixed(1)} min`);
    } catch (error) {
      console.error(`  ✗ ${episode.id}: ${error instanceof Error ? error.message : error} (next run retries)`);
    }
  }
}

async function send(): Promise<void> {
  const { sendEpisode, telegramConfig } = await import("./telegram");
  const config = telegramConfig(values["telegram-config"]);
  const todo = store
    .episodes()
    .filter((e) => e.audio && (idsFilter ? idsFilter.has(e.id) : !store.state.sent[e.id]))
    .sort(playOrder);
  for (const episode of todo) {
    await sendEpisode(config, store, episode);
    store.state.sent[episode.id] = new Date().toISOString();
    store.save();
    console.log(`  ✈ ${episode.id} sent`);
    await sleep(1500);
  }
}

async function auto(): Promise<void> {
  const chunk = Number(values.chunk);
  for (;;) {
    const running = await collect();
    let submitted = 0;
    if (running === 0) submitted = await write(chunk);
    await audio();
    if (values["telegram-config"] || process.env.TELEGRAM_BOT_TOKEN) {
      await send().catch((error: unknown) => console.error(`Telegram: ${error instanceof Error ? error.message : error} (next round retries)`));
    }
    status();
    if (running === 0 && submitted === 0) {
      console.log("Done: nothing running and nothing more fits in the budget (or no ideas left).");
      return;
    }
    await sleep(60_000);
  }
}

async function main(): Promise<void> {
  switch (command) {
    case "status":
      return status();
    case "topics":
      loadKey();
      return topics();
    case "write": {
      loadKey();
      const n = await write(Number(values.count ?? 3));
      if (n && !values.direct && !values["no-wait"]) await waitAll();
      return;
    }
    case "collect":
      loadKey();
      await collect();
      return;
    case "audio":
      return audio();
    case "send":
      return send();
    case "auto":
      loadKey();
      return auto();
    default:
      throw new Error(`Unknown command ${command}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
