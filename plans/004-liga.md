# Plan 004 — Liga: accounts and weekly competition

Status: active
Created: 2026-10-01
Base branch: plan-004-liga-t38
Previous: main @ 12d6ad9 (frozen)
Goal: Let friends compete: an optional account (nickname + emoji, anonymous Supabase user, optionally linked to an email by magic link), one group per person (join by code or link), and a weekly XP ranking (Monday 00:00 Europe/Madrid reset) per group and global, shown on a new "Liga" screen (/liga/, opened from Perfil and from a card on Ruta). Supabase (Auth + Postgres + RLS + RPC) is called from the client with the public anon key, so the app stays a static export; without Supabase env vars the app builds and Liga is simply hidden. The app keeps working fully offline and without an account: only XP events go to the cloud (queued offline), progress stays on the device. This batch runs on its own integration branch in parallel with plan 003 (pictures) on main; the last task merges main back in. MVP speed: no automated tests; verification is `npm run verify` (+ `npm run db:check` for SQL).
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-04 17:05Z 💻
- Writer: released
- Branch: plan-004-liga-t38 (from main @ 12d6ad9)
- Next step: T40 blocked on anonymous sign-ins
- Needs Hernán: Supabase dashboard: Authentication → Sign In / Providers → enable 'Allow anonymous sign-ins' (and no CAPTCHA on sign-ups); then relaunch T40 (script in scratchpad e2e.mjs)

## Shared contract (all tasks read this)

- Brief override (Hernán, 2026-10-01): docs/brief.md says single learner, no accounts, no server. That is superseded for this feature only: optional accounts and a Supabase backend for competition. docs/brief.md stays untouched; the decision is recorded in `docs/league.md`.
- Names: feature "Liga" (UI copy, Spain Spanish, "tú"). Route `/liga/` (registered in `NESTED` under the Perfil tab in `src/lib/navigation.ts`, no new tab). Code in `src/lib/league/` (framework-free logic + hooks) and `src/components/league/`. SQL in `supabase/migrations/`.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public by design, inlined at build). `leagueEnabled()` is false when either is missing → every Liga entry point is hidden and `/liga/` shows a short "no disponible" state. `npm run verify` must pass without them.
- `@supabase/supabase-js` is loaded with a dynamic `import()` only when Liga is used, so the rest of the app does not pay for it.
- Identity: anonymous Supabase sign-in when the user joins. Profile = unique nickname (3–20 chars, case-insensitive unique, basic bad-word blocklist, server-enforced) + one emoji from a fixed list. No email, name or anything else is ever shown to others.
- Email: optional "vincular email" (magic link via `updateUser({ email })`) to keep the account, and "entrar con mi email" on a new device (`signInWithOtp`, `shouldCreateUser: false`). Redirect back to `/liga/`. For now Supabase's default SMTP is used, which only delivers to project team members (Hernán); the UI must not promise more than "te enviaremos un enlace".
- Groups (minimal): a person is in at most one group. Anyone can create one (name) and gets a 6-character code and a share link `/liga/unirse/?codigo=XXXXXX` (static page, reads the query on the client). Anyone can leave. No admin features.
- Scoring: weekly XP = sum of XP events whose `earned_at` falls in the current week (Monday 00:00 Europe/Madrid). Only XP earned after joining counts; on join, current total XP and streak (count/best) are sent as profile stats (shown, not ranked). Rankings are per language (`lang` of the pack). Leaderboard = top 50 + the caller's own row if outside. Last week's podium (top 3) is shown.
- Anti-cheat ("reasonable limits"): XP only enters through a `security definer` RPC that takes a batch of events `{id uuid (client generated), lang, amount, source, earned_at}`, ignores duplicate ids, rejects amount ≤ 0 or above a per-event cap, `earned_at` in the future (> now + 5 min) or older than 8 days, and clamps each user's total per day to a daily cap. Caps derived from the current XP rules in the code (per-event cap ≈ 2× the largest single award; document the numbers). Clients can never insert into tables directly (RLS).
- Privacy: "Salir de la Liga y borrar mis datos" deletes the profile, membership and events (RPC) and clears local Liga state.
- RPC contract (T33 implements it, later tasks call it; names may be refined by T33 but must be documented in docs/league.md): `league_set_profile(nickname, emoji)`, `league_record_xp(events jsonb)`, `league_create_group(name)` → code, `league_join_group(code)`, `league_leave_group()`, `league_leaderboard(lang, scope 'group'|'global')`, `league_last_week_podium(lang, scope)`, `league_me(lang)` (profile, group, weekly xp, rank), `league_delete_me()`.
- Hernán applies migrations to the real project himself (`npx supabase db push`, steps in docs/league.md). Agents never touch the real Supabase project's schema. Local SQL validation: `npm run db:check` creates a throwaway database on the local Postgres (17, running on the default socket), stubs the minimal `auth` schema (`auth.users`, `auth.uid()`, roles `anon`/`authenticated`), applies every migration, runs smoke SQL that exercises every RPC and the RLS denials, and drops the database. It is not part of `verify` (Vercel has no Postgres).

