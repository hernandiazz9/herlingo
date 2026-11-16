# Plan 018 — «Biblioteca»: the English listening library inside Modo deporte

Status: active
Created: 2026-11-16
Base branch: plan-018-biblioteca
Goal: Hernán listens to the 244 English episodes written in bulk by `scripts/listening/` (82 interviews, 81 English at work, 81 stories; format `herlingo-listening/1`) inside Modo deporte, as a private «Biblioteca» section, instead of Telegram: with the screen locked, one chapter per line, offline once downloaded, with progress (heard, favourites, XP) and a list of the key phrases. The scripts reach the app like Mi entrevista's deck: `npm run library:push` uploads them to the server's private store under the owner's code (only new or changed ones), never to git or the build. The audio is **rebuilt on the device** with the existing Modo deporte pipeline: every line read by the same edge-tts voices on the server (`/api/coach/tts/`; narrator `en-GB-SoniaNeural`, Natasha and William, never the device voice), joined byte by byte with exact chapters. One play order for the batch mp3s and the app. Runs in parallel with plan 017: server, push and device data now; the screens after P017·T215 is merged into this branch. Save tokens: one agent at a time, no code reviews, no visual checks by agents (Hernán checks on his iPhone).
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-11-16 17:01Z 💻
- Writer: released 17:01Z by 💻 desktop → continue on ☁️ or 💻
- Branch: plan-018-biblioteca · pushed · checkout /Users/heralc/Desktop/HDDev/herlingo-biblioteca (no node_modules yet: `npm ci` first on the Mac)
- Next step: new session: start ritual, take the lock; T217 runnable now, then T218 and T219
- Gotchas: agents run in the plan checkout without `isolation` (in HDDev it would branch the centre repo), one at a time, no commits: the writer verifies and commits · `listening-out/` lives only on the Mac in ../herlingo-escucha (git-ignored) · T220 waits for P017·T215, merged here first (Shared contract, "Branches") · plan 017 is also active on this branch: run `plan_status.py plans/018-biblioteca.md`
- Needs Hernán: later: deploy the server + the real push (T224)

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, this plan's **Design** section (the contract until T217 copies it into docs/sport.md "Biblioteca"; from then on that doc is the contract and tasks keep it current), docs/sport.md (episode model, player, offline, XP), docs/mock-interview.md "API" (owner check, the deck pattern), scripts/listening/README.md. docs/brief.md is app-wide; do not edit it. Do not edit `plans/`.
- **Static export stays.** The backend is only `api/` (Vercel functions, relative `.js` imports). `src/` never imports `api/`, `@anthropic-ai/sdk`, `@upstash/redis` or runtime zod (ESLint enforces it). No secrets in code; `.env.example` holds names only.
- **Privacy (public repo).** The scripts live only in Upstash (owner's code), in `listening-out/` on the Mac and on Hernán's device. No episode text (titles included) in code, fixtures, docs, commits or logs: the fake library is invented; `[coach]` logs and the push script print ids and counts only.
- **Never lose on-device data.** New stores only: `lang-lern:library:index` and `lang-lern:library:progress` (each `{ v: 1, … }`, tolerant parsing) and Cache Storage `lang-lern-library` (on the SW KEEP list). No existing key renamed, reshaped or dropped; no `localStorage.clear()`. The clips of a downloaded library episode are never pruned; nothing is deleted without an explicit action («Quitar descarga», «Marcar como no escuchado», removing a ★).
- **Existing features behave exactly as today.** Compile output for dialogue, route, AI and deck episodes is unchanged; the XP rules are unchanged (the library shares them); `/api/coach/tts/` limits and messages are unchanged; the batch script's output (order, voices, mp3) is unchanged.
- **Owner only, English pack.** `/api/coach/library/` answers 403 to any code that is not the owner; the Biblioteca shows only to the owner, with the English pack (`en`) active.
- **Branches.** This plan's branch `plan-018-biblioteca` was cut from `plan-017-mi-entrevista` @ cb3e99c4 (it needs P017·T206's text store and owner check, P017·T209's voices, P017·T212's backup exclusion). Before launching T220 the writer merges `origin/plan-017-mi-entrevista` (with P017·T215 done) into this branch (`git merge --no-ff`), runs the Test command and pushes. This plan never pushes to 017's branch; 017's writer never touches this one. Merging into main is Hernán's call, after 017.
- **UI**: Spain Spanish with "tú" (copy in Design); episode text in English with `lang="en"`; design tokens only, both themes, `pressable` + `-ledge`, `PageHeader`, targets ≥ 44 px; audio only from a tap (`speak()` or the episode player).
- **Verification**: `npm run verify` → exit 0 for every task. API checks in fake mode: `PORT=3107 COACH_FAKE=1 npm run dev:coach` (dev codes `dev-owner` / `dev-guest`) + `curl`; stop the server afterwards. Pure logic: a throwaway `npx tsx` check (not committed). **No browser, no screenshots, no visual checks** (Hernán does them). Anything against production (push, deploy) needs Hernán's OK first.
- Final message ≤ 15 lines.

