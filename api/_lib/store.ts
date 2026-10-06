/**
 * Key-value store of the ledger: Upstash Redis (REST) when configured, otherwise an in-memory map
 * (local dev; lost on restart). Fake mode always uses memory so canned calls never touch real data.
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
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

class UpstashStore implements Store {
  readonly kind = "upstash";
  constructor(private readonly redis: Redis) {}

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
}

class MemoryStore implements Store {
  readonly kind = "memory";
  private readonly data = new Map<string, { value: number; expires?: number }>();

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
}

let memory: MemoryStore | undefined;
let upstash: UpstashStore | undefined;

export function getStore(): Store {
  const config = upstashConfig();
  if (!isFake() && config) {
    upstash ??= new UpstashStore(new Redis({ url: config.url, token: config.token }));
    return upstash;
  }
  memory ??= new MemoryStore();
  return memory;
}