## Tasks

## T33 — Supabase schema, RPCs and local SQL check
- Status: done
- Depends on: none
- Goal: Create the whole database side of Liga as migrations (tables, RLS, RPCs, caps, week logic) plus `npm run db:check`, and document setup and the RPC contract so the client tasks can build on it.
- Context: the plan's Shared contract; CLAUDE.md; `src/lib/progress/` (index.ts, activity.ts) and `src/lib/game/`, `src/lib/exercises/result.ts` to derive XP caps; `scripts/` for script style (tsx). Supabase skill `supabase-postgres-best-practices` for RLS/RPC patterns. Local Postgres 17 is running (`pg_isready` OK, `psql` in /opt/homebrew/bin).
- Scope: may touch `supabase/**` (migrations, `config.toml` if useful), `scripts/db/**` (new), `package.json` (`db:check` script only), `docs/league.md` (new: decision record, data model, RPC contract with params/returns/errors, caps, week rule, and step-by-step setup for Hernán: create project, enable anonymous sign-ins, email magic link + Site URL/redirect URLs for the Vercel domain and localhost, `npx supabase link` + `npx supabase db push`, env vars in `.env.local` and Vercel), `.env.example` (new, the two vars, empty), CLAUDE.md (commands table row + one convention line) / must not touch `src/**`, `content/**`, `docs/brief.md`.
- Done when:
  - `npm run db:check` → exit 0; the smoke SQL covers: profile create/update with nickname uniqueness and blocklist, group create/join/leave and one-group limit, record_xp duplicates/caps/future/old rejection, weekly sum respects the Madrid Monday boundary, group and global leaderboards with top 50 + me, last week podium, delete_me, and direct table writes denied for `anon`/`authenticated`.
  - Every table has RLS enabled; no table is writable except through RPCs.
  - docs/league.md documents the contract, caps and Hernán's setup steps.
  - `npm run verify` → exit 0.
- Outcome: private `league` schema + 9 security-definer `public.league_*` RPCs, caps 100 XP/event and 2500/day, db:check 171 checks green → 819a45d

## T34 — Supabase client, account and auth layer
- Status: done
- Depends on: T33
- Goal: The framework-free + hooks layer every Liga screen uses: config/feature flag, lazy client, anonymous sign-in on join, session persistence, email linking and sign-in by magic link, account state hook, and the `/liga/` route skeleton.
- Context: Shared contract; docs/league.md (RPC contract from T33); CLAUDE.md (static export, tokens, Spanish copy, trailing slashes); `src/lib/progress/use-progress.ts` (hook + change-event pattern to mirror); `src/lib/navigation.ts` (`NESTED`); `node_modules/next/dist/docs/` for anything Next-specific. Supabase skill for supabase-js auth (anonymous sign-in, `updateUser({ email })`, `signInWithOtp`, detecting the session from the redirect URL in a static SPA).
- Scope: may touch `src/lib/league/**` (config, client, account, hooks; not the XP outbox), `src/app/liga/page.tsx` + layout/skeleton only, `src/lib/navigation.ts` (NESTED entry), `package.json`/`package-lock.json` (add `@supabase/supabase-js`), docs/league.md (client section), CLAUDE.md (folder layout line) / must not touch `src/lib/progress/**`, `src/components/**` except a new `src/components/league/` stub if needed, `content/**`, `supabase/**`.
- Done when:
  - `leagueEnabled()`, a lazily imported client (no supabase-js in the first-load JS of routes other than /liga/; check the build output), `useLeagueAccount()` exposing `{ status: 'disabled'|'offline'|'none'|'joined', profile, email? }` plus `join(nickname, emoji)`, `linkEmail(email)`, `signInWithEmail(email)`, `signOut()`, `deleteMe()`; account changes fire an event other modules can subscribe to.
  - The magic-link redirect to `/liga/` completes the session in the static export.
  - `/liga/` exists (placeholder content), lights up the Perfil tab, and shows "no disponible" when Liga is disabled.
  - `npm run verify` → exit 0 with and without the env vars set.