## Design (contract)

### Decisions (Hernán, 2026-11-16)

| Topic | Decision |
| --- | --- |
| Audio | **Rebuilt on the device** with the Modo deporte pipeline: each line from `/api/coach/tts/` (edge-tts on the server, the same voices as the batch mp3s; never the device voice), cached in `lang-lern-coach-audio`, joined byte by byte with silent gaps and exact chapters; plays locked and offline once downloaded. The pre-rendered mp3s are not used by the app (they stay for Telegram). Scripts on the server's private store (owner only), like the deck. |
| Chapters | **One per line, as today**: «anterior» = this line again (again within 3 s: the previous line), «siguiente» = the next line; the opening and the final scene are one chapter each. «Los pasos» on screen with the playing line highlighted and the key phrases marked. |
| Progress | **Like the other episodes**: «Escuchado» at ≥ 90 % really heard (count + last date) and «Ya lo he escuchado» by hand (episodes heard on Telegram); ★ favourites; filters (unheard, favourites, topic, level). XP as today: 10 per finished episode, at most 3 episodes a day across Modo deporte, on the `en` pack, counts for the streak. |
| Key phrases | **«Frases clave» list with ★**: the focus lines of the episodes already heard, each with its meaning, variants and tip, audio normal and slow (same voice), ★ to save it; filters «Guardadas» and topic; tapping one opens its episode at that step. |
| New batches | **One command, like the deck**: `npm run library:push` uploads only new or changed episodes from `listening-out/` with the owner's code; never deletes without `--prune`. The app sees them when the Biblioteca opens online, marked «Nuevo». No deploy. Telegram and the mp3s unchanged. |
| Timing | **Now, in parallel with 017**: own branch from 017's; server, push and device data first; the screens after P017·T215 is merged here. |

Defaults (not asked; say so if you disagree): the Biblioteca shows for the owner only with the English pack active (the content and the XP are `en`); episode ids in the app are `lib:<id>` (`lib:interview-001`); lock screen artist "Biblioteca · Entrevistas" / "Biblioteca · Trabajo" / "Biblioteca · Historias"; the text is shown in «Los pasos» (English only: the scripts have no Spanish); «Escuchar seguidos» joins at most 6 downloaded episodes (≈ 1.5 h); nothing downloaded is removed automatically; list order = topic (Entrevistas, Trabajo, Historias), then number.

### Server (`api/_lib/library.ts`, `api/coach/library.ts`)

