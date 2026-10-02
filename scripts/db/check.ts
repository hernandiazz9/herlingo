/**
 * `npm run db:check`: validates the Liga SQL on the local Postgres without touching anything else.
 *
 *   1. creates a throwaway database with a unique name (lang_lern_dbcheck_<time>_<random>);
 *   2. creates the roles anon/authenticated/service_role only if the cluster lacks them
 *      (and drops exactly those again at the end);
 *   3. applies scripts/db/auth-stub.sql (minimal `auth` schema + Supabase's default grants),
 *      every supabase/migrations/*.sql in order (one transaction each), then scripts/db/smoke.sql;
 *   4. drops the database, also when something failed.
 *
 * Connection: the usual libpq variables (PGHOST, PGPORT, PGUSER...; default = local socket).
 * The user must be allowed to create databases and roles and to SET ROLE (a local superuser).
 *   PSQL=/path/to/psql npm run db:check     # when psql is not on PATH
 *   DB_CHECK_ADMIN_DB=postgres               # database used to create/drop the throwaway one
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { devNull } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const STUB = join(ROOT, "scripts/db/auth-stub.sql");
const SMOKE = join(ROOT, "scripts/db/smoke.sql");
const ADMIN_DB = process.env.DB_CHECK_ADMIN_DB ?? "postgres";
const ROLES = ["anon", "authenticated", "service_role"];

function findPsql(): string {
  if (process.env.PSQL) return process.env.PSQL;
  const probe = spawnSync("psql", ["--version"], { encoding: "utf8" });
  if (probe.status === 0) return "psql";
  for (const p of ["/opt/homebrew/bin/psql", "/usr/local/bin/psql", "/usr/bin/psql"]) if (existsSync(p)) return p;
  console.error("psql not found: install Postgres or set PSQL=/path/to/psql.");
  process.exit(2);
}

const PSQL = findPsql();

interface Run {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function psql(db: string, args: string[]): Run {
  const r = spawnSync(PSQL, ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db, ...args], {
    encoding: "utf8",
    env: { ...process.env, PGOPTIONS: "--client-min-messages=notice", PGTZ: "UTC" },
  });
  if (r.error) return { ok: false, stdout: "", stderr: String(r.error) };
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function sql(db: string, command: string): Run {
  return psql(db, ["-At", "-c", command]);
}

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

const db = `lang_lern_dbcheck_${Date.now()}_${randomBytes(4).toString("hex")}`;
const createdRoles: string[] = [];
let failed = false;

function fail(step: string, r: Run): Error {
  failed = true;
  console.error(`✗ ${step}`);
  // Passed checks are noise here: show the error and its context only.
  const out = `${r.stdout}\n${r.stderr}`
    .split("\n")
    .filter((l) => l.trim() && !/NOTICE:\s+ok:/.test(l))
    .map((l) => `    ${l}`);
  if (out.length) console.error(out.join("\n"));
  return new Error(step);
}

const ready = sql(ADMIN_DB, "select 1");
if (!ready.ok) {
  fail(`connect to the local Postgres (database "${ADMIN_DB}")`, ready);
  process.exit(1);
}

const existing = sql(ADMIN_DB, `select rolname from pg_roles where rolname in (${ROLES.map((r) => `'${r}'`).join(",")})`);
if (!existing.ok) {
  fail("read roles", existing);
  process.exit(1);
}
const have = new Set(existing.stdout.split("\n").map((l) => l.trim()).filter(Boolean));
for (const role of ROLES) {
  if (have.has(role)) continue;
  const r = sql(ADMIN_DB, `create role ${ident(role)} nologin`);
  if (!r.ok) {
    fail(`create role ${role}`, r);
    process.exit(1);
  }
  createdRoles.push(role);
}

let checks = 0;
try {
  const created = sql(ADMIN_DB, `create database ${ident(db)}`);
  if (!created.ok) throw fail(`create database ${db}`, created);
  console.log(`• throwaway database ${db}`);

  const steps: { name: string; file: string; tx: boolean }[] = [
    { name: "auth stub", file: STUB, tx: true },
    ...readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => ({ name: `migration ${f}`, file: join(MIGRATIONS, f), tx: true })),
    { name: "smoke tests", file: SMOKE, tx: false },
  ];
  for (const step of steps) {
    const r = psql(db, [...(step.tx ? ["-1"] : []), "-o", devNull, "-f", step.file]);
    if (!r.ok) throw fail(step.name, r);
    const passed = r.stderr.split("\n").filter((l) => /NOTICE:\s+ok:/.test(l));
    checks += passed.length;
    console.log(`✓ ${step.name}${passed.length ? ` (${passed.length} checks)` : ""}`);
    if (process.env.DB_CHECK_VERBOSE) for (const l of passed) console.log(`    ${l.replace(/.*NOTICE:\s+ok:\s*/, "")}`);
  }
} catch {
  // reported by fail()
} finally {
  const dropped = sql(ADMIN_DB, `drop database if exists ${ident(db)} with (force)`);
  if (!dropped.ok) fail(`drop database ${db}`, dropped);
  for (const role of createdRoles) {
    const r = sql(ADMIN_DB, `drop role if exists ${ident(role)}`);
    if (!r.ok) fail(`drop role ${role}`, r);
  }
}

if (failed) process.exit(1);
console.log(`db:check passed: ${checks} checks, database dropped.`);
