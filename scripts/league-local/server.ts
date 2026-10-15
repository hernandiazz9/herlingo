/**
 * The local fake Supabase: just the endpoints `@supabase/supabase-js` calls for Liga
 * (src/lib/league/client.ts, account.ts), backed by `herlingo_league_local`.
 *
 *   Auth (GoTrue-shaped): POST /auth/v1/signup (anonymous), POST /auth/v1/token?grant_type=refresh_token,
 *   GET|PUT /auth/v1/user, POST /auth/v1/otp, GET /auth/v1/verify, POST /auth/v1/logout, GET /auth/v1/settings.
 *   REST (PostgREST-shaped): POST /rest/v1/rpc/league_* run as role `authenticated` (or `anon`)
 *   with the JWT claims set like PostgREST does.
 *
 * No email is ever sent: magic links are printed to the console (open them by hand).
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { ACCESS_TOKEN_SECONDS, ANON_KEY, DB, ISSUER, LOCAL_URL, pgError, psql, signJwt, verifyJwt, type JwtClaims } from "./shared";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface Reply {
  status: number;
  body?: Json;
  headers?: Record<string, string>;
}

interface AuthUser {
  id: string;
  email: string;
  is_anonymous: boolean;
  created_at: string;
  new_email: string | null;
}

const MAX_BODY = 4_000_000; // room for a cloud save just over its 2 MiB cap (save_too_large)
const DEFAULT_REDIRECT = "http://localhost:3000/liga/";
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const token = () => randomBytes(24).toString("hex");

function authError(status: number, errorCode: string, msg: string): Reply {
  return { status, body: { code: status, error_code: errorCode, msg } };
}

function restError(status: number, code: string, message: string, details: string | null = null, hint: string | null = null): Reply {
  return { status, body: { code, details, hint, message } };
}

async function readBody(req: IncomingMessage): Promise<Json | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const b = chunk as Buffer;
    size += b.length;
    if (size > MAX_BODY) throw new Error("body_too_large");
    chunks.push(b);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return undefined;
  return JSON.parse(text) as Json;
}

function asObject(v: Json | undefined): Record<string, Json> {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function bearer(req: IncomingMessage): string | null {
  const h = req.headers.authorization;
  const m = typeof h === "string" ? /^Bearer\s+(.+)$/i.exec(h) : null;
  return m ? m[1].trim() : null;
}

function safeRedirect(raw: string | null): string {
  if (!raw) return DEFAULT_REDIRECT;
  try {
    const u = new URL(raw);
    return LOCAL_ORIGIN.test(u.origin) ? u.toString() : DEFAULT_REDIRECT;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

async function query(script: string, vars: Record<string, string> = {}): Promise<string> {
  const r = await psql(DB, script, vars);
  if (!r.ok) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}

const USER_JSON = `json_build_object(
  'id', u.id, 'email', coalesce(u.email, ''), 'is_anonymous', u.is_anonymous, 'created_at', u.created_at,
  'new_email', (select l.email from local_auth.links l
                where l.user_id = u.id and l.kind = 'email_change' and not l.used and l.expires_at > now()
                order by l.created_at desc limit 1))`;

async function loadUser(id: string): Promise<AuthUser | null> {
  const out = await query(`select ${USER_JSON} from auth.users u where u.id = :'id'::uuid;`, { id });
  return out ? (JSON.parse(out) as AuthUser) : null;
}

function userBody(u: AuthUser): Json {
  const provider = u.is_anonymous ? "anonymous" : "email";
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    phone: "",
    ...(u.new_email ? { new_email: u.new_email, email_change_sent_at: new Date().toISOString() } : {}),
    ...(u.email ? { email_confirmed_at: u.created_at, confirmed_at: u.created_at } : {}),
    app_metadata: { provider, providers: [provider] },
    user_metadata: {},
    identities: [],
    is_anonymous: u.is_anonymous,
    created_at: u.created_at,
    updated_at: new Date().toISOString(),
  };
}

interface Session {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: Json;
}

async function issueSession(user: AuthUser, sessionId: string = randomUUID()): Promise<Session> {
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    iss: ISSUER,
    sub: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    is_anonymous: user.is_anonymous,
    session_id: sessionId,
    iat: now,
    exp: now + ACCESS_TOKEN_SECONDS,
  };
  const refresh = token();
  await query("insert into local_auth.refresh_tokens (token, user_id, session_id) values (:'t', :'u'::uuid, :'s'::uuid);", {
    t: refresh,
    u: user.id,
    s: sessionId,
  });
  return {
    access_token: signJwt(claims),
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_SECONDS,
    expires_at: now + ACCESS_TOKEN_SECONDS,
    refresh_token: refresh,
    user: userBody(user),
  };
}

const sessionJson = (s: Session): Json => ({ ...s });

/** The signed-in user of a request (user JWT), or an auth error reply. */
async function requireUser(req: IncomingMessage): Promise<{ user: AuthUser; claims: JwtClaims } | Reply> {
  const jwt = bearer(req);
  if (!jwt) return authError(401, "no_authorization", "This endpoint requires a Bearer token");
  const check = verifyJwt(jwt);
  if (!check.ok) return authError(403, "bad_jwt", `invalid JWT: ${check.reason}`);
  const sub = check.claims.sub;
  if (typeof sub !== "string") return authError(403, "bad_jwt", "invalid claim: missing sub claim");
  const user = await loadUser(sub);
  if (!user) return authError(403, "user_not_found", "User from sub claim in JWT does not exist");
  return { user, claims: check.claims };
}

