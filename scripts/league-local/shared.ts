/**
 * Shared pieces of the local fake Supabase (docs/league.md → "Try it locally"): the dedicated local
 * database, a psql runner with safe variables, and HS256 JWTs signed with a fixed local secret.
 * Only Node built-ins + `psql` (same as `npm run db:check`).
 */
import { spawn, spawnSync } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ROOT = process.cwd();
export const DB = "lang_lern_league_local";
export const PORT = Number(process.env.LEAGUE_LOCAL_PORT ?? 54321);
export const ADMIN_DB = process.env.DB_CHECK_ADMIN_DB ?? "postgres";
/** Local only, never used by a real project: the anon key below is derived from it. */
export const JWT_SECRET = "lang-lern-league-local-secret-not-for-production";
export const ACCESS_TOKEN_SECONDS = Number(process.env.LEAGUE_LOCAL_JWT_SECONDS ?? 3600);

const MIGRATIONS = join(ROOT, "supabase/migrations");
const STUB = join(ROOT, "scripts/db/auth-stub.sql");
const LOCAL_AUTH = join(ROOT, "scripts/league-local/local-auth.sql");
const ROLES = ["anon", "authenticated", "service_role"];
/** Values above this size are passed to psql through a temp file (see psql()). */
const BIG_VAR_BYTES = 64 * 1024;

function findPsql(): string {
  if (process.env.PSQL) return process.env.PSQL;
  const probe = spawnSync("psql", ["--version"], { encoding: "utf8" });
  if (probe.status === 0) return "psql";
  for (const p of ["/opt/homebrew/bin/psql", "/usr/local/bin/psql", "/usr/bin/psql"]) if (existsSync(p)) return p;
  console.error("psql not found: install Postgres or set PSQL=/path/to/psql.");
  process.exit(2);
}

const PSQL = findPsql();

export interface PsqlResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export interface PgError {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}

/**
 * Runs `script` on `db` through psql's stdin. Values go in as psql variables (`:'name'` in the
 * script is a safely quoted literal), never spliced into the SQL.
 */