- Outcome: lazy supabase-js chunk (only loaded for Liga actions/sessions), `useLeagueAccount()` with cached offline state + change event, implicit-flow magic link handled on /liga/, placeholder LeagueView → 96ffc72

## T35 — XP outbox and sync
- Status: done
- Depends on: T34
- Goal: Every XP award made while the user has joined Liga is queued on the device and sent to `league_record_xp` when online, so weekly rankings fill up without ever blocking the offline app.
- Context: Shared contract; docs/league.md; `src/lib/progress/` (where XP is added: `update()`, `recordActivity` in activity.ts) and every caller that awards XP (lessons, review, game, stories); `src/lib/league/` from T34 (account state + change event).
- Scope: may touch `src/lib/league/outbox.ts`, `src/lib/league/sync.ts` (new), a minimal hook point in `src/lib/progress/**` (one place where XP awards are reported, not scattered edits), docs/league.md (sync section), a new `src/components/league/LeagueSync.tsx` (renders nothing, starts the sync) mounted with one line in `src/app/layout.tsx` / must not touch other `src/components/**`, other `src/app/**`, `supabase/**`, `src/lib/game/**`, `src/lib/exercises/**`.
- Done when:
  - Outbox in localStorage (`lang-lern:league-outbox:<lang>`, versioned, tolerant parsing, capped size) receives `{ id, lang, amount, source, earnedAt }` for each XP award only while joined; nothing is queued when Liga is disabled or the user has not joined.
  - Flush on join, on app start, on `online` and on `visibilitychange` to visible; idempotent (ids), removes only acknowledged events, backs off on errors, never throws into the UI.
  - On join and on each flush the profile stats (total XP, streak count/best) are sent as defined in docs/league.md.
  - `npm run verify` → exit 0.
- Outcome: localStorage outbox (≤500 events, ≤8 days), `lang-lern:xp-award` event from `saveResult()`, flush on start/join/online/visible/1 s after award with backoff, stats on every call, LeagueSync in layout → 69099df

## T36 — Join flow and Liga account screen
- Status: done
- Depends on: T34
- Goal: On /liga/: the join flow for users without an account (pick nickname + emoji, join) and the account section for joined users (edit nickname/emoji, link email, sign in with email on a new device, leave and delete my data), with offline and error states.
- Context: Shared contract; docs/league.md; `src/lib/league/` hooks (T34); CLAUDE.md UI conventions (tokens only, both themes, `pressable`, PageHeader, Spain Spanish "tú"); `src/components/ui/`; `src/app/perfil/ProfileView.tsx` for the settings/confirm-dialog style to reuse.
- Scope: may touch `src/app/liga/**`, `src/components/league/**` (join + account components; leave a clear slot for the ranking that T38 fills), `src/lib/league/emoji.ts` (fixed avatar list) / must not touch `src/lib/progress/**`, `src/lib/league/outbox.ts`/`sync.ts`, `src/components/league/LeagueSync.tsx`, `src/app/layout.tsx`, `src/components/ui/**`, other routes, `supabase/**`.
- Done when:
  - Not joined: nickname field with live validation (length, server errors like "ese apodo ya está cogido"), emoji grid, "Unirme a la Liga" button; offline → clear message, no crash.
  - Joined: shows nickname + emoji, edit, "Vincular email" (sends magic link, explains it), "Entrar con mi email" for the not-joined state, "Salir de la Liga y borrar mis datos" with confirmation.
  - Checked by hand in both themes at 375 px (describe what was checked in DECISIONS).
  - `npm run verify` → exit 0.
- Outcome: join form (live validation, server errors, 24-emoji grid), account section (edit, link email, sign in by email, sign out only with linked email, delete with confirmation), offline states; hand-checked both themes at 375 px → 9ed886b

