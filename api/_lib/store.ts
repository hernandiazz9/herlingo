/**
 * Key-value store of the ledger (numbers) and of Mi entrevista's deck (one JSON string): Upstash
 * Redis (REST) when configured, otherwise an in-memory map (local dev; lost on restart). Fake mode
 * always uses memory so canned calls never touch real data.
 */
import { Redis } from "@upstash/redis";
import { isFake, upstashConfig } from "./config.js";

export interface Store {
  readonly kind: "upstash" | "memory";
  incrby(key: string, by: number, ttlSeconds?: number): Promise<number>;
  get(key: string): Promise<number | null>;
  mget(keys: string[]): Promise<(number | null)[]>;
  /** Overwrites `key`; with `ttlSeconds` it expires like an `incrby` counter. */
  set(key: string, value: number, ttlSeconds?: number): Promise<void>;
  /** A string value stored as is (a JSON document such as the interview deck); null when absent. */
  getText(key: string): Promise<string | null>;
  /** Overwrites `key` with `value`, no expiry. */
  setText(key: string, value: string): Promise<void>;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

class UpstashStore implements Store {
  readonly kind = "upstash";
  /** `raw` skips the client's JSON parsing, so `getText` returns the stored string untouched. */
  constructor(
    private readonly redis: Redis,
    private readonly raw: Redis,
  ) {}

  async incrby(key: string, by: number, ttlSeconds?: number) {
    const value = await this.redis.incrby(key, by);
    if (ttlSeconds && value === by) await this.redis.expire(key, ttlSeconds);
    return value;
  }
  async get(key: string) {
    return toNumber(await this.redis.get(key));
  }
  async mget(keys: string[]) {
    if (keys.length === 0) return [];
    return (await this.redis.mget<unknown[]>(...keys)).map(toNumber);
  }
  async set(key: string, value: number, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(key, value, { ex: ttlSeconds });
    else await this.redis.set(key, value);
  }
  async getText(key: string) {
    const value = await this.raw.get<string>(key);
    return value === null || value === undefined ? null : String(value);
  }
  async setText(key: string, value: string) {
    await this.raw.set(key, value);
  }
}

class MemoryStore implements Store {
  readonly kind = "memory";
  private readonly data = new Map<string, { value: number; expires?: number }>();
  private readonly texts = new Map<string, string>();

  private read(key: string) {
    const entry = this.data.get(key);
    if (entry?.expires && entry.expires < Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }
  async incrby(key: string, by: number, ttlSeconds?: number) {
    const entry = this.read(key);
    const value = (entry?.value ?? 0) + by;
    this.data.set(key, { value, expires: entry?.expires ?? (ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined) });
    return value;
  }
  async get(key: string) {
    return this.read(key)?.value ?? null;
  }
  async mget(keys: string[]) {
    return Promise.all(keys.map((k) => this.get(k)));
  }
  async set(key: string, value: number, ttlSeconds?: number) {
    this.data.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
  }
  async getText(key: string) {
    return this.texts.get(key) ?? null;
  }
  async setText(key: string, value: string) {
    this.texts.set(key, value);
  }
}

let memory: MemoryStore | undefined;
let upstash: UpstashStore | undefined;

export function getStore(): Store {
  const config = upstashConfig();
  if (!isFake() && config) {
    upstash ??= new UpstashStore(
      new Redis({ url: config.url, token: config.token }),
      new Redis({ url: config.url, token: config.token, automaticDeserialization: false }),
    );
    return upstash;
  }
  memory ??= new MemoryStore();
  return memory;
}
