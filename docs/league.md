# Liga — accounts and weekly competition

Friends compete on weekly XP. Plan: `plans/004-liga.md`. This document is the source of truth
for the database side (schema, rules, RPC contract) and for setting up the Supabase project.

## Decision record

- **2026-10-01, Hernán:** `docs/brief.md` says "single learner, no accounts, no server". That is
  superseded **for this feature only**: an optional account and a Supabase backend (Auth +
  Postgres + RLS + RPC) for competition. Everything else in the brief stands; the brief itself is
  not edited.
- The app stays a **static export**. Supabase is called from the browser with the public anon key
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Without them Liga is hidden and
  the app works as before.
- **Offline first.** Progress stays on the device. Only XP events (and a few profile stats) go to
  the cloud, queued while offline.
- **Optional account:** anonymous Supabase user on join; nickname + emoji are the only things other
  players see. Optional email link (magic link) to keep the account on another device.
- **One group per person** (create, join by code or link, leave; no admin features) and one global
  table. **Weekly XP**, reset on Monday 00:00 Europe/Madrid, per language.
- **Reasonable anti-cheat:** XP only enters through one RPC with per-event, per-day and time-window
  limits. No table is writable (or readable) by clients.
- **2026-10-06, Hernán (several languages, plan 006):** weekly XP = **sum over every language**
  (the week is unchanged); `lang` is still recorded on every event and stat. **Daily cap 2500 per
  player per Madrid day across all languages.** A player can be in **up to 10 groups** at once,
  plus the general table; joining another group no longer requires leaving. Leaderboard streak =
  the best of the player's per-language streaks. New RPCs for the multi-group client
  (`league_status`, `league_ranking`, `league_podium`, `league_leave_group(code)`); the old ones
  keep answering for installed app versions (see "Old RPCs"). Migration
  `20261006000000_league_multi.sql`. This supersedes "one group per person" and "per language"
  in the 2026-10-01 record above.
- Hernán applies migrations to the real project himself (`npx supabase db push`). Agents only
  validate SQL locally with `npm run db:check`.

## Architecture

```
browser (static app) ──supabase-js, anon key──▶ Supabase Auth (anonymous user, magic link)
                      └─ rpc('league_*') ───────▶ public.league_* (security definer)
                                                    └─ league.* tables (RLS on, no grants)
```

- Tables live in the private schema **`league`**, which the Data API does not expose
  (`supabase/config.toml` → `[api] schemas`). RLS is enabled on every table with **no policies**,
  and `anon`/`authenticated` hold no privileges on them: a direct `select`/`insert` fails with
  `42501 permission denied`.
- Clients call the twelve **`public.league_*` RPCs**: `security definer`, `search_path = ''`,
  executable by `authenticated` only (anonymous Supabase users are `authenticated` too; the `anon`
  role, i.e. not signed in, can call nothing).
- The caller is always `auth.uid()`; no RPC takes a user id.
- Migrations: `supabase/migrations/*.sql`. Local check: `scripts/db/` (see "Local SQL check").

## Data model (`league` schema)

| Table | Columns | Notes |
| --- | --- | --- |
| `profiles` | `user_id` (pk → `auth.users`, cascade), `nickname`, `emoji`, `created_at` (= joined at), `updated_at` | Nickname unique on `lower(nickname)`. |
| `stats` | `user_id`, `lang`, `total_xp`, `streak_count`, `streak_best`, `updated_at` (pk user+lang) | Sent by the device; shown, never ranked. |
| `groups` | `id`, `code` (6 chars, unique), `name`, `created_at` | Deleted automatically when its last member leaves. |
| `members` | `user_id`, `group_id` (pk user+group), `joined_at` | Up to `league.max_groups()` (10) rows per player; `joined_at` orders them (earliest = "the group" of the old RPCs). |
| `xp_events` | `id` (uuid from the device, pk), `user_id`, `lang`, `amount` (≥ 0), `source`, `earned_at`, `received_at` | `amount` is 0 when the daily cap swallowed the event (kept so a resend is a duplicate). |
| `blocked_words` | `word`, `mode` (`token` \| `contains`) | Nickname / group-name blocklist (edit with SQL). |
| `emojis` | `emoji`, `position` | The fixed avatar list. |

Everything hangs off `auth.users` with `on delete cascade`: deleting a user in the dashboard
removes all their Liga data.

## Rules