function printLink(kind: string, email: string, url: string) {
  if (process.env.LEAGUE_LOCAL_QUIET === "1") return;
  console.log(`\n✉  ${kind} for ${email} (not sent, open it by hand):\n   ${url}\n`);
}

async function createLink(userId: string, kind: "magiclink" | "email_change", email: string, redirectTo: string): Promise<string> {
  const t = token();
  await query(
    "insert into local_auth.links (token, user_id, kind, email, redirect_to) values (:'t', :'u'::uuid, :'k', :'e', :'r');",
    { t, u: userId, k: kind, e: email, r: redirectTo },
  );
  const url = `${LOCAL_URL}/auth/v1/verify?token=${t}&type=${kind}&redirect_to=${encodeURIComponent(redirectTo)}`;
  printLink(kind === "magiclink" ? "Magic link" : "Email change link", email, url);
  return url;
}

async function findUserByEmail(email: string): Promise<string | null> {
  const id = await query("select id from auth.users where lower(email) = lower(:'e') limit 1;", { e: email });
  return id || null;
}

async function handleAuth(req: IncomingMessage, url: URL, path: string): Promise<Reply> {
  const method = req.method ?? "GET";

  if (path === "/settings" && method === "GET") {
    return {
      status: 200,
      body: { external: { anonymous_users: true, email: true }, disable_signup: false, mailer_autoconfirm: false },
    };
  }

  if (path === "/signup" && method === "POST") {
    const body = asObject(await readBody(req));
    if (typeof body.email === "string" || typeof body.phone === "string") {
      return authError(422, "signup_disabled", "Signups with email or phone are not supported by the local fake Supabase");
    }
    const id = randomUUID();
    await query("insert into auth.users (id, is_anonymous) values (:'id'::uuid, true);", { id });
    const user = await loadUser(id);
    if (!user) return authError(500, "unexpected_failure", "user not created");
    if (process.env.LEAGUE_LOCAL_QUIET !== "1") console.log(`+ anonymous user ${id}`);
    return { status: 200, body: sessionJson(await issueSession(user)) };
  }

  if (path === "/token" && method === "POST") {
    if (url.searchParams.get("grant_type") !== "refresh_token") {
      return authError(400, "unsupported_grant_type", "Only grant_type=refresh_token is supported locally");
    }
    const body = asObject(await readBody(req));
    const refresh = typeof body.refresh_token === "string" ? body.refresh_token : "";
    const row = await query(
      `update local_auth.refresh_tokens set revoked = true
       where token = :'t' and not revoked returning json_build_object('user_id', user_id, 'session_id', session_id);`,
      { t: refresh },
    );
    if (!row) return authError(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
    const { user_id, session_id } = JSON.parse(row) as { user_id: string; session_id: string };
    const user = await loadUser(user_id);
    if (!user) return authError(400, "user_not_found", "User not found");
    return { status: 200, body: sessionJson(await issueSession(user, session_id)) };
  }

  if (path === "/user" && (method === "GET" || method === "PUT")) {
    const who = await requireUser(req);
    if ("status" in who) return who;
    if (method === "GET") return { status: 200, body: userBody(who.user) };
    const body = asObject(await readBody(req));
    if (typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();
      if (!EMAIL.test(email)) return authError(400, "validation_failed", "Unable to validate email address: invalid format");
      if (email !== who.user.email.toLowerCase()) {
        const owner = await findUserByEmail(email);
        if (owner && owner !== who.user.id) {
          return authError(422, "email_exists", "A user with this email address has already been registered");
        }
        await createLink(who.user.id, "email_change", email, safeRedirect(url.searchParams.get("redirect_to")));
      }
    }
    const user = await loadUser(who.user.id);
    return { status: 200, body: user ? userBody(user) : null };
  }

  if (path === "/otp" && method === "POST") {
    const body = asObject(await readBody(req));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL.test(email)) return authError(400, "validation_failed", "Unable to validate email address: invalid format");
    const owner = await findUserByEmail(email);
    if (!owner) {
      if (body.create_user === false) return authError(422, "otp_disabled", "Signups not allowed for otp");
      return authError(422, "signup_disabled", "Email signups are not supported by the local fake Supabase");
    }
    await createLink(owner, "magiclink", email, safeRedirect(url.searchParams.get("redirect_to")));
    return { status: 200, body: {} };
  }

  if (path === "/verify" && method === "GET") {
    const t = url.searchParams.get("token") ?? "";
    const row = await query(
      `update local_auth.links set used = true
       where token = :'t' and not used and expires_at > now()
       returning json_build_object('user_id', user_id, 'kind', kind, 'email', email, 'redirect_to', redirect_to);`,
      { t },
    );
    if (!row) {
      const fallback = safeRedirect(url.searchParams.get("redirect_to"));
      const params = new URLSearchParams({
        error: "access_denied",
        error_code: "otp_expired",
        error_description: "Email link is invalid or has expired",
      });
      return { status: 303, headers: { location: `${fallback}#${params}` } };
    }
    const link = JSON.parse(row) as { user_id: string; kind: string; email: string; redirect_to: string };
    if (link.kind === "email_change") {
      await query("update auth.users set email = :'e', is_anonymous = false where id = :'u'::uuid;", {
        e: link.email,
        u: link.user_id,
      });
      await query("update local_auth.links set used = true where user_id = :'u'::uuid and kind = 'email_change';", { u: link.user_id });
    }
    const user = await loadUser(link.user_id);
    if (!user) return authError(404, "user_not_found", "User not found");
    const s = await issueSession(user);
    const params = new URLSearchParams({
      access_token: s.access_token,
      expires_at: String(s.expires_at),
      expires_in: String(s.expires_in),
      refresh_token: s.refresh_token,
      token_type: "bearer",
      type: link.kind,
    });
    if (process.env.LEAGUE_LOCAL_QUIET !== "1") console.log(`✓ ${link.kind} used by ${link.email}`);
    return { status: 303, headers: { location: `${link.redirect_to}#${params}` } };
  }

  if (path === "/logout" && method === "POST") {
    const jwt = bearer(req);
    const check = jwt ? verifyJwt(jwt) : null;
    if (!check?.ok) return { status: 204 };
    const scope = url.searchParams.get("scope") ?? "global";
    const sub = String(check.claims.sub ?? "");
    const sid = String(check.claims.session_id ?? "");
    if (scope === "local") {
      await query("update local_auth.refresh_tokens set revoked = true where session_id = :'s'::uuid;", { s: sid });
    } else if (scope === "others") {
      await query("update local_auth.refresh_tokens set revoked = true where user_id = :'u'::uuid and session_id <> :'s'::uuid;", {
        u: sub,
        s: sid,
      });
    } else {
      await query("update local_auth.refresh_tokens set revoked = true where user_id = :'u'::uuid;", { u: sub });
    }
    return { status: 204 };
  }

  return authError(404, "not_found", `${method} /auth/v1${path} is not implemented by the local fake Supabase`);
}

