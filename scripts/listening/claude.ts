/**
 * Claude calls of the listening library: Claude Opus 5.5, adaptive thinking, structured output.
 * Default = Message Batches API (half price, results in minutes to hours; no server-side
 * fallbacks there); `direct` = Messages API with server-side fallbacks, for a fast pilot.
 * Every response is billed into the ledger as soon as it arrives, also when it is then rejected.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { EPISODE_SYSTEM, episodeUser, TOPICS_SYSTEM, topicsUser } from "./prompt";
import { EpisodeDraft, TopicPlan, type Topic, type TopicIdea, type Usage } from "./schema";
import { BATCH_FACTOR, costOf, MODEL, usd, worstCaseMicro, type LedgerEntry, type Store } from "./state";

let client: Anthropic | undefined;
const api = () => (client ??= new Anthropic());

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** One request to make: the batch `custom_id` is `id`. */
export interface Job {
  id: string;
  kind: "topics" | "episode";
  system: string;
  user: string;
  schema: z.ZodType;
}

export function episodeJob(idea: TopicIdea): Job {
  return { id: idea.id, kind: "episode", system: EPISODE_SYSTEM, user: episodeUser(idea), schema: EpisodeDraft };
}

export function topicsJob(topic: Topic, count: number): Job {
  return { id: `topics-${topic}`, kind: "topics", system: TOPICS_SYSTEM, user: topicsUser(topic, count), schema: TopicPlan };
}

export function jobWorstCase(job: Job, maxTokens: number, factor: number): number {
  return worstCaseMicro(MODEL, job.system.length + job.user.length + 2000, maxTokens, factor);
}

/** A parsed response, or why there is none. */
export type Outcome = { ok: true; data: unknown } | { ok: false; outcome: LedgerEntry["outcome"]; note: string };

function usageOf(u: Anthropic.Messages.Usage | Anthropic.Beta.Messages.BetaUsage): Usage {
  return {
    input: u.input_tokens,
    output: u.output_tokens,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
  };
}

function thinkingOf(u: Anthropic.Messages.Usage | Anthropic.Beta.Messages.BetaUsage): number | undefined {
  const details = (u as { output_tokens_details?: { reasoning_tokens?: number } | null }).output_tokens_details;
  return details?.reasoning_tokens ?? undefined;
}

/** Checks `stop_reason` before parsing, then JSON + zod. */
function parse(
  job: Job,
  message: { stop_reason: string | null; content: Array<{ type: string; text?: string }> },
): Outcome {
  if (message.stop_reason === "refusal") return { ok: false, outcome: "refusal", note: "refusal" };
  if (message.stop_reason === "max_tokens") return { ok: false, outcome: "max_tokens", note: "max_tokens" };
  const text = message.content.flatMap((b) => (b.type === "text" && b.text ? [b.text] : [])).join("");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, outcome: "invalid", note: `not JSON (${text.length} chars)` };
  }
  const parsed = job.schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, outcome: "invalid", note: `${issue?.path.join(".")}: ${issue?.message}` };
  }
  return { ok: true, data: parsed.data };
}

function logEntry(e: LedgerEntry): void {
  const think = e.thinking !== undefined ? ` (thinking ${e.thinking})` : "";
  console.log(
    `  ${e.id}: ${e.outcome}${e.note ? ` (${e.note})` : ""} · in ${e.usage.input} + cache ${e.usage.cacheWrite}/${e.usage.cacheRead} · out ${e.usage.output}${think} · ${usd(e.costMicro)}`,
  );
}

// ---------------------------------------------------------------------------------------------
// Message Batches

/** Submits `jobs` as one batch if its worst case fits in the free budget; records it. */
export async function submitBatch(store: Store, jobs: Job[], effort: Effort, maxTokens: number): Promise<string> {
  const reserved = jobs.reduce((sum, j) => sum + jobWorstCase(j, maxTokens, BATCH_FACTOR), 0);
  if (reserved > store.freeMicro) {
    throw new Error(`Batch worst case ${usd(reserved)} > free budget ${usd(store.freeMicro)}`);
  }
  const requests = jobs.map((job) => {
    const { type, schema } = zodOutputFormat(job.schema);
    return {
      custom_id: job.id,
      params: {
        model: MODEL,
        max_tokens: maxTokens,
        system: [{ type: "text" as const, text: job.system, cache_control: { type: "ephemeral" as const } }],
        messages: [{ role: "user" as const, content: job.user }],
        output_config: { effort, format: { type, schema } },
      },
    };
  });
  const batch = await api().messages.batches.create({ requests });
  store.state.batches.push({
    id: batch.id,
    kind: jobs[0]!.kind,
    customIds: jobs.map((j) => j.id),
    reservedMicro: reserved,
    effort,
    maxTokens,
    createdAt: new Date().toISOString(),
  });
  store.save();
  console.log(`Batch ${batch.id}: ${jobs.length} requests, worst case ${usd(reserved)} reserved.`);
  return batch.id;
}

