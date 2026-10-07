# Guardado en la nube — cloud save of the on-device data

An automatic copy of the Perfil backup in Supabase, tied to the Liga account, restorable on a new
device or after a reinstall by signing in with the email link. Plan: `plans/010-nube.md`.
Database side (Liga schema, auth, setup): `docs/league.md`.

## Decision record

- **2026-10-07, Hernán:** `docs/brief.md` says "single learner, no accounts, no server". Liga was
  the first recorded exception (`docs/league.md`); this is the **second**: a copy of the
  learner's on-device data on the Liga server. Everything else in the brief stands; the brief
  itself is not edited.
- **No new login.** The Liga account (anonymous Supabase user + optional email magic link) is the
  identity. Restoring on another device needs the email linked. No credentials or passwords are
  stored in any table. Cloud save needs a **joined** Liga account: no anonymous user is created
  just for saving; Perfil links to `/liga/` instead.
- **The device stays the source of truth.** The cloud is a copy; the app works offline as before
  and nothing in the learning flow waits for the network.
- **One row per user** (blob + `rev` + `size` + `updated_at`), optimistic concurrency: a stale
  revision is a conflict, **never a silent overwrite**.
- **Conflict policy v1:** restore offer on an empty device; otherwise the learner chooses a whole
  copy. No field-by-field merge (open proposal in the plan).
- **Hidden** when `leagueEnabled()` is false (no Supabase env vars): no card, no prompt, no
  request, no chunk loaded.
- **Deleting the Liga account deletes the cloud save.** Turning the switch off only stops uploads.
- Hernán applies the migration to the real project (`npx supabase db push`); agents only validate
  locally (`npm run db:check`, `npm run league:local:check`).

## What is in the copy

**One format.** The blob is the Perfil "Copia de seguridad" file format,
`{ app: "lang-lern", format: 1, exportedAt, data: { <key>: <raw string> } }`, built by
`collectBackup`, read by `parseBackup` / `toCloudBackup` and applied by `applyBackup` (with its
rollback), all in `src/lib/backup/`. There is no second format: a cloud copy can be downloaded as a
file and a file can be restored, with the same versioned, tolerant parsing of each store.

Keys = `isCloudSaveKey(key)` (`src/lib/backup/index.ts`): every `lang-lern:*` key of the file
backup (`isBackupKey`) **minus**:

| Excluded | Why |
| --- | --- |
| `lang-lern:coach:access` (Prepárate access code) | A secret; never in any backup (file too). |
| `lang-lern:league-auth*` (Supabase session, refresh token) | Tied to this device and account. Also out of **file** backups since plan 010: importing an old file that has it ignores it and keeps the device's own session (no silent sign-out). |
| every other `lang-lern:league-*` key (account cache, XP outbox, groups, rankings, invites) | Tied to one account or rebuildable from the server. The outbox is deduplicated server-side (`xp_events.id`), but carries a `userId`, so it stays out. |
| `lang-lern:cloud-save` (bookkeeping, below) | About this device and account, never part of a copy (file too). |
| probe keys (a segment starting with `__`) | Transient. |

So the copy holds progress for every language (lessons, XP, streak, SRS), settings, favourites,
game and story state, the active language, Prepárate saved packs and Sobre mí / assessments.

**Restoring a cloud copy** writes and removes only `isCloudSaveKey` keys: the Liga session and
cache, the coach access code and (when the copy has none) the theme stay on the device.

**Not in the copy:** Cache Storage. Lesson audio is downloaded again, generated Prepárate audio is
regenerated on first play. Theme: in the copy when set, like in the file.

## Server (migration `20261008000000_league_save.sql`)

Table `league.saves (user_id uuid primary key references auth.users on delete cascade, data jsonb,
rev bigint, size int, updated_at timestamptz, window_start timestamptz, window_writes int)`, in the
private `league` schema: RLS on, no policies, no grants. Only reachable through the RPCs below,
all `security definer set search_path = ''`, user from `league.require_uid()`, executable by
`authenticated` only. Errors: SQLSTATE `P0001` with a snake_case token as the message (same as
every Liga RPC; the client gets it as the `LeagueError` message).

| RPC | Returns | Notes |
| --- | --- | --- |
| `league_save_head()` | `{ rev, size, updated_at }` or `null` | Cheap status, no data. |
| `league_save_get()` | `{ rev, size, updated_at, data }` or `null` | The whole copy. |
| `league_save_put(p_data jsonb, p_base_rev bigint)` | `{ status: "ok" \| "conflict", rev, size, updated_at }` | `p_base_rev` null = "I have never seen a cloud copy": ok only if there is no row. Otherwise ok only if it equals the stored `rev`; ok → `rev + 1` (first write = 1). `conflict` writes nothing and returns the stored head (all `null` when there is no row). Serialized per user (advisory lock). |
| `league_save_delete()` | `void` | Deletes the caller's copy; no-op when none. |
| `league_delete_me()` | `boolean` | Re-created by this migration: also deletes the caller's copy (still `true` only if a profile was deleted). |