## T37 — Groups: create, join by code or link, leave
- Status: done
- Depends on: T36, T41, T42
- Goal: One group per person: create a group with a name, share its code/link, join by typing a code or opening `/liga/unirse/?codigo=…`, see the group name and members count, leave it.
- Context: Shared contract; docs/league.md; T34/T36 code in `src/lib/league/` and `src/components/league/`; Web Share API with copy-to-clipboard fallback.
- Scope: may touch `src/app/liga/**` (including new `unirse/`), `src/components/league/**`, `src/lib/league/groups.ts` (new) / must not touch `src/lib/progress/**`, `src/components/ui/**`, other routes, `supabase/**`.
- Done when:
  - Create → shows code + "Compartir" (Web Share, else copy); join by code with validation and errors (unknown code, already in a group → offer to leave first); leave with confirmation.
  - `/liga/unirse/?codigo=XXXXXX` works in the static export: if not joined, it sends the user through the join flow first and then into the group; offline-safe.
  - `npm run verify` → exit 0.
- Outcome: `groups.ts` (cache `lang-lern:league-group`, invite `lang-lern:league-invite`, create/join/leave/switch), GroupSection on /liga/, `/liga/unirse/?codigo=` (join Liga → auto-join group; switch with confirmation); e2e with 2 browser users on the local fake Supabase, both themes at 375 px → fc09e61

## T38 — Weekly leaderboards
- Status: done
- Depends on: T35, T37
- Goal: The heart of /liga/: weekly XP ranking with a Grupo / Global switch, podium for the top 3, the user's row highlighted (top 50 + me), time left until the Monday reset, and last week's podium; cached for offline viewing.
- Context: Shared contract; docs/league.md (`league_leaderboard`, `league_last_week_podium`, `league_me`); T34–T37 code; design tokens and existing cards (`src/components/ui`), ProgressBar etc.
- Scope: may touch `src/app/liga/**`, `src/components/league/**`, `src/lib/league/leaderboard.ts` (new, includes a localStorage cache) / must not touch `src/lib/progress/**`, `src/components/ui/**`, other routes, `supabase/**`.
- Done when:
  - Grupo tab hidden or with an invite to create/join a group when the user has none; Global always available.
  - Shows rank, emoji, nickname, weekly XP; own row highlighted; refresh after a flush (subscribe to the sync from T35) and on focus.
  - Countdown "Quedan 3 d 4 h" to Monday 00:00 Europe/Madrid; "La semana pasada" podium.
  - Offline: last cached table with "Sin conexión · actualizado hace …".
  - Checked by hand in both themes at 375 px.
  - `npm run verify` → exit 0.
- Outcome: Grupo/Global leaderboard, podium, countdown, last-week podium, offline cache. Refresh on XP-award event (+3s) since sync.ts is out of scope. not checked: Grupo table with real group, offline banner, me-outside-top-50 separator, light Global podium.

## T39 — Entry points: Ruta card and Perfil link
- Status: done
- Depends on: T38
- Goal: Make Liga discoverable: a card on Ruta (joined: weekly rank + XP this week in group/global, taps to /liga/; not joined: a dismissible "Compite con tus amigos" invite) and a Liga row on Perfil; all hidden when Liga is disabled.
- Context: Shared contract; `src/app/page.tsx` and the Ruta components (cards for repaso/diálogos as the style to follow); `src/app/perfil/ProfileView.tsx`; `src/lib/league/` hooks and the leaderboard cache (T38).
- Scope: may touch the Ruta page/components (only adding the card), `src/app/perfil/**` (only adding the link row), `src/components/league/**` (the card component), `src/lib/league/**` (dismiss flag) / must not touch `src/lib/progress/**`, `src/components/ui/**`, `src/components/game/**`, `src/lib/game/**`, `supabase/**`.
- Done when:
  - Card renders from cache instantly (no layout jump), refreshes in the background, never blocks Ruta offline; invite dismiss is remembered on the device.
  - Nothing Liga-related appears when the env vars are missing.
  - Checked by hand in both themes at 375 px.
  - `npm run verify` → exit 0.
- Outcome: RutaLeagueCard (cache-first, dismissible invite, key lang-lern:league-invite-dismissed) + Perfil Liga card; hidden when Liga disabled. Small layout shift if invite is hidden after the placeholder. not checked: any hand check at 375 px in both themes, joined/not-joined/dismiss/offline states.