/**
 * Collects every ended batch: bills each result, hands successful parses to `onResult`, and
 * releases the reservation. Returns how many batches are still running.
 */
export async function collectBatches(
  store: Store,
  jobsById: (id: string, kind: "topics" | "episode") => Job,
  onResult: (job: Job, data: unknown, entry: LedgerEntry) => void,
): Promise<number> {
  let running = 0;
  for (const record of store.state.batches.filter((b) => !b.collectedAt)) {
    const batch = await api().messages.batches.retrieve(record.id);
    if (batch.processing_status !== "ended") {
      const c = batch.request_counts;
      console.log(`Batch ${record.id}: ${batch.processing_status} (processing ${c.processing}, done ${c.succeeded + c.errored})`);
      running++;
      continue;
    }
    console.log(`Batch ${record.id}: ended. Results:`);
    for await (const result of await api().messages.batches.results(record.id)) {
      const job = jobsById(result.custom_id, record.kind);
      if (result.result.type !== "succeeded") {
        const detail = result.result.type === "errored" ? JSON.stringify(result.result.error).slice(0, 200) : "";
        console.log(`  ${result.custom_id}: ${result.result.type} (not billed) ${detail}`);
        continue;
      }
      const message = result.result.message;
      const usage = usageOf(message.usage);
      const outcome = parse(job, message);
      const entry: LedgerEntry = {
        at: new Date().toISOString(),
        id: job.id,
        kind: job.kind,
        mode: "batch",
        batchId: record.id,
        model: message.model,
        usage,
        thinking: thinkingOf(message.usage),
        costMicro: costOf(message.model, usage, BATCH_FACTOR),
        outcome: outcome.ok ? "ok" : outcome.outcome,
        note: outcome.ok ? undefined : outcome.note,
      };
      store.state.ledger.push(entry);
      logEntry(entry);
      if (outcome.ok) onResult(job, outcome.data, entry);
    }
    record.collectedAt = new Date().toISOString();
    store.save();
  }
  return running;
}

// ---------------------------------------------------------------------------------------------
// Direct (Messages API, streaming, server-side fallbacks)

/** Tokens per model attempt: a response rescued by a fallback model is billed from `usage.iterations`. */
function chargesOf(response: Anthropic.Beta.Messages.BetaMessage): Array<{ model: string; usage: Usage }> {
  const iterations = response.usage.iterations ?? [];
  if (iterations.some((it) => it.type === "fallback_message")) {
    return iterations.flatMap((it) =>
      it.type === "message" || it.type === "fallback_message"
        ? [
            {
              model: it.model ?? MODEL,
              usage: {
                input: it.input_tokens,
                output: it.output_tokens,
                cacheWrite: it.cache_creation_input_tokens,
                cacheRead: it.cache_read_input_tokens,
              },
            },
          ]
        : [],
    );
  }
  return [{ model: response.model, usage: usageOf(response.usage) }];
}

/**
 * Runs `jobs` in parallel on the Messages API (standard price, ×2 worst case for a fallback).
 * Refuses to start if the worst case does not fit in the free budget.
 */
export async function runDirect(
  store: Store,
  jobs: Job[],
  effort: Effort,
  maxTokens: number,
  onResult: (job: Job, data: unknown, entry: LedgerEntry) => void,
): Promise<void> {
  const worst = jobs.reduce((sum, j) => sum + 2 * jobWorstCase(j, maxTokens, 1), 0);
  if (worst > store.freeMicro) throw new Error(`Direct worst case ${usd(worst)} > free budget ${usd(store.freeMicro)}`);
  console.log(`Direct: ${jobs.length} requests (worst case ${usd(worst)}).`);
  await Promise.all(
    jobs.map(async (job) => {
      const started = Date.now();
      const response = await api()
        .beta.messages.stream({
          model: MODEL,
          max_tokens: maxTokens,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: job.system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: job.user }],
          output_config: { effort, format: betaZodOutputFormat(job.schema) },
        })
        .finalMessage();
      const charges = chargesOf(response);
      const usage = charges.reduce<Usage>(
        (t, c) => ({
          input: t.input + c.usage.input,
          output: t.output + c.usage.output,
          cacheWrite: t.cacheWrite + c.usage.cacheWrite,
          cacheRead: t.cacheRead + c.usage.cacheRead,
        }),
        { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      );
      const outcome = parse(job, response);
      const entry: LedgerEntry = {
        at: new Date().toISOString(),
        id: job.id,
        kind: job.kind,
        mode: "direct",
        model: response.model,
        usage,
        thinking: thinkingOf(response.usage),
        costMicro: charges.reduce((sum, c) => sum + costOf(c.model, c.usage, 1), 0),
        outcome: outcome.ok ? "ok" : outcome.outcome,
        note: `${Math.round((Date.now() - started) / 1000)} s${outcome.ok ? "" : `, ${outcome.note}`}`,
      };
      store.state.ledger.push(entry);
      store.save();
      logEntry(entry);
      if (outcome.ok) onResult(job, outcome.data, entry);
    }),
  );
}
