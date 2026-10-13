@AGENTS.md

# lang_lern — personal language trainer (Italian first)

Mobile-first, offline-capable Next.js PWA for Hernán to learn spoken Italian before a trip to
Sicily. **Read `docs/brief.md` before any task**: it holds every product decision.

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Setup in a fresh checkout. |
| `npm run dev` | Dev server (http://localhost:3000). |
| `npm run dev:coach` | Dev server plus working `/api/coach/*` (Prepárate) on http://localhost:3000. Reads `.env.local`; fake mode (canned data, no network) when `ANTHROPIC_API_KEY` is missing or `COACH_FAKE=1`; dev codes `dev-owner`/`dev-guest` when `COACH_ACCESS_CODES` is missing (fake mode only: with a real key it refuses to start without `COACH_ACCESS_CODES`). Listens on 127.0.0.1; `COACH_LAN=1` for the LAN. Restart after editing `api/`. `npm run start:coach` = same with the built `out/` on :4173. See docs/coach.md. |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules). |
| `npm run typecheck` | `next typegen` (route types, `LayoutProps`/`PageProps`) + `tsc --noEmit`. |
| `npm run build` | Static export to `out/` (`output: "export"`, `trailingSlash: true`), then `postbuild` (scripts/pwa/build.ts) writes `out/manifest.webmanifest` and `out/sw.js`. |
| `npm start` | Serves `out/` on http://localhost:4173 and the LAN (Range requests, like a static host). |
| `npm run content:check` | Validate every pack in `content/` (schema, ids, references). Exit 1 on errors. |
| `npm run content:build` | Validate + write `src/lib/content/generated/packs.json` (git-ignored). Runs automatically before dev, typecheck and build; re-run it after editing content while `dev` is running. |
| `npm run audio` | Neural mp3 (edge-tts, needs internet; creates `.venv` from `scripts/audio/requirements.txt` on first run) for every playable → `public/audio/<lang>/<hash>.mp3` + `manifest.json`; only new/changed lines, prunes unused files. Run after content changes and commit `public/audio/`. `npm run content:check -- --strict-audio` fails if any playable lacks an mp3. pack.json `ttsVoices` renders a voice with another edge-tts voice or ElevenLabs (`ELEVENLABS_API_KEY` in `.env.local`; dialogue/story lines first; out of credits → the line keeps its edge-tts mp3 and the next run continues; `-- --max-credits=N` caps a run). |
| `npm run images` | Writes every referenced picture (vocab `image`, dialogue `avatars`: `fluent:<icon>` from the `@iconify-json/fluent-emoji-flat` devDependency, `custom:<slug>` from `assets/images/custom/`) minified to `public/images/{fluent,custom}/`; prunes unused files, flags near-black ones for the dark backdrop, skips custom drawings not drawn yet. Run after image changes and commit `public/images/`. `npm run content:check -- --strict-images` fails if any is missing or stale. |
| `npm run pwa:icons` | Redraws `public/icons/*.png` (same design as `src/app/icon.svg`). Only if the icon changes. |
| `npm run db:check` | Liga SQL check on the local Postgres (`psql` on the default socket): throwaway database ← `scripts/db/auth-stub.sql` + every `supabase/migrations/*.sql` + `scripts/db/smoke.sql`, then dropped. Exit 1 on any failure. Not part of `verify`; run it after any SQL change. |
| `npm run league:local` | Local fake Supabase on http://localhost:54321 (database `lang_lern_league_local`, `-- --reset` to recreate); prints the two env values for `.env.local`. Magic links are printed, never emailed. docs/league.md, "Try it locally". |
| `npm run league:seed` | 15 fake players with XP this week and last week + group code `PRUEBA` in the local fake Supabase (`-- --reset` to reseed). |
| `npm run league:local:check` | HTTP check of the local fake Supabase with two throwaway users (sign-up → profile → XP → groups → rankings → email link → delete). Exit 1 on failure. |
| `npm run verify` | lint → content:check → typecheck → build. Must exit 0 before a task is done. |

**There are no automated tests in the MVP** (speed over tests). Verification is `npm run verify`;
check UI changes by hand with `npm run dev` or `npm run build && npm start` (offline, SW).

## Folder layout

```
src/app/               Routes (App Router). One folder per section: / (ruta), historias, jugar, frasario, perfil;
                       repaso and dialogos (cards on Ruta); instalar = iPhone install guide (linked from /perfil).
                       layout.tsx = app shell (centred mobile column + bottom TabBar); globals.css = design tokens.
src/components/ui/     Base components: Button, IconButton, Card, ProgressBar, Picture (import from "@/components/ui").
src/components/shell/  App shell pieces: TabBar, PageHeader, ComingSoon placeholder, ThemeToggle, ThemeSync.
src/components/icons.tsx  Inline SVG icons (no icon library).
src/lib/               Framework-free logic. navigation.ts = the tab list (single source of truth).
                       theme/ = light/dark choice (localStorage), inline pre-paint script, theme-color.
src/lib/content/       Content contract: schema.ts (zod, source JSON), types.ts (runtime types), index.ts (loader).
src/lib/speech/        Speech recognition engine (createListenSession; only platform.ts touches the browser API),
                       error messages, diagnostics log, scoring (score.ts). docs/speech.md.
src/components/speech/ The one mic UI: useListen hook, MicButton, LiveTranscript, SpeakPanel, WordFeedback.
src/lib/audio/         speak() / stop(): the only way to play target-language audio (content mp3s; generated.ts =
                       Prepárate lines: Cache Storage, else /api/coach/tts/ once, else speechSynthesis).
src/lib/pwa/           Web app manifest (manifest.ts), SW registration + update prompt (register.ts, UpdatePrompt.tsx).
src/lib/coach/         Prepárate client: API client + typed errors (CoachApiError), saved packs, learner profile and
                       buildLearnerContext(), usage (`lang-lern:coach:*`); hooks in use-coach.ts. docs/coach.md "Client".
src/lib/progress/      On-device progress (`lang-lern:progress:<lang>`, versioned, tolerant parsing), settings,
                       path model; hooks in use-progress.ts. src/lib/srs/ = Leitner spaced repetition.
src/lib/grammar/       Gramática "Leído" (docs/grammar.md): read counts per entry (`lang-lern:grammar:<lang>`) and the
                       daily-capped reading XP (`markGrammarRead`, source "grammar"); hook in use-grammar-reads.ts.
src/lib/backup/        Perfil "Copia de seguridad": export/import every `lang-lern:*` key (except the coach access code)
                       as a JSON file; validates before writing, rolls back on a failed write.
src/lib/league/        Liga (docs/league.md): config.ts (`leagueEnabled()`), client.ts (lazy supabase-js, `leagueRpc`),
                       account.ts (cached account, actions, change event), use-league-account.ts. Route /liga/ (under Perfil).
src/lib/cloud-save/    "Guardado en la nube" (docs/cloud-save.md): the backup blob per Liga account via `league_save_*` (blob.ts,
                       undo.ts, sync loop + actions in index.ts, use-cloud-save.ts). Started by LeagueSync only when `leagueEnabled()`.
src/components/cloud-save/  Its UI: CloudSaveHost (layout: restore offer, conflict dialog, undo panel), CloudSaveCard (Perfil).
content/<lang>/        Learning content per language: pack.json, units/, dialogues/, extras/, stories/ (`getStories()`, `getStory()`, `getStoryKeywords()`).
                       `it` (default pack, `"default": true`), `fr`, `en`, `nl`, `es` (docs/brief-<lang>.md each). Ids are unique across packs.
                       `cba` = Cordobés for Spain-Spanish speakers (es-AR, glosses = Spain equivalents; docs/brief-cba.md),
                       `"hidden": true` for now (being reworked: kept in content/audio/images, not in the app).
                       Format, ids, order ranges and quality rules: docs/content-guide.md.
                       Code never hard-codes content.
api/                   Prepárate backend only: Vercel functions (coach/*.ts, one per endpoint) + api/_lib/ (server modules,
                       not routes: model + price table, zod schemas, Claude call, ledger, access codes). Relative imports only.
                       Contract, pack schema, limits, env vars: docs/coach.md.
scripts/               Node scripts (content tools, audio generation, images/ = picture pipeline, pwa/ = SW + manifest + icons, serve.ts,
                       coach/dev.ts = local app + /api server, lib/static.ts = static file handler).
assets/images/custom/  Source SVGs of our own vocabulary drawings (`custom:<slug>`), language-agnostic.
public/                Static assets: audio/<lang>/ (generated by `npm run audio`, committed); images/ (generated by
                       `npm run images`, committed); icons/ (PWA, committed).
vercel.json            Vercel deploy as a plain static site from out/ (README.md has the commands).
docs/                  brief.md (product decisions; do not edit) and other docs.
plans/                 Orchestrator plans. Never edit.
.claude/skills/hybrid/ The hybrid skill (cloud + Mac work on plans). Install on the Mac: cp -R .claude/skills/hybrid ~/.claude/skills/
```

## Conventions

- **UI copy is Spain Spanish using "tú"** ("Toca para escuchar", "¡Genial!"). Accessible names
  (`aria-label`, IconButton `label`) too.
- **Language-agnostic code.** Nothing in `src/` is specific to Italian: all learning content lives
  under `content/<lang>/`. Adding a language means adding content, not changing code.
- **Static export only.** No server runtime, API routes, `cookies()`/`headers()`, or runtime env
  secrets. Progress lives on the device (localStorage). **Two exceptions:** Prepárate's Vercel
  functions in `api/` (secrets, access codes, limits, cost ledger; docs/coach.md) and Liga (Supabase,
  below). The app itself stays `output: "export"`; `src/` reaches them only over `fetch("/api/coach/…/")` and never imports
  `api/`, `@anthropic-ai/sdk`, `@upstash/redis` or runtime zod (ESLint enforces it).
- **Never lose the learner's on-device data.** Hernán uses the deployed app daily while we build;
  until accounts exist, localStorage (`lang-lern:*` keys) and the coach Cache Storage are the only
  copy of his progress, saved packs, Sobre mí and assessments. Never rename or drop a stored key,
  never change a stored shape without a migration that reads the old version (bump the version,
  keep tolerant parsing), never call `localStorage.clear()`, and never let a SW update delete
  anything but its own precache. Only explicit user actions ("Borrar progreso", deleting a pack)
  remove data. Never tell Hernán to "clear site data" on the production origin; to reset fake
  audio use `clearGeneratedAudio()`.
- **Liga (Supabase)** is the other cloud feature: the client only calls the `public.league_*` RPCs
  (contract, caps and setup in `docs/league.md`); tables live in the private `league` schema with
  RLS and no grants. SQL changes = a new file in `supabase/migrations/` + `npm run db:check`;
  never edit an applied migration and never touch the real project (Hernán runs `db push`).
- **Cloud save** (docs/cloud-save.md) rides on the Liga account: the blob IS the Perfil backup format
  (`collectBackup`/`applyBackup`, no second format) limited to `isCloudSaveKey` (backup keys minus every
  `lang-lern:league-*` key; the coach access code and `lang-lern:cloud-save` are never in any backup). Bookkeeping
  lives in `lang-lern:cloud-save` (keep `enabled` on resets). Conflicts are never resolved silently; a restore
  first keeps the replaced data in Cache Storage `lang-lern-cloud-undo`, which the SW never deletes (KEEP list).
- **Design tokens** are CSS variables in `src/app/globals.css` (`--lemon`, `--sea`, `--terracotta`,
  neutrals, `--success`, `--error`, each with `-deep`/`-soft`/`-ledge` variants, plus `--on-accent`,
  `--on-lemon`, `--shadow`) exposed to Tailwind as `bg-sea`, `text-ink`, `border-line`,
  `text-on-accent`, `rounded-card`, `rounded-button`...
- **Light and dark themes.** Every colour token has a dark value (system setting by default, or the
  Sistema/Claro/Oscuro choice on /perfil, stored on the device as `data-theme` on `<html>`).
  **UI code uses tokens only, never hard-coded colours** (no hex/rgb, no `text-white`/`bg-black`,
  no `dark:` variants), so both themes work. Token roles: `-deep` = strong text/emphasis readable on
  surfaces and `-soft` backgrounds (lighter in dark); `-ledge` = the darker press ledge; text on a
  filled accent uses `text-on-accent` (sea/terracotta/success/error) or `text-on-lemon`. Check new
  UI in both themes.
- **Press animation:** add the `pressable` class and set `[--ledge:var(--sea-ledge)]` (a `-ledge` token).
  Respect `prefers-reduced-motion`.
- **Mobile shell:** the app is a column capped at `--column-width` (480px), centred on desktop. The
  tab bar is fixed to the bottom and pads with `env(safe-area-inset-bottom)` (`viewport-fit=cover`).
  Pages render inside `<main>`; start each with `<PageHeader title=… />`.
- **Tabs:** add or rename sections only in `src/lib/navigation.ts` (`TABS`, plus `NESTED` for
  sections without a tab that light up a parent tab); TabBar and page headings read from it.
  `central: true` = the raised Jugar button.
- **If tests are added later, they never hard-code content ids or counts**: derive expectations
  from the source (import `TABS`, the content loader, etc.).
- **Content** is read only through `@/lib/content` (`getPack()`, `getAllLessons()`, `getLesson()`,
  `getLessonItems()`, `getItem()`, `getDialogue()`, `getSituation()`, `listPlayables()`), never
  by importing `content/` JSON. Synchronous; works in server and client components. The app
  never imports zod (only `scripts/content.ts` does).
- **Glosses** (translations, notes, grammar text, learner-facing titles) are read only through `glossOf(value | item, glossLang, base?)` from `@/lib/content`, with the learner's per-pack choice from `useGlossLang(lang)` (`@/lib/content/use-gloss`, key `lang-lern:gloss:<lang>`; `lang={gloss.tag}` on the element); a pack lists `glossLangs` (absent = `["es"]`). docs/content-guide.md, "Gloss languages".
- **Several packs.** `listPacks()` = every pack's meta, default first (`DEFAULT_LANG` = the pack
  with `"default": true`). The learner's language is the **active** one: `getActiveLang()` /
  `setActiveLang()` / `subscribeActiveLang()` from `@/lib/content/active` (`lang-lern:active-lang`,
  else the first onboarded pack, else null = first launch) and `useActiveLang()` →
  `{ ready, lang, pack, setLang }` from `@/lib/content/use-active-lang` (wait for `ready`).
  `/leccion/[id]/`, `/dialogos/[id]/`, `/historias/[id]/` are generated for every pack and find
  the owner with `findLessonPack(id)` / `findDialoguePack(id)` / `findStoryPack(id)`.
