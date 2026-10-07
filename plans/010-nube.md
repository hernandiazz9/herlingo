# Plan 010 — Nube: cloud save and restore of all on-device data through the Liga account

Status: active
Created: 2026-10-07
Base branch: plan-010-nube
Goal: Today all progress lives only in localStorage (`lang-lern:*`): deleting the home-screen app, losing the phone or moving from the Safari tab to the installed PWA (iOS keeps them apart) loses it; the only way out is Perfil → Copia de seguridad. Add "Guardado en la nube": an automatic copy of the same backup blob in Supabase, tied to the existing Liga account (anonymous user + optional email magic link), restorable on a new device or after a reinstall by signing in with the email link. The device stays the source of truth and the app works offline as today; the cloud is a copy, conflicts are never resolved silently, and replaced local data can always be undone. Hidden when Liga is not configured. MVP speed: no automated tests; verification is `npm run verify` (+ `npm run db:check` and the local fake Supabase check for SQL/client tasks).
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-07 22:24Z 💻
- Writer: me (💻 desktop)
- Branch: plan-010-nube @ cfe71d6 (from main) · worktree .claude/worktrees/plan-010 · not pushed
- Next step: T130 running; then T131
- Needs Hernán: -

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, docs/brief.md (says "no accounts, no server": this plan is a second recorded exception like Liga's; do not edit brief.md), docs/league.md (decision record, schema, RPC contract, caps, "Try it locally"), `src/lib/backup/index.ts`, `src/lib/league/` (`config.ts`, `client.ts`, `account.ts`, `outbox.ts`, `sync.ts`, `errors.ts`). UI copy is Spain Spanish with "tú", accessible names too; tokens only, both themes.
- **One format.** The cloud blob IS the Perfil backup: `{ app: "lang-lern", format: 1, exportedAt, data: { <key>: <raw string> } }` built by `collectBackup` and checked by `parseBackup`, applied by `applyBackup` (with its rollback). No second format.
- **Keys in the blob** = `isCloudSaveKey(key)` (new, in `src/lib/backup/`): `isBackupKey(key)` minus every `lang-lern:league-*` key (auth session with refresh token, account cache, outbox, groups, rankings, invites: all tied to one account or rebuildable from the server) minus the bookkeeping key `lang-lern:cloud-save`. The outbox is deduplicated server-side (`xp_events.id` primary key, `on conflict do nothing`), but it carries a `userId` and is excluded anyway. Restoring a cloud copy never removes or overwrites a key outside `isCloudSaveKey` (theme and the coach access code stay on the device as today).
- **File backups stop carrying the Liga session** (T131): `isBackupKey` also excludes `lang-lern:league-auth`; importing an old file that contains it ignores that key and keeps the device's own session (no silent sign-out). Every other existing key keeps its name and shape.
- **Bookkeeping key** `lang-lern:cloud-save` = `{ v: 1, enabled: boolean, userId: string | null, rev: number | null, hash: string | null, dirty: boolean, lastSyncAt: string | null, lastError: string | null }` (tolerant parsing; missing = enabled true, nothing synced). `rev`/`hash` belong to `userId`: a different signed-in user resets them.
- **Server (T130)**, new migration `supabase/migrations/20261008000000_league_save.sql`, private schema `league`, RLS on with no policies, no table grants:
  - table `league.saves (user_id uuid primary key references auth.users on delete cascade, data jsonb not null, rev bigint not null, size int not null, updated_at timestamptz not null, window_start timestamptz, window_writes int)`.
  - `public.league_save_head() → { rev, size, updated_at } | null` (cheap status, no data).
  - `public.league_save_get() → { rev, size, updated_at, data } | null`.
  - `public.league_save_put(p_data jsonb, p_base_rev bigint) → { status: "ok" | "conflict", rev, size, updated_at }`: `p_base_rev` null = "I have never seen a cloud copy" (ok only if no row); otherwise ok only if it equals the stored rev; ok → rev + 1. Conflict returns the stored head and writes nothing. Rejects with tokens: `save_invalid` (not an object with `app = "lang-lern"`, integer `format`, object `data`), `save_too_large` (`octet_length(p_data::text)` > 2 MiB = 2097152), `save_rate_limited` (> 120 writes per rolling hour per user, counter in the row).
  - `public.league_save_delete() → void`; `league_delete_me()` is re-created (`create or replace` in the new migration) to also delete the user's save.
  - All `security definer set search_path = ''`, user from `league.require_uid()`, errors as P0001 snake_case tokens, `revoke` from public/anon, `grant execute` to authenticated — same pattern as the existing league RPCs. Names stay `league_*` (the local fake server only allows that prefix).
- **Client (T131)** `src/lib/cloud-save/` (framework-free + hooks in `use-cloud-save.ts`; supabase only through `leagueRpc`):
  - Active only when `leagueEnabled()`, the Liga account is joined (signed-in user) and `enabled`. Otherwise it does nothing and no request is made.
  - Change detection: hash of the blob's `data` (key-sorted, `exportedAt` excluded) compared with the stored `hash`; checked on the app's existing change events where they exist (storage event, progress/settings change events), on `visibilitychange` → hidden, on `online`, at start, and every 15 s while visible. A difference sets `dirty`.
  - Upload: debounced 5 s after the blob changes, at most one put per 30 s; at start and on `online` when `dirty`. Offline or a network error → stays dirty, retried with back-off (like `sync.ts`). `save_too_large` / `save_rate_limited` → `lastError`, shown on Perfil, no tight retry loop.
  - Put sends the last seen `rev`. `conflict` → stops uploading and raises the conflict state for T132; it never overwrites.
  - Nothing in the learning flow awaits it; failures never throw into the UI.
  - Exposed API (names fixed so T132/T133 can rely on them): `getCloudSaveState()`, `subscribeCloudSave(fn)`, `useCloudSave()` → `{ status: "off" | "no-account" | "idle" | "dirty" | "uploading" | "offline" | "error" | "conflict" | "restore-available", lastSyncAt, lastError, size, needsEmail }`, `setCloudSaveEnabled(on)`, `syncNow()`, `fetchCloudCopy()` → `{ rev, updated_at, backup }`, `summarizeBackup(backup)` → `{ xp, lessonsDone, lastActivity }` (sum over every `lang-lern:progress:<lang>`: `xp`, number of `lessons`, latest `streak.last`; via `parseProgress`), `isLocalEmpty()` (no progress key with xp > 0 or lessons), `keepLocalCopy()` (put with the cloud's current rev after an explicit choice), `restoreCloudCopy()` (T132).
- **Conflict/restore (T132)**: launch check after the account is known. Local empty + cloud has data → offer restore ("Tienes una copia en la nube del <fecha>. ¿Restaurarla?"). Both have data and the hashes differ, with no matching `rev` → dialog "¿Qué copia quieres conservar?" showing for each side total XP, lessons done, last activity date; choices "Esta del móvil" / "La de la nube" / "Decidir luego" (stays in `conflict`, no uploads). Before applying a cloud copy, the replaced local blob is kept in Cache Storage `lang-lern-cloud-undo` (one entry, the last replaced copy, with its date) and offered as "Deshacer restauración" and "Descargar copia anterior" for 7 days; the SW never deletes that cache (check `scripts/pwa/sw.template.js` cache cleanup). After restore: `announceStorageReplaced()`, `rev`/`hash` = cloud's, not dirty. Never `localStorage.clear()`.
- **Perfil (T133)**: card "Guardado en la nube" (only when `leagueEnabled()`), next to Copia de seguridad: status line ("Guardado hace 2 min", "Pendiente: sin conexión", "Pendiente de subir", "Desactivado", "Hay un conflicto: elige qué copia conservar", error text), size, on/off switch, "Guardar ahora", "Restaurar desde la nube" (confirmation dialog, then T132's restore with undo), and a call to action when needed: no Liga account → "Crea tu cuenta en la Liga para guardar en la nube" (link `/liga/`); account without email → "Vincula tu email para poder recuperar tu progreso en otro móvil" (the existing link-email flow on /liga/). One line of privacy copy: the copy (progress, saved Prepárate packs, Sobre mí) is stored on the Liga server.
- **Deletion (T134)**: deleting the Liga account (`league_delete_me`, server side in T130) deletes the cloud save; the client resets `lang-lern:cloud-save` (keeps `enabled`) and shows nothing about the cloud until a new account exists. Turning the switch off stops uploads but keeps the cloud copy ("Borrar copia de la nube" button calls `league_save_delete`, with confirmation).
- SQL: new migration file only, never edit applied ones; `scripts/db/smoke.sql` extended; `npm run db:check` exit 0. Never touch the real project (Hernán runs `npx supabase db push`).
- Verification: `npm run verify` → exit 0 for every task. UI changes: check light and dark at 375 px with `npm run dev` (+ `npm run league:local`) when the agent can; otherwise the writer queues a Visual line.

## Tasks

## T130 — Migration: `league.saves` + save RPCs + smoke SQL
- Status: running (attempt 1 · 💻 · since 22:40Z)
- Depends on: none
- Where: pc (local Postgres for `npm run db:check`)
- Goal: Write `supabase/migrations/20261008000000_league_save.sql` per the Shared contract ("Server"): table, `league_save_head/get/put/delete`, size cap 2 MiB, 120 writes/hour rate limit, `league_delete_me` re-created to also delete the save. Extend `scripts/db/smoke.sql`: two users; put with null base → ok rev 1; put base 1 → rev 2; stale base → conflict, data unchanged; user B cannot see A's save; anon cannot call; too large / invalid → tokens; rate limit hit; `league_delete_me` removes the save; deleting the auth user cascades.
- Context: `supabase/migrations/20261001000000_league.sql` (pattern: `require_uid`, P0001 tokens, revoke/grant block at the end), `20261006000000_league_multi.sql`, `scripts/db/auth-stub.sql`, `scripts/db/smoke.sql` (`smoke.ok`, `smoke.err`, `smoke.login`), `scripts/db/check.ts`, docs/league.md "RPC contract".
- Scope: may touch `supabase/migrations/20261008000000_league_save.sql` (new), `scripts/db/smoke.sql`, `scripts/league-local/**` only if the fake server needs it / must not touch existing migration files, `src/**`, `docs/**`, `plans/`.
- Done when:
  - `npm run db:check` → exit 0 with the new smoke assertions.
  - `git diff --stat supabase/migrations` → only the new file.
  - `npm run verify` → exit 0
- Outcome:

## T131 — Client module `src/lib/cloud-save/` + key exclusions + local HTTP check
- Status: pending
- Depends on: T130
- Where: pc (local fake Supabase for the HTTP check)
- Goal: Add `isCloudSaveKey` and the `league-auth` exclusion in `src/lib/backup/` (file import ignores that key and keeps the device's session), and the client module per the Shared contract ("Client"): bookkeeping key, hash, change detection, debounced/throttled upload with optimistic concurrency, offline retry, conflict state, the exposed API and hook. Start it from the app shell (like Liga's sync) only when `leagueEnabled()`. Extend `npm run league:local:check` (or a sibling `league:local:save-check` script in package.json) with put → get → stale put = conflict → head → delete against the fake Supabase.
- Context: `src/lib/backup/index.ts`, `src/lib/league/client.ts` (`leagueRpc`), `account.ts` (account change event `lang-lern:league-account-change`), `sync.ts` (start/online/visibility triggers, back-off), `src/lib/progress/index.ts` (`parseProgress`), `src/app/perfil/BackupSection.tsx` (current file import/export), `scripts/league-local/check.ts`, `shared.ts`.
- Scope: may touch `src/lib/cloud-save/**` (new), `src/lib/backup/**`, `src/app/layout.tsx` or the shell component that starts Liga sync, `scripts/league-local/**`, `package.json` (script line only) / must not touch `src/lib/league/**` except one export if strictly needed (report it), `supabase/**`, `src/app/perfil/**` (T133), `plans/`.
- Done when:
  - `npm run league:local` + the extended check → exit 0 covering put, get, conflict, delete.
  - A tsx snippet shows `isCloudSaveKey` false for `lang-lern:league-auth`, `lang-lern:league-outbox:it`, `lang-lern:cloud-save`, `lang-lern:coach:access`, true for `lang-lern:progress:it` (report output).
  - With Liga env unset (`leagueEnabled()` false) no request is made (report how checked).
  - `npm run verify` → exit 0
- Outcome:

## T132 — Conflict and restore flow with undo
- Status: pending
- Depends on: T131
- Where: any
- Goal: Per the Shared contract ("Conflict/restore"): launch check, restore offer on an empty device, the "¿Qué copia quieres conservar?" dialog with XP / lessons / last activity per side, `keepLocalCopy` and `restoreCloudCopy` (undo copy in Cache Storage `lang-lern-cloud-undo`, "Deshacer restauración", "Descargar copia anterior" for 7 days), reusing `applyBackup` and its rollback. Confirm the SW does not delete the undo cache.
- Context: Shared contract; `src/lib/cloud-save/` (T131), `src/lib/backup/index.ts` (`applyBackup`, `announceStorageReplaced`, `serializeBackup`, `backupFileName`), `src/app/perfil/BackupSection.tsx` ("Descargar la copia anterior" model), `scripts/pwa/sw.template.js` (cache cleanup), `src/components/ui`.
- Scope: may touch `src/lib/cloud-save/**`, `src/components/cloud-save/**` (new), the app shell component that mounts global prompts (like UpdatePrompt), `scripts/pwa/sw.template.js` only if the undo cache would be deleted / must not touch `src/lib/league/**`, `supabase/**`, `src/app/perfil/**` (T133), `plans/`.
- Done when:
  - Against `npm run league:local` with two browser profiles (or two localStorage states): empty device → restore offered → restored → undo brings the previous data back; both with data → dialog shows both summaries; each choice does what it says; "Decidir luego" uploads nothing (report how checked).
  - `grep -rn "localStorage.clear" src` → nothing.
  - `npm run verify` → exit 0
  - Hand check (PC): restore offer and conflict dialog in light and dark at 375 px.
- Outcome:

## T133 — Perfil card "Guardado en la nube"
- Status: pending
- Depends on: T132
- Where: any
- Goal: Per the Shared contract ("Perfil"): the card with status line, size, switch, "Guardar ahora", "Restaurar desde la nube" with confirmation, "Borrar copia de la nube" with confirmation, the Liga-account and link-email calls to action, privacy line. Hidden when `leagueEnabled()` is false.
- Context: `src/app/perfil/ProfileView.tsx` (`LeagueLink`, `BackupSection` placement), `src/app/perfil/BackupSection.tsx` (card style), `src/lib/league/use-league-account.ts` (email / pendingEmail), `src/lib/cloud-save/use-cloud-save.ts`, `src/components/cloud-save/` (T132 dialogs), `src/components/ui`.
- Scope: may touch `src/app/perfil/**`, `src/components/cloud-save/**` / must not touch `src/lib/league/**`, `src/lib/backup/**`, `supabase/**`, `plans/`.
- Done when:
  - With `npm run league:local`: each status shows (off, no account, no email, synced "hace …", offline pending, conflict, error); the switch, Guardar ahora, Restaurar, Borrar behave (report how checked).
  - Without Liga env the card is absent and Perfil looks as today.
  - `npm run verify` → exit 0
  - Hand check (PC): the card in light and dark at 375 px, every status.
- Outcome:

## T134 — Account deletion wiring, docs, CLAUDE.md
- Status: pending
- Depends on: T133
- Where: any
- Goal: Client side of deletion per the Shared contract ("Deletion"): after `deleteLeagueAccount()` and on account `deleted`/`user_changed`, reset `lang-lern:cloud-save` (keep `enabled`); the /liga/ delete confirmation copy says the cloud save is deleted too. Docs: new `docs/cloud-save.md` (decision record: second exception to "no accounts, no server", what is in the blob and what is excluded and why, RPC contract, caps with the 2 MiB / 120 per hour reasoning, client states, conflict policy, undo, try it locally), a link and short "Cloud save" section in docs/league.md (RPCs + delete behaviour), CLAUDE.md folder line for `src/lib/cloud-save/` and `src/components/cloud-save/`, convention line (blob = backup format, `isCloudSaveKey`, `lang-lern:cloud-save`, `lang-lern-cloud-undo` never deleted by the SW).
- Context: `src/lib/league/account.ts` (`deleteLeagueAccount`, change event), `src/app/liga/` (delete confirmation), docs/league.md, CLAUDE.md, the T130–T133 commits.
- Scope: may touch `src/lib/cloud-save/**`, `src/app/liga/**` (delete copy only), `docs/cloud-save.md` (new), `docs/league.md`, `CLAUDE.md` / must not touch `docs/brief.md`, `supabase/**`, `plans/`.
- Done when:
  - With `npm run league:local`: delete the account → `league_save_head` for that user returns nothing (the check or a psql query) and Perfil shows the no-account state (report how checked).
  - `npm run verify` → exit 0
- Outcome:

## Review queue

## Visual checks queue

## Decisions
- 2026-10-07 plan: no new login; the Liga account (anonymous Supabase user + optional email magic link) is the identity; restoring on another device needs the email linked; never store credentials or passwords in any table. (Hernán)
- 2026-10-07 plan: the device stays the source of truth; the cloud is a copy; nothing in the learning flow waits for the network. (Hernán)
- 2026-10-07 plan: one row per user (jsonb backup blob + rev + updated_at + size); optimistic concurrency, a rev mismatch is a conflict, never a silent overwrite. (Hernán)
- 2026-10-07 plan: conflict policy v1 = restore offer on an empty device, otherwise choose a whole copy (XP, lessons, last activity per side); no field-by-field merge. (Hernán)
- 2026-10-07 plan: hidden when `leagueEnabled()` is false; deleting the Liga account deletes the cloud save. (Hernán)
- 2026-10-07 plan: plan numbered 010 (not 009 as in the brief: 009-ruso and 009-ingles-b2-c1 already exist; last task id was T129); branch `plan-010-nube` from main in worktree `.claude/worktrees/plan-010`. (orchestrator)
- 2026-10-07 plan: the current backup includes `lang-lern:league-auth` (Supabase session with refresh token): excluded from the cloud blob and, from T131, from file backups too. (orchestrator; approved by Hernán 2026-10-07)
- 2026-10-07 plan: all `lang-lern:league-*` keys excluded from the cloud blob (outbox is deduped server-side by event id, but is per user; the rest is rebuildable). (orchestrator; approved by Hernán 2026-10-07)
- 2026-10-07 plan: size cap 2 MiB per save: estimated real backup 0.3–1 MB for 2–3 languages (SRS ~80 B/item, coach packs 5–15 KB each), well under `MAX_BACKUP_BYTES` (5 MiB); T133 shows the size so the cap can be revisited with a measured value. (orchestrator; approved by Hernán 2026-10-07)
- 2026-10-07 plan: rate limit 120 writes per rolling hour per user (client: 5 s debounce, ≥ 30 s between puts). (orchestrator; approved by Hernán 2026-10-07)
- 2026-10-07 plan: cloud save requires a joined Liga account (no anonymous user created just for saving); Perfil links to /liga/ otherwise. (orchestrator; approved by Hernán 2026-10-07)
- 2026-10-07 plan: undo copy kept in Cache Storage `lang-lern-cloud-undo` (localStorage has no room for a second copy), offered 7 days. (orchestrator; approved by Hernán 2026-10-07)
- 2026-10-07 plan: coach mp3s and lesson audio (Cache Storage) are not in the cloud copy; they are re-downloaded or regenerated. (orchestrator)
- 2026-10-07 plan: push policy: guarded push of `plan-010-nube` only; no merge into main, PR or deploy without Hernán's explicit OK; Hernán runs `npx supabase db push`. (Hernán)

## Proposals (new scope)
- 2026-10-07 plan: field-by-field merge of two copies (max XP, union of lessons and SRS by latest review) instead of choosing a whole copy.

## Log
- 2026-10-07 22:24Z 💻 plan written from Hernán's brief (prompt-009-nube.md); not approved yet
- 2026-10-07 22:40Z 💻 plan approved by Hernán ("hazlo en worktree y comienza"); T130 launched · attempt 1