```ts
type LibraryEpisode = {                       // what the push sends and the app plays; zod in api/_lib/schema.ts
  format: "herlingo-listening/1";
  id: string;                                 // ^[a-z0-9][a-z0-9-]{0,63}$ ("interview-001")
  topic: "interview" | "work" | "story"; number: number;   // 1–9999
  title: string; description: string;        // ≤ 80 / ≤ 300
  level: "B2" | "C1"; register: "formal" | "informal";
  intro: string; outro: string;               // ≤ 400 / ≤ 300
  cast: { id: string; name: string; role: string; gender: "female" | "male"; main: boolean }[];   // 1–8
  voices: Record<string, string>;             // "narrator" + every cast id; each in LIBRARY_VOICES
  parts: { title: string; steps: {           // 1–8 parts, 1–80 steps in total; title ≤ 120
    speaker: string;                          // a cast id
    intro: string;                            // ≤ 300, "" for most
    line: { text: string; meaning: string };  // ≤ 300 each; meaning "" unless focus
    focus: boolean;
    variants: { cue: string; text: string; meaning: string }[];   // ≤ 2; ≤ 120 / ≤ 300 / ≤ 300
    tip: string;                              // ≤ 300
  }[] }[];
  createdAt: string; seconds?: number;        // seconds = the batch mp3's length (estimate for the list)
};
type LibraryEntry = { id; topic; number; title; description; level; register; steps: number; focus: number;
                      seconds?: number; hash: string; addedAt: string; updatedAt: string };   // the index row
```

- Upstash (text store of P017·T206): `langlern:coach:library:index:<owner>` = `{ updatedAt, episodes: LibraryEntry[] }` (≤ 2000 rows) and `langlern:coach:library:ep:<owner>:<id>` = `{ hash, episode }` (≤ 64 KB each). One writer: the push script.
- `GET /api/coach/library/` → `200 { updatedAt, episodes }` · none → 404 `no_library` ("Todavía no hay episodios en la Biblioteca. Súbelos con npm run library:push.").
- `GET /api/coach/library/?id=<id>` → `200 { episode, hash }` · unknown → 404 `not_found` ("Ese episodio ya no está en la Biblioteca.").
- `PUT /api/coach/library/` body `{ episodes: LibraryEpisode[] }` (1–60, ≤ 512 KB) → each written with `hash` = SHA-256 of its canonical JSON, its index row upserted (`addedAt` kept for an existing id) → `200 { updatedAt, added, changed, unchanged, total }`. Invalid shape, a speaker without a voice or a voice outside `LIBRARY_VOICES` → 400 naming the episode id and the field path (never text).
- `DELETE /api/coach/library/` body `{ ids: string[] }` (1–500) → removed with their rows → `200 { updatedAt, removed, total }`.
- Checks in order: code → owner (non-owner → 403 `forbidden` "La Biblioteca es solo para la cuenta del dueño.") → body. No Claude call, no counter, no budget.
- **Voices**: `LIBRARY_VOICES` in `api/_lib/languages.ts` = the narrator `en-GB-SoniaNeural`, the main voices (`en-AU-NatashaNeural`, `en-AU-WilliamMultilingualNeural`), the second-main ones (`en-NZ-MollyNeural`, `en-NZ-MitchellNeural`) and the extras of `scripts/listening/episode.ts` (IE, US, GB, CA, ZA), one list that the script imports from there; `allowedVoices()` adds them, so `/api/coach/tts/` reads library lines (its daily limit, 2000 lines a code, is unchanged: an episode is ≈ 55 distinct lines the first time, ≈ 36 episodes a day).
- **Fake mode**: the memory store starts with an invented library of 3 episodes (one per topic, 2 parts × 3 steps, 1–2 focus steps each, invented names, the main voices).

### Push (`scripts/listening/push.ts`, `npm run library:push`)

`npm run library:push -- [--dir=listening-out] [--url=https://herlingo.vercel.app] [--dry] [--prune]`

- Reads `<dir>/scripts/*.json` (`format: "herlingo-listening/1"`), maps each to `LibraryEpisode` (drops `brief`, `generation`, `stats`, `audio`; `seconds` from `audio.seconds`), validates with the server's zod schema (imported from `api/_lib/`, like run.ts imports `api/_lib/tts`) and hashes it like the server.
- GETs the index with the owner's code (`COACH_ACCESS_CODES` + `COACH_OWNER` from `.env.local`, as `deck:push`), PUTs the new and changed episodes in chunks ≤ 400 KB, and with `--prune` DELETEs the ids on the server that are not in the folder. `--dry` validates and counts without the network.
- Prints counts only: files, invalid (with id and field path), new, changed, unchanged, pruned, total on the server. Never episode text.

