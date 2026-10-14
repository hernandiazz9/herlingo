# Plan 016 — "Modo deporte": audio-only episodes to learn a situation while cycling

Status: active
Created: 2026-10-13
Base branch: plan-016-modo-deporte
Goal: Hernán picks or describes a situation ("ir a un supermercado en Italia") and gets an **episode**: an 8–12 minute audio guide where a Spain-Spanish narrator explains each step and the target-language lines sound several times (his lines normal → slow → normal, theirs twice, then the meaning and short tips), ending with the whole scene untranslated. Listening only: no pauses to speak, no taps. The device joins the episode into **one mp3** so it keeps playing with the iPhone locked (lock-screen and headphone controls jump between steps). Episodes come from AI (`POST /api/coach/episode/`) and, free, from the pack's dialogues and his saved Modo rápido routes. Phase 1 proves the locked-screen playback on his iPhone with free episodes before any AI work. Save tokens: one agent at a time, no code reviews, no visual checks by agents (Hernán checks on his iPhone).
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-14 06:07Z 💻
- Writer: me (💻 desktop session in lang_lern-rapido; plan checkout ../lang_lern-deporte)
- Branch: plan-016-modo-deporte · pushed · main = this branch
- Next step: T199 (episode preparation survives a locked screen + «Completar audio»), then redeploy for Hernán
- Gotchas: integrate in ../lang_lern-deporte; agent worktrees (lang_lern/.claude/worktrees/) reset to the plan HEAD in step 1 and hold the real .env.local → fake server as COACH_FAKE=1 ANTHROPIC_API_KEY= COACH_ACCESS_CODES= UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN=; generatedBytes lives in @/lib/audio/generated (not re-exported yet)
- Needs Hernán: workaround meanwhile: reopen the episode with the screen on · rest of T197 · visual queue (5)

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, **docs/sport.md** (the contract: decisions, episode model, compiler, player, endpoint, prompt, client, UI copy) and the parts of docs/coach.md it points to ("Modo rápido", "POST /api/coach/tts/", "Generated audio", "Voice (TTS)"). docs/brief.md is app-wide; do not edit it. Do not edit `plans/`.
- **Static export stays.** The backend is only `api/` (Vercel functions, relative `.js` imports). `src/` never imports `api/`, `@anthropic-ai/sdk`, `@upstash/redis` or runtime zod (ESLint enforces it). No secrets in code; `.env.example` holds names only.
- **Never lose on-device data.** New key `lang-lern:coach:episodes:<lang>` (`{ v: 1, episodes }`) only. No existing key renamed, reshaped or dropped; no `localStorage.clear()`. `pruneCoachAudio` keeps the lines of every saved pack, route and episode, plus every route's and pack dialogue's episode lines.
- **Existing features behave exactly as today** (unless the task says otherwise). `PACK_SYSTEM`, `INTERVIEW_SYSTEM` and `ROUTE_SYSTEM` stay byte-identical (prompt cache); routes' and packs' counters are not used by episodes.
- **Audio**: episode lines are edge-tts mp3s (24 kHz, 48 kbps, mono); slow lines are rendered at rate −30 % by `/api/coach/tts/` (`slow: true`), never `playbackRate`; episodes never use `speechSynthesis`. Playback starts from a user gesture on the shared unlocked `<audio>` element.
- **UI**: Spain Spanish with "tú" (copy in docs/sport.md); design tokens only, both themes, `pressable` + `-ledge`, `PageHeader`, `TargetText`, `lang` on target-language text, targets ≥ 44 px.
- **Language-agnostic.** Nothing names Italian outside fake fixtures keyed by language; narration copy keyed by gloss language; gate UI with `coachAvailable(lang)`.
- **Verification**: `npm run verify` → exit 0 for every task. API checks in fake mode: `PORT=3107 npm run dev:coach` (no key needed; dev code `dev-owner`) + `curl`; stop the server afterwards. Pure logic: a throwaway `npx tsx` check (not committed). **No browser, no screenshots, no visual checks** (Hernán does them).
- Final message ≤ 15 lines.

## Tasks