## T40 — End-to-end check against the real Supabase project
- Status: pending
- Depends on: T39
- Goal: Prove the whole flow on Hernán's real Supabase project (migrations already applied by him, keys in `.env.local`): join, XP sync, groups, leaderboards, magic-link linking redirect, delete; fix what breaks in the client code.
- Context: docs/league.md; the real keys live in the main checkout's `/Users/heralc/Desktop/HDDev/lang_lern/.env.local` (read them from there if the worktree has none; never print or commit them). If the migrations are not applied or the keys are missing, stop with STATUS: blocked and say exactly what Hernán must do. Use the built-in browser (`npm run build && npm start`, or `npm run dev`) and/or a small throwaway script with the anon key; test users must be clearly named test accounts and deleted at the end via `league_delete_me`.
- Scope: may touch `src/lib/league/**`, `src/components/league/**`, `src/app/liga/**`, docs/league.md (known issues) / must not touch `supabase/migrations/**` (if SQL must change, add a new migration file and block for Hernán to apply it), other code, the real project's settings.
- Done when:
  - With two test users: join, earn XP in a lesson and in a game round, see both in the global and group rankings with the right weekly XP; duplicate/cap rejection observed once; offline earn → online flush works.
  - Magic link to Hernán's email is NOT sent by the agent (outward-facing); instead the redirect handling is verified by the documented path and listed for Hernán to try by hand.
  - Test users deleted; `npm run verify` → exit 0.
- Outcome:

## T41 — Bring main (plan 003, pictures) into the Liga branch
- Status: done
- Depends on: T35, T36
- Goal: Merge the current `main` (plan 003's pictures work) into the integration branch and resolve conflicts keeping both intents, so the branch can be fast-forwarded into main.
- Context: `git log main` for plan 003's commits; likely conflicts: `package.json`/`package-lock.json` (regenerate the lock with `npm install` after merging package.json), CLAUDE.md, docs, `src/lib/navigation.ts`, `src/components/ui/index.ts`. Plan 003 is finished on main (`Status: done`). Other sessions may have added more commits to main; merge whatever main has.
- Scope: may touch any file only to resolve merge conflicts / must not add features or refactor.
- Done when:
  - `git merge main` completed with no conflict markers left (`git grep -n '<<<<<<<'` → nothing).
  - `npm run content:check`, `npm run db:check` and `npm run verify` → exit 0.
  - Liga still hidden without env vars; pictures (plan 003) still render (spot-check one lesson and Jugar by hand).
  - Note: T42 may land before or after this task; the merge only resolves conflicts.
- Outcome: real merge of main 01832a7 (plan 003 done), no conflicts; content:check, db:check, verify green; pictures and hidden Liga spot-checked → 0b2524d

## T42 — Local fake Supabase with fake players
- Status: done
- Depends on: none
- Goal: Let Hernán and the agents try Liga end to end with fake users before the real Supabase project exists: a small local server that imitates the parts of Supabase the app uses, backed by the local Postgres with the real migrations, plus a seed of fake players.
- Context: Shared contract; docs/league.md (RPC contract, Local SQL check); `scripts/db/` (db:check, auth-stub.sql: reuse it); `src/lib/league/client.ts` and `account.ts` (exactly which supabase-js auth and rest endpoints the client calls: anonymous sign-up, token refresh, get user, update user/email, sign-in OTP, sign-out, `/rest/v1/rpc/<fn>`). No Docker on this Mac; Postgres 17 runs locally.
- Scope: may touch `scripts/league-local/**` (new), `package.json` (scripts only, no new dependencies unless tiny and dev-only), docs/league.md (a "Try it locally" section), CLAUDE.md (commands table rows), `.env.example` (comment showing the local values) / must not touch `src/**`, `supabase/migrations/**`, `content/**`.
- Done when:
  - `npm run league:local` creates (or resets with `--reset`) a dedicated local database `lang_lern_league_local` (never touches other databases), applies auth-stub + migrations, and serves on http://localhost:54321 the endpoints supabase-js uses: anonymous sign-up issuing a signed JWT (HS256, local secret) with refresh, get/update user (email linking simulated: no email is sent; the magic link URL is printed to the console so it can be opened by hand), sign-out, and `POST /rest/v1/rpc/<league_*>` executed as role `authenticated` with the JWT `sub` (like PostgREST), returning Supabase-shaped JSON and errors; CORS for localhost:3000 and :4173. It prints the two env values to use.
  - `npm run league:seed` adds ~15 fake players (clearly fake nicknames, emojis from the fixed list) with XP events spread over this week and last week, two of them plus a few others in a group with a printed join code, so the global/group rankings and last week's podium have content. Idempotent (`--reset` wipes and reseeds).
  - With `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321` + the printed anon key in the shell, `npm run dev` lets a browser join Liga, and a small scripted check (`npm run league:local:check` or similar) proves sign-up → set_profile → record_xp → leaderboard → delete_me over HTTP with two users.
  - docs/league.md "Try it locally" explains the 3 commands and how to play as several users (separate browser profiles / private windows).
  - `npm run verify` → exit 0.
- Outcome: Node built-ins + psql only; GoTrue/PostgREST-shaped endpoints, magic links printed; 15 bots + group PRUEBA; league:local:check 23 checks and db:check 171 green on Postgres 16; real supabase-js verified against it (anon sign-in, RPCs, errors, updateUser, otp, refresh); `npm run verify` green → 6909ec2

## Review queue
- [ ] T38 @f329004 (queued 2026-10-02 💻)
- [ ] T39 @7f21c79 (queued 2026-10-02 💻)

## Visual checks queue
- [ ] T38: /liga/ leaderboard in both themes at 375 px (Grupo with group, offline banner, me outside top 50) (queued 2026-10-02 💻)
- [ ] T39: Ruta card (joined, invite, dismissed, offline) and Perfil Liga row, both themes at 375 px; nothing Liga without env vars (queued 2026-10-02 💻)

## Decisions
- 2026-10-01 plan: runs on integration branch `claude/usuarios-competencia-puntajes-3caa9b`, in parallel with plan 003 on main; T41 merges main back (Hernán)
- 2026-10-01 plan: Supabase; account optional; groups (one per person, minimal) + one global table; weekly XP (Monday Europe/Madrid); only XP events in the cloud; nickname + emoji; magic link (default SMTP for now, only Hernán's email works); reasonable server-side limits against cheating; Hernán applies migrations (Hernán)
- 2026-10-01 plan: Liga lives at /liga/ under Perfil plus a Ruta card, no new tab (Hernán)
- 2026-10-01 plan: only XP earned after joining counts for the weekly ranking; rankings per language; top 50 + me; delete-my-data included; SQL validated on local Postgres via `npm run db:check` (orchestrator)
- 2026-10-01 T33: tables in private `league` schema (RLS on, no grants); clients only call 9 `public.league_*` RPCs (authenticated only); caps 100 XP/event, 2500 XP/user/lang/Madrid day, 200 events/batch; events before join rejected (`before_join`); profile stats sent via `league_record_xp(events, stats)`; every per-event status is final so the client drops every returned id; errors = P0001 with token message (e.g. `nickname_taken`); leaderboard rows have `is_me`, no user ids, ties share rank; group scope lists all members, global lists players with XP + caller; fixed list of 24 emojis in docs/league.md (T36 must copy it); editable blocklist table; empty group deleted when last member leaves; `league_delete_me` keeps the anonymous auth user; added supabase/config.toml (agent)
- 2026-10-01 T34: extra account status `loading`; implicit auth flow (PKCE only works in the requesting browser); account cached on device as `lang-lern:league-account`; change event `lang-lern:league-account-change` with reason joined/updated/user_changed/signed_out/deleted/status; hook also exposes updateProfile/refresh/linkError/pendingEmail/online; supabase-js 2.117.2 pinned; /liga/ placeholder in `src/app/liga/LeagueView.tsx` (agent)
- 2026-10-01 T34: first integration reverted only because the integration checkout lacked the new dependency; ran `npm ci` there and re-integrated (orchestrator)
- 2026-10-01 T35: scope widened to a `LeagueSync` mount in layout.tsx so the sync can start on app start (orchestrator)
- 2026-10-01 plan: T35/T36 orphaned by a session restart; WIP committed (e17cdb0, de3d16e) and relaunched as continuations (orchestrator)
- 2026-10-01 plan: new T42 local fake Supabase + fake players so Liga can be tried before the real project; T41 (merge main) moved up to right after T35/T36 since plan 003 is done; T37 now depends on T41 and T42 (Hernán)
- 2026-10-01 T35: hook point = `saveResult()` in progress/index.ts dispatches window event `lang-lern:xp-award` (progress never imports Liga); XP `source` derived from route (/jugar/ → game, /historias/ → story, else activity); outbox cleared only on signed_out/deleted/user_changed; stats rejected as `stats_invalid` are dropped so events still pass; backoff 5 s → 10 min ±20 % (agent)
- 2026-10-01 T36: "Cerrar sesión en este móvil" only shown once an email is linked (an anonymous account could never be recovered); link-error copy in copy.ts with "Entendido" (agent)
- 2026-10-01 T41: integrated as a real merge (not squash) so main's history becomes an ancestor of the Liga branch and the final merge into main is clean (orchestrator)

- 2026-10-01 T42: fake server in `scripts/league-local/` with fixed local JWT secret (stable anon key, also in .env.example as a comment); extra schema `local_auth` (refresh tokens, links, applied migrations, seed users) only in the local DB; seed writes straight into `league.*` as superuser (record_xp would reject backdated events); `--reset` also works as `npm run x --reset` (agent)
- 2026-10-01 T42: cloud session has Postgres 16 (not 17) and no npm registry access; db:check passes on 16; verify must be run by Hernán (orchestrator)
- 2026-10-01 T42: later cloud session had npm access: `npm run verify` green on the T42 code (orchestrator)
- 2026-10-01 T37: group cached per user id; invite code kept on device so it survives the join flow and the email-sign-in redirect; JoinFlow got an `onJoined` callback for the invite page; checked by a Playwright script (2 users: create, invite link → join Liga → auto-join, switch to PRUEBA, leave last member deletes group, unknown/deleted code errors, invalid link) (agent)
- 2026-10-02 plan: merged into main before T38 so plan 005 (Prepárate) can land; Liga stays hidden without Supabase env vars (Hernán)

## Proposals (new scope)
- 2026-10-01 T33: custom SMTP (e.g. Resend) so friends can link their email; fill the real Vercel domain in docs/league.md
- 2026-10-01 T34: on an iPhone home-screen app the magic link opens in Safari (separate storage), so the session lands in Safari; fix = 6-digit code typed in the app (`verifyOtp` + email template change)

## Log
- 2026-10-01 16:20 T33 launched · attempt 1 · agent a1d5ff0695d0cd3a0
- 2026-10-01 16:31 T33 done · branch worktree-agent-a1d5ff0695d0cd3a0 → 819a45d
- 2026-10-01 16:32 T34 launched · attempt 1 · agent aab5f5c3059dcbe63
- 2026-10-01 16:41 T34 done · branch worktree-agent-aab5f5c3059dcbe63 → 96ffc72 (first attempt 24da942 reverted by 050a742: missing deps in integration checkout)
- 2026-10-01 16:44 T35 launched · attempt 1 · agent aaedbb5286e79fc64
- 2026-10-01 16:44 T36 launched · attempt 1 · agent a800f3382a1ab7473
- 2026-10-01 T35/T36 orphaned (session restart) · WIP e17cdb0 / de3d16e
- 2026-10-01 T35 relaunched (interrupted continuation) · attempt 1 · agent ac830d833ddf8d34c · old branch worktree-agent-aaedbb5286e79fc64
- 2026-10-01 T36 relaunched (interrupted continuation) · attempt 1 · agent a2fbb57240abcaf4f · old branch worktree-agent-a800f3382a1ab7473
- 2026-10-01 17:34 T35 done · branch worktree-agent-ac830d833ddf8d34c → 69099df
- 2026-10-01 17:35 T42 launched · attempt 1 · agent a7da1ef41206a92d0
- 2026-10-01 17:36 T36 done · branch worktree-agent-a2fbb57240abcaf4f → 9ed886b
- 2026-10-01 17:37 T41 launched · attempt 1 · agent a8db55a71f4cd5046
- 2026-10-01 17:39 T41 done · fast-forwarded to merge commit 0b2524d (parents ed57436 + main 01832a7)
- 2026-10-01 T42 attempt 1 stalled (unpushed) · restarted directly in a cloud session
- 2026-10-01 T42 done · 6909ec2 (verify pending: no npm registry in the cloud env)
- 2026-10-01 T37 done · fc09e61 (cloud session)
- 2026-10-02 T42 verify green after network access was opened; supabase-js smoke against league:local OK
- 2026-10-02 19:15Z 💻 plan merged into main up to T37 (T38–T40 pending); old cloud branches superseded
- 2026-10-02 19:26Z 💻 writer taken on 💻, new work branch from main
- 2026-10-02 19:31Z 💻 T38 done @f329004
- 2026-10-02 19:33Z 💻 T39 done @7f21c79
- 2026-10-04 17:04Z 💻 Supabase keys loaded in .env.local + Vercel Production (migrations up to date); T40 launched
- 2026-10-04 17:05Z 💻 T40 blocked: anonymous sign-ins disabled on real project; nothing created
