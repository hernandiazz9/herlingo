/**
 * Everything a run keeps in the output folder (git-ignored): `state.json` (topic plan, batches,
 * cost ledger, Telegram log), `scripts/<id>.json` (one episode each), `clips/` (TTS cache) and
 * `mp3/`. Money: every response is billed from its `usage` with the prices of api/_lib/model.ts
 * (Message Batches: half price); a submitted batch reserves its worst case until it is collected,
 * so spent + reserved never goes over the cap.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { costMicroUsd, PRICES } from "../../api/_lib/model";
import type { ListeningEpisode, TopicIdea, Usage } from "./schema";

export const MODEL = "claude-opus-5-5";
/** Message Batches API: 50 % of standard prices on every token. */
export const BATCH_FACTOR = 0.5;

export interface LedgerEntry {
  at: string;
  /** Episode id, or `topics-<topic>`. */
  id: string;
  kind: "topics" | "episode";
  mode: "batch" | "direct";
  batchId?: string;
  model: string;
  usage: Usage;
  /** Reasoning tokens inside `usage.output`, when the API reports them. */
  thinking?: number;
  costMicro: number;
  outcome: "ok" | "refusal" | "max_tokens" | "invalid";
  note?: string;
}

export interface BatchRecord {
  id: string;
  kind: "topics" | "episode";
  customIds: string[];
  /** Worst case of the whole batch (every input token at cache-write price, every request at `max_tokens`). */
  reservedMicro: number;
  effort: string;
  maxTokens: number;
  createdAt: string;
  collectedAt?: string;
}

export interface State {
  version: 1;
  capUsd: number;
  topics: TopicIdea[];
  batches: BatchRecord[];
  ledger: LedgerEntry[];
  /** Episode id → ISO date it was sent to Telegram. */
  sent: Record<string, string>;
}

export class Store {
  readonly scriptsDir: string;
  readonly clipsDir: string;
  readonly mp3Dir: string;
  private readonly file: string;
  state: State;

  constructor(readonly dir: string, capUsd: number) {
    this.scriptsDir = join(dir, "scripts");
    this.clipsDir = join(dir, "clips");
    this.mp3Dir = join(dir, "mp3");
    for (const d of [dir, this.scriptsDir, this.clipsDir, this.mp3Dir]) mkdirSync(d, { recursive: true });
    this.file = join(dir, "state.json");
    this.state = existsSync(this.file)
      ? (JSON.parse(readFileSync(this.file, "utf8")) as State)
      : { version: 1, capUsd, topics: [], batches: [], ledger: [], sent: {} };
    this.save();
  }

  save(): void {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    renameSync(tmp, this.file);
  }

  get capMicro(): number {
    return Math.floor(this.state.capUsd * 1_000_000);
  }
  get spentMicro(): number {
    return this.state.ledger.reduce((sum, e) => sum + e.costMicro, 0);
  }
  get reservedMicro(): number {
    return this.state.batches.filter((b) => !b.collectedAt).reduce((sum, b) => sum + b.reservedMicro, 0);
  }
  /** What can still be reserved: cap − spent − reserved. */
  get freeMicro(): number {
    return this.capMicro - this.spentMicro - this.reservedMicro;
  }

  pendingIds(): Set<string> {
    return new Set(this.state.batches.filter((b) => !b.collectedAt).flatMap((b) => b.customIds));
  }

  scriptPath(id: string): string {
    return join(this.scriptsDir, `${id}.json`);
  }
  hasScript(id: string): boolean {
    return existsSync(this.scriptPath(id));
  }
  readEpisode(id: string): ListeningEpisode {
    return JSON.parse(readFileSync(this.scriptPath(id), "utf8")) as ListeningEpisode;
  }
  writeEpisode(episode: ListeningEpisode): void {
    const path = this.scriptPath(episode.id);
    writeFileSync(`${path}.tmp`, JSON.stringify(episode, null, 2));
    renameSync(`${path}.tmp`, path);
  }
  /** Every stored episode, in play order (`number`, then topic order). */
  episodes(): ListeningEpisode[] {
    const ids = readdirSync(this.scriptsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -5));
    return ids.map((id) => this.readEpisode(id)).sort(playOrder);
  }

  /** Failed attempts (billed, no script) per episode id. */
  failures(id: string): number {
    return this.state.ledger.filter((e) => e.id === id && e.outcome !== "ok").length;
  }

  /** The next ideas to write: no script, not pending, fewer than 2 failed attempts; interleaved by topic. */
  nextIdeas(count: number): TopicIdea[] {
    const pending = this.pendingIds();
    return [...this.state.topics]
      .sort(playOrder)
      .filter((t) => !this.hasScript(t.id) && !pending.has(t.id) && this.failures(t.id) < 2)
      .slice(0, count);
  }
}

const TOPIC_ORDER = ["interview", "work", "story"];
export function playOrder(a: { number: number; topic: string }, b: { number: number; topic: string }): number {
  return a.number - b.number || TOPIC_ORDER.indexOf(a.topic) - TOPIC_ORDER.indexOf(b.topic);
}

/** Actual cost of one response, rounded up; `factor` 0.5 for batch results. */
export function costOf(model: string, usage: Usage, factor: number): number {
  return Math.ceil(costMicroUsd(model, usage) * factor);
}

/**
 * Worst case of one request: its input (estimated generously at 3 characters per token) at the
 * cache-write price and `maxTokens` of output (thinking included), × `factor`.
 */
export function worstCaseMicro(model: string, inputChars: number, maxTokens: number, factor: number): number {
  const p = PRICES[model];
  if (!p) throw new Error(`No price for ${model} in api/_lib/model.ts`);
  const inputTokens = Math.ceil(inputChars / 3) + 100;
  return Math.ceil((inputTokens * Math.max(p.input, p.cacheWrite) + maxTokens * p.output) * factor);
}

export const usd = (micro: number) => `${(micro / 1_000_000).toFixed(2)} USD`;