- **Audio** goes through `@/lib/audio`: `speak(playable | text, { slow })`, `stop()`, `canSpeak()`.
  Every playable (phrase, vocab, Q&A question and replies, dialogue turns and options, grammar
  examples, placement `audio`) has `text`, `audioKey` and `voice`: pass it as is. It plays
  the mp3 listed for its `audioKey` in `public/audio/<lang>/manifest.json` (files named by a hash of
  voice + text; dialogue learner options get a voice different from the native speakers') and
  falls back to `speechSynthesis` in the pack's `speechLocale` (strings, missing or failing mp3).
- **Audio** must start from a user gesture (iOS): call `speak()` directly in the handler. Speech recognition is optional: feature-detect
  and fall back to self-evaluation.
- **Speech** (the learner speaking) only through `useListen` (`@/components/speech`) or
  `createListenSession` (`@/lib/speech`); ESLint rejects `SpeechRecognition` /
  `webkitSpeechRecognition` outside `src/lib/speech/`. Score with `scoreHeard` / `bestOption`.
  Each session logs to `lang-lern:speech-log` (no transcript text; "Probar micrófono" at /microfono/). docs/speech.md.
- **Pictures** (vocab words, dialogue avatars) are shown only through `<Picture image={…} alt={…} size=… />`
  from `@/components/ui`, with the resolved `image` / `avatar` (`{ src, dark? }`) from `@/lib/content`
  (`listVocab({ situation, withImage })`, `getVocab()`, `hasImage()`); absent = no picture, show text.
  Keys, coverage and the drawing style guide: docs/content-guide.md, "Pictures".
- **Offline PWA.** `out/sw.js` precaches every file of the export except audio (pages by their
  `/route/` URL, RSC `.txt` payloads, JS/CSS, icons, `/sw-audio/<lang>.json` audio lists), so new
  routes and content are offline automatically. Audio is offline for the **active language only**:
  one SW-owned cache per language, `lang-lern-audio-<lang>`, filled from the build's list (older
  caches first, then the network) after the page posts the language (`src/lib/pwa/audio-cache.ts`,
  progress `{ lang, total, cached, state }`); once a switch has fully downloaded, the other
  languages' audio caches go. Cache first, query strings ignored; audio Range requests answered with 206. A new
  build = new SW version; it waits until the user taps "Actualizar" (UpdatePrompt). The SW only
  exists in the export: `next dev` unregisters it. Links between pages use trailing slashes.
- TypeScript strict; import from `@/…` (maps to `src/`).
- Multi-task plans in plans/ follow the hybrid skill: on resume read the plan's ## Now block first.