### Week and day

- **Week** = `[Monday 00:00, next Monday 00:00)` in **Europe/Madrid** (DST aware: the week in which
  clocks go back lasts 169 h, the one in which they go forward 167 h). SQL: `league.week_start(ts)`,
  `league.week_end(ts)`.
- **Weekly XP** = sum of `amount` of the player's events in **every language** whose `earned_at` is
  in the current week. There is one ranking for all languages (`lang` is still stored on events
  and stats, but no ranking filters by it).
- **Streak** shown on the boards = the highest `streak_count` among the player's per-language
  `stats` (the device sends its global streak in each language's stats).
- **Day** (daily cap) = calendar day in Europe/Madrid of the event's `earned_at`.

### XP limits

Derived from the XP rules in the code (2026-10-01):

| Award | Rule (source) | Max |
| --- | --- | --- |
| Lesson | `XP_LESSON` 10 + 1 per first-try exercise + `XP_PERFECT_BONUS` 5 (`src/lib/exercises/result.ts`); sessions have 10–12 exercises (`defaultSessionSize`) | 27 |
| Review | same formula, `REVIEW_SIZE` 10 items (`src/lib/srs`) | ~25 |
| Story | `XP_STORY` 10 + 1 per first-try game answer (`src/lib/stories/games.ts`); stories have ≤ 16 steps | ~26 |
| Game round | `XP_ROUND` 5 + 1 per right answer in a 60 s round (`src/lib/game`) | ~40 realistic, ~65 at one answer per second |

| Limit | Value | Where |
| --- | --- | --- |
| Per-event cap | **100 XP** (≈ 2× a strong award, above the theoretical game maximum). Larger → `too_big`. | `league.max_event_xp()` |
| Daily cap | **2500 XP** per player, per Madrid day, **all languages together** (≈ 90 perfect lessons). The event that crosses it is clamped, later ones get 0 (`capped`). | `league.daily_cap_xp()` |
| Groups | **10** groups per player at once. One more (create or join) → `too_many_groups`. | `league.max_groups()` |
| Batch size | **200** events per `league_record_xp` call. More → `too_many_events`. | `league.max_batch()` |
| Time window | `earned_at` ≤ now + 5 min (clock skew) and ≥ now − 8 days. | `league_record_xp` |
| Only after joining | `earned_at` ≥ profile `created_at` − 5 min, else `before_join`. | `league_record_xp` |

To change a number, add a migration that redefines the function (e.g.
`create or replace function league.daily_cap_xp() returns integer language sql immutable as $$ select 3000 $$;`).
If the app's XP rules grow (bigger awards), revisit the per-event cap.

### Nicknames, emojis, group names

- Nickname: trimmed, inner spaces collapsed, **3–20 characters**, letters (incl. `áéíóúüñàèìòùç`),
  digits, space, `_`, `.`, `-`; at least one letter or digit. **Unique ignoring case**.
- Blocklist (`league.blocked_words`): the name is folded (lower case, accents removed,
  `0→o 1→i 3→e 4→a 5→s 7→t`). `token` words match a whole word (`puta` blocks "Puta Madre" but not
  "Disputa"); `contains` words match anywhere once spaces/punctuation are removed (`fuck` blocks
  "xFuckYoux"). Spanish, Italian and English insults plus a few reserved names (`admin`,
  `moderador`, `langlern`, `supabase`). Add words in the dashboard SQL editor:
  `insert into league.blocked_words values ('palabra', 'token');` (lower case a–z only).
- Emoji: exactly one of this list, in this order (U+FE0F variation selectors are ignored). The
  client keeps the same list in `src/lib/league/emoji.ts`:

  🍋 🍊 🍕 🍝 🍦 🥐 ☕ 🫒 🐢 🐬 🐙 🦀 🐟 🦊 🐱 🐶 🐼 🦁 🐸 🦉 🐝 🌋 ⛵ 🌞

- Group name: trimmed, inner spaces collapsed, **1–30 characters**, no control characters, same
  blocklist. Group code: 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I);
  joining accepts lower case and ignores spaces.

## RPC contract

Call with supabase-js: `supabase.rpc("league_me", { lang: "it" })`. Parameter names are the JSON
keys. All need a signed-in user (anonymous is fine).

**Errors:** raised as SQLSTATE `P0001` with a snake_case token as the message; match
`error.message`. Network errors have no such token and should be retried later.