interface FnInfo {
  retset: boolean;
  args: { name: string; type: string }[];
}

const fnCache = new Map<string, FnInfo | null>();

async function fnInfo(fn: string): Promise<FnInfo | null> {
  if (fnCache.has(fn)) return fnCache.get(fn) ?? null;
  const out = await query(
    `select json_build_object(
       'retset', p.proretset,
       'args', coalesce((select json_agg(json_build_object('name', a.n, 'type', format_type(a.t, null)) order by a.i)
                         from unnest(p.proargnames[1:p.pronargs], p.proargtypes::oid[]) with ordinality as a(n, t, i)), '[]'))
     from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = :'fn' limit 1;`,
    { fn },
  );
  const info = out ? (JSON.parse(out) as FnInfo) : null;
  fnCache.set(fn, info);
  return info;
}

async function handleRpc(req: IncomingMessage, fn: string): Promise<Reply> {
  if (req.method !== "POST") return restError(405, "PGRST117", `Unsupported HTTP method: ${req.method}`);
  const jwt = bearer(req) ?? (typeof req.headers.apikey === "string" ? req.headers.apikey : null);
  if (!jwt) return restError(401, "PGRST301", "No API key found in request");
  const check = verifyJwt(jwt);
  if (!check.ok) {
    return check.reason === "expired"
      ? restError(401, "PGRST303", "JWT expired")
      : restError(401, "PGRST301", "JWSError JWSInvalidSignature");
  }
  const role = check.claims.role === "authenticated" ? "authenticated" : "anon";

  const info = /^league_[a-z_]+$/.test(fn) ? await fnInfo(fn) : null;
  const body = asObject(await readBody(req));
  const keys = Object.keys(body);
  if (!info || keys.some((k) => !info.args.some((a) => a.name === k))) {
    return restError(404, "PGRST202", `Could not find the function public.${fn}(${keys.join(", ")}) in the schema cache`);
  }

  const vars: Record<string, string> = { claims: JSON.stringify(check.claims), sub: String(check.claims.sub ?? ""), role };
  const named = info.args
    .filter((a) => keys.includes(a.name))
    .map((a, i) => {
      const v = body[a.name];
      if (v === null) return `"${a.name}" => null::${a.type}`;
      vars[`a${i}`] = typeof v === "string" && a.type !== "jsonb" && a.type !== "json" ? v : JSON.stringify(v);
      return `"${a.name}" => :'a${i}'::${a.type}`;
    })
    .join(", ");
  const call = `public."${fn}"(${named})`;
  const select = info.retset
    ? `select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from ${call} as r;`
    : `select to_jsonb(${call});`;
  const script = `begin;
\\o /dev/null
select set_config('request.jwt.claims', :'claims', true), set_config('request.jwt.claim.sub', :'sub', true),
       set_config('request.jwt.claim.role', :'role', true);
set local role ${role};
\\o
${select}
commit;
`;
  const r = await psql(DB, script, vars);
  if (!r.ok) {
    const e = pgError(r.stderr);
    const status = e.code === "42501" ? (role === "anon" ? 401 : 403) : e.code === "42883" ? 404 : e.code.startsWith("XX") ? 500 : 400;
    return restError(status, e.code, e.message, e.details, e.hint);
  }
  const out = r.stdout.trim();
  return { status: 200, body: out ? (JSON.parse(out) as Json) : null };
}

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && LOCAL_ORIGIN.test(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    const asked = req.headers["access-control-request-headers"];
    res.setHeader(
      "access-control-allow-headers",
      typeof asked === "string" ? asked : "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    );
    res.setHeader("access-control-expose-headers", "content-range, x-supabase-api-version");
    res.setHeader("access-control-max-age", "600");
  }
}