export function psql(db: string, script: string, vars: Record<string, string> = {}): Promise<PsqlResult> {
  const args = ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-d", db];
  // Big values (a cloud save can be ~2 MiB) would overflow the command line (ARG_MAX): they go
  // through a temp file that psql reads with `\set name `cat file`` instead.
  let dir: string | null = null;
  let pre = "";
  for (const [k, v] of Object.entries(vars)) {
    if (Buffer.byteLength(v) <= BIG_VAR_BYTES) {
      args.push("-v", `${k}=${v}`);
      continue;
    }
    dir ??= mkdtempSync(join(tmpdir(), "lang-lern-psql-"));
    const file = join(dir, k);
    writeFileSync(file, v);
    pre += `\\set ${k} \`cat '${file}'\`\n`;
  }
  const cleanup = () => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  };
  return new Promise((resolve) => {
    const child = spawn(PSQL, args, { env: { ...process.env, PGTZ: "UTC" } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    child.on("error", (e) => {
      cleanup();
      resolve({ ok: false, stdout, stderr: `${stderr}${String(e)}` });
    });
    child.on("close", (code) => {
      cleanup();
      resolve({ ok: code === 0, stdout, stderr });
    });
    child.stdin.end(pre + script);
  });
}

/** The SQLSTATE error psql printed (`ERROR:  P0001: nickname_taken`), with DETAIL/HINT. */
export function pgError(stderr: string): PgError {
  const m = /ERROR:\s+([0-9A-Z]{5}):\s+(.*)/.exec(stderr);
  const detail = /DETAIL:\s+(.*)/.exec(stderr);
  const hint = /HINT:\s+(.*)/.exec(stderr);
  return {
    code: m?.[1] ?? "XX000",
    message: m?.[2]?.trim() ?? stderr.trim(),
    details: detail?.[1]?.trim() ?? null,
    hint: hint?.[1]?.trim() ?? null,
  };
}

/** Runs a script that must succeed; exits the process with the error otherwise. */
export async function mustRun(db: string, step: string, script: string, vars: Record<string, string> = {}) {
  const r = await psql(db, script, vars);
  if (!r.ok) {
    console.error(`✗ ${step}\n${r.stderr.trim()}`);
    process.exit(1);
  }
  return r.stdout;
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * Makes sure `lang_lern_league_local` exists with the auth stub, the local auth tables and every
 * migration (new migration files are applied on the next run). `reset` drops it first. Never
 * touches any other database; creates the API roles only if the cluster lacks them.
 */
export async function ensureDatabase(reset: boolean): Promise<void> {
  const ping = await psql(ADMIN_DB, "select 1;");
  if (!ping.ok) {
    console.error(`✗ connect to the local Postgres (database "${ADMIN_DB}")\n${ping.stderr.trim()}`);
    console.error("Start Postgres (default socket) or set PGHOST/PGPORT/PGUSER.");
    process.exit(1);
  }
  for (const role of ROLES) {
    await mustRun(
      ADMIN_DB,
      `role ${role}`,
      `select format('create role %I nologin', :'role') where not exists (select 1 from pg_roles where rolname = :'role') \\gexec\n`,
      { role },
    );
  }
  if (reset) {
    await mustRun(ADMIN_DB, `drop ${DB}`, `drop database if exists ${ident(DB)} with (force);`);
    console.log(`• dropped ${DB}`);
  }
  const exists = (await mustRun(ADMIN_DB, "find database", "select 1 from pg_database where datname = :'db';", { db: DB })).trim();
  if (!exists) {
    await mustRun(ADMIN_DB, `create ${DB}`, `create database ${ident(DB)};`);
    await mustRun(DB, "auth stub", `begin;\n${readFileSync(STUB, "utf8")}\ncommit;\n`);
    await mustRun(DB, "local auth tables", `begin;\n${readFileSync(LOCAL_AUTH, "utf8")}\ncommit;\n`);
    console.log(`• created ${DB} (auth stub + local auth tables)`);
  }
  const applied = new Set(
    (await mustRun(DB, "applied migrations", "select name from local_auth.migrations;")).split("\n").filter(Boolean),
  );
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    const body = readFileSync(join(MIGRATIONS, f), "utf8");
    await mustRun(DB, `migration ${f}`, `begin;\n${body}\n;\ninsert into local_auth.migrations (name) values (:'name');\ncommit;\n`, {
      name: f,
    });
    console.log(`• applied ${f}`);
  }
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export type JwtClaims = Record<string, string | number | boolean | null>;

export function signJwt(claims: JwtClaims): string {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export type JwtCheck = { ok: true; claims: JwtClaims } | { ok: false; reason: "invalid" | "expired" };

export function verifyJwt(token: string): JwtCheck {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [head, body, sig] = parts;
  const want = Buffer.from(createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url"));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, reason: "invalid" };
  let claims: JwtClaims;
  try {
    const header = JSON.parse(Buffer.from(head, "base64url").toString("utf8")) as { alg?: unknown };
    if (header.alg !== "HS256") return { ok: false, reason: "invalid" };
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as JwtClaims;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const exp = claims.exp;
  if (typeof exp === "number" && exp * 1000 < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, claims };
}

/** Stable local anon key (same value on every machine, like `supabase start`'s demo keys). */
export const ANON_KEY = signJwt({ iss: "supabase-local", role: "anon", iat: 1759276800, exp: 2074636800 });

export const LOCAL_URL = `http://localhost:${PORT}`;
export const ISSUER = `${LOCAL_URL}/auth/v1`;

/** `--reset` as an argument (`npm run x -- --reset`) or swallowed by npm (`npm run x --reset`). */
export function wantsReset(): boolean {
  return process.argv.includes("--reset") || process.env.npm_config_reset === "true";
}

/** Every lang with content (`content/<lang>/pack.json`): the seed fills each one. */
export function contentLangs(): string[] {
  const dir = join(ROOT, "content");
  return readdirSync(dir).filter((d) => existsSync(join(dir, d, "pack.json")));
}
