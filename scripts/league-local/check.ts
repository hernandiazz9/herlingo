/**
 * `npm run league:local:check`: proves the local fake Supabase end to end over HTTP with two
 * throwaway users (like supabase-js would call it): CORS, anonymous sign-up, refresh, get user,
 * set_profile, record_xp (duplicate/cap/future), groups, leaderboards, league_me, the multi-group
 * RPCs (league_status, league_ranking, league_podium, leave by code, group limit), email linking
 * through the printed magic link, sign in by email, sign-out, delete_me. Starts its own server on a
 * free port against `lang_lern_league_local` (created if missing) and removes its users at the end.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { ANON_KEY, contentLangs, DB, ensureDatabase, mustRun, ROOT, signJwt } from "./shared";
import { createLeagueServer } from "./server";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface Res {
  status: number;
  body: Json;
  headers: Headers;
}

interface Session {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; is_anonymous: boolean; new_email?: string };
}

interface Status {
  weekly_xp: number;
  streak: number;
  max_groups: number;
  groups: { code: string; members: number; rank: number }[];
  rank: { global: number | null };
}

interface Row {
  rank: number;
  nickname: string;
  weekly_xp: number;
  is_me: boolean;
}

let base = "";
let passed = 0;
const users: string[] = [];

function ok(cond: boolean, what: string, detail?: unknown) {
  if (!cond) {
    console.error(`✗ ${what}${detail === undefined ? "" : `\n  ${JSON.stringify(detail)}`}`);
    throw new Error(what);
  }
  passed++;
  console.log(`✓ ${what}`);
}

async function call(method: string, path: string, opts: { token?: string; body?: Json; headers?: Record<string, string> } = {}): Promise<Res> {
  const res = await fetch(`${base}${path}`, {
    method,
    redirect: "manual",
    headers: {
      apikey: ANON_KEY,
      authorization: `Bearer ${opts.token ?? ANON_KEY}`,
      "content-type": "application/json",
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as Json) : null, headers: res.headers };
}

const rpc = (fn: string, token: string, body: Json = {}) => call("POST", `/rest/v1/rpc/${fn}`, { token, body });

async function signUp(): Promise<Session> {
  const r = await call("POST", "/auth/v1/signup", { body: { data: {} } });
  const s = r.body as unknown as Session;
  users.push(s.user.id);
  return s;
}

const event = (lang: string, amount: number, at = new Date()) => ({
  id: randomUUID(),
  lang,
  amount,
  source: "lesson",
  earned_at: at.toISOString(),
});

async function run(lang: string) {
  const tag = randomUUID().slice(0, 4);

  const pre = await fetch(`${base}/rest/v1/rpc/league_me`, {
    method: "OPTIONS",
    headers: { origin: "http://localhost:3000", "access-control-request-headers": "authorization,apikey,content-type,x-client-info" },
  });
  ok(
    pre.status === 204 && pre.headers.get("access-control-allow-origin") === "http://localhost:3000",
    "CORS preflight from localhost:3000",
  );

  const anon = await rpc("league_me", ANON_KEY, { lang });
  ok(anon.status === 401 && (anon.body as { code: string }).code === "42501", "anon key alone cannot call RPCs (401)", anon);

  let a = await signUp();
  const b = await signUp();
  ok(Boolean(a.access_token && a.refresh_token && a.user.is_anonymous), "anonymous sign-up returns a session");

  const me = await call("GET", "/auth/v1/user", { token: a.access_token });
  ok(me.status === 200 && (me.body as { id: string }).id === a.user.id, "GET /auth/v1/user");

  const refreshed = await call("POST", "/auth/v1/token?grant_type=refresh_token", { body: { refresh_token: a.refresh_token } });
  const reused = await call("POST", "/auth/v1/token?grant_type=refresh_token", { body: { refresh_token: a.refresh_token } });
  ok(refreshed.status === 200 && reused.status === 400, "refresh token rotates (old one rejected)", reused.body);
  a = refreshed.body as unknown as Session;

  const expired = signJwt({ sub: a.user.id, role: "authenticated", exp: Math.floor(Date.now() / 1000) - 10 });
  const exp = await rpc("league_me", expired, { lang });
  ok(exp.status === 401 && (exp.body as { code: string }).code === "PGRST303", "expired JWT → 401 PGRST303");

  const nickA = `Check A ${tag}`;
  const nickB = `Check B ${tag}`;
  const pa = await rpc("league_set_profile", a.access_token, { nickname: nickA, emoji: "🍋" });
  const pb = await rpc("league_set_profile", b.access_token, { nickname: nickB, emoji: "🐬" });
  ok(pa.status === 200 && (pa.body as { nickname: string }).nickname === nickA && pb.status === 200, "both users join (set_profile)");

  const taken = await rpc("league_set_profile", b.access_token, { nickname: nickA.toUpperCase(), emoji: "🐬" });
  ok(taken.status === 400 && (taken.body as { code: string; message: string }).message === "nickname_taken", "nickname_taken as P0001", taken);

  const unknownArg = await rpc("league_me", a.access_token, { lang, nope: 1 });
  ok(unknownArg.status === 404 && (unknownArg.body as { code: string }).code === "PGRST202", "unknown argument → 404 PGRST202");

  const e1 = event(lang, 40);
  const xa = await rpc("league_record_xp", a.access_token, {
    events: [e1, e1, event(lang, 500), event(lang, 10, new Date(Date.now() + 3_600_000))],
    stats: { lang, total_xp: 1234, streak_count: 3, streak_best: 9 },
  });
  const statuses = ((xa.body as { results: { status: string }[] }).results ?? []).map((r) => r.status);
  ok(
    xa.status === 200 && statuses.join() === "accepted,duplicate,too_big,future",
    "record_xp: accepted, duplicate, too_big, future",
    xa.body,
  );
  const xb = await rpc("league_record_xp", b.access_token, { events: [event(lang, 25)] });
  ok(xb.status === 200 && (xb.body as { xp_added: number }).xp_added === 25, "record_xp for the second user");

  const g = await rpc("league_create_group", a.access_token, { name: `Check ${tag}` });
  const code = (g.body as { code: string }).code;
  const j = await rpc("league_join_group", b.access_token, { code });
  ok(g.status === 200 && j.status === 200 && (j.body as { members: number }).members === 2, `group created and joined (${code})`);

  const global = await rpc("league_leaderboard", a.access_token, { lang, scope: "global" });
  const rows = global.body as unknown as Row[];
  const rowA = rows.find((r) => r.nickname === nickA);
  const rowB = rows.find((r) => r.nickname === nickB);
  ok(
    rowA?.weekly_xp === 40 && rowA.is_me && rowB?.weekly_xp === 25 && !rowB.is_me,
    "global leaderboard has both users with their weekly XP",
    rows,
  );
  const group = await rpc("league_leaderboard", b.access_token, { lang, scope: "group" });
  const grows = group.body as unknown as Row[];
  ok(grows.length === 2 && grows[0].nickname === nickA && grows[1].is_me, "group leaderboard (2 members, ordered)", grows);

  const podium = await rpc("league_last_week_podium", a.access_token, { lang });
  ok(podium.status === 200 && Array.isArray(podium.body), "last week podium");

  const meA = await rpc("league_me", a.access_token, { lang });
  const meBody = meA.body as { weekly_xp: number; group: { code: string } | null; rank: { group: number | null } };
  ok(meBody.weekly_xp === 40 && meBody.group?.code === code && meBody.rank.group === 1, "league_me", meA.body);

  // Multi-language, multi-group RPCs (docs/league.md, 2026-10-06).
  const other = lang === "fr" ? "it" : "fr";
  const xo = await rpc("league_record_xp", a.access_token, {
    events: [event(other, 15)],
    stats: { lang: other, total_xp: 15, streak_count: 6, streak_best: 6 },
  });
  ok(xo.status === 200 && (xo.body as { xp_added: number }).xp_added === 15, `record_xp in a second language (${other})`);

  const status = async (token: string) => (await rpc("league_status", token)).body as unknown as Status;
  let st = await status(a.access_token);
  ok(
    st.weekly_xp === 55 && st.streak === 6 && st.groups.length === 1 && st.groups[0].code === code && st.groups[0].rank === 1,
    `league_status: weekly XP summed (${lang} + ${other}), streak = max, groups`,
    st,
  );
  const ranking = (await rpc("league_ranking", a.access_token, { scope: "global" })).body as unknown as Row[];
  const oldBoard = (await rpc("league_leaderboard", a.access_token, { lang: other, scope: "global" })).body as unknown as Row[];
  const myRow = ranking.find((r) => r.is_me);
  ok(
    myRow?.weekly_xp === 55 && oldBoard.find((r) => r.is_me)?.weekly_xp === 55 && st.rank.global === myRow.rank,
    "league_ranking(global) and the old leaderboard both sum the languages",
  );
  const oldMe = (await rpc("league_me", a.access_token, { lang })).body as { weekly_xp: number; group: { code: string } | null };
  ok(oldMe.weekly_xp === 55 && oldMe.group?.code === code, "old league_me: summed weekly XP, earliest group", oldMe);

  const g2 = await rpc("league_create_group", a.access_token, { name: `Check2 ${tag}` });
  const code2 = (g2.body as { code: string }).code;
  st = await status(a.access_token);
  ok(g2.status === 200 && st.groups.map((x) => x.code).join() === `${code},${code2}`, "a second group without leaving the first", st);
  const gr = await rpc("league_ranking", a.access_token, { scope: "group", code: code2 });
  ok(gr.status === 200 && (gr.body as unknown as Row[]).length === 1, "league_ranking(group, code)");
  const notIn = await rpc("league_ranking", b.access_token, { scope: "group", code: code2 });
  ok(
    notIn.status === 400 && (notIn.body as { message: string }).message === "not_in_group",
    "ranking of someone else's group → not_in_group",
    notIn.body,
  );
  const pod = await rpc("league_podium", a.access_token, { scope: "group", code });
  const podGlobal = await rpc("league_podium", a.access_token, {});
  ok(
    pod.status === 200 && Array.isArray(pod.body) && podGlobal.status === 200 && Array.isArray(podGlobal.body),
    "league_podium (group and global)",
  );
  const left = await rpc("league_leave_group", a.access_token, { code: code2 });
  st = await status(a.access_token);
  ok(left.body === true && st.groups.length === 1 && st.groups[0].code === code, "leave one group by code");

  for (let i = st.groups.length; i < st.max_groups; i++) {
    const r = await rpc("league_create_group", a.access_token, { name: `Check ${tag} ${i}` });
    if (r.status !== 200) ok(false, `create group ${i + 1}`, r.body);
  }
  const tooMany = await rpc("league_create_group", a.access_token, { name: `Check ${tag} extra` });
  st = await status(a.access_token);
  ok(
    st.groups.length === st.max_groups && tooMany.status === 400 && (tooMany.body as { message: string }).message === "too_many_groups",
    `${st.max_groups} groups at once, one more → too_many_groups`,
    tooMany.body,
  );

  const email = `check-${tag}@example.test`;
  const upd = await call("PUT", `/auth/v1/user?redirect_to=${encodeURIComponent("http://localhost:3000/liga/")}`, {
    token: a.access_token,
    body: { email },
  });
  ok(upd.status === 200 && (upd.body as { new_email: string }).new_email === email, "link email: pending new_email");

  const linkToken = (
    await mustRun(DB, "read link", "select token from local_auth.links where email = :'e' and not used;", { e: email })
  ).trim();
  const verify = await call("GET", `/auth/v1/verify?token=${linkToken}&type=email_change&redirect_to=x`);
  const location = verify.headers.get("location") ?? "";
  const fragment = new URLSearchParams(location.split("#")[1] ?? "");
  ok(verify.status === 303 && location.startsWith("http://localhost:3000/liga/#") && fragment.has("access_token"), "magic link redirects to /liga/#access_token=…");
  const linked = await call("GET", "/auth/v1/user", { token: fragment.get("access_token") ?? "" });
  ok((linked.body as { email: string; is_anonymous: boolean }).email === email && !(linked.body as { is_anonymous: boolean }).is_anonymous, "email linked");

  const again = await call("GET", `/auth/v1/verify?token=${linkToken}&type=email_change&redirect_to=${encodeURIComponent("http://localhost:3000/liga/")}`);
  ok((again.headers.get("location") ?? "").includes("error_code=otp_expired"), "used link → otp_expired");

  const otp = await call("POST", "/auth/v1/otp", { body: { email, create_user: false } });
  const otpUnknown = await call("POST", "/auth/v1/otp", { body: { email: `nobody-${tag}@example.test`, create_user: false } });
  ok(
    otp.status === 200 && otpUnknown.status === 422 && (otpUnknown.body as { error_code: string }).error_code === "otp_disabled",
    "sign in with email: known → 200, unknown → otp_disabled",
  );

  const out = await call("POST", "/auth/v1/logout?scope=local", { token: a.access_token });
  const afterOut = await call("POST", "/auth/v1/token?grant_type=refresh_token", { body: { refresh_token: a.refresh_token } });
  ok(out.status === 204 && afterOut.status === 400, "sign-out revokes the session's refresh token");

  const da = await rpc("league_delete_me", a.access_token);
  const db = await rpc("league_delete_me", b.access_token);
  const gone = await rpc("league_me", b.access_token, { lang });
  ok(da.body === true && db.body === true && (gone.body as { profile: Json }).profile === null, "delete_me for both users");
  const leftover = (
    await mustRun(DB, "count memberships", "select count(*) from league.members where user_id = any(string_to_array(:'ids', ',')::uuid[]);", {
      ids: [a.user.id, b.user.id].join(","),
    })
  ).trim();
  ok(leftover === "0", "delete_me removes every membership");
}

/** The language the check plays: the default pack (`pack.json` `"default": true`), else the first one. */
function checkLang(): string {
  const langs = contentLangs();
  const isDefault = (lang: string) => {
    try {
      return (JSON.parse(readFileSync(join(ROOT, "content", lang, "pack.json"), "utf8")) as { default?: unknown }).default === true;
    } catch {
      return false;
    }
  };
  const lang = langs.find(isDefault) ?? langs[0];
  if (!lang) throw new Error("No content pack found under content/.");
  return lang;
}

async function main() {
  process.env.LEAGUE_LOCAL_QUIET = "1";
  await ensureDatabase(false);
  const server = createLeagueServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let failed = false;
  try {
    await run(checkLang());
  } catch (error) {
    failed = true;
    if (!(error instanceof Error) || !error.message) console.error(error);
  } finally {
    if (users.length) {
      await mustRun(DB, "remove check users", "delete from auth.users where id = any(string_to_array(:'ids', ',')::uuid[]);", {
        ids: users.join(","),
      });
    }
    server.close();
  }
  if (failed) process.exit(1);
  console.log(`league:local:check passed: ${passed} checks, test users removed.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