### Order and chapters (`src/lib/sport/library.ts`)

- **One order** for the batch mp3s and the app: `libraryOrder(episode)` in a pure module (relative imports only, no browser API) returns the spoken lines (`{ text, voice, slow, chapter }`) and gaps; `scripts/listening/episode.ts` `compileEpisode` becomes a wrapper over it with byte-identical output (the T220 check proves it on every script in `listening-out/`). The order is the current one: title + intro; per part its title, then each step (intro if any, line; focus: slow, normal, "In other words: …", each variant's cue + text (+ its meaning), "Tip: …"); "And now, all of it again, from the start, with no stops." and every line once; outro; "End of the episode.". Gaps `GAPS` (repeat 400, turn 400, block 800, part 1200 ms), copy `COPY`, as now.
- `compileLibraryEpisode(episode)` → the `CompiledEpisode` the player joins: narrator lines `generatedPlayable(text, voices.narrator)`, a speaker's lines in `voices[speaker]`, slow ones with `{ slow: true }`. A line over 300 characters (54 openings are) is spoken in pieces by `splitSpokenText` into its one playable, as route lines are.
- **Chapters**: the opening (title + intro); one per step (the first step of a part starts at the part title; a step with an intro starts at it); the final scene (the replay, the outro and the end). A gap between two chapters belongs to the earlier one. `libraryPlayables(episode)` = every generated line, for downloads and pruning.
- Prepared like the deck episodes of P017·T215 (same preparation, retries, hidden-page pause, wake lock, missing-clip reasons, «Completar audio», «Guardar mp3», `joinEpisodes`).

### Device (`src/lib/library/`)

- `lang-lern:library:index` = `{ v: 1, updatedAt, fetchedAt, episodes: LibraryEntry[] }`: fetched when the Biblioteca opens online; a failed fetch keeps the stored one; 403 → not the owner (nothing shown, nothing stored). **Out of the backup and the cloud copy** (re-downloaded with the code, like the deck).
- Scripts: Cache Storage `lang-lern-library`, one entry per episode (`/library/<id>.json`, `{ hash, episode }`), fetched when an episode opens or downloads; lookups bounded at 1.5 s like generated lines; a script whose index `hash` changed is fetched again. The SW never deletes it (KEEP list); backups never include it.
- `lang-lern:library:progress` = `{ v: 1, firstSyncAt?, episodes: { [id]: { heard?: number; lastHeard?: string; manual?: true; fav?: true; opened?: true; downloaded?: true } }, phrases: { [phraseId]: { episodeId, step, text, meaning, at } } }`: learner data, **in the backup and the cloud copy** (change event `lang-lern:library-change` in the cloud save's `CHANGE_EVENTS`). `phraseId` = `<id>#<step>` (step = 0-based across the episode); a saved phrase keeps its own text, so the list works without the script.
- «Nuevo» = an index row with `addedAt` after `firstSyncAt` and not `opened` (the first sync flags nothing).
- **Downloads**: `downloadLibraryEpisode(id, { onProgress, signal })` = the script + every `libraryPlayables` line, fetched like `prepareEpisode` does (retries, pause while hidden, wake lock) without joining; then `downloaded: true`. «Quitar descarga» clears the flag and runs `pruneCoachAudio`. `pruneCoachAudio` keeps every line of each downloaded episode (from its cached script); if a downloaded episode's script cannot be read, it keeps every clip in a `LIBRARY_VOICES` voice (on doubt, keep).

### Screens (`src/components/sport/library/`)

- `/deporte/`: a «Biblioteca» card (owner, English active pack): "N episodios · N escuchados · N descargados", «Continuar: <title>» (the last opened and not finished, else the first unheard in list order) and «Ver la biblioteca» → `?bib=` (shallow `pushState`, like `?seguidos=`; back works).
- `?bib=`: filters «Todos» / «Sin escuchar» / «Favoritos» / «Descargados», topic chips, level chips; rows: number, title, one-line description, "Unos N min" (from `seconds`, else estimated from the compiled text), ✓ «Escuchado» (×N), ★, «Nuevo», download state; tap → `?ep=lib:<id>`. At the top: «Descargar 5 sin escuchar» (the next five unheard of the current filter, one after another: "Episodio 2 de 5 · 34/55", screen kept awake), «Escuchar seguidos» (the downloaded ones of the current filter, in list order, at most 6), «Frases clave» → `?frases=`, «Actualizar», space used by downloads. Offline: the stored index; only downloaded episodes play. No code → Prepárate's `AccessCard`; none uploaded → the `no_library` message.
- `?ep=lib:<id>` (`&paso=<n>` starts at that step's chapter): the existing player (prepare, «Reproducir» / «Pausar» / «Seguir», «Paso anterior» / «Paso siguiente», missing clips, «Guardar mp3») plus ★, «Ya lo he escuchado» / «Marcar como no escuchado», «Descargar» / «Quitar descarga». «Los pasos»: the opening, part titles as headings, each step as "Name: line", key phrases marked «Frase clave» with their meaning, variants (cue + text), tip and ☆ to save the phrase; the final scene as one item. Lock screen: the episode title, artist per Defaults.
- `?frases=`: the key phrases of the heard episodes (scripts in the cache; offline, the saved ones), grouped by episode in list order; filters «Todas» / «Guardadas» + topic; each: the line, its meaning, variants, tip, 🔊 normal and 🐢 lenta (`speak()` with the step speaker's generated playable), ☆/★; the episode title → `?ep=lib:<id>&paso=<n>`.

### XP and heard

`trackEpisodeXp("en", prepared)` as for the other episodes, ids `lib:<id>`. An additive `onFinished(episodeId)` callback on the tracker marks the episode heard (+1, date) at ≥ 90 % really heard, even when the day's XP cap is reached; XP through `awardFinishedEpisode("en", "lib:<id>")` (10 XP, source `"sport"`, shared cap of 3 a day). Opening an episode sets `opened` (clears «Nuevo»).

### UI copy (Spain Spanish, tú)

«Biblioteca» · "Episodios en inglés para escuchar corriendo: entrevistas, trabajo e historias." · «Continuar» · «Ver la biblioteca» · «Todos» · «Sin escuchar» · «Favoritos» · «Descargados» · «Entrevistas» · «Trabajo» · «Historias» · «Nuevo» · «Escuchado» / "Escuchado N veces" · «Ya lo he escuchado» · «Marcar como no escuchado» · «Descargar» · "Descargando… n/N" · «Quitar descarga» · «Descargar 5 sin escuchar» · "Episodio n de N" · «Escuchar seguidos» · «Frases clave» · «Todas» · «Guardadas» · «Frase clave» · «Guardar frase» / «Quitar de guardadas» (accessible names) · «Actualizar» · "Descargas: N MB" · "Todavía no hay episodios en la Biblioteca." · "Sin conexión: solo suenan los episodios descargados."

## Tasks

## T217 — Server: library store, `/api/coach/library/`, library voices, fake library
- Status: pending
- Depends on: none
- Where: any
- Goal: The scripts live on the server under the owner's code, and the TTS endpoint reads their lines with their own voices.
- Context: Design "Server"; the base already has the text store and owner check (017's T206) and the interview voices (017's T209); `api/_lib/{schema,store,deck,access,http,languages,fake}.ts`, `api/coach/deck.ts` (the owner pattern), `api/coach/tts.ts`, `scripts/coach/dev.ts`, docs/coach.md (API table), docs/mock-interview.md "API".
- Scope: may touch `api/_lib/library.ts` (new), `api/coach/library.ts` (new), `api/_lib/{schema,languages,fake}.ts`, `scripts/coach/dev.ts` (only if it lists routes), docs/sport.md (new section "Biblioteca" = this plan's Design, in the docs' style), docs/coach.md (one API row) / must not touch `src/`, prompts, ledger counters, `scripts/listening/**`.
- Done when:
  - `LibraryEpisode` / `LibraryEntry` (zod) and `LIBRARY_VOICES` per Design; `allowedVoices()` includes them.
  - `GET` (index, `?id=`), `PUT`, `DELETE` per Design: owner 200, guest 403, no code 401, bad body 400 (id + path, no text), > 512 KB 400, other methods 405; `PUT` reports added / changed / unchanged by hash and keeps `addedAt`.
  - Fake mode starts with the invented 3-episode library; `/api/coach/tts/` accepts `en-GB-SoniaNeural`.
  - Fake curl round trip: GET → PUT one changed + one new → GET `?id=` → DELETE → GET.
  - `npm run verify` → exit 0.
- Outcome:

## T218 — `npm run library:push`
- Status: pending
- Depends on: T217
- Where: any (against the fake server; the real upload is T224)
- Goal: One command uploads the new and changed episodes of `listening-out/`, and never deletes without `--prune`.
- Context: Design "Push", "Server"; `scripts/mock-interview/push-deck.ts` (owner code from `.env.local`, counts-only output), `scripts/listening/{schema,episode,README}`.
- Scope: may touch `scripts/listening/push.ts` (new), `scripts/listening/episode.ts` (voice pools imported from `LIBRARY_VOICES`, same assignment), `scripts/listening/README.md`, `package.json` (script `library:push`), CLAUDE.md (one Commands row) / must not touch `api/` (imports only), `src/`.
- Done when:
  - The command per Design (`--dir`, `--url`, `--dry`, `--prune`), chunks ≤ 400 KB, counts only.
  - Against `PORT=3107 COACH_FAKE=1 npm run dev:coach` with a throwaway folder of 3 invented episodes written by the check outside the repo: first run 3 new, second 0 changed, one edited → 1 changed, one removed + `--prune` → 1 pruned; an invalid file is counted with its id and path.
  - The voice assignment of `buildEpisode` is unchanged (throwaway tsx on an invented cast); `npx tsx scripts/listening/run.ts status` still runs.
  - `npm run verify` → exit 0.
- Outcome:

## T219 — Device: library index, scripts cache, progress store
- Status: pending
- Depends on: T217
- Where: any
- Goal: The app knows the library (offline after one sync), keeps each opened script, and stores the progress as learner data that travels in the backup.
- Context: Design "Device"; `src/lib/mock-interview/` (deck sync and stores, P017·T212), `src/lib/coach/api.ts` (`CoachApiError`, the code header), `src/lib/backup/index.ts` (`isBackupKey`, the deck exclusion), `src/lib/cloud-save/index.ts` (`CHANGE_EVENTS`), `scripts/pwa/build.ts` (KEEP), `src/lib/audio/generated.ts` (bounded cache lookups).
- Scope: may touch `src/lib/library/**` (new), `src/lib/backup/index.ts` (the index key out), `src/lib/cloud-save/index.ts` (the change event), `scripts/pwa/build.ts` (KEEP `lang-lern-library`), CLAUDE.md (one layout line) / must not touch `src/lib/sport/**`, `src/components/**`, `api/`.
- Done when:
  - Types mirroring Design; `fetchLibraryIndex`, `fetchLibraryEpisode` (`CoachApiError`); `useLibrary()` (stored index, sync on open when online, a failure keeps the stored one, 403 → not the owner); `getLibraryScript(id)` (cache first, ≤ 1.5 s, else the server, then cached; refetched when the hash changed); the progress store and hooks (heard, manual, ★, opened, downloaded, saved phrases, `firstSyncAt`, «Nuevo»).
  - The index key is out of the backup and the cloud copy; the progress key is in both; an import never touches the scripts cache; the SW keeps `lang-lern-library`.
  - Throwaway tsx: tolerant parsing (bad and unknown shapes), the «Nuevo» rule, the backup filters.
  - `npm run verify` → exit 0.
- Outcome:

## T220 — One play order, the library compiler and downloads
- Status: pending
- Depends on: T219, P017·T215 (merged into this branch first: Shared contract, "Branches")
- Where: any
- Goal: A library episode compiles to the same audio as its batch mp3, prepares and plays on the existing player, and can be downloaded for a run.
- Context: Design "Order and chapters", "Device" (downloads); `scripts/listening/episode.ts` (`compileEpisode`, `GAPS`, `COPY`), `src/lib/sport/{compile,prepare,downloaded,types,index}.ts` and P017·T215's deck compiler, `src/lib/audio/{generated,split}.ts`, `src/lib/coach/saved-audio.ts` (`pruneCoachAudio`).
- Scope: may touch `src/lib/sport/library.ts` (new: the pure order, relative imports only, and the compiler), `src/lib/sport/{prepare,downloaded,index}.ts` (additive), `src/lib/library/**`, `src/lib/coach/saved-audio.ts` (the keep rule), `scripts/listening/episode.ts` (`compileEpisode` → a wrapper over the order, same output), docs/sport.md / must not touch `api/`, the other sources' compile output, stored shapes outside the library keys.
- Done when:
  - `libraryOrder`, `compileLibraryEpisode`, `libraryPlayables` and the chapters per Design; lines over 300 characters spoken in pieces.
  - `downloadLibraryEpisode` per Design; «Quitar descarga»; `pruneCoachAudio` keeps downloaded episodes' lines (on doubt, every library-voice clip).
  - Throwaway tsx: the fake library compiles (distinct lines per episode printed); the script's `compileEpisode` output equals the order's for the fake library and, when `../herlingo-escucha/listening-out/scripts` exists (the Mac), for every file there (same text, voice, speed and gaps in order); dialogue, route, AI and deck episodes compile exactly as before.
  - `npm run verify` → exit 0.
- Outcome:

## T221 — Biblioteca on `/deporte/`: card, list, filters, downloads, «Escuchar seguidos»
- Status: pending
- Depends on: T220
- Where: any
- Goal: Hernán finds his next episode, filters by topic and level, downloads a few at home and joins them for a long run.
- Context: Design "Screens", "UI copy", Defaults; `src/components/sport/{SportView,nav,JoinedView,episodes}` (`?seguidos=` shallow navigation, sections, «Escuchar seguidos»), `src/components/coach/AccessCard`, P017·T213's owner detection (cached usage `isOwner`).
- Scope: may touch `src/components/sport/library/**` (new), `src/components/sport/{SportView,nav,JoinedView,episodes}.*` (additive), `src/lib/library/**`, docs/sport.md, CLAUDE.md (one layout line) / must not touch `api/`, `src/lib/sport/compile.ts`.
- Done when:
  - The card on `/deporte/` (owner + English pack only), `?bib=` with every filter, row and action of Design, «Continuar», «Descargar 5 sin escuchar» (progress, wake lock, pause while hidden), «Quitar descarga», space used, «Actualizar», «Escuchar seguidos» (≤ 6), offline and no-code / no-library states.
  - `npm run verify` → exit 0.
  - Hand check (PC): card and list in light and dark at 375 px; filters; five downloads in a row.
- Outcome:

## T222 — The library player: «Los pasos», key phrases, heard, XP
- Status: pending
- Depends on: T221
- Where: any
- Goal: A library episode plays like the others, shows who says what and its key phrases, and marks itself heard.
- Context: Design "Screens" (`?ep=lib:`), "XP and heard"; `src/components/sport/{EpisodeView,use-episode-audio,episodes}`, `src/lib/sport/{xp,player}.ts`.
- Scope: may touch `src/components/sport/**`, `src/lib/sport/xp.ts` (the additive `onFinished`), `src/lib/library/**`, docs/sport.md / must not touch `api/`, the other sources' behaviour.
- Done when:
  - `?ep=lib:<id>` and `&paso=<n>`; lock screen title and artist; «Los pasos» per Design with the playing line highlighted; ★, «Ya lo he escuchado» / «Marcar como no escuchado», «Descargar» / «Quitar descarga», ☆ per key phrase.
  - ≥ 90 % → heard +1 with the date (also past the XP cap) and the XP of the other episodes; opening clears «Nuevo».
  - `npm run verify` → exit 0.
  - Hand check (PC): the player in light and dark; previous / next on the lock screen.
- Outcome:

## T223 — «Frases clave»
- Status: pending
- Depends on: T222
- Where: any
- Goal: Hernán reviews the key phrases of what he has heard, hears them normal and slow, and keeps the ones he wants.
- Context: Design "Screens" (`?frases=`), "Device" (saved phrases); `src/lib/audio` (`speak`, `generatedPlayable`).
- Scope: may touch `src/components/sport/library/**`, `src/lib/library/**`, docs/sport.md / must not touch `api/`, `src/lib/sport/**`.
- Done when:
  - `?frases=` per Design: heard episodes' key phrases, «Todas» / «Guardadas» + topic, 🔊 normal / 🐢 lenta from a tap, ☆/★, the title opens the episode at the step; offline with the saved ones.
  - `npm run verify` → exit 0.
  - Hand check (PC): the list in light and dark; a slow line.
- Outcome:

## T224 — Real upload and iPhone check (Hernán, by hand)
- Status: pending
- Depends on: T218, T223
- Where: pc (`listening-out/` in ../herlingo-escucha; the owner code in `.env.local`; a deployed build with Hernán's OK)
- Goal: The 244 episodes in the app, measured on the iPhone; findings become fix tasks.
- Context: Design (all); T218's command.
- Scope: none (no code), except the numbers in docs/sport.md "Biblioteca · Measured".
- Done when:
  - `npm run library:push -- --dir=../herlingo-escucha/listening-out --dry`, then the real push: 244 new; a second run: 0 changed.
  - On the iPhone (English pack): one episode prepared (time, distinct lines, missing clips → docs), «Descargar 5 sin escuchar» at home, a run with the phone locked (previous repeats the line, next skips it, the final scene), ≥ 90 % → «Escuchado» + XP, a ★ and a saved phrase, «Escuchar seguidos».
- Outcome:

## Review queue

## Visual checks queue

## Decisions
- 2026-11-16 plan: Audio = rebuilt on the device with the Modo deporte pipeline and the same edge-tts voices through `/api/coach/tts/` (never the device voice); scripts on the server's private store under the owner's code; never in git or the build; the batch mp3s stay for Telegram. (Hernán)
- 2026-11-16 plan: Chapters = one per line as today (previous = this line again, next = the next line); opening and final scene one chapter each. (Hernán)
- 2026-11-16 plan: Progress = like the other episodes: heard at ≥ 90 % plus «Ya lo he escuchado» by hand, ★ favourites, filters, XP 10 with the shared cap of 3 a day on the `en` pack. (Hernán)
- 2026-11-16 plan: Key phrases = a «Frases clave» list of heard episodes with audio normal/slow and ★ to save; no review (SRS) integration. (Hernán)
- 2026-11-16 plan: New batches = `npm run library:push` (new and changed only, `--prune` to delete), «Nuevo» in the app, no deploy; Telegram and the mp3s unchanged. (Hernán)
- 2026-11-16 plan: Timing = in parallel with plan 017 on a branch cut from it; screens after P017·T215 is merged here. (Hernán)
- 2026-11-16 plan: hybrid push policy: the writer pushes `plan-018-biblioteca` after every integrated task; never main, no PR or deploy without Hernán's OK. (plan)

## Proposals (new scope)

## Log
- 2026-11-16 16:55Z 💻 plan written from the interview (5 questions, all recommended options); base plan-017-mi-entrevista @ cb3e99c4 (its last integration verified ✓); not approved yet
- 2026-11-16 17:01Z 💻 approved by Hernán; Status active; Writer released