async function route(req: IncomingMessage): Promise<Reply> {
  const url = new URL(req.url ?? "/", LOCAL_URL);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/health") return { status: 200, body: { name: "herlingo league local", anon_key: ANON_KEY } };
  if (path.startsWith("/auth/v1/")) {
    if (path !== "/auth/v1/verify" && !req.headers.apikey) {
      return { status: 401, body: { message: "No API key found in request" } };
    }
    return handleAuth(req, url, path.slice("/auth/v1".length));
  }
  const rpc = /^\/rest\/v1\/rpc\/([A-Za-z0-9_]+)$/.exec(path);
  if (rpc) return handleRpc(req, rpc[1]);
  if (path.startsWith("/rest/v1/")) return restError(404, "PGRST205", "Only /rest/v1/rpc/league_* is available locally");
  return { status: 404, body: { message: "not found" } };
}

export function createLeagueServer(): Server {
  return createServer((req, res) => {
    cors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    const started = Date.now();
    route(req)
      .catch((error: unknown): Reply => {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "body_too_large") return { status: 413, body: { message: "Payload too large" } };
        if (error instanceof SyntaxError) return restError(400, "PGRST102", "Empty or invalid json");
        console.error(`! ${req.method} ${req.url}: ${message}`);
        return { status: 500, body: { message } };
      })
      .then((reply) => {
        const headers: Record<string, string> = { ...reply.headers };
        if (reply.body !== undefined) headers["content-type"] = "application/json; charset=utf-8";
        res.writeHead(reply.status, headers);
        res.end(reply.body !== undefined ? JSON.stringify(reply.body) : undefined);
        if (process.env.LEAGUE_LOCAL_QUIET !== "1") {
          const path = (req.url ?? "").split("?")[0];
          console.log(`  ${req.method} ${path} → ${reply.status} (${Date.now() - started} ms)`);
        }
      });
  });
}
