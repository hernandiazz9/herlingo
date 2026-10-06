# Plan 006 — Multi-idioma: French pack, global points, multi-group Liga

Status: active
Created: 2026-10-06
Base branch: plan-006-multi-idioma
Goal: Turn the Italian trainer into a multi-language app where adding a language stays "content only". The learner picks the language they are studying (first launch and Perfil), stored on the device, and every screen uses that pack; Italian progress and every other on-device key survive untouched. French (`fr`) becomes the second pack: an everyday-life course from a basic level (docs/brief-fr.md), same format and volume as Italian, with fr-FR neural audio. Points become global: app XP adds every language, is always shown, resets on the 1st of each month and keeps a lifetime total; the streak is global. Liga XP is the weekly sum over all languages (still recorded per language), and a player can be in up to 10 groups at once plus the general table. The service worker keeps only the active language's audio offline. Order: code foundation first, then points and Liga, French content unit by unit in parallel slots, audio last on the Mac. MVP speed: no automated tests; verification is `npm run verify`.
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-06 09:05Z 💻
- Writer: 💻 desktop
- Branch: plan-006-multi-idioma (from main @ c970ea6)
- Next step: T58 + T63 running; then T59/T61 and French units
- Needs Hernán: -

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, docs/brief.md (app-wide decisions, do not edit), docs/brief-fr.md (French pack note, Hernán 2026-10-06), docs/content-guide.md, and docs/league.md for Liga tasks. UI copy is Spain Spanish with "tú", accessible names too.
- **Content only.** After this plan nothing in `src/`, `api/` or `scripts/` names a language: no `"it"`, `lang="it"`, "italiano", `it`-named fields. Language names in copy come from the pack (`pack.meta.name`, lower-cased inside sentences: "Tradúcelo al francés"); `lang` attributes from `pack.meta.lang`. Test/seed SQL and fixtures may use concrete languages.
- **Never lose on-device data.** Every existing `lang-lern:*` key keeps its name and shape (`progress:<lang>`, `favorites:<lang>`, `game:<lang>`, `stories:<lang>`, `coach:*:<lang>`, `league-*`, `settings`…). New state goes in new keys only: `lang-lern:active-lang` (T58), `lang-lern:activity` (T62), `lang-lern:league-groups` and new board cache keys (T64). Old keys a feature stops using are left in place, never deleted. Switching languages never reads, rewrites or clears another language's keys. Only explicit user actions remove data. New keys are versioned (`{ v: 1, … }`) with tolerant parsing and are covered by the Perfil backup automatically (`lang-lern:*`).
- **Default and active language.** Exactly one pack is the default: `pack.json` `"default": true` (Italian). `scripts/content.ts` writes it as `defaultLang` (today it is the first folder alphabetically, which would become `fr`). The active language = `lang-lern:active-lang` `{ v: 1, lang }` if it names an existing pack; else the first pack whose `lang-lern:progress:<lang>` is onboarded, default pack first (so Hernán's phone resolves to Italian with no prompt); else none = first launch, the picker shows. API (T58, `src/lib/content/active.ts` or similar, framework-free + one hook): `getActiveLang(): string | null`, `setActiveLang(lang)`, `subscribeActiveLang(cb)` (window event `lang-lern:active-lang-change`), `useActiveLang()` → `{ ready, lang, pack, setLang }` (`ready` false during server render/hydration; lang-dependent UI waits for it, no flash of the wrong language). `listPacks()` → every pack's meta, sorted with the default first.
- **Routes.** `/leccion/[id]/`, `/dialogos/[id]/`, `/historias/[id]/` generate params for every pack; a page finds the pack that owns the id (`findLessonPack(id)` etc.) and uses it. Ids (units, lessons, items, dialogues, stories, placement) are unique across all packs; `content:check` enforces it. Situation ids are per pack.
- **Schema (T58).** `pack.json` gains `default?: true`, `emoji?` (flag shown by the picker), `formalRegister: "lei" | "vous"` and `articles: string[]` (allowed vocab articles; Italian `il lo la l' i gli le`, French `le la l' les`). `Register` = `tu | lei | vous | neutral`; `content:check` allows only `tu`, `neutral` and the pack's `formalRegister`, and only the pack's `articles`. Italian content files stay byte-identical (only `content/it/pack.json` gets the new fields). There is no `numberWords` in the app (Hernán assumed one; numbers are content: French 70–99 is taught in unit `nombres`).
- **Audio offline (T61).** The SW precache no longer holds `/audio/<lang>/**`. Audio lives in one SW-owned cache per language, `lang-lern-audio-<lang>` (no build version: mp3 names are content hashes), filled with the active language's files from the build's audio list; files no longer listed are removed from it; filled first from any older cache that already holds the file (today's precache), then the network. The page tells the SW the active language (`postMessage`) at start and on every switch; after a switch has fully downloaded, the other languages' audio caches are deleted. Coach Cache Storage and the precache rules in CLAUDE.md stay as they are. A small client API reports progress (`{ lang, total, cached, state }`) for the picker.
- **App points (T62).** New key `lang-lern:activity` `{ v: 1, days: { "YYYY-MM-DD": { <lang>: xp } }, best }` (device-local dates, `src/lib/progress/dates.ts`), written by `saveResult()` for every award (0-XP activity marks the day too). Monthly XP = sum of the current local calendar month, all languages (resets on day 1; the first month counts from the update). Lifetime XP = Σ `progress:<lang>.xp` over every pack (never resets). **Streak is global** (Hernán): consecutive active days in `activity`, seeded on first run from each language's stored `streak { count, last }` so today's Italian streak carries over; `best` = max(seeded per-language bests, computed). Per-language `progress.streak` keeps being updated as today (Liga stats, backups). "Borrar progreso" of a language also removes that language's entries from `activity`.
- **Liga (T63 SQL, T64 client).** Hernán 2026-10-06: weekly XP = sum over all languages (Monday 00:00 Europe/Madrid, unchanged), `lang` still recorded on every event and stat; **daily cap 2500 per player per Madrid day across all languages**; a player can be in **up to 10 groups** at once (`too_many_groups`) plus the general table; joining another group no longer requires leaving. Leaderboard streak = max of the player's per-language stats (the device sends the global streak). New RPCs (names may be refined in T63, documented in docs/league.md): `league_status()` (profile, groups[], week, weekly_xp, global rank), `league_ranking(scope 'global'|'group', code)` and `league_podium(scope, code)`, `league_leave_group(code)`. The old RPCs (`league_me(lang)`, `league_leaderboard(lang, scope)`, `league_last_week_podium(lang, scope)`, `league_leave_group()`) keep working for app versions still installed (summed XP, "the group" = the earliest joined one) until a later cleanup migration. SQL changes = a new file in `supabase/migrations/` + `npm run db:check`; never edit the applied migration, never touch the real project (Hernán runs `db push`).
- **French content (T65–T72).** docs/brief-fr.md fixes unit ids, orders, situations, register, cast and volume; docs/content-guide.md fixes the format. Each content task owns its own files under `content/fr/` (no shared index); `content/fr/pack.json` is written by T58 and only T58 edits it (a content task that needs a change reports it). Content tasks do not run `npm run audio`/`npm run images` (T73 on the Mac does); they still set picture keys.
- Verification: `npm run verify` → exit 0 for every task. UI changes: check light and dark at 375 px with `npm run dev` or `npm run build && npm start` when the agent can; otherwise the writer queues a Visual line.

## Tasks

## T58 — Multi-pack foundation: default pack, active language, schema, routes
- Status: running (attempt 1 · 💻 · agent a8f0c979cd1939402 · since 09:05Z)
- Depends on: none
- Where: any
- Goal: The plumbing every other task builds on: an explicit default pack, the active-language store and hook, `listPacks()`, the per-pack schema rules (register, articles), ids unique across packs, static params for every pack on the three dynamic routes, and a meta-only `content/fr/pack.json` so the code runs with two packs.
- Context: Shared contract (Default and active language, Routes, Schema); `scripts/content.ts:57-111` (pack discovery, `defaultLang`), `src/lib/content/{index.ts,types.ts,schema.ts,build.ts}`, `src/app/leccion/[id]/page.tsx:10`, `src/app/dialogos/[id]/page.tsx:11`, `src/app/historias/[id]/page.tsx:11,39`; docs/brief-fr.md (situations, voices, register, articles).
- Scope: may touch `src/lib/content/**`, `scripts/content.ts`, `scripts/lib/**` if the content tool lives there, the three `[id]` route pages, `content/it/pack.json` (new fields only), `content/fr/pack.json` (new: `lang` fr, `name` "Francés", `nativeName` "Français", `speechLocale` fr-FR, voices from brief-fr, the 12 situations, `formalRegister` vous, `articles`, `emoji` 🇫🇷; Italian gets `emoji` 🇮🇹), docs/content-guide.md (multi-pack rules: register, articles, global ids, default pack), CLAUDE.md (folder layout and Content conventions lines) / must not touch other `content/it/**` files, `src/components/**` (except what the route pages need), `src/lib/progress/**`, `supabase/**`, `plans/`.
- Done when:
  - `npm run content:check` → `✓ content/it` and `✓ content/fr` (a pack without units is accepted, or the check says it is empty without failing); a duplicate id across packs, a `lei` item in fr or an unknown article fails with a clear message (try it on a throwaway copy, then revert).
  - `defaultLang` is `it` because of `"default": true`, not alphabetical order.
  - `getActiveLang()` resolves: stored key → onboarded progress (default pack first) → null; setting it fires the change event; the hook's `ready` is false on the server.
  - `out/leccion/`, `out/dialogos/`, `out/historias/` contain every Italian id as before.
  - `npm run verify` → exit 0
- Outcome:

## T59 — Every screen on the active pack
- Status: pending
- Depends on: T58
- Where: any
- Goal: Replace every implicit Italian with the active (or owning) pack: the ~25 `DEFAULT_LANG` uses and the silent `lang?` fallbacks, the ~25 `lang="it"` attributes, the Spanish copy that says "italiano", the `it`-named fields, the audio manifest preload, the league client's module-level `lang`, and the Italian-only coach fake pack. Behaviour with Italian active must not change.
- Context: Shared contract (Content only, Default and active language). Survey 2026-10-06: DEFAULT_LANG in `ReviewView.tsx:15`, `ProfileView.tsx:22`, `PathView.tsx:24`, `Onboarding.tsx:27`, `GameView.tsx:40`, `RutaCard.tsx:20`, `PackPractice.tsx:24`, `LevelInterview.tsx:93`, `CoachView.tsx:37`, `AboutMeCard.tsx:10`, `StoryView.tsx:9`, `LessonPlayer.tsx:73`, `progress/activity.ts:36`, `use-league-account.ts:58`, `Leaderboard.tsx:32`, `exercises/shared.tsx:11`, `league/account.ts:236,377`, `league/groups.ts:208,244,326`, `league/sync.ts:68`, `audio/index.ts:59`; silent fallbacks in `Phrasebook.tsx:20`, `DialogueList.tsx:5`, `StoryList.tsx:10`, `DialogueSimulator.tsx:10`, `DialoguePlayer.tsx:65`; `getPack()` defaults in content helpers, `game/index.ts:69,75`, `stories/games.ts:118`; `lang="it"` in game/Discover, game/Round, Picture/Dictation/FillGap/Match/Tiles/Speak/Choice exercises, GrammarTip, WordIntro, phrasebook ShowMode and PhraseList, lesson FeedbackSheet; copy in `Round.tsx:188,189,298`, `DictationExercise.tsx:29,46`, `TilesExercise.tsx:27`, `SearchHeader.tsx:46`; `it` fields in `MatchExercise.tsx`, `exercises/types.ts:94,106`, `generate.ts:395-431`, `stories/games.ts:41,48`; `api/_lib/fake.ts` (Italian-only fixture); `scripts/league-local/check.ts:207`; `src/lib/coach/practice.ts:27` (`"lei"` → pack `formalRegister`).
- Scope: may touch `src/**` (except `src/lib/content/**` beyond small helper additions), `api/_lib/fake.ts`, `scripts/league-local/check.ts` / must not touch `content/**`, `supabase/**`, `scripts/pwa/**`, `plans/`; no new stored keys or shapes.
- Done when:
  - `grep -rnE 'DEFAULT_LANG|lang="it"|italiano|Italiano' src api` → only the content loader's definition/fallback and comments that explain multi-language; no `it`-named fields.
  - Server render uses the default pack; the client switches to the active one when `ready` without a flash (pages wait for `ready`).
  - With a temporary `lang-lern:active-lang` = fr in the browser, Ruta, Repaso, Frasario, Jugar, Historias, Diálogos, Perfil and Prepárate render the (empty) French pack without crashing; back to it everything is as before.
  - `npm run verify` → exit 0
  - Hand check (PC): Italian lesson, game round, phrasebook, story and dialogue look and sound as before, light and dark, 375 px.
- Outcome:

## T60 — Language picker: first launch, Perfil, Ruta
- Status: pending
- Depends on: T59, T61
- Where: any
- Goal: Let the learner choose what to study. First launch with no active language → a picker before the welcome/placement (`/bienvenida/`), then that pack's onboarding. Perfil gets "Idioma que estudias" to switch at any time (each language keeps its own progress; a never-onboarded language goes to its welcome). Ruta shows the active language (name + flag/emoji from the pack) as a quick switch. The picker lists packs that have at least one unit, shows per-language progress and the offline-audio state from T61 ("Audio sin conexión: descargando 40 %"). Perfil's backup summary lists every language, not just the active one.
- Context: Shared contract; `src/app/bienvenida/**`, `components/path/Onboarding.tsx`, `PathView.tsx:32-34` (onboarded redirect), `ProfileView.tsx`, `BackupSection.tsx:86`; T61's audio-status API; T58's `useActiveLang`/`listPacks`.
- Scope: may touch `src/app/bienvenida/**`, `src/app/perfil/**`, `src/components/path/**`, `src/components/profile/**` (or wherever ProfileView/BackupSection live), new `src/components/language/**`, `src/lib/backup/**` (summary only) / must not touch `content/**`, `src/lib/progress/**` stored shapes, `src/components/league/**`, `scripts/pwa/**`, `plans/`.
- Done when:
  - Fresh browser profile → picker → choosing a language opens its welcome; Hernán's existing data (Italian onboarded, no active key) opens Ruta in Italian with no picker.
  - Switching it → fr → it keeps both languages' progress byte-identical (compare `localStorage` before/after).
  - `npm run verify` → exit 0
  - Hand check (PC): picker, Perfil section and Ruta switch in light and dark at 375 px; first launch on the installed PWA.
- Outcome:

## T61 — Service worker: offline audio for the active language only
- Status: pending
- Depends on: T58
- Where: any
- Goal: Stop precaching every language's audio (+~30 MB per language). The precache keeps the app; audio goes to one SW-owned cache per language filled for the active language, reusing files already cached by the current SW so the update does not re-download Italian.
- Context: Shared contract (Audio offline); `scripts/pwa/build.ts:26-46`, `scripts/pwa/sw.template.js` (IMMUTABLE regex :19, Range/206 handling, coach cache keep list), `src/lib/pwa/register.ts`, `UpdatePrompt.tsx`, `src/lib/audio/index.ts` (manifest fetch); CLAUDE.md "Offline PWA" and "Never lose the learner's on-device data".
- Scope: may touch `scripts/pwa/**`, `src/lib/pwa/**`, `src/lib/audio/**` (only if playback needs the new cache), CLAUDE.md ("Offline PWA" bullet), docs (a short section in an existing doc) / must not touch `src/components/**` beyond a provider mount in the layout, `content/**`, `public/audio/**`, `plans/`.
- Done when:
  - `out/sw.js` precache list has no `/audio/` URL; the build emits the per-language audio lists the SW reads.
  - `npm run build && npm start`: first load with Italian active fills `lang-lern-audio-it`; offline, Italian audio plays (206 for Range); switching to another pack fills its cache and then removes the Italian one; an SW update copies files from the old cache instead of the network (check the network panel).
  - The coach audio cache and every `localStorage` key are untouched by install, activate and switch.
  - `npm run verify` → exit 0
  - Hand check (PC): installed iPhone PWA updates via "Actualizar" and keeps Italian audio offline (airplane mode).
- Outcome:

## T62 — App points: monthly XP, lifetime XP, global streak
- Status: pending
- Depends on: T60
- Where: any
- Goal: XP is global and always shown: "XP de <mes>" (all languages, resets on day 1) on Ruta and Perfil, plus the lifetime total and a per-language breakdown in Perfil; the streak and best streak become global, seeded so today's Italian streak carries over.
- Context: Shared contract (App points); `src/lib/progress/{index.ts,activity.ts,dates.ts,use-progress.ts}` (`saveResult()`, streak update), `PathView.tsx:48-49`, `ProfileView.tsx:41-42,127` ("Borrar progreso"), `src/lib/league/sync.ts` (stats `streak_count`/`streak_best`: send the global streak).
- Scope: may touch `src/lib/progress/**` (new `activity` key; existing shapes unchanged), `src/components/path/PathView.tsx`, `src/components/profile/**`, `src/lib/league/sync.ts` (streak values only) / must not touch `src/components/league/**`, `src/lib/league/**` beyond sync.ts, `content/**`, `plans/`.
- Done when:
  - With Italian progress and a 5-day streak in `localStorage`, the first load creates `lang-lern:activity` with those 5 days, Ruta shows the same streak and "XP de octubre" counting from now; lifetime = Italian XP.
  - XP earned in fr adds to the monthly and lifetime totals and keeps the global streak; changing the device date to the next month resets the monthly figure only.
  - "Borrar progreso" of one language removes only that language (progress key and its `activity` entries).
  - `npm run verify` → exit 0
  - Hand check (PC): Ruta and Perfil numbers in light and dark at 375 px.
- Outcome:

## T63 — Liga SQL: global weekly sum, global daily cap, up to 10 groups
- Status: running (attempt 1 · 💻 · agent a0e011abed6b45031 · since 09:05Z)
- Depends on: none
- Where: pc (local Postgres for `npm run db:check` and `league:local`)
- Goal: A new migration that ranks on the sum of all languages, caps daily XP across languages, and lets a player be in up to 10 groups, with new RPCs for the multi-group client and the old RPCs kept working for installed app versions.
- Context: Shared contract (Liga); docs/league.md (whole); `supabase/migrations/20261001000000_league.sql` (members pk on user, `week_start`, daily cap per lang :378-383, leaderboards); `scripts/db/smoke.sql`, `scripts/db/auth-stub.sql`; `scripts/league-local/**` (seed, check); skills `supabase-postgres-best-practices` and `supabase`.
- Scope: may touch `supabase/migrations/<new timestamp>_league_multi.sql` (new), `scripts/db/**`, `scripts/league-local/**` (seed: players in several groups with XP in it and fr; check: the new RPCs), docs/league.md (decision record 2026-10-06, data model, rules, RPC contract, old-RPC compatibility) / must not touch the applied migration, `src/**`, `content/**`, `plans/`; never the real Supabase project.
- Done when:
  - `npm run db:check` → exit 0; smoke covers: join up to 10 groups and `too_many_groups` on the 11th, leave one group by code, weekly XP summed over it+fr, daily cap 2500 across languages, group/global rankings and podium with the new RPCs, old RPCs still answering (summed XP, earliest group), streak = max over stats, delete_me removes every membership.
  - `npm run league:local -- --reset && npm run league:seed && npm run league:local:check` → exit 0.
  - `npm run verify` → exit 0
- Outcome:

## T64 — Liga client: several groups and global rankings
- Status: pending
- Depends on: T59, T63
- Where: pc (local fake Supabase for the hand check)
- Goal: The Liga screens use the new RPCs: "Tus grupos" (up to 10: create, join by code or link without leaving the others, leave one with confirmation), rankings with General + one tab per group, podium per tab, the RutaCard showing the global weekly XP and rank ("todos los idiomas"). The outbox keeps sending every language's events and stats.
- Context: Shared contract (Liga, Never lose data); docs/league.md after T63 ("Client", "Sync"); `src/lib/league/{account.ts,groups.ts,sync.ts,leaderboard.ts,outbox.ts}`, `src/components/league/**`, `src/app/liga/**` (incl. `unirse/`), `RutaCard.tsx`.
- Scope: may touch `src/lib/league/**`, `src/components/league/**`, `src/app/liga/**`, `RutaCard.tsx`, docs/league.md ("Client" section) / must not touch `supabase/**`, `src/lib/progress/**`, `content/**`, `plans/`; old caches `lang-lern:league-group` and `league-board:<lang>:<scope>` are left in place (new keys instead).
- Done when:
  - Against `npm run league:local` + `league:seed`: join `PRUEBA` and a second group, see both tabs and the general table with summed XP; an invite link while in groups adds the group; leaving one keeps the others; the 11th group shows the limit message.
  - XP earned in it and fr both reach the server (outbox per language) and the weekly total is their sum.
  - `npm run verify` → exit 0
  - Hand check (PC): Liga screens in light and dark at 375 px with several groups.
- Outcome:

## T65 — French content: greetings, numbers and grammar cards
- Status: pending
- Depends on: T58
- Where: any
- Goal: Units `salut` (10) and `nombres` (12), the grammar cards and the grammar unit `grammaire` (90), per docs/brief-fr.md: basic everyday French, ~5-minute lessons ending with their Q&A, pronunciation tips for a Spanish speaker, numbers 70–99 and prices in their own lesson.
- Context: docs/brief-fr.md; docs/content-guide.md (format, quality rules, Pictures); `content/it/units/10-sopravvivenza.json` and `90-grammatica.json`, `content/it/extras/gramatica.json` as format models (not as content).
- Scope: may touch `content/fr/units/10-*.json`, `content/fr/units/12-*.json`, `content/fr/units/90-*.json`, `content/fr/extras/grammaire.json` / must not touch `content/fr/pack.json`, `content/it/**`, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓ for both packs; ~85 phrases, ~65 vocab, ~16 Q&A, ~10 grammar cards, 10–12 lessons in these three units.
  - Every phrase has `register` and an `explanation`; ids follow brief-fr ("Ids").
  - `npm run verify` → exit 0
- Outcome:

## T66 — French content: introducing yourself, family and friends
- Status: pending
- Depends on: T58
- Where: any
- Goal: Units `presenter` (20) and `famille` (22) per docs/brief-fr.md.
- Context: as T65 (format models `content/it/units/30-chiacchiere.json`, `32-persona-sobre-mi.json`); grammar card ids from brief-fr ("Grammar cards") may be referenced in lessons once T65 lands, otherwise leave them out.
- Scope: may touch `content/fr/units/20-*.json`, `content/fr/units/22-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~80 phrases, ~60 vocab, ~16 Q&A, 9–11 lessons.
  - `npm run verify` → exit 0
- Outcome:

## T67 — French content: home and routine, free time and weather
- Status: pending
- Depends on: T58
- Where: any
- Goal: Units `maison` (30) and `loisirs` (32) per docs/brief-fr.md.
- Context: as T66.
- Scope: may touch `content/fr/units/30-*.json`, `content/fr/units/32-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~80 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons.
  - `npm run verify` → exit 0
- Outcome:

## T68 — French content: eating and drinking, shopping
- Status: pending
- Depends on: T58
- Where: any
- Goal: Units `manger` (40) and `courses` (42) per docs/brief-fr.md (café, boulangerie, restaurant; supermarket, market, clothes).
- Context: as T66 (format model `content/it/units/40-cibo.json`).
- Scope: may touch `content/fr/units/40-*.json`, `content/fr/units/42-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~90 phrases, ~70 vocab, ~16 Q&A, 10–12 lessons.
  - `npm run verify` → exit 0
- Outcome:

## T69 — French content: around town, health and emergencies
- Status: pending
- Depends on: T58
- Where: any
- Goal: Units `ville` (50) and `sante` (52) per docs/brief-fr.md (metro/bus/tram tickets, directions on foot; doctor, pharmacy, emergencies).
- Context: as T66 (format models `content/it/units/24-taxi-a-piedi.json`, `14-emergenze.json`).
- Scope: may touch `content/fr/units/50-*.json`, `content/fr/units/52-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~60 vocab, ~16 Q&A, 9–11 lessons.
  - `npm run verify` → exit 0
- Outcome:

## T70 — French content: 12 dialogues and the placement test
- Status: pending
- Depends on: T65, T66, T67, T68, T69
- Where: any
- Goal: The 12 dialogues listed in docs/brief-fr.md (avatars, `unit`, register-honest options with Spanish feedback) and 12 placement questions spread over the units, each marking the lessons it proves.
- Context: docs/brief-fr.md ("Dialogues and stories"); docs/content-guide.md (Dialogue file, Placement); every `content/fr/units/*.json`; Italian `content/it/dialogues/*.json` and `extras/placement.json` as format models.
- Scope: may touch `content/fr/dialogues/*.json` (new), `content/fr/extras/placement.json` (new) / must not touch units, `pack.json`, `content/it/**`, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; 12 dialogues (6–10 turns, ≥ 3 learner turns, 3 options each), 12 placement questions covering every unit except `grammaire`.
  - `npm run verify` → exit 0
  - Hand check (PC): play two dialogues and the placement in French with device voices.
- Outcome:

## T71 — French content: stories 1–6
- Status: pending
- Depends on: T65, T66, T67, T68, T69
- Where: any
- Goal: Stories 1–6 with the brief-fr cast (Camille, Julien, Madame Martin, Pablo) in Lyon, A1, following the units' order; key words reuse unit items by id where possible.
- Context: docs/brief-fr.md; docs/content-guide.md (Story file, guidelines); every `content/fr/units/*.json`; `content/it/stories/01-arrivo-a-palermo.json` as format model.
- Scope: may touch `content/fr/stories/0[1-6]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings (80–150 words, 8–10 key words, 3–4 questions, 4–6 gaps).
  - `npm run verify` → exit 0
- Outcome:

## T72 — French content: stories 7–12
- Status: pending
- Depends on: T71
- Where: any
- Goal: Stories 7–12 (A1, the last ones A1–A2), continuing T71's cast and reusing its inline key words by id.
- Context: as T71, plus `content/fr/stories/0[1-6]-*.json`.
- Scope: may touch `content/fr/stories/0[7-9]-*.json`, `content/fr/stories/1[0-2]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings.
  - `npm run verify` → exit 0
- Outcome:

## T73 — French audio and pictures, final offline check
- Status: pending
- Depends on: T61, T70, T72
- Where: pc (edge-tts needs the Mac's internet; on-device check)
- Goal: Generate fr-FR neural mp3 for every French playable and the French pictures, commit them, and prove the whole French course works offline with only its audio cached.
- Context: CLAUDE.md commands (`npm run audio`, `npm run images`, strict checks); docs/brief-fr.md ("Audio and pictures"); T61's audio cache.
- Scope: may touch `public/audio/fr/**` (new), `public/images/**`, `assets/images/custom/**` only if a French vocab needs a new drawing (else pick a Fluent icon in the content and note it), `content/fr/**` (picture keys or text fixes the audio run reveals) / must not touch `public/audio/it/**` (must stay byte-identical), `src/**`, `plans/`.
- Done when:
  - `npm run audio && npm run images` → exit 0; `git diff --stat public/audio/it` → empty.
  - `npm run content:check -- --strict-audio --strict-images` → exit 0.
  - `npm run verify` → exit 0
  - Hand check (PC): installed PWA with French active, airplane mode: a lesson, a dialogue and a story play neural audio.
- Outcome:

## Review queue

## Visual checks queue

## Decisions
- 2026-10-06 plan: multi-language app; French (`fr`) is the second pack; adding a language stays content only; active-language picker on first launch and in Perfil, stored on the device; every page uses the active pack; static params for all packs with ids unique across packs; SW precaches only the active language's audio; never lose on-device data (every `lang-lern:*:<lang>` key and shape kept, Italian progress untouched). (Hernán)
- 2026-10-06 plan: French is not a trip: basic level for someone with little prior knowledge, everyday life, new vocabulary, useful phrases; same volume and format as Italian; Spain Spanish UI with "tú"; product note in docs/brief-fr.md (docs/brief.md not edited); audio with fr-FR edge-tts voices via `npm run audio` on the Mac. (Hernán)
- 2026-10-06 plan: app XP global across languages, always shown, resets monthly on day 1, plus a lifetime total that never resets; streak global (seeded from the current per-language streaks). (Hernán)
- 2026-10-06 plan: Liga XP global across languages (rank on the sum, `lang` still recorded), weekly reset Monday Europe/Madrid; daily cap 2500 per player per day across languages; up to 10 groups per player plus the general table; changes as a new migration + `npm run db:check`, Hernán runs `db push`. (Hernán)
- 2026-10-06 plan: order: code foundation (T58) first, then points/Liga; French content runs in parallel slots once T58 is in (max 2 agents, code tasks first); audio last on the Mac. (Hernán)
- 2026-10-06 plan: `numberWords` dropped: the app has no number-to-words code (survey 2026-10-06); French numbers are taught as content in unit `nombres`. (orchestrator)
- 2026-10-06 plan: Base branch `plan-006-multi-idioma` from main @ c970ea6; hybrid push policy: the writer pushes the plan branch after every integrated task; never main, no PR, merge or deploy without Hernán's OK. (orchestrator)
- 2026-10-06 orchestrator: probe: `npm run verify` on main @ c970ea6 → exit 0. (orchestrator)

## Proposals (new scope)

## Log
- 2026-10-06 💻 plan written from the interview; not approved yet
- 2026-10-06 09:05Z 💻 plan approved by Hernán
- 2026-10-06 09:05Z 💻 T58 launched · attempt 1 · agent a8f0c979cd1939402
- 2026-10-06 09:05Z 💻 T63 launched · attempt 1 · agent a0e011abed6b45031