`league_save_put` errors:

| Token | When |
| --- | --- |
| `save_invalid` | Not an object with string `app = "lang-lern"`, integer `format` and object `data`. |
| `save_too_large` | `octet_length(p_data::text)` > **2 MiB** (2 097 152 bytes). |
| `save_rate_limited` | More than **120** successful writes in the user's current one-hour window. |

Order: validation and size first, then the revision check (a stale put over the limit is a
`conflict`, not `save_rate_limited`), then the rate limit. Only successful puts count.

### Caps

- **2 MiB per copy** (`league.save_max_bytes()`). Estimated real copy: 0.3–1 MB for 2–3 languages
  (SRS ≈ 80 B per item, saved Prepárate packs 5–15 KB each), well under the file backup's own
  ceiling (`MAX_BACKUP_BYTES`, 5 MiB, ≈ what localStorage holds). Perfil shows the copy's size so
  the cap can be revisited with a measured value.
- **120 writes per hour per user** (`league.save_max_writes_per_hour()`), a fixed one-hour window
  stored in the row (`window_start`, `window_writes`; a new window starts when the old one is an
  hour old). The client puts at most once per 30 s, i.e. 120 per hour from one device studying
  non-stop, so normal use never hits it; it stops a runaway loop or many devices at once from
  hammering the free-tier database.

To change a number, add a migration that redefines the function (never edit an applied one).

## Client (`src/lib/cloud-save/`, `src/components/cloud-save/`)

`src/lib/cloud-save/` is framework-free (hook in `use-cloud-save.ts`) and talks to Supabase only
through `leagueRpc`. It is started by `src/components/league/LeagueSync.tsx` (lazy import, only when
`leagueEnabled()`). It is **active** only when Liga is configured, the device has **joined** the
Liga (signed-in user with a profile) and the switch is on; otherwise it makes no request.

| File | What |
| --- | --- |
| `index.ts` | Bookkeeping, state, sync loop, actions (below). |
| `blob.ts` | `collectCloudBackup`, `hashData` (key-sorted `data`, `exportedAt` excluded; same data = same hash on every device), `toCloudBackup`, `summarizeBackup` (XP, lessons, last activity per copy), `isStoreEmpty`. |
| `undo.ts` | Undo copy of the last restore in Cache Storage `lang-lern-cloud-undo`. |
| `use-cloud-save.ts` | `useCloudSave()` → the state below. |
| `components/cloud-save/CloudSaveHost.tsx` | Mounted in the app layout; lazily loads `CloudSavePrompt` (restore offer, conflict dialog, undo panel). |
| `components/cloud-save/CloudSaveCard.tsx` | Perfil card "Guardado en la nube" (via `src/app/perfil/CloudSaveSection.tsx`, lazy). |

**Bookkeeping** `lang-lern:cloud-save` = `{ v: 1, enabled, userId, rev, hash, dirty, lastSyncAt,
lastError }`, tolerant parsing (missing or unreadable = enabled, nothing synced). `rev`/`hash`
belong to `userId`: another signed-in user starts from scratch, keeping `enabled`.

**State** (`getCloudSaveState()`, `subscribeCloudSave()`, `useCloudSave()`): `{ status, lastSyncAt,
lastError, size, needsEmail, enabled, promptDismissed }`.

| `status` | Meaning (Perfil status line) |
| --- | --- |
| `off` | Switch off ("Desactivado"). Nothing is uploaded; the cloud copy stays. |
| `no-account` | Not joined ("Sin cuenta de la Liga" + "Crea tu cuenta en la Liga…" → `/liga/`). |
| `idle` | Synced ("Guardado hace 2 min"; no copy yet → created with the next change). |
| `dirty` | Upload pending ("Pendiente de subir"). |
| `uploading` | Put in flight ("Guardando…"). |
| `offline` | Pending, no connection ("Pendiente: sin conexión"). |
| `error` | `lastError` = `save_too_large` / `save_rate_limited` / `save_invalid` (copy in `CLOUD_SAVE_ERRORS`). |
| `conflict` | Both sides have data and differ: uploads stop until the learner chooses. |
| `restore-available` | This device has no progress and the cloud has a copy. |

`needsEmail`: joined without a linked email → "Vincula tu email para poder recuperar tu progreso
en otro móvil" (link to `/liga/`).