| Token | Meaning |
| --- | --- |
| `not_authenticated` | No user in the JWT. |
| `no_profile` | The caller has not joined (no `league_set_profile` yet). |
| `nickname_invalid` | Length or characters (see rules). |
| `nickname_blocked` | Blocklist. |
| `nickname_taken` | Another player has it (ignoring case). |
| `emoji_invalid` | Not in the list. |
| `group_name_invalid` / `group_name_blocked` | Group name length/characters / blocklist. |
| `too_many_groups` | Create/join while already in `max_groups` (10) groups. |
| `not_in_group` | `league_ranking` / `league_podium` for a group the caller is not a member of. |
| `already_in_group` | No longer raised (until 2026-10-06: create/join while in another group). |
| `group_not_found` | No group with that code. |
| `try_again` | Could not pick a free group code (practically never). |
| `lang_invalid` | `lang` is not 2–3 lower-case letters. |
| `scope_invalid` | `scope` is not `group` or `global`. |
| `group_not_found` (rankings) | `league_ranking` / `league_podium` with scope `group` and an unknown or missing `code`. |
| `events_invalid` / `too_many_events` | `events` is not a JSON array / has more than 200 items. |
| `stats_invalid` | `stats` malformed or out of range. |

### `league_set_profile(nickname text, emoji text) → jsonb`

Creates the caller's profile (= joins the Liga; `joined_at` is now) or updates nickname/emoji.
Returns `{ nickname, emoji, joined_at }` (`joined_at` ISO timestamp).
Errors: `not_authenticated`, `nickname_invalid`, `nickname_blocked`, `nickname_taken`, `emoji_invalid`.

### `league_record_xp(events jsonb, stats jsonb default null) → jsonb`

`events`: array (may be empty) of
`{ "id": uuid, "lang": "it", "amount": int, "source": "lesson", "earned_at": ISO timestamp }`
(`id` generated on the device, `source` matches `^[a-z][a-z_-]{0,19}$`; the app uses `lesson`,
`review`, `game`, `story`). Processed in array order.

`stats` (optional): `{ "lang": "it", "total_xp": int, "streak_count": int, "streak_best": int }`,
the device's current totals; upserted before the events. Send it on join (with `events: []`) and
with each flush.

Returns `{ "results": [{ "id", "status", "amount" }], "xp_added": int }`, one result per input
event, same order. `amount` is what counted (0 unless accepted/capped). Status:

| Status | Stored | Meaning |
| --- | --- | --- |
| `accepted` | yes | Counted in full. |
| `capped` | yes | Daily cap reached: counted partly or with 0. |
| `duplicate` | — | Id already recorded (resend). |
| `invalid` | no | Bad id/lang/source/amount (≤ 0, not an integer, not a number) or not an object. |
| `too_big` | no | `amount` above the per-event cap. |
| `future` | no | `earned_at` more than 5 min ahead of the server. |
| `too_old` | no | `earned_at` older than 8 days. |
| `before_join` | no | Earned before the profile was created. |

**Every status is final:** the client drops every event listed in `results` from its outbox; only a
failed call (network/HTTP error) keeps them for a retry. Batches of one user are serialised
(advisory lock), so the daily cap cannot be raced.
Errors: `not_authenticated`, `no_profile`, `events_invalid`, `too_many_events`, `stats_invalid`.

### `league_create_group(name text) → jsonb`

Creates a group and makes the caller its first member (other groups are kept). Returns
`{ code, name, members }`. Share link: `/liga/unirse/?codigo=<code>`.
Errors: `not_authenticated`, `no_profile`, `group_name_invalid`, `group_name_blocked`,
`too_many_groups`, `try_again`.

### `league_join_group(code text) → jsonb`

Joins the group with that code without leaving the others; joining a group you are already in is a
no-op (also at the limit). Returns `{ code, name, members }`.
Errors: `not_authenticated`, `no_profile`, `group_not_found`, `too_many_groups`.

### `league_leave_group(code text default null) → boolean`

With `code`: leaves that group (`true`), or `false` when not a member or the code is unknown.
Without `code` (old app versions call it with `{}`): leaves the **earliest joined** group, `false`
when in no group. A group is deleted when its last member leaves (its code stops working).
Errors: `not_authenticated`.

### `league_status() → jsonb`

Everything the multi-group Liga screen needs about the caller:

```jsonc
{
  "profile": { "nickname": "Hernán", "emoji": "🍋", "joined_at": "…" } | null,
  "stats": [{ "lang": "fr", "total_xp": 80, "streak_count": 2, "streak_best": 2, "updated_at": "…" }], // one per lang, sorted
  "streak": 5,                       // max streak_count over stats (what the boards show)
  "groups": [{ "code": "K7PX2M", "name": "Amici", "members": 4, "joined_at": "…", "rank": 2 }],
  "max_groups": 10,
  "week": { "start": "…", "end": "…" },
  "weekly_xp": 85,                   // all languages
  "rank": { "global": 12 | null }
}
```

`groups` = the caller's groups, earliest joined first, with `rank` = the caller's rank in that
group this week (same as the `is_me` row of `league_ranking('group', code)`). Without a profile:
`profile: null`, empty `stats`/`groups`, `weekly_xp: 0`, `rank.global: null`.
Errors: `not_authenticated`.

### `league_ranking(scope text default 'global', code text default null) → setof row`

This week's ranking, XP summed over every language. Same rows and rules as `league_leaderboard`
below; `scope: 'group'` needs the `code` of one of the caller's groups (any case, spaces ignored).
Errors: `not_authenticated`, `scope_invalid`, `group_not_found`, `not_in_group`.

### `league_podium(scope text default 'global', code text default null) → setof row`

Last week's top 3 (players with XP only, all languages), of the general table or one of the
caller's groups. Errors: as `league_ranking`.

### Old RPCs (installed app versions)

`league_me(lang)`, `league_leaderboard(lang, scope)` and `league_last_week_podium(lang, scope)`
keep their signatures and shapes until a later cleanup migration, with the 2026-10-06 rules:
weekly XP is **summed over every language** (`lang` is only validated; `league_me.stats` is still
the stats of that `lang`), the streak is the max over stats, and "the group" (`league_me.group`,
`rank.group`, scope `group`) is the caller's **earliest joined** group. `league_leave_group()`
without a code leaves that group (above).

### `league_leaderboard(lang text, scope text default 'global') → setof row`

Old RPC (see "Old RPCs"). Current week's ranking. Rows (display order):
`{ rank int, nickname text, emoji text, weekly_xp int, streak int, is_me boolean }`.

- `global`: every player with weekly XP > 0, plus the caller (also with 0).
- `group`: every member of the caller's earliest joined group, 0 XP included; empty when in no group.
- Top **50** rows plus the caller's own row when outside them (so up to 51). `rank` is shared on
  ties (1, 2, 2, 4); `streak` = max `streak_count` over the player's stats (0 if never sent). No user ids are exposed.

Errors: `not_authenticated`, `lang_invalid`, `scope_invalid`.

### `league_last_week_podium(lang text, scope text default 'global') → setof row`

Old RPC. Last week's top 3 (same row shape), players with XP only; may return fewer rows.
Errors: as `league_leaderboard`.

### `league_me(lang text) → jsonb`

Old RPC (see "Old RPCs"; new clients use `league_status`).

```jsonc
{
  "profile": { "nickname": "Hernán", "emoji": "🍋", "joined_at": "2026-10-01T09:00:00+00:00" } | null,
  "stats": { "total_xp": 1234, "streak_count": 3, "streak_best": 9, "updated_at": "…" } | null,
  "group": { "code": "K7PX2M", "name": "Amici", "members": 4 } | null,
  "week": { "start": "2026-09-28T22:00:00+00:00", "end": "2026-10-04T22:00:00+00:00" },
  "weekly_xp": 85,
  "rank": { "global": 12 | null, "group": 2 | null }
}
```

`profile: null` = signed in but not joined. `rank` matches the `is_me` row of the leaderboards
(`null` without profile / group). `week.end` is the next reset (use it for the countdown).
Errors: `not_authenticated`, `lang_invalid`.

### `league_delete_me() → boolean`

"Salir de la Liga y borrar mis datos": deletes the caller's XP events, stats, every membership
(and each group that becomes empty) and profile. `true` if there was a profile. The auth user itself stays
(anonymous, without data); the client then signs out and clears its local Liga state. To remove an
auth user completely, delete it in the dashboard (Authentication → Users): everything cascades.
Errors: `not_authenticated`.

## Client (`src/lib/league/`)

Framework-free modules plus one hook; nothing outside `/liga/` imports supabase-js statically.