## T187 — Slow lines from the voice and byte access to generated audio
- Status: done
- Depends on: none
- Where: any
- Goal: `/api/coach/tts/` can render a line at rate −30 % and the client can get any generated line as bytes (cache first), so episodes can include slow versions and be joined.
- Context: docs/sport.md "Slow", "Player"; docs/coach.md "POST /api/coach/tts/", "Generated audio", "Voice (TTS)"; `api/_lib/tts.ts` (`PROSODY`; msedge-tts 2.0.8 accepts `{ rate: "-30%" }` in `toStream`, checked 2026-10-13), `api/coach/tts.ts`, `api/_lib/config.ts`, `src/lib/audio/generated.ts`, `src/lib/coach/api.ts` (the TTS source).
- Scope: may touch `api/_lib/{tts,config,schema}.ts`, `api/coach/tts.ts`, `src/lib/audio/generated.ts` (additive), `src/lib/coach/{api,audio}.ts` (the TTS request only), `.env.example`, docs/coach.md (tts + limits) / must not touch the prompts, `content/`, any screen.
- Done when:
  - Body `{ text, voice, slow?: boolean }`; `slow: true` reads at rate `-30%` (pitch and volume as today); anything else as today.
  - `generatedPlayable(text, voice, { slow: true })` → its own `audioKey` (hash of voice + slow flag + text; normal lines keep today's keys byte for byte) and the source requests it with `slow: true`; `speak()` of a slow generated playable plays at rate 1.
  - `generatedBytes(playable, signal?)` (name free) → `Uint8Array | null`: memory/Cache Storage first, else the source once (cached), never `speechSynthesis`; content playables are not its job.
  - `COACH_TTS_DAILY_LIMIT` default 2000 (docs and `.env.example` comment updated).
  - Fake check: `/api/coach/tts/` with `slow: true` → 200; an unknown voice → 400; a non-boolean `slow` → 400.
  - `npm run verify` → exit 0.
- Outcome: tts slow:true (rate -30%, 400 on non-boolean), generatedPlayable(…, { slow }) own key (normal keys unchanged), generatedBytes(playable) cache→source→null, COACH_TTS_DAILY_LIMIT 2000 · 58fa3d04 · verify ✓ 💻 · fake curl ✓ · not checked: real slow voice, device

## T188 — Episode model, compiler and free episodes from dialogues and routes
- Status: done
- Depends on: T187
- Where: any
- Goal: Pure logic in `src/lib/sport/` that turns any episode (AI, dialogue or route) into the ordered list of clips and gaps the player joins, following the decided format.
- Context: docs/sport.md "Decisions" (Order, Variants, Final scene, Gaps), "Episode model"; `@/lib/content` (`getDialogue`, dialogue turn shapes: native `text/es/voice/audioKey`, learner `prompt` + options with `verdict`), `src/lib/coach/{types,audio}.ts` (routes, `routeLine`, `COACH_NARRATORS`), `src/lib/audio/generated.ts`.
- Scope: may touch `src/lib/sport/**` (new) / must not touch other folders.
- Done when:
  - Types per docs/sport.md; `compileEpisode(episode, glossLang)` → `{ segments, chapters }` with the exact order and gap constants of the contract; narration copy in one table keyed by gloss language (`es`).
  - `episodeFromDialogue(dialogueId)` and `episodeFromRoute(route)` per the contract (correct + acceptable options only; ≤ 2 variants; words skipped); dialogue native lines reuse their content playables, slow lines are generated.
  - `episodePlayables(episode)` lists every generated line (narrator, slow, route lines) once.
  - Throwaway `npx tsx` check: one Italian dialogue and the fake route fixture compile; print segment counts, the first 15 segments as text, and an estimated duration (≈ 15 characters per second spoken + gaps); a dialogue episode lands in 2–5 minutes.
  - `npm run verify` → exit 0.
- Outcome: src/lib/sport/ (types, NARRATION table, EPISODE_GAPS, compileEpisode → segments+chapters, episodeFromDialogue/Route, episodePlayables); estimates: Italian dialogues 3:43–6:46, fake route 5:11 · 1d162735 · verify ✓ 💻 · not checked: real durations

## T189 — Joined player: one mp3 per episode, chapters, lock-screen controls
- Status: done
- Depends on: T188
- Where: any
- Goal: Prepare an episode (download every clip with progress), join it byte by byte into one mp3 with silent frames for the gaps, and play it on the shared element with Media Session controls that jump between steps.
- Context: docs/sport.md "Player", "Lock screen", "Offline", "Save mp3"; `src/lib/audio/{mp3,index,generated}.ts` (shared element, `unlockOnFirstGesture`, `mp3Url`), the SW audio cache (CLAUDE.md "Offline PWA"), Media Session use in `src/components/quick/listen-all.ts`. Spike 2026-10-13: edge-tts clips + LAME silence (`-write_xing 0 -id3v2_version 0`) joined with `cat` decode cleanly.
- Scope: may touch `src/lib/sport/**`, `src/lib/audio/**` (additive: long-media play/pause/seek/time events on the shared element) / must not touch screens, `api/`, `content/`.
- Done when:
  - `prepareEpisode(episode, { onProgress, signal })` → `{ blob, chapters, durationSec, missing }`: content mp3s by `fetch`, generated by T187's bytes helper (one retry), 3 downloads at a time; missing clips left out and counted; a format mismatch → a typed `format` error.
  - MP3 frame parser: skips ID3v2 and Xing/Info/LAME frames, checks version/layer/sample rate/channels, counts frames → exact durations; silent frames for 24 kHz mono 48 kbps embedded (small base64) and repeated to each gap.
  - `joinEpisodes(prepared[])` → one blob with all chapters in order.
  - Player API: `load(blob, chapters, meta)`, `play()` (inside a gesture), `pause()`, `seek(sec)`, `nextStep()`, `previousStep()` (start of step; within 3 s of it → previous step), `subscribe(state)` with `{ playing, timeSec, durationSec, step }`; `stop()`/`speak()` elsewhere stop it.
  - Media Session per the contract (metadata, play/pause, next/previous track = steps, seekto, seekbackward/forward 15 s, `setPositionState`), cleared on stop.
  - `episodeMp3File(blob, title)` → a `File` named after the title (for «Guardar mp3»).
  - Throwaway `npx tsx` check on bytes only: join 3 mp3s from `public/audio/it/` + gaps → frame count and duration match the sum; if `ffprobe`/`ffmpeg` exist, the output decodes without errors.
  - `npm run verify` → exit 0.
- Outcome: prepareEpisode (downloads, missing counted, format error), MP3 frame parser + new Xing frame on the joined file, joinEpisodes, player (load/play/pause/seek/steps, Media Session), episodeMp3File; mp3Media on the shared element · b4fa000b · verify ✓ 💻 · joined Gemini+edge clips: frames/duration exact, ffmpeg + afconvert decode clean · not checked: lock screen, headphones, iOS blob play/seek

## T190 — `/deporte/` screen with free episodes, player view and the Jugar card
- Status: done
- Depends on: T189
- Where: any
- Goal: Hernán opens Modo deporte, picks a dialogue episode, waits for "Preparando el audio…", taps «Reproducir», locks the phone and listens.
- Context: docs/sport.md "Access", "Save mp3", "UI copy"; models: `/rapido/` (`src/components/quick/*`: `?ruta=` shallow `pushState`, `AccessCard`, offline notice), `src/lib/navigation.ts` (`NESTED`), `src/components/shell/QuickFab.tsx` (`hiddenOn`), `src/app/jugar/page.tsx`.
- Scope: may touch `src/app/deporte/**` (new), `src/components/sport/**` (new), `src/lib/navigation.ts` (one `NESTED` entry), `src/components/shell/QuickFab.tsx` (hide on `/deporte/`), `src/app/jugar/page.tsx` (the card only), CLAUDE.md (folder layout lines), docs/sport.md / must not touch `api/`, `src/lib/coach/**`, `content/`, other screens.
- Done when:
  - `/deporte/` (nested section `sport`, title "Modo deporte", parent `play`) shows "De la app": one card per dialogue of the active pack (title, description, estimated minutes); gated by `coachAvailable(lang)` and the access code (`AccessCard`).
  - `?ep=<id>` (`dlg:…`, `route:…`, later ai ids) opens the player in place (shallow `pushState`, back works, works offline for what is cached): title, «Reproducir»/«Pausar»/«Seguir», paso anterior/siguiente buttons, progress with elapsed/total, the step list with the current step highlighted (`aria-current`, scrolled into view, reduced motion respected), "Preparando el audio… n/N", the missing-clips notice, «Guardar mp3» (share sheet, else download).
  - Jugar shows the "Modo deporte" card; the ⚡ is hidden on `/deporte/`.
  - CLAUDE.md folder layout names `src/lib/sport/` and `src/components/sport/`.
  - `npm run verify` → exit 0.
  - Hand check (PC): see T191.
- Outcome: /deporte/ (nested sport under Jugar): De la app (dialogue episodes, ~min estimate), ?ep= player (play/pause/steps, progress, step list, preparing n/N, missing notice, Guardar mp3), Jugar card, ⚡ hidden; dialogue lines on edge-tts (DIALOGUE_LINES_FROM_CONTENT=false); no ±15 s handlers; docs/sport.md Player/Lock screen/Screen · 93851d69 · verify ✓ 💻 · not checked: visuals, iPhone lock screen, share sheet, offline

## T191 — iPhone check: does it keep playing with the screen locked? (Hernán, by hand)
- Status: done
- Depends on: T190
- Where: pc (Hernán on his iPhone; a deployed build: merge to main or a Vercel preview, with his OK)
- Goal: Prove the joined-mp3 approach on the installed app before any AI work. Gate for T192 onwards.
- Context: «Escuchar todo» (chained clips) stops when the iPhone locks (Hernán, 2026-10-13).
- Scope: none (no code).
- Done when:
  - A dialogue episode plays to the end with the screen locked and the phone in a pocket; lock-screen title and progress show; play/pause, next and previous step from the lock screen and from the headphones work; the format sounds right (normal → slow → normal, twice for theirs, meanings, final scene).
  - After one full download it plays in airplane mode; «Guardar mp3» saves a file that plays in Archivos.
  - Findings become fix tasks; if locked playback fails, stop and decide with Hernán (e.g. «Guardar mp3» + another player as the main path) before T192.
- Outcome: Hernán on the iPhone (deployed app): "me fue bien" — dialogue episode plays with the screen locked; joined-mp3 approach confirmed · no code · verify n/a

## T192 — Episode generation on the server
- Status: done
- Depends on: T190
- Where: any
- Goal: Server modules that turn a description into a validated episode (fake or real Claude), no endpoint yet.
- Context: docs/sport.md "POST /api/coach/episode/", "Prompt", "Episode model"; models: the route's code in `api/_lib/{schema,normalize,prompts,fake,generators}.ts`.
- Scope: may touch `api/_lib/{schema,normalize,prompts,fake,generators}.ts` / must not touch `src/`, `api/coach/`, `content/`, the bytes of `PACK_SYSTEM`, `INTERVIEW_SYSTEM`, `ROUTE_SYSTEM`.
- Done when:
  - `EPISODE_ARRAY_LIMITS`, `GeneratedEpisode`, `Episode`, `EpisodeRequest` (zod) per the contract; `normalizeEpisode` trims and logs `[coach] trimmed episode overflow …` (paths and counts only); empty parts dropped; < 6 steps fails.
  - `EPISODE_SYSTEM` + `episodeUserPrompt` follow the contract's rules, reusing the pack's blocks and the `<`→`‹` escaping.
  - `generateEpisode(input, onUsage)`: fake → `fakeEpisode(meta, description)` (Italian supermarket fixture per the contract; placeholders for other languages) with realistic fake usage (~3k cache write, ~5k output); real → `generateStructured`, `effort: "low"`, `maxTokens: 12000`.
  - Throwaway `npx tsx` check: fakes for `it` and one other language pass `GeneratedEpisode`; an overflowing object is trimmed and passes; a 4-step one fails.
  - `git diff` shows the three existing system prompts unchanged.
  - `npm run verify` → exit 0.
- Outcome: EPISODE_TEXT_LIMITS (spoken strings ≤ 300) + EPISODE_ARRAY_LIMITS, GeneratedEpisode/Episode/EpisodeRequest, normalizeEpisode, EPISODE_SYSTEM + episodeUserPrompt (other prompts byte-identical), fakeEpisode (it supermarket: 3 parts, 8 steps), generateEpisode (low, 12000) · 51c87dfc · verify ✓ 💻 · not checked: real Claude call (tokens, latency vs the 50 s deadline, 12–16 steps)

## T193 — `POST /api/coach/episode/`, episode counter and usage
- Status: done
- Depends on: T192
- Where: any
- Goal: The endpoint with its own daily counter, billing and usage fields, exactly like `/api/coach/route/`.
- Context: docs/sport.md "POST /api/coach/episode/", "Decisions" (Limits); docs/coach.md "API", "Limits and ledger", the route endpoint `api/coach/route.ts`, `api/_lib/{ledger,store,config,http}.ts`, `api/coach/usage.ts`.
- Scope: may touch `api/coach/{episode,usage}.ts`, `api/_lib/{ledger,store,config}.ts`, `scripts/coach/dev.ts` (only if routes are registered by hand), `.env.example`, docs/coach.md + docs/sport.md / must not touch `src/`, the prompts.
- Done when:
  - Order of checks, billing, refunds and 502s as the route's; 429 `daily_limit` with the episode message; `COACH_EPISODE_DAILY_LIMIT` (default 5).
  - `GET /usage/` adds `episodes`, `avgEpisodeUsd`, `episodesToday`.
  - Fake curl: 200 with a valid episode and `today.used` 1; a 6th call the same day → 429; usage shows the new fields; no code → 401.
  - `npm run verify` → exit 0.
- Outcome: POST /api/coach/episode/ (checks/billing/refunds as /route/, reserveEpisode COACH_EPISODE_DAILY_LIMIT 5), /usage/ episodes + avgEpisodeUsd + episodesToday, per-call deadlineMs (episode 55 s), [coach] episode latency/tokens log · 97035912 · verify ✓ 💻 · fake curl ✓ (401/400/200×5/429, usage) · not checked: real Claude call, Upstash counters

## T194 — AI episodes on the device: create, save, download, list, delete
- Status: done
- Depends on: T193, T191
- Where: any
- Goal: From `/deporte/` Hernán types a situation, gets an episode saved with its audio downloaded in the background, and finds it under "Mis episodios".
- Context: docs/sport.md "Client", "UI copy"; models: `src/lib/coach/{api,routes,saved-audio,parse,types,use-coach}.ts`, `src/components/coach/generation.ts`, `src/components/quick/{QuickForm,SavedRoutes}.tsx`.
- Scope: may touch `src/lib/coach/**`, `src/lib/sport/**`, `src/components/sport/**`, docs/sport.md / must not touch `api/`, other screens, existing stored shapes.
- Done when:
  - `generateEpisode`, `parseEpisode` (tolerant), `episodes.ts` storage + `useSavedEpisodes` per the contract; saved on arrival even if the screen was left.
  - Saving downloads every generated line of the compiled episode (narrator, slow, targets) in the background with the shared prefetch; `pruneCoachAudio` keeps saved episodes' lines and every route's and pack dialogue's episode lines.
  - `/deporte/` gets the form (free text 1–500 characters) with the pending state, the daily-limit and offline messages, and "Mis episodios" (newest first, delete with "¿Borrar este episodio?"); an AI episode opens in the T190 player.
  - Fake end-to-end through the client code paths compiles (`npm run verify`); the fake fixture compiles to a 6–12 minute estimate in the T188 check script.
  - `npm run verify` → exit 0.
- Outcome: generateEpisode + parseEpisode (tolerant) + lang-lern:coach:episodes:<lang> + useSavedEpisodes; background download; pruneCoachAudio keeps episode/route/dialogue episode lines; /deporte/ form (placeholder 'Ej.: ir a un supermercado'), Mis episodios + delete; new episode opens in the player with a saved notice; usage fields parsed · 6d6160ad · verify ✓ 💻 · fake end-to-end ✓ (it fixture ≈ 6 min) · not checked: visuals, real episode, device

## T195 — Episodes from routes, «Escuchar seguidos» and XP
- Status: done
- Depends on: T194
- Where: any
- Goal: Every saved Modo rápido route becomes a free episode, several episodes can play as one long file, and a finished episode earns XP.
- Context: docs/sport.md "Sources", "Length", "XP"; `src/components/quick/RouteView.tsx`, `src/lib/progress/{activity,index}.ts` (`recordActivity`, `XpSource`; the Liga accepts any lowercase source).
- Scope: may touch `src/components/sport/**`, `src/lib/sport/**`, `src/components/quick/RouteView.tsx` (the button only), `src/lib/progress/index.ts` (add `"sport"` to `XpSource`), docs/sport.md / must not touch `api/`, stored shapes.
- Done when:
  - A route shows «🏃 Modo deporte» → `/deporte/?ep=route:<id>`; `/deporte/` lists "De tus rutas".
  - «Escuchar seguidos» on a section joins its fully downloaded episodes in order (`joinEpisodes`), with chapters across episodes.
  - Playing ≥ 90 % of an episode records 10 XP, source `"sport"`, once per episode per day, at most 3 a day (state in an existing-compatible way: a new `lang-lern:` key only if needed, versioned).
  - `npm run verify` → exit 0.
- Outcome: «🏃 Modo deporte» on saved routes → ?ep=route:<id>; De tus rutas section; «Escuchar seguidos» (?seguidos=mis|rutas|app, downloaded episodes only, joined); XP 10 'sport' at 90 % actually played, once/episode/day, ≤ 3/day via countPlay (no new key) · 9418fa65 · verify ✓ 💻 · tsx checks ✓ · not checked: visuals, joined lock-screen jumps, XP while locked

## T196 — «Escuchar todo» keeps playing with the screen locked
- Status: done
- Depends on: T191
- Where: any
- Goal: Fix the T183 finding: «Escuchar todo» on routes (and on stories and grammar pages, which use the same chain) plays one joined file instead of chained clips, so locking the iPhone does not stop it.
- Context: P015·T183 finding (Hernán, 2026-10-13: it stops when the screen locks); `src/components/quick/listen-all.ts`, `src/components/stories/StoryReader.tsx`, the grammar «Escuchar todo» (plan 014, T184), `speakSequence` in `src/lib/audio/index.ts`; the T189 joiner.
- Scope: may touch `src/components/quick/**`, `src/components/stories/StoryReader.tsx`, `src/components/grammar/**` (the play-all only), `src/lib/audio/**`, `src/lib/sport/**` (reuse only), docs/coach.md («Escuchar todo») / must not touch `api/`, `content/`, stored shapes.
- Done when:
  - Each «Escuchar todo» prepares its lines (all mp3 available → one joined file, highlight from chapters, Pausar/Seguir as today); if any line has no mp3 (device-voice fallback), it falls back to today's chain.
  - Media Session as today plus position state.
  - `npm run verify` → exit 0.
- Outcome: useSequencePlayer + src/lib/audio/joined.ts: route/story/grammar «Escuchar todo» join on-device mp3s into one file on episodePlayer (chapters drive the highlight, lock-screen position + steps); chain kept when a line lacks an mp3, the file is not ready 2 s after the tap, or Audio lento is on · 130a01ca · verify ✓ 💻 · tsx join check ✓ (it/fr/en/nl/es stories) · not checked: iPhone locked playback, lock screen, Audio lento path, visuals

## T197 — iPhone check of AI episodes, routes, XP and «Escuchar todo» (Hernán, by hand)
- Status: pending
- Depends on: T195, T196
- Where: pc (Hernán on his iPhone; deployed build with his OK; real key)
- Goal: Hernán listens to a real AI episode on the bike and checks the rest; findings become fix tasks.
- Context: first real episode: measure tokens, cost and latency into docs/sport.md.
- Scope: none (no code).
- Done when:
  - An AI episode is 8–12 minutes, natural Italian, useful tips; a route episode and «Escuchar seguidos» play locked; XP appears once; «Escuchar todo» keeps playing locked.
- Outcome:

## T198 — Fix: Modo deporte card next to Prepárate's at the top of Jugar
- Status: done
- Depends on: T190
- Where: any
- Goal: Hernán wants the Modo deporte card at the top of Jugar, next to «Prepárate para una situación» (above or below).
- Context: Hernán 2026-10-13 ("arriba o abajo"); T190 put it under the topic grid; `src/components/game/GameView.tsx` renders `EntryCard` only on the topics step.
- Scope: may touch `src/components/game/GameView.tsx`, `src/app/jugar/page.tsx`, docs/sport.md / must not touch the rest.
- Done when:
  - `SportEntryCard` renders right under `EntryCard` on the topics step (never during discovery or a round); removed from the page bottom.
  - `npm run verify` → exit 0.
- Outcome: done by the writer (3-line change, no agent, to save tokens) · e4c0de27 · verify ✓ 💻 · not checked: visual

## T199 — Fix: an episode prepared while the phone locks ends with dozens of missing clips
- Status: pending
- Depends on: T196
- Where: any
- Goal: Preparing an episode survives the screen locking or the app going to the background, and missing clips get completed without leaving the episode, so a native line's "Significa:" is never followed by silence.
- Context: Hernán 2026-10-14 (T197): a new AI episode said "Faltan 74 audios: necesitas conexión…" while online, and a "Significa:" had no meaning after it. Vercel request logs: the episode arrived 05:59:05, the phone then made 22 `/api/coach/tts/` requests in 7 s (all 200, ~3 at a time) and none after 05:59:12. Reading: the page went to the background (screen locked during "Preparando el audio…"); iOS fails its fetches instantly while JS still runs, so `prepareEpisode` (`src/lib/sport/prepare.ts`, one retry per clip) burned through the remaining clips as missing; `useEpisodeAudio` (`src/components/sport/use-episode-audio.ts`) prepares only once per mount, so nothing retries until the episode is reopened; the notice in `src/components/sport/EpisodeView.tsx` blames the connection.
- Scope: may touch `src/lib/sport/**`, `src/components/sport/**`, `src/lib/audio/generated.ts` (only if a visibility-aware wait belongs there), docs/sport.md / must not touch `api/`, stored shapes, other screens.
- Done when:
  - While `document.visibilityState === "hidden"`, preparation pauses: no new clip starts, and a clip that failed while hidden is retried once the page is visible again (not counted as missing). Same for «Escuchar seguidos» preparation if it shares the path.
  - A Screen Wake Lock (`navigator.wakeLock.request("screen")`, feature-detected, errors ignored) is held while an episode prepares and released when it is ready, fails or unmounts.
  - Ready with `missing > 0`: the player retries the missing clips automatically when the page becomes visible or the browser goes back online (only while not playing), and shows a «Completar audio» button; after completion the new file loads at the start of the chapter that was current. Notice copy: online → "Faltan N audios. Toca «Completar audio» para descargarlos."; offline → "Sin conexión: faltan N audios. Se completarán cuando vuelvas a tener internet.".
  - A throwaway `npx tsx` check simulates: clips failing while "hidden" are retried after "visible" and the result has `missing: 0`; a clip that truly fails stays missing once.
  - docs/sport.md "Offline" and "UI copy" updated.
  - `npm run verify` → exit 0.
- Outcome:

## Review queue

## Visual checks queue
- [ ] T190 @93851d69 — /deporte/ list + player: light + dark, iPhone width, Jugar card (below the topic grid), preparing state, step highlight, Guardar mp3 (queued 2026-10-13 💻)
- [ ] T198 @e4c0de27 — Jugar: Modo deporte card right under «Prepárate para una situación», light + dark (queued 2026-10-13 💻)
- [ ] T194 @6d6160ad — /deporte/: form (pending, limit, offline), Mis episodios + delete dialog, new AI episode opening in the player with its notice; light + dark (queued 2026-10-13 💻)
- [ ] T195 @9418fa65 — route «🏃 Modo deporte» button; /deporte/ De tus rutas; «Escuchar seguidos» joined view; '+10 XP' notice; light + dark (queued 2026-10-13 💻)
- [ ] T196 @130a01ca — «Escuchar todo» on a route, a story and a grammar page: keeps playing locked, highlight follows, Pausar/Seguir, lock-screen title (queued 2026-10-13 💻)

## Decisions
- 2026-10-13 plan: Sources = AI episodes from a description + free episodes from the pack's dialogues and saved Modo rápido routes, one player for all. (Hernán)
- 2026-10-13 plan: Listening only (bike): no pauses to speak, no microphone; just short gaps. (Hernán)
- 2026-10-13 plan: Length 8–12 min per episode; several can play in a row. (Hernán)
- 2026-10-13 plan: Order by speaker: his lines = Spanish context first, then normal → slow → normal, then the meaning; their lines = target twice, then the meaning; short tips ("Breve + trucos"); final scene untranslated. (Hernán)
- 2026-10-13 plan: «Escuchar todo» (chained clips) stops when the iPhone locks (Hernán, P015·T183 partial) → one joined mp3 per episode; slow lines rendered by the voice at −30 %. (Hernán + plan)
- 2026-10-13 plan: Defaults accepted without objection: `/deporte/` under Jugar + button on routes; lock-screen/headphone step controls; offline after download; XP per finished episode with a daily cap; ≈0.05–0.10 USD per AI episode with 5/day; «Guardar mp3». (Hernán)
- 2026-10-13 plan: Phase gate: T191 proves locked playback on the iPhone before any AI work (T192+). (plan)
- 2026-10-13 plan: Save tokens: one agent at a time, no code reviews, no visual checks by agents; Hernán checks on his iPhone (T191, T197). (Hernán, standing rule)
- 2026-10-13 plan: Work on branch `plan-016-modo-deporte` in ../lang_lern-deporte; pushes only there with `guarded_push.sh`; no merge into main, PR or deploy without Hernán's explicit OK. (plan)
- 2026-10-13 plan: Numbering: P015's Proposals named the evaluation plan "Plan 016"; Modo deporte takes 016 and the evaluation gets the next free number. (plan)
- 2026-10-13 T189: the joined file starts with its own Xing frame (frame count, bytes, seek table) so mixed 48/64 kbps seeks land right; docs/sport.md 'Player' to say so (T190). (plan)
- 2026-10-13 T189: lock screen = previous/next track (steps) only: no seekbackward/seekforward handlers, since iOS shows ±15 s instead of track buttons when they exist; seekto kept (T190). (plan)
- 2026-10-13 T188: dialogue episodes use edge-tts for normal and slow lines (same voice), one constant to switch back to the Gemini content mp3s; default until Hernán answers. (plan)
- 2026-10-13 plan: merged into main (fast-forward 487747ed..071ef416) with Hernán's OK ("si pasa a main"); deploy = Hernán. (Hernán)
- 2026-10-13 T188: dialogue episodes keep edge-tts for normal and slow lines ("me gustan las voces"). (Hernán)
- 2026-10-13 plan: gate relaxed after "continúa con lo que sigue": server tasks T192–T193 run before T191; T194 onwards still waits for T191. (Hernán + plan)
- 2026-10-13 plan: main fast-forwarded to plan-016 (deployed code, T187–T198) with Hernán's OK ("pasalo a main"). (Hernán)

## Proposals (new scope)
- 2026-10-13 plan: Episodes from the pack's units (key phrases of a lesson as a short listening review), no AI.
- 2026-10-13 plan: Narrator for other gloss languages (only `es` today).
- 2026-10-13 T187: a slow line without mp3 falls back to the device voice at speak()'s rate, not slow (rate set in src/lib/audio/index.ts)
- 2026-10-13 T187: per-line load deadline 8 s (LOAD_DEADLINE_MS) and request timeout 7 s (SPEECH_TIMEOUT_MS): preparing an episode with real slow lines may need retries
- 2026-10-13 T188: Italian content mp3s are Gemini voices (ttsVoices: Kore/Charon/Leda, 64 kbps) while slow lines are edge-tts (48 kbps): a dialogue's normal and slow lines sound like different people → asked Hernán
- 2026-10-13 T188: episode es/intro/tip allow ≤ 400 chars but /api/coach/tts/ accepts ≤ 300 (COACH_LIMITS.ttsText) → T192 caps episode narration and meanings at 300
- 2026-10-13 T189: generatedBytes and prefetchGenerated send text to TTS without stripStress (no pack uses stress marks today)
- 2026-10-13 T190: the Jugar card sits under the topic grid (top of Jugar is GameView); moving it next to EntryCard needs a GameView edit
- 2026-10-13 T190: 'De la app' is one flat list (en has 48 dialogues): group by situation
- 2026-10-13 T192: src/lib/sport/types.ts comment still says es ≤ 400 (now ≤ 300)
- 2026-10-13 T192: route es (schema ≤ 400) is spoken by «Escuchar todo» and route episodes, but /api/coach/tts/ caps text at 300: a 301–400 char meaning cannot play
- 2026-10-13 T192: an episode is ~4–6k output tokens; packs measured ~135 tok/s (2k in 15 s) → ~30–45 s, close to claude.ts DEADLINE_MS 50 s; T193 gives the episode call its own deadline (≤ 55 s, function maxDuration 60) and logs latency
- 2026-10-13 T193: as in route.ts, an Episode.parse failure after billing answers 500 internal instead of 502
- 2026-10-13 T194: src/components/sport/generation.ts duplicates the job runner of components/coach/generation.ts; share one
- 2026-10-13 T194: the Prepárate usage panel (AiUsagePanel) does not show the episode counters yet (the client parses them)
- 2026-10-13 T195: src/lib/sport/downloaded.ts copies generated.ts's private cache path; export an 'is cached' helper from src/lib/audio/generated.ts
- 2026-10-13 T195: XpToast does not list source 'sport' (no floating +XP; the player shows its own notice)
- 2026-10-13 T196: episodePlayer hard-codes artist 'Modo deporte' (useSequencePlayer overwrites it after play()); add an optional artist to EpisodePlayerMeta
- 2026-10-13 T196: docs/sport.md 'Player' does not say «Escuchar todo» now uses the episode player

## Log
- 2026-10-13 16:31Z 💻 plan written from the interview (two demo mp3s + a byte-join spike with real edge-tts voices); not approved yet
- 2026-10-13 16:40Z 💻 approved by Hernán ("si comienza con el plan")
- 2026-10-13 16:40Z 💻 T187 launched · attempt 1 · agent a8150887220bfacf0
- 2026-10-13 16:49Z 💻 T187 done · worktree-agent-a8150887220bfacf0 → 58fa3d04 · verify ✓
- 2026-10-13 16:49Z 💻 T188 launched · attempt 1 · agent af9c75698b24a05f4
- 2026-10-13 16:57Z 💻 T188 done · worktree-agent-af9c75698b24a05f4 → 1d162735 · verify ✓
- 2026-10-13 16:57Z 💻 T189 launched · attempt 1 · agent a1001fa71713095c5
- 2026-10-13 17:13Z 💻 T189 done · worktree-agent-a1001fa71713095c5 → b4fa000b · verify ✓
- 2026-10-13 17:13Z 💻 T190 launched · attempt 1 · agent a4eddf1514188c1ad (+ edge-tts dialogue lines, no ±15 s handlers, Xing note in docs)
- 2026-10-13 17:25Z 💻 T190 done · worktree-agent-a4eddf1514188c1ad → 93851d69 · verify ✓
- 2026-10-13 17:28Z 💻 main fast-forwarded to 071ef416 with Hernán's OK; .vercel copied into ../lang_lern-deporte for the deploy
- 2026-10-13 17:28Z 💻 T192 launched · attempt 1 · agent a6c51a16e78d4a469 (+ spoken strings ≤ 300)
- 2026-10-13 17:38Z 💻 T192 done · worktree-agent-a6c51a16e78d4a469 → 51c87dfc · verify ✓
- 2026-10-13 17:38Z 💻 T193 launched · attempt 1 · agent ac9bbfe0cf04a6319 (+ episode deadline 55 s, latency log)
- 2026-10-13 17:43Z 💻 T193 done · worktree-agent-ac9bbfe0cf04a6319 → 97035912 · verify ✓
- 2026-10-13 20:18Z 💻 deployed by Hernán from ../lang_lern-deporte (plan-016 @ ead2b57a, includes T192–T193 not yet in main) → https://langlern-iota.vercel.app
- 2026-10-13 20:59Z 💻 T191 done (Hernán: "me fue bien"); next: AI episodes ("agreguemos lo de ia")
- 2026-10-13 20:59Z 💻 T194 launched · attempt 1 · agent ae24454bb01bbcc72
- 2026-10-13 21:01Z 💻 T198 done by the writer (card under EntryCard) → e4c0de27 · verify ✓
- 2026-10-13 21:10Z 💻 T194 done · worktree-agent-ae24454bb01bbcc72 → 6d6160ad · verify ✓
- 2026-10-13 21:11Z 💻 T195 launched · attempt 1 · agent aa039354ce92863d9
- 2026-10-13 21:23Z 💻 T195 done · worktree-agent-aa039354ce92863d9 → 9418fa65 · verify ✓
- 2026-10-13 21:23Z 💻 T196 launched · attempt 1 · agent a0c13b2cdac9c4346
- 2026-10-13 21:42Z 💻 T196 done · worktree-agent-a0c13b2cdac9c4346 → 130a01ca · verify ✓
- 2026-10-13 21:43Z 💻 merged origin/main (a952b70e: msedge-tts 2.1.0, update download progress) into plan-016 → 0257a6de, no conflicts · npm ci · verify ✓ · slow TTS (rate -30%) still works on msedge-tts 2.1.0
- 2026-10-13 22:10Z 💻 deployed by Hernán from ../lang_lern-deporte (plan-016 @ 99a8e4ad: T187–T198 + main a952b70e) → https://langlern-iota.vercel.app; main not fast-forwarded yet
- 2026-10-13 22:30Z 💻 main fast-forwarded to 82ad12f5 with Hernán's OK
- 2026-10-14 06:07Z 💻 T197 finding (Hernán): 'Faltan 74 audios' while online + 'Significa:' with no meaning → logs show downloads stopped 7 s after the episode arrived (page backgrounded) → fix task T199