**Sync loop.** Change detection = `hashData` of the local copy vs the stored `hash`, checked on the
stores' change events (`lang-lern:progress-change`, `settings-change`, `coach-change`…), the
`storage` event, `visibilitychange` (hidden → flush now), `online`, at start and every 15 s while
visible. A difference sets `dirty`. Upload 5 s after the last change, at most one put per 30 s,
sending the last seen `rev`. Before the first upload of a page (and after an account change) one
`league_save_head` checks the cloud: same revision → go on; different revision with the same data
→ adopt it; different data → `conflict` / `restore-available`. Offline and network errors stay
dirty and retry with back-off (5 s doubling up to 10 min). `save_rate_limited` retries after
15 min; `save_too_large` / `save_invalid` are not retried until the data changes (or "Guardar
ahora"). Nothing throws into the UI.

**Actions:** `setCloudSaveEnabled(on)`, `syncNow()` ("Guardar ahora"), `fetchCloudCopy()`,
`deleteCloudCopy()` ("Borrar copia de la nube", with confirmation; local data untouched),
`keepLocalCopy()`, `restoreCloudCopy()`, `undoCloudRestore()`, `isLocalEmpty()`,
`summarizeBackup()`.

## Conflict policy

Checked once per launch and per account change, after the account is known:

- **Empty device + cloud copy** (`isLocalEmpty()`: no language with XP or a lesson) → "Tienes una
  copia en la nube del <fecha>. ¿Restaurarla?" — **Restaurar** / **Ahora no**.
- **Both have data and the hashes differ** → "¿Qué copia quieres conservar?", with total XP,
  lessons done and last activity for each side:
  - **Esta del móvil** → `keepLocalCopy()`: put with the cloud's current `rev` (an explicit
    overwrite; if the cloud changed again in between → "vuelve a intentarlo").
  - **La de la nube** → `restoreCloudCopy()` (below).
  - **Decidir luego** (default) → stays in `conflict`, **nothing is uploaded**; the prompt hides
    for this page and Perfil offers "Elegir qué copia conservar". The next launch asks again.
- Same data on both sides → the device adopts the cloud's revision silently (nothing to choose).

## Restore and undo

`restoreCloudCopy()` (prompt, or Perfil "Restaurar desde la nube" with confirmation):

1. Reads the cloud copy (reuses the one read for the prompt if the head has not changed).
2. Saves the device's current copy (cloud keys) as the **undo copy** in Cache Storage
   `lang-lern-cloud-undo` (one entry: the last replaced copy, with its date) and reads it back. If
   it cannot be stored, **nothing changes** (localStorage has no room for a second copy, hence
   Cache Storage).
3. `applyBackup(store, copy, now, isCloudSaveKey)` (rolls back on a storage error), then the
   bookkeeping takes the cloud's `rev`/`hash` (not dirty) and `announceStorageReplaced()` makes
   every store re-read. Never `localStorage.clear()`.

For **7 days** the undo panel offers **Deshacer restauración** (puts the replaced data back,
removes the undo copy, forgets the revision: the next check finds the difference and asks again,
never a silent upload) and **Descargar copia anterior** (the replaced data as a backup file). The
service worker never deletes `lang-lern-cloud-undo` (`KEEP` in `scripts/pwa/sw.template.js`).

## Deletion

- **"Salir de la Liga y borrar mis datos"** (`/liga/`, its confirmation says the cloud copy goes
  too): `league_delete_me()` deletes the save with the rest; deleting the auth user in the
  dashboard cascades. The client gets the account change `deleted` and resets
  `lang-lern:cloud-save` (`userId`, `rev`, `hash`, dates, error; **`enabled` kept**); Perfil shows
  the no-account state until a new account exists. The data on the device is not touched.
- **Another user signs in** (`user_changed`, magic link on a device that had another account): the
  same reset; the new account starts with a head check (restore offer or conflict, never a silent
  overwrite of its copy).
- **Signing out** keeps the bookkeeping (the cloud copy still exists); signing back in to the same
  account carries on.
- **Switch off** stops uploads and keeps the cloud copy. **Borrar copia de la nube** calls
  `league_save_delete()` (with confirmation); with the switch on, the next change (or "Guardar
  ahora") creates a new copy.

## Try it locally

Same fake Supabase as Liga (`docs/league.md`, "Try it locally"):

1. `npm run league:local` (the migration is applied on start; `-- --reset` for an empty database).
2. `npm run dev` with the two printed values in `.env.local` (or in the environment), then join
   the Liga on `/liga/` and open Perfil → "Guardado en la nube".
3. Two devices = two browser profiles or a private window. Link an email (the magic link is printed
   in the `league:local` terminal) and "Entrar con mi email" on the other one to get the restore
   offer or the conflict dialog.
4. Inspect: `psql lang_lern_league_local -c 'select user_id, rev, size, updated_at, window_writes from league.saves;'`.
5. `npm run league:local:check` covers the save RPCs over HTTP (null head/get, put with null base →
   rev 1, stale put → conflict and data unchanged, another user cannot read it, `save_invalid`,
   `save_too_large`, delete → head null, `league_delete_me` removes the save). `npm run db:check`
   covers the same in SQL plus the rate limit and the cascade.