| File | What |
| --- | --- |
| `config.ts` | `leagueEnabled()` (both env vars set at build), `supabaseConfig()`, `AUTH_STORAGE_KEY`, `LEAGUE_PATH` (`/liga/`), `leagueRedirectUrl()`. |
| `client.ts` | `getLeagueClient()`: creates the client once via dynamic `import("@supabase/supabase-js")` (own chunk, never in a route's first-load JS); `leagueRpc<T>(fn, args)` calls a `league_*` RPC and throws `LeagueError`; `hasAuthCallbackInUrl()`, `authCallbackResult()`. |
| `errors.ts` | `LeagueError` with `code`: the RPC tokens above plus `disabled`, `offline`, `network`, `not_joined`, `anonymous_disabled`, `email_invalid`, `email_taken`, `email_not_found`, `email_not_authorized`, `rate_limited`, `link_expired`, `link_invalid`, `unknown`. UI maps codes to copy. |
| `account.ts` | Account state + actions (below). |
| `use-league-account.ts` | `useLeagueAccount(lang?)` → the account snapshot + actions (`join`, `updateProfile`, `linkEmail`, `signInWithEmail`, `signOut`, `deleteMe`, `refresh`, `clearLinkError`). |
| `groups.ts` | The caller's groups and weekly standing (below): `useLeagueGroups()`, `createLeagueGroup(name)`, `joinLeagueGroup(code)`, `leaveLeagueGroup(code)`, `refreshLeagueGroups()`, invite code helpers. |
| `leaderboard.ts` | Rankings per tab (`BoardTab` = `{ scope: "global" }` or `{ scope: "group", code }`): `fetchBoard(tab)` (`league_ranking` + `league_podium`), `useLeaderboard(tab, enabled)`, the Madrid week helpers. |

**Account state.** `{ status, profile, email?, pendingEmail?, userId?, online, linkError? }`.
`status`: `loading` (server render/hydration, or checking a session the device has no profile
for), `disabled` (no env vars: hide every Liga entry point), `offline` (not joined and no
connection), `none` (online, not joined), `joined` (has a profile; also offline). The account is
cached in localStorage `lang-lern:league-account` (`{ v: 1, userId, profile, email, pendingEmail }`,
tolerant parsing), so `isLeagueJoined()` / `getLeagueAccount()` answer synchronously and offline;
`refreshLeagueAccount()` re-reads it from the server (`getSession` + `league_status`), throttled to
once a minute, on screen mount and when the device comes back online. The account refresh reads
`league_status` (no language: the Liga is the same for every pack) and hands the answer to the
groups layer (`subscribeLeagueStatus`), so a screen mount costs one call. supabase-js is only loaded
when there is something to check (cached account, stored session or a magic link in the URL) or
for an action, so users who never open Liga never download it.

**Change event.** Every change dispatches `lang-lern:league-account-change` on `window` (a
`CustomEvent` whose `detail` is the reason); subscribe with `subscribeLeagueAccount(cb)`:
`joined` (profile created, or signed in on a device to an account that has one: flush + send
stats), `updated`, `user_changed` (another user signed in: drop per-user local state), `signed_out`,
`deleted` (after `deleteMe`: clear all local Liga state), `status` (connectivity, loading, link error).

**Auth.**
- Session: supabase-js in localStorage under `lang-lern:league-auth`, auto-refreshed while the
  client is loaded. **Implicit flow** (`flowType: "implicit"`, `detectSessionInUrl: true`): the magic
  link returns to `/liga/#access_token=…&type=magiclink|email_change`; supabase-js reads the
  fragment when the client is created, stores the session and clears the URL. PKCE is not used
  because it only works in the browser that asked for the link (it keeps a code verifier there).
- `join(nickname, emoji)`: `signInAnonymously()` if there is no session, then `league_set_profile`.
  If the profile call fails, the anonymous session is kept and reused on the next try.
- `linkEmail(email)`: `updateUser({ email }, { emailRedirectTo: <origin>/liga/ })`; `pendingEmail`
  until the link is opened, then `email`. The anonymous user becomes a permanent one with the same id.
- `signInWithEmail(email)`: `signInWithOtp({ email, options: { shouldCreateUser: false,
  emailRedirectTo } })`. Opening the link replaces this device's session (`user_changed` / `joined`).
- `signOut()`: `signOut({ scope: "local" })`, works offline. An anonymous account without a linked
  email cannot be recovered afterwards (its server data stays until deleted in the dashboard).
- `deleteMe()`: `league_delete_me`, then local sign-out (`deleted`). Needs a connection.
- A rejected link (`#error_code=otp_expired…`) sets `linkError` (`link_expired` / `link_invalid`);
  the fragment is removed from the address bar.
- Known limit: on an iPhone home-screen app the email link opens in Safari, whose storage is not
  the app's, so the session lands in Safari. Linking/sign-in by link works best in the browser
  where the app is used; a 6-digit code typed in the app (`verifyOtp`) would remove the limit.

**Groups (up to 10) and weekly standing.** `useLeagueGroups()` → `{ status: "unknown" | "ready",
groups: [{ code, name, members, rank }], maxGroups, weeklyXp, globalRank, weekEnd, updatedAt,
refreshing, invite }`, from `league_status` (`weeklyXp` = every language this week; `rank` = the
caller's rank in that group). Cached in localStorage `lang-lern:league-groups`
(`{ v: 1, userId, groups, maxGroups, weeklyXp, globalRank, weekEnd, updatedAt }`, tolerant parsing;
only used when `userId` is the joined user) and re-read on screen mount, after joining or signing in,
when back online, when the app becomes visible (8 s throttle) and 3 s after each XP award; sign-out,
delete and user change drop it. The old one-group cache `lang-lern:league-group` is no longer read or
written (left in place). Actions (`not_joined`/`offline` checked first) apply the server's answer
to the cache, then re-read the status: create/join add the group without leaving the others (a
client-side `too_many_groups` check at `maxGroups` avoids a call), `leaveLeagueGroup(code)` removes
that one (and its cached ranking). The share link is `<origin>/liga/unirse/?codigo=<code>` (Web
Share, else copied to the clipboard). That static page reads the code on the client and remembers
it in `lang-lern:league-invite`: not joined → the join flow, then straight into the group; already
in it → "Ya estás"; at the limit → the limit message; else "Unirme al grupo" (the other groups are
kept). The remembered invite is offered again on /liga/ (e.g. after an email sign-in, which
redirects to /liga/) until it is used or dismissed ("Ahora no").

**Screens.** /liga/: profile, "Tus grupos" (one card per group: name, members, this week's rank,
code, "Compartir enlace", "Salir" with confirmation; create / join by code until the limit, then
the limit message), "Clasificación" with tabs **General** + one per group (scrolls sideways; a group
left elsewhere falls back to General), each with this week's podium and table and last week's
podium. Ruta's Liga card shows the rank in the general table and the weekly XP of every language
("En la general · todos los idiomas"), from the cached status.

**Rankings cache.** `lang-lern:league-ranking:global` and `lang-lern:league-ranking:group:<code>`
(`{ v: 1, userId, updatedAt, rows, lastWeek }`, ignored once the week is over). The old per-language
caches `lang-lern:league-board:<lang>:<scope>` are no longer read or written (left in place).

### Sync (XP outbox)

Files: `src/lib/league/outbox.ts` (storage), `src/lib/league/sync.ts` (sending),
`src/components/league/LeagueSync.tsx` (mounted once in the root layout; renders nothing).

- **Hook point.** Every XP award goes through `saveResult()` in `src/lib/progress/index.ts`
  (`recordLessonResult` → `lesson`, `recordReviewResult` → `review`, `recordActivity` → `game` on
  `/jugar/`, `story` on `/historias/`, else `activity`). After saving progress it dispatches
  `lang-lern:xp-award` (`{ lang, amount, source, earnedAt }`); `subscribeXpAwards(cb)` listens.
  The progress module knows nothing about Liga.
- **Lazy.** `LeagueSync` does nothing when `leagueEnabled()` is false; otherwise it loads
  `sync.ts` with a dynamic `import()` after hydration. supabase-js is only fetched when there is
  something to send (joined device).
- **Outbox.** localStorage `lang-lern:league-outbox:<lang>` =
  `{ v: 1, userId, events: [{ id, lang, amount, source, earnedAt }], sentStats }` (`id` = uuid from
  the device, `earnedAt` ISO). Tolerant parsing (bad entries dropped, other versions ignored),
  capped at **500** events (oldest dropped) and events older than 8 days dropped (the server would
  answer `too_old`). An award is queued **only while joined** (cached account has a profile); the
  events belong to `userId` and are never sent for another user. Signing out, `deleteMe` and
  switching user clear every outbox.
- **When it flushes:** on app start (any page), on `joined` / `user_changed`, on `online`, on
  `visibilitychange` to visible, and 1 s after each award (several quick awards share a call).
  Concurrent flushes coalesce; offline or not joined = no-op.
- **What it sends:** per language, `league_record_xp(events, stats)` in batches of ≤ 200 events,
  oldest first. Every call carries `stats` = `{ lang, total_xp, streak_count, streak_best }` from the
  device's progress (`streak_count` is the current streak, 0 once lapsed). With nothing queued, a
  call with `events: []` is made only when the stats differ from the last ones the server stored
  (`sentStats`), or on join / account switch. If the server answers `stats_invalid`, those stats are
  skipped and the events are sent without them.
- **Acknowledgement:** only ids listed in `results` leave the outbox (every status is final). A
  failed call keeps everything; ids make the resend a `duplicate`.
- **Errors:** never reach the UI. Failures back off exponentially (5 s → 10 min, ±20 % jitter);
  coming back online or an account change resets the back-off. `not_authenticated` / `no_profile`
  trigger an account re-check (which may sign out and clear the outbox).

Verified for T34 without a real project: a static build pointed at a local mock of `/auth/v1/user`
and `/rest/v1/rpc/league_me`, opened at `/liga/#access_token=…&type=magiclink`, ends `joined` with
the mock profile and a clean URL; `#error_code=otp_expired` shows the expired-link message.

Verified for T40 against the real project (2026-10-04, throwaway users `ZZ-test-*`, all deleted with
`league_delete_me`): anonymous sign-in, `set_profile` (duplicate nickname → `nickname_taken`),
`record_xp` (accepted, `duplicate`, `too_big`, `future`, `too_old`, `invalid`, daily cap 2500 →
`capped`), groups (create, join by code, bad code), global and group rankings with the right weekly
XP, `league_me`, direct table access denied, and the client outbox (`sync.ts`: queued offline,
flushed after `online`). Known limits: the last-week podium could not be exercised (events before
joining are rejected, so a fresh player has no last-week XP); the magic-link email is untested
(the default SMTP only reaches team members); deleted players leave an empty anonymous auth user
(remove it under Authentication → Users).

## Setup (Hernán, once)

1. **Create the project.** <https://supabase.com/dashboard> → sign in → **New project**: name
   `lang-lern`, a strong database password (save it in your password manager; `link` asks for it),
   region **West EU (Paris)** or **Central EU (Frankfurt)**. Wait until it is ready.
2. **Anonymous sign-ins.** Authentication → **Sign In / Providers** → enable **Allow anonymous
   sign-ins** → Save. Leave **Email** enabled (default) with "Confirm email" on.
3. **URLs for the magic link.** Authentication → **URL Configuration**:
   - **Site URL:** `https://<your-app>.vercel.app` (the production URL from `npx vercel@latest --prod`).
   - **Redirect URLs** → Add: `https://<your-app>.vercel.app/liga/`,
     `http://localhost:3000/liga/` (`npm run dev`) and `http://localhost:4173/liga/` (`npm start`).
   - Emails: the default Supabase mailer is fine for now, but it only delivers to members of the
     project's team (your own address) and only a few emails per hour. For friends to link their
     email later, set up custom SMTP (Project Settings → Authentication → SMTP).
4. **Apply the schema** from the repo folder:
   ```bash
   npx supabase login                               # opens the browser once
   npx supabase link --project-ref <project-ref>    # ref = the id in the dashboard URL; asks the DB password
   npx supabase db push                             # lists the migrations to apply → confirm with Y
   ```
   Check: Table Editor → schema `league` shows 7 tables. Later migrations: pull, then
   `npx supabase db push` again (it only applies new files).
5. **Keys for the app.** Project Settings → **API Keys** (or Connect → App frameworks): copy the
   **Project URL** and the **anon / publishable** key (never the `service_role` / secret key).
   - Local: `cp .env.example .env.local` and fill both lines; restart `npm run dev`.
   - Vercel: Project → Settings → **Environment Variables** → add `NEXT_PUBLIC_SUPABASE_URL` and
     `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production (and Preview), or
     `npx vercel@latest env add NEXT_PUBLIC_SUPABASE_URL production` (same for the key). Then
     redeploy: `npx vercel@latest --prod` (the values are inlined at build time).
6. Open the app → Perfil → Liga. Without the two variables Liga simply does not appear.

Useful SQL (dashboard → SQL Editor, runs as `postgres`): `select * from league.profiles;`,
`select * from league.xp_events order by received_at desc limit 50;`.

## Local SQL check

`npm run db:check` (needs a local Postgres 17 on the default socket and `psql`; not part of
`verify`): creates a uniquely named throwaway database, creates the roles
`anon`/`authenticated`/`service_role` only if the cluster lacks them (and drops those again),
applies `scripts/db/auth-stub.sql` (minimal `auth.users`, `auth.uid()` from the
`request.jwt.claim.sub` setting, and Supabase's default grants on `public`), every migration in
order, then `scripts/db/smoke.sql`, and drops the database. The smoke SQL simulates callers like
PostgREST (`set role authenticated|anon` + the JWT `sub`) and covers profiles, blocklist, groups,
`record_xp` statuses and caps (daily cap across languages), the Madrid week boundary, up to 10
groups (`too_many_groups`, leave by code), summed weekly XP, new and old rankings/podiums, streak =
max over stats, deletion (every membership) and the RLS/privilege denials. `DB_CHECK_VERBOSE=1` lists every check; libpq variables (`PGHOST`, `PGPORT`,
`PGUSER`) pick another server.

## Try it locally (fake Supabase)

Before the real project exists (or to play with fake friends), `scripts/league-local/` imitates the
parts of Supabase the app uses, on the local Postgres (same requirements as `db:check`: Postgres on
the default socket and `psql`; Node built-ins only, no Docker). It uses its own database
`lang_lern_league_local` and never touches any other one.

1. **`npm run league:local`** (add `-- --reset` to start from an empty database): creates the
   database if missing (auth stub + `scripts/league-local/local-auth.sql` + every migration; new
   migration files are applied on the next start) and serves <http://localhost:54321>. It prints
   the two env values; the anon key is a fixed local JWT, the same on every machine:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<printed by league:local>
   ```
   Put them in `.env.local` (keep the real keys commented out) and restart `npm run dev` (or
   `npm run build && npm start`; both origins are allowed by CORS).
2. **`npm run league:seed`** (`-- --reset` to reseed): 15 fake players "Bot …" with XP spread over
   this week and last week in every content language plus `it` and `fr`, and two groups of 5:
   **Amici di prova** (code `PRUEBA`) and **Les copains** (code `BANDA2`), with two bots in both,
   so the global and group tables and last week's podium have content.
   Does nothing if the bots already exist; `--reset` deletes the bots and both groups (real
   members leave them too).
3. **`npm run league:local:check`**: proves it over HTTP with two throwaway users (CORS, anonymous
   sign-up, refresh, set_profile, record_xp statuses, groups, leaderboards, league_me, a second
   language, `league_status`/`league_ranking`/`league_podium`, leave by code, the 10-group limit, email linking,
   sign in by email, sign-out, delete_me) on its own free port, then deletes them. Exit 1 on failure.

What it serves: GoTrue-shaped `POST /auth/v1/signup` (anonymous only), `POST /auth/v1/token?grant_type=refresh_token`
(rotating refresh tokens), `GET|PUT /auth/v1/user`, `POST /auth/v1/otp`, `GET /auth/v1/verify`,
`POST /auth/v1/logout`; and PostgREST-shaped `POST /rest/v1/rpc/league_*`, run as role
`authenticated` (or `anon` with only the anon key) with `request.jwt.claims` set like PostgREST,
errors as `{ code, message, details, hint }` (P0001 → 400, permission denied → 401/403). JWTs are
HS256 with a local secret, valid for 1 hour (`LEAGUE_LOCAL_JWT_SECONDS` to shorten them and watch
the refresh). **No email is sent:** "Vincular email" and "Entrar con mi email" print the magic link
in the `league:local` terminal; open it in the same browser and it lands on `/liga/#access_token=…`
like the real one.

**Playing as several users:** each browser profile or private window is a different device (its
own localStorage), so open the app in a normal window, a private window and another browser, join
with different nicknames and use code `PRUEBA` to share a group. To start over in one window,
"Salir de la Liga y borrar mis datos". Inspect the data with
`psql lang_lern_league_local -c 'select * from league.profiles;'`.
