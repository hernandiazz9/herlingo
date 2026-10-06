# Plan 006 — Multi-idioma: French pack, global points, multi-group Liga

Status: active
Created: 2026-10-06
Base branch: plan-006-multi-idioma
Goal: Turn the Italian trainer into a multi-language app where adding a language stays "content only". The learner picks the language they are studying (first launch and Perfil), stored on the device, and every screen uses that pack; Italian progress and every other on-device key survive untouched. French (`fr`) becomes the second pack: an everyday-life course from a basic level (docs/brief-fr.md), same format and volume as Italian, with fr-FR neural audio. Points become global: app XP adds every language, is always shown, resets on the 1st of each month and keeps a lifetime total; the streak is global. Liga XP is the weekly sum over all languages (still recorded per language), and a player can be in up to 10 groups at once plus the general table. The service worker keeps only the active language's audio offline. Order: code foundation first, then points and Liga, French content unit by unit in parallel slots, audio last on the Mac. MVP speed: no automated tests; verification is `npm run verify`.
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-06 11:10Z 💻
- Writer: 💻 desktop
- Branch: main @ 2b18669 (plan merged 2026-10-06)
- Next step: T75 fixes the coach functions; then ff main, push, Hernán deploys
- Needs Hernán: -

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, docs/brief.md (app-wide decisions, do not edit), docs/brief-fr.md (French pack note, Hernán 2026-10-06), docs/content-guide.md, and docs/league.md for Liga tasks. UI copy is Spain Spanish with "tú", accessible names too.
- **Content only.** After this plan nothing in `src/`, `api/` or `scripts/` names a language: no `"it"`, `lang="it"`, "italiano", `it`-named fields. Language names in copy come from the pack (`pack.meta.name`, lower-cased inside sentences: "Tradúcelo al francés"); `lang` attributes from `pack.meta.lang`. Test/seed SQL and fixtures may use concrete languages.
- **Never lose on-device data.** Every existing `lang-lern:*` key keeps its name and shape (`progress:<lang>`, `favorites:<lang>`, `game:<lang>`, `stories:<lang>`, `coach:*:<lang>`, `league-*`, `settings`…). New state goes in new keys only: `lang-lern:active-lang` (T58), `lang-lern:activity` (T62), `lang-lern:league-groups` and new board cache keys (T64). Old keys a feature stops using are left in place, never deleted. Switching languages never reads, rewrites or clears another language's keys. Only explicit user actions remove data. New keys are versioned (`{ v: 1, … }`) with tolerant parsing and are covered by the Perfil backup automatically (`lang-lern:*`).
- **Default and active language.** Exactly one pack is the default: `pack.json` `"default": true` (Italian). `scripts/content.ts` writes it as `defaultLang` (today it is the first folder alphabetically, which would become `fr`). The active language = `lang-lern:active-lang` `{ v: 1, lang }` if it names an existing pack; else the first pack whose `lang-lern:progress:<lang>` is onboarded, default pack first (so Hernán's phone resolves to Italian with no prompt); else none = first launch, the picker shows. API (T58, `src/lib/content/active.ts` or similar, framework-free + one hook): `getActiveLang(): string | null`, `setActiveLang(lang)`, `subscribeActiveLang(cb)` (window event `lang-lern:active-lang-change`), `useActiveLang()` → `{ ready, lang, pack, setLang }` (`ready` false during server render/hydration; lang-dependent UI waits for it, no flash of the wrong language). `listPacks()` → every pack's meta, sorted with the default first.
- **Routes.** `/leccion/[id]/`, `/dialogos/[id]/`, `/historias/[id]/` generate params for every pack; a page finds the pack that owns the id (`findLessonPack(id)` etc.) and uses it. Ids (units, lessons, items, dialogues, stories, placement) are unique across all packs; `content:check` enforces it. Situation ids are per pack.
- **Schema (T58).** `pack.json` gains `default?: true`, `emoji?` (flag shown by the picker), `formalRegister: "lei" | "vous"` and `articles: string[]` (allowed vocab articles; Italian `il lo la l' i gli le`, French `le la l' les`). `Register` = `tu | lei | vous | neutral`; `content:check` allows only `tu`, `neutral` and the pack's `formalRegister`, and only the pack's `articles`. Italian content files stay byte-identical (only `content/it/pack.json` gets the new fields). `numberWords` (added on main by a434e34) maps digits to words for mic matching; French has its own since T74; French 70–99 is also taught in unit `nombres`.
- **Audio offline (T61).** The SW precache no longer holds `/audio/<lang>/**`. Audio lives in one SW-owned cache per language, `lang-lern-audio-<lang>` (no build version: mp3 names are content hashes), filled with the active language's files from the build's audio list; files no longer listed are removed from it; filled first from any older cache that already holds the file (today's precache), then the network. The page tells the SW the active language (`postMessage`) at start and on every switch; after a switch has fully downloaded, the other languages' audio caches are deleted. Coach Cache Storage and the precache rules in CLAUDE.md stay as they are. A small client API reports progress (`{ lang, total, cached, state }`) for the picker.
- **App points (T62).** New key `lang-lern:activity` `{ v: 1, days: { "YYYY-MM-DD": { <lang>: xp } }, best }` (device-local dates, `src/lib/progress/dates.ts`), written by `saveResult()` for every award (0-XP activity marks the day too). Monthly XP = sum of the current local calendar month, all languages (resets on day 1; the first month counts from the update). Lifetime XP = Σ `progress:<lang>.xp` over every pack (never resets). **Streak is global** (Hernán): consecutive active days in `activity`, seeded on first run from each language's stored `streak { count, last }` so today's Italian streak carries over; `best` = max(seeded per-language bests, computed). Per-language `progress.streak` keeps being updated as today (Liga stats, backups). "Borrar progreso" of a language also removes that language's entries from `activity`.
- **Liga (T63 SQL, T64 client).** Hernán 2026-10-06: weekly XP = sum over all languages (Monday 00:00 Europe/Madrid, unchanged), `lang` still recorded on every event and stat; **daily cap 2500 per player per Madrid day across all languages**; a player can be in **up to 10 groups** at once (`too_many_groups`) plus the general table; joining another group no longer requires leaving. Leaderboard streak = max of the player's per-language stats (the device sends the global streak). New RPCs (names may be refined in T63, documented in docs/league.md): `league_status()` (profile, groups[], week, weekly_xp, global rank), `league_ranking(scope 'global'|'group', code)` and `league_podium(scope, code)`, `league_leave_group(code)`. The old RPCs (`league_me(lang)`, `league_leaderboard(lang, scope)`, `league_last_week_podium(lang, scope)`, `league_leave_group()`) keep working for app versions still installed (summed XP, "the group" = the earliest joined one) until a later cleanup migration. SQL changes = a new file in `supabase/migrations/` + `npm run db:check`; never edit the applied migration, never touch the real project (Hernán runs `db push`).
- **French content (T65–T72).** docs/brief-fr.md fixes unit ids, orders, situations, register, cast and volume; docs/content-guide.md fixes the format. Each content task owns its own files under `content/fr/` (no shared index); `content/fr/pack.json` is written by T58 and only T58 edits it (a content task that needs a change reports it). Content tasks do not run `npm run audio`/`npm run images` (T73 on the Mac does); they still set picture keys.
- Verification: `npm run verify` → exit 0 for every task. UI changes: check light and dark at 375 px with `npm run dev` or `npm run build && npm start` when the agent can; otherwise the writer queues a Visual line.

## Tasks

## T58 — Multi-pack foundation: default pack, active language, schema, routes
- Status: done
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
- Outcome: default pack flag, active-lang store + hook, listPacks, per-pack register/articles, ids unique across packs, static params for all packs, fr pack.json meta · 197c3ac · verify ✓ 💻

## T59 — Every screen on the active pack
- Status: done
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
- Outcome: useScreenLang (waits for ready), owning pack on [id] routes, lang attrs + languageName() copy, match fields renamed, audio/league/coach follow active lang, fake coach per lang · 214521a · verify ✓ 💻 · not checked: Italian audio/themes on device, full game round

## T60 — Language picker: first launch, Perfil, Ruta
- Status: done
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
- Outcome: picker on /bienvenida/ (first launch, only with >1 language), Ruta flag switch sheet, Perfil 'Idioma que estudias', backup summary per language; SW keeps other audio caches while the new language has no audio; OfflineStatus names the language · c5f60f6 · verify ✓ 💻 · not checked: Perfil/welcome dark, installed PWA first launch, picker audio line with SW

## T61 — Service worker: offline audio for the active language only
- Status: done
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
- Outcome: precache without /audio/ (790 files, 6.9 MB), per-language lists, cache lang-lern-audio-<lang> filled from old caches first, switch drops other langs, useAudioProgress API · d5ee8c7 · verify ✓ headless Chrome ✓ 💻 · not checked: iPhone update + airplane mode

## T62 — App points: monthly XP, lifetime XP, global streak
- Status: done
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
- Outcome: new lang-lern:activity (points.ts) seeded from per-language streaks; Ruta streak + 'XP de <mes>', Perfil monthly/lifetime/per-language/global streak; Ruta lesson counter counts all lessons; Liga stats send global streak · c191bba · verify ✓ headless 19 asserts ✓ 💻 · not checked: light theme, real month rollover

## T63 — Liga SQL: global weekly sum, global daily cap, up to 10 groups
- Status: done
- Depends on: none
- Where: pc (local Postgres for `npm run db:check` and `league:local`)
- Goal: A new migration that ranks on the sum of all languages, caps daily XP across languages, and lets a player be in up to 10 groups, with new RPCs for the multi-group client and the old RPCs kept working for installed app versions.
- Context: Shared contract (Liga); docs/league.md (whole); `supabase/migrations/20261001000000_league.sql` (members pk on user, `week_start`, daily cap per lang :378-383, leaderboards); `scripts/db/smoke.sql`, `scripts/db/auth-stub.sql`; `scripts/league-local/**` (seed, check); skills `supabase-postgres-best-practices` and `supabase`.
- Scope: may touch `supabase/migrations/<new timestamp>_league_multi.sql` (new), `scripts/db/**`, `scripts/league-local/**` (seed: players in several groups with XP in it and fr; check: the new RPCs), docs/league.md (decision record 2026-10-06, data model, rules, RPC contract, old-RPC compatibility) / must not touch the applied migration, `src/**`, `content/**`, `plans/`; never the real Supabase project.
- Done when:
  - `npm run db:check` → exit 0; smoke covers: join up to 10 groups and `too_many_groups` on the 11th, leave one group by code, weekly XP summed over it+fr, daily cap 2500 across languages, group/global rankings and podium with the new RPCs, old RPCs still answering (summed XP, earliest group), streak = max over stats, delete_me removes every membership.
  - `npm run league:local -- --reset && npm run league:seed && npm run league:local:check` → exit 0.
  - `npm run verify` → exit 0
- Outcome: migration 20261006000000_league_multi.sql: summed weekly XP, global daily cap, ≤10 groups (too_many_groups, not_in_group), league_status/ranking/podium, leave_group(code), old RPCs compatible; seed/check + docs · d1b5666 · verify ✓ db:check 214 ✓ league:local:check ✓ 💻 · not checked: real project (Hernán runs db push)

## T64 — Liga client: several groups and global rankings
- Status: done
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
- Outcome: Liga on league_status/ranking/podium/leave_group(code): Tus grupos (≤10, share, leave), General + per-group tabs with podium, RutaCard global rank/XP, invite adds a group; new keys league-groups, league-ranking:*; old keys left · 9a6d848 · verify ✓ league:local ✓ 💻 · not checked: full light/dark hand check on phone, XP from real lessons

## T65 — French content: greetings, numbers and grammar cards
- Status: done
- Depends on: T58
- Where: any
- Goal: Units `salut` (10) and `nombres` (12), the grammar cards and the grammar unit `grammaire` (90), per docs/brief-fr.md: basic everyday French, ~5-minute lessons ending with their Q&A, pronunciation tips for a Spanish speaker, numbers 70–99 and prices in their own lesson.
- Context: docs/brief-fr.md; docs/content-guide.md (format, quality rules, Pictures); `content/it/units/10-sopravvivenza.json` and `90-grammatica.json`, `content/it/extras/gramatica.json` as format models (not as content).
- Scope: may touch `content/fr/units/10-*.json`, `content/fr/units/12-*.json`, `content/fr/units/90-*.json`, `content/fr/extras/grammaire.json` / must not touch `content/fr/pack.json`, `content/it/**`, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓ for both packs; ~85 phrases, ~65 vocab, ~16 Q&A, ~10 grammar cards, 10–12 lessons in these three units.
  - Every phrase has `register` and an `explanation`; ids follow brief-fr ("Ids").
  - `npm run verify` → exit 0
- Outcome: units salut (4 lessons), nombres (5 incl. 70–100 + prices), grammaire (3) + 10 gram.fr-* cards: 105 phrases, 68 vocab, 16 Q&A · 3507bfd · verify ✓ 💻 · not checked: native review, audio/pictures (T73)

## T66 — French content: introducing yourself, family and friends
- Status: done
- Depends on: T58
- Where: any
- Goal: Units `presenter` (20) and `famille` (22) per docs/brief-fr.md.
- Context: as T65 (format models `content/it/units/30-chiacchiere.json`, `32-persona-sobre-mi.json`); grammar card ids from brief-fr ("Grammar cards") may be referenced in lessons once T65 lands, otherwise leave them out.
- Scope: may touch `content/fr/units/20-*.json`, `content/fr/units/22-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~80 phrases, ~60 vocab, ~16 Q&A, 9–11 lessons.
  - `npm run verify` → exit 0
- Outcome: units presenter (6 lessons) + famille (5): 87 phrases, 69 vocab, 18 Q&A, reuses salut/nombres/grammaire items; persona Hernán (Madrid, programmer) · a68dc23 · verify ✓ 💻 · not checked: native review, audio/pictures (T73)

## T67 — French content: home and routine, free time and weather
- Status: done
- Depends on: T58
- Where: any
- Goal: Units `maison` (30) and `loisirs` (32) per docs/brief-fr.md.
- Context: as T66.
- Scope: may touch `content/fr/units/30-*.json`, `content/fr/units/32-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~80 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons.
  - `npm run verify` → exit 0
- Outcome: units maison (6 lessons) + loisirs (4): 85 phrases, 65 vocab, 16 Q&A, 44 picture keys, reuses earlier items · cdee444 · verify ✓ 💻 · not checked: native review, audio/pictures (T73)

## T68 — French content: eating and drinking, shopping
- Status: done
- Depends on: T58
- Where: any
- Goal: Units `manger` (40) and `courses` (42) per docs/brief-fr.md (café, boulangerie, restaurant; supermarket, market, clothes).
- Context: as T66 (format model `content/it/units/40-cibo.json`).
- Scope: may touch `content/fr/units/40-*.json`, `content/fr/units/42-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~90 phrases, ~70 vocab, ~16 Q&A, 10–12 lessons.
  - `npm run verify` → exit 0
- Outcome: units manger (7 lessons) + courses (5): 107 phrases, 81 vocab, 18 Q&A, ~40 picture keys, reuses grammaire/nombres items · 311c7ee · verify ✓ 💻 · not checked: native review, audio/pictures (T73)

## T69 — French content: around town, health and emergencies
- Status: done
- Depends on: T58
- Where: any
- Goal: Units `ville` (50) and `sante` (52) per docs/brief-fr.md (metro/bus/tram tickets, directions on foot; doctor, pharmacy, emergencies).
- Context: as T66 (format models `content/it/units/24-taxi-a-piedi.json`, `14-emergenze.json`).
- Scope: may touch `content/fr/units/50-*.json`, `content/fr/units/52-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~60 vocab, ~16 Q&A, 9–11 lessons.
  - `npm run verify` → exit 0
- Outcome: units ville (5 lessons, Lyon) + sante (5): 90 phrases, 61 vocab, 17 Q&A · 6729cca · verify ✓ 💻 · not checked: native review, audio/pictures (T73)

## T70 — French content: 12 dialogues and the placement test
- Status: done
- Depends on: T65, T66, T67, T68, T69
- Where: any
- Goal: The 12 dialogues listed in docs/brief-fr.md (avatars, `unit`, register-honest options with Spanish feedback) and 12 placement questions spread over the units, each marking the lessons it proves.
- Context: docs/brief-fr.md ("Dialogues and stories"); docs/content-guide.md (Dialogue file, Placement); every `content/fr/units/*.json`; Italian `content/it/dialogues/*.json` and `extras/placement.json` as format models.
- Scope: may touch `content/fr/dialogues/*.json` (new), `content/fr/extras/placement.json` (new) / must not touch units, `pack.json`, `content/it/**`, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; 12 dialogues (6–10 turns, ≥ 3 learner turns, 3 options each), 12 placement questions covering every unit except `grammaire`.
  - `npm run verify` → exit 0
  - Hand check (PC): play two dialogues and the placement in French with device voices.
- Outcome: 12 dialogues (8–9 turns, 4 learner turns, 3 options with feedback) + 12 placement questions over every unit but grammaire · 70795f1 · verify ✓ 💻 · not checked: playing them with device voices, avatar images (T73)

## T71 — French content: stories 1–6
- Status: done
- Depends on: T65, T66, T67, T68, T69
- Where: any
- Goal: Stories 1–6 with the brief-fr cast (Camille, Julien, Madame Martin, Pablo) in Lyon, A1, following the units' order; key words reuse unit items by id where possible.
- Context: docs/brief-fr.md; docs/content-guide.md (Story file, guidelines); every `content/fr/units/*.json`; `content/it/stories/01-arrivo-a-palermo.json` as format model.
- Scope: may touch `content/fr/stories/0[1-6]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings (80–150 words, 8–10 key words, 3–4 questions, 4–6 gaps).
  - `npm run verify` → exit 0
- Outcome: stories 1–6 (Lyon cast: Pablo from Seville, Camille, Julien, Madame Martin, Léa), 108–125 words, 10 key words, 4 questions, 5–6 gaps, no ⚠ · 2fad6dd · verify ✓ 💻 · not checked: native review, audio (T73)

## T72 — French content: stories 7–12
- Status: done
- Depends on: T71
- Where: any
- Goal: Stories 7–12 (A1, the last ones A1–A2), continuing T71's cast and reusing its inline key words by id.
- Context: as T71, plus `content/fr/stories/0[1-6]-*.json`.
- Scope: may touch `content/fr/stories/0[7-9]-*.json`, `content/fr/stories/1[0-2]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings.
  - `npm run verify` → exit 0
- Outcome: stories 7–12 per T71's outline (11–12 A2, light passé composé), 6 new inline words, no ⚠ · b23c31a · verify ✓ 💻 · not checked: native review, audio (T73)

## T73 — French audio and pictures, final offline check
- Status: done
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
- Outcome: fr-FR audio 1732 mp3 (29 MB) + 109 Fluent pictures; minuit/midi without article; strict image check now counts pictures referenced by any pack; SW: audio lists fr+it per language, no mp3 precached · 1c894c7 · verify ✓ strict audio+images ✓ 💻 · not checked: iPhone PWA French offline

## T74 — Bring main (XP everywhere, numbers in the mic) into plan 006 + French numberWords
- Status: done
- Depends on: T73
- Where: any
- Goal: main gained a434e34 and 3e54007 (another session): XP in dialogues/listening/Descubrir/placement/interview with an XpToast and `src/lib/progress/daily.ts`, numbers spoken in the mic compared through `pack.json` `numberWords`, dictation by voice with typo tolerance. Merge origin/main into this branch keeping both sides: every new feature must follow the plan's Shared contract (active pack, no Italian hard-coded, new stored keys only, global XP via `saveResult()` so `lang-lern:activity` and the Liga outbox see every award). Add `numberWords` to `content/fr/pack.json` (0–100 at least, French spelling: soixante-dix, quatre-vingts, quatre-vingt-dix…, same coverage as Italian).
- Context: `git log c970ea6..origin/main`, `git diff c970ea6 origin/main`; conflicts in docs/content-guide.md, DialogueSimulator, DictationExercise, FeedbackSheet, Onboarding, PhraseList, ShowMode, WordList, src/lib/progress/index.ts.
- Scope: may touch every file in the merge, `content/fr/pack.json` (numberWords only), docs/content-guide.md / must not touch `public/audio/**`, `supabase/**`, `plans/`.
- Done when:
  - `git merge-base --is-ancestor origin/main HEAD` → true; no conflict markers.
  - `grep -rnE 'DEFAULT_LANG|lang="it"|italiano' src api` → only the loader and explanatory comments.
  - `npm run content:check -- --strict-audio --strict-images` and `npm run verify` → exit 0.
- Outcome: merged origin/main (XP everywhere, numbers in the mic, voice dictation) with 9 conflicts resolved for multi-language; recordListen lang required; Borrar progreso also clears daily-xp:<lang>; French numberWords 0–100, hundreds, 1000 · 2b18669 · verify ✓ strict ✓ 💻 · not checked: new UI from main in both themes, mic numbers on device

## T75 — Fix: Prepárate functions crash on Vercel (ES module load)
- Status: running (attempt 1 · 💻 · agent acec2518d18aaec3b · since 11:10Z)
- Depends on: T74
- Where: any
- Goal: Production `/api/coach/*` answers 500 FUNCTION_INVOCATION_FAILED; Vercel logs: "Failed to load the ES module: /var/task/api/coach/usage.js. Make sure to set "type": "module" in the nearest package.json file or use the .mjs extension". Make every coach function load on Vercel's Node runtime (e.g. `api/package.json` with `"type": "module"` plus `.js` extensions on relative imports in `api/**`, or another documented fix), keeping `npm run dev:coach`/`start:coach` working.
- Context: vercel.json; api/coach/*.ts, api/_lib/*.ts (relative imports without extensions); scripts/coach/dev.ts; docs/coach.md; Vercel Node functions docs (WebFetch).
- Scope: may touch `api/**`, `vercel.json`, `tsconfig*.json`, `eslint.config.*`, `scripts/coach/**`, docs/coach.md / must not touch `src/**`, `content/**`, `public/**`, `plans/`.
- Done when:
  - `npx vercel@latest build --prod` (local, no deploy) succeeds and each built coach function loads in Node with no ESM error (import its entry from `.vercel/output/functions/...` and call it with a request lacking `x-coach-code` → 401 JSON, not a crash).
  - `COACH_FAKE=1 npm run dev:coach` still serves POST /api/coach/pack/ (200 with a dev code, 401 without).
  - `npm run verify` → exit 0
- Outcome:

## Review queue
- [ ] T58 @197c3ac — code review (queued 2026-10-06 💻)
- [ ] T63 @d1b5666 — code review (SQL) (queued 2026-10-06 💻)
- [ ] T59 @214521a — code review (queued 2026-10-06 💻)
- [ ] T65 @3507bfd — French language review (native-level) (queued 2026-10-06 💻)
- [ ] T61 @d5ee8c7 — code review (SW) (queued 2026-10-06 💻)
- [ ] T64 @9a6d848 — code review (queued 2026-10-06 💻)
- [ ] T60 @c5f60f6 — code review (queued 2026-10-06 💻)
- [ ] T62 @c191bba — code review (queued 2026-10-06 💻)
- [ ] T66 @a68dc23 — French language review (queued 2026-10-06 💻)
- [ ] T67 @cdee444 — French language review (queued 2026-10-06 💻)
- [ ] T68 @311c7ee — French language review (queued 2026-10-06 💻)
- [ ] T69 @6729cca — French language review (queued 2026-10-06 💻)
- [ ] T71 @2fad6dd — French language review (queued 2026-10-06 💻)
- [ ] T70 @70795f1 — French language review (queued 2026-10-06 💻)
- [ ] T72 @b23c31a — French language review (queued 2026-10-06 💻)
- [ ] T73 @1c894c7 — code review (scripts/content.ts, scripts/images/plan.ts) (queued 2026-10-06 💻)
- [ ] T74 @2b18669 — code review of the merge resolutions (queued 2026-10-06 💻)

## Visual checks queue
- [ ] T59 @214521a — Italian lesson, game round, phrasebook, story, dialogue unchanged; light + dark, 375 px (queued 2026-10-06 💻)
- [ ] T61 @d5ee8c7 — installed iPhone PWA: Actualizar, Italian audio offline in airplane mode (queued 2026-10-06 💻)
- [ ] T64 @9a6d848 — Liga with several groups (tabs, Tus grupos, invite, 10-group limit): light + dark, 375 px (queued 2026-10-06 💻)
- [ ] T60 @c5f60f6 — picker, Ruta switch, Perfil section, welcome: dark + light 375 px; first launch on installed PWA; picker audio state (queued 2026-10-06 💻)
- [ ] T62 @c191bba — Ruta and Perfil points/streak: light + dark, 375 px, with Hernán's real data (queued 2026-10-06 💻)
- [ ] T70 @70795f1 — play two French dialogues and the French placement with device voices (queued 2026-10-06 💻)
- [ ] T73 @1c894c7 — installed PWA, French active, airplane mode: lesson, dialogue, story play neural audio; audio cache switch it↔fr (queued 2026-10-06 💻)
- [ ] T74 @2b18669 — +N XP toast, yellow 'almost' sheet, dictation mic: light + dark 375 px; say numbers in fr and it (queued 2026-10-06 💻)

## Decisions
- 2026-10-06 plan: multi-language app; French (`fr`) is the second pack; adding a language stays content only; active-language picker on first launch and in Perfil, stored on the device; every page uses the active pack; static params for all packs with ids unique across packs; SW precaches only the active language's audio; never lose on-device data (every `lang-lern:*:<lang>` key and shape kept, Italian progress untouched). (Hernán)
- 2026-10-06 plan: French is not a trip: basic level for someone with little prior knowledge, everyday life, new vocabulary, useful phrases; same volume and format as Italian; Spain Spanish UI with "tú"; product note in docs/brief-fr.md (docs/brief.md not edited); audio with fr-FR edge-tts voices via `npm run audio` on the Mac. (Hernán)
- 2026-10-06 plan: app XP global across languages, always shown, resets monthly on day 1, plus a lifetime total that never resets; streak global (seeded from the current per-language streaks). (Hernán)
- 2026-10-06 plan: Liga XP global across languages (rank on the sum, `lang` still recorded), weekly reset Monday Europe/Madrid; daily cap 2500 per player per day across languages; up to 10 groups per player plus the general table; changes as a new migration + `npm run db:check`, Hernán runs `db push`. (Hernán)
- 2026-10-06 plan: order: code foundation (T58) first, then points/Liga; French content runs in parallel slots once T58 is in (max 2 agents, code tasks first); audio last on the Mac. (Hernán)
- 2026-10-06 plan: `numberWords` dropped: the app has no number-to-words code (survey 2026-10-06); French numbers are taught as content in unit `nombres`. (orchestrator)
- 2026-10-06 plan: Base branch `plan-006-multi-idioma` from main @ c970ea6; hybrid push policy: the writer pushes the plan branch after every integrated task; never main, no PR, merge or deploy without Hernán's OK. (orchestrator)
- 2026-10-06 orchestrator: probe: `npm run verify` on main @ c970ea6 → exit 0. (orchestrator)
- 2026-10-06 T60: scope extended by orchestrator: SW keeps other languages' audio caches while the new active language has no audio (fr before T73), and OfflineStatus copy names the active language's audio
- 2026-10-06 T73: scope extended by orchestrator: fix checkImages to use pictures referenced by all packs; drop article on nombres.midi like minuit
- 2026-10-06 plan: Hernán OK'd merging plan 006 into main for deploy (2026-10-06); main had moved (a434e34, 3e54007), so T74 brings it in first
- 2026-10-06 plan: numberWords exists after all (main a434e34); contract line corrected; French numberWords added in T74. (orchestrator)

## Proposals (new scope)
- 2026-10-06 T58: listLangs() now returns the default pack first (sync.ts, coach/packs.ts iterate it, fr)
- 2026-10-06 T59: Jugar on an empty pack shows 'Todos los temas ·' with a stray dot
- 2026-10-06 T65: later French units reuse existing basics (grammaire.lait, nombres.carte, salut.francais) instead of duplicating
- 2026-10-06 T64: sign-out/delete leave the old league-board:* caches on the device (harmless, unused)
- 2026-10-06 T67: docs/content-guide.md order ranges and quality rules are still Italy-only; point them to per-pack briefs

## Log
- 2026-10-06 💻 plan written from the interview; not approved yet
- 2026-10-06 09:05Z 💻 plan approved by Hernán
- 2026-10-06 09:05Z 💻 T58 launched · attempt 1 · agent a8f0c979cd1939402
- 2026-10-06 09:05Z 💻 T63 launched · attempt 1 · agent a0e011abed6b45031
- 2026-10-06 09:11Z 💻 T58 done · worktree-agent-a8f0c979cd1939402 → 197c3ac · verify ✓
- 2026-10-06 09:11Z 💻 T59 launched · attempt 1 · agent a6de474c4d54e2790
- 2026-10-06 09:13Z 💻 T63 done · worktree-agent-a0e011abed6b45031 → d1b5666 · verify ✓
- 2026-10-06 09:13Z 💻 T65 launched · attempt 1 · agent afbf6bfca2c5bb23b
- 2026-10-06 09:22Z 💻 T59 done · worktree-agent-a6de474c4d54e2790 → 214521a · verify ✓
- 2026-10-06 09:22Z 💻 T61 launched · attempt 1 · agent acc11bf7897385ebd
- 2026-10-06 09:23Z 💻 T65 done · worktree-agent-afbf6bfca2c5bb23b → 3507bfd · verify ✓
- 2026-10-06 09:23Z 💻 T64 launched · attempt 1 · agent ab9c51c64c5870d41
- 2026-10-06 09:29Z 💻 T61 done · worktree-agent-acc11bf7897385ebd → d5ee8c7 · verify ✓
- 2026-10-06 09:29Z 💻 T60 launched · attempt 1 · agent a95d57934a2e43c41
- 2026-10-06 09:34Z 💻 T64 done · worktree-agent-ab9c51c64c5870d41 → 9a6d848 · verify ✓
- 2026-10-06 09:34Z 💻 T66 launched · attempt 1 · agent ad96a505c474bf6a2
- 2026-10-06 09:36Z 💻 T60 done · worktree-agent-a95d57934a2e43c41 → c5f60f6 · verify ✓
- 2026-10-06 09:36Z 💻 T62 launched · attempt 1 · agent a382ef15404b4341a
- 2026-10-06 09:41Z 💻 T62 done · worktree-agent-a382ef15404b4341a → c191bba · verify ✓
- 2026-10-06 09:41Z 💻 T67 launched · attempt 1 · agent a2578ade40af140b3
- 2026-10-06 09:43Z 💻 T66 done · worktree-agent-ad96a505c474bf6a2 → a68dc23 · verify ✓
- 2026-10-06 09:43Z 💻 T68 launched · attempt 1 · agent ab47370f46b265ec9
- 2026-10-06 09:49Z 💻 T67 done · worktree-agent-a2578ade40af140b3 → cdee444 · verify ✓
- 2026-10-06 09:49Z 💻 T69 launched · attempt 1 · agent aba579a428944ec60
- 2026-10-06 09:54Z 💻 T68 done · worktree-agent-ab47370f46b265ec9 → 311c7ee · verify ✓
- 2026-10-06 09:58Z 💻 T69 done · worktree-agent-aba579a428944ec60 → 6729cca · verify ✓
- 2026-10-06 09:58Z 💻 T70 launched · attempt 1 · agent ad5fd9b2e670aff2f
- 2026-10-06 09:58Z 💻 T71 launched · attempt 1 · agent a874c68c42dcdc95b
- 2026-10-06 10:05Z 💻 T71 done · worktree-agent-a874c68c42dcdc95b → 2fad6dd · verify ✓
- 2026-10-06 10:05Z 💻 T72 launched · attempt 1 · agent aa287685dcb08c962
- 2026-10-06 10:06Z 💻 T70 done · worktree-agent-ad5fd9b2e670aff2f → 70795f1 · verify ✓
- 2026-10-06 10:12Z 💻 T72 done · worktree-agent-aa287685dcb08c962 → b23c31a · verify ✓
- 2026-10-06 10:12Z 💻 T73 launched · attempt 1 · agent ae4d7048a936ed7f7
- 2026-10-06 10:18Z 💻 T73 agent blocked: strict image check is per pack (other pack's pictures flagged unused); scope extended to scripts/images/plan.ts + scripts/content.ts, sent back to the same agent
- 2026-10-06 10:20Z 💻 T73 done · worktree-agent-ae4d7048a936ed7f7 → 1c894c7 · verify ✓
- 2026-10-06 10:39Z 💻 Hernán applied 20261006000000_league_multi.sql to the real project (db push)
- 2026-10-06 10:40Z 💻 T74 launched · attempt 1 · agent a175ea6da93433afd
- 2026-10-06 10:44Z 💻 T74 done · worktree-agent-a175ea6da93433afd → 2b18669 (merge) · verify ✓
- 2026-10-06 11:10Z 💻 T75 launched · attempt 1 · agent acec2518d18aaec3b (prod /api/coach/* 500: ESM load failure)
