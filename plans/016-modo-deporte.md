# Plan 016 — "Modo deporte": audio-only episodes to learn a situation while cycling

Status: active
Created: 2026-10-13
Base branch: plan-016-modo-deporte
Goal: Hernán picks or describes a situation ("ir a un supermercado en Italia") and gets an **episode**: an 8–12 minute audio guide where a Spain-Spanish narrator explains each step and the target-language lines sound several times (his lines normal → slow → normal, theirs twice, then the meaning and short tips), ending with the whole scene untranslated. Listening only: no pauses to speak, no taps. The device joins the episode into **one mp3** so it keeps playing with the iPhone locked (lock-screen and headphone controls jump between steps). Episodes come from AI (`POST /api/coach/episode/`) and, free, from the pack's dialogues and his saved Modo rápido routes. Phase 1 proves the locked-screen playback on his iPhone with free episodes before any AI work. Save tokens: one agent at a time, no code reviews, no visual checks by agents (Hernán checks on his iPhone).
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-13 16:49Z 💻
- Writer: me (💻 desktop session in lang_lern-rapido; plan checkout ../lang_lern-deporte)
- Branch: plan-016-modo-deporte · pushed
- Next step: T188, then T189–T190 one at a time; T191 is Hernán's iPhone check (gate)
- Gotchas: integrate in ../lang_lern-deporte; agent worktrees (lang_lern/.claude/worktrees/) reset to the plan HEAD in step 1 and hold the real .env.local → fake server as COACH_FAKE=1 ANTHROPIC_API_KEY= COACH_ACCESS_CODES= UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN=; generatedBytes lives in @/lib/audio/generated (not re-exported yet)

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
- Status: running (attempt 1 · 💻 · agent af9c75698b24a05f4 · since 16:49Z)
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
- Outcome:

## T189 — Joined player: one mp3 per episode, chapters, lock-screen controls
- Status: pending
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
- Outcome:

## T190 — `/deporte/` screen with free episodes, player view and the Jugar card
- Status: pending
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
- Outcome:

## T191 — iPhone check: does it keep playing with the screen locked? (Hernán, by hand)
- Status: pending
- Depends on: T190
- Where: pc (Hernán on his iPhone; a deployed build: merge to main or a Vercel preview, with his OK)
- Goal: Prove the joined-mp3 approach on the installed app before any AI work. Gate for T192 onwards.
- Context: «Escuchar todo» (chained clips) stops when the iPhone locks (Hernán, 2026-10-13).
- Scope: none (no code).
- Done when:
  - A dialogue episode plays to the end with the screen locked and the phone in a pocket; lock-screen title and progress show; play/pause, next and previous step from the lock screen and from the headphones work; the format sounds right (normal → slow → normal, twice for theirs, meanings, final scene).
  - After one full download it plays in airplane mode; «Guardar mp3» saves a file that plays in Archivos.
  - Findings become fix tasks; if locked playback fails, stop and decide with Hernán (e.g. «Guardar mp3» + another player as the main path) before T192.
- Outcome:

## T192 — Episode generation on the server
- Status: pending
- Depends on: T191
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
- Outcome:

## T193 — `POST /api/coach/episode/`, episode counter and usage
- Status: pending
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
- Outcome:

## T194 — AI episodes on the device: create, save, download, list, delete
- Status: pending
- Depends on: T193
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
- Outcome:

## T195 — Episodes from routes, «Escuchar seguidos» and XP
- Status: pending
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
- Outcome:

## T196 — «Escuchar todo» keeps playing with the screen locked
- Status: pending
- Depends on: T191
- Where: any
- Goal: Fix the T183 finding: «Escuchar todo» on routes (and on stories and grammar pages, which use the same chain) plays one joined file instead of chained clips, so locking the iPhone does not stop it.
- Context: P015·T183 finding (Hernán, 2026-10-13: it stops when the screen locks); `src/components/quick/listen-all.ts`, `src/components/stories/StoryReader.tsx`, the grammar «Escuchar todo» (plan 014, T184), `speakSequence` in `src/lib/audio/index.ts`; the T189 joiner.
- Scope: may touch `src/components/quick/**`, `src/components/stories/StoryReader.tsx`, `src/components/grammar/**` (the play-all only), `src/lib/audio/**`, `src/lib/sport/**` (reuse only), docs/coach.md («Escuchar todo») / must not touch `api/`, `content/`, stored shapes.
- Done when:
  - Each «Escuchar todo» prepares its lines (all mp3 available → one joined file, highlight from chapters, Pausar/Seguir as today); if any line has no mp3 (device-voice fallback), it falls back to today's chain.
  - Media Session as today plus position state.
  - `npm run verify` → exit 0.
- Outcome:

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

## Review queue

## Visual checks queue

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

## Proposals (new scope)
- 2026-10-13 plan: Episodes from the pack's units (key phrases of a lesson as a short listening review), no AI.
- 2026-10-13 plan: Narrator for other gloss languages (only `es` today).
- 2026-10-13 T187: a slow line without mp3 falls back to the device voice at speak()'s rate, not slow (rate set in src/lib/audio/index.ts)
- 2026-10-13 T187: per-line load deadline 8 s (LOAD_DEADLINE_MS) and request timeout 7 s (SPEECH_TIMEOUT_MS): preparing an episode with real slow lines may need retries

## Log
- 2026-10-13 16:31Z 💻 plan written from the interview (two demo mp3s + a byte-join spike with real edge-tts voices); not approved yet
- 2026-10-13 16:40Z 💻 approved by Hernán ("si comienza con el plan")
- 2026-10-13 16:40Z 💻 T187 launched · attempt 1 · agent a8150887220bfacf0
- 2026-10-13 16:49Z 💻 T187 done · worktree-agent-a8150887220bfacf0 → 58fa3d04 · verify ✓
- 2026-10-13 16:49Z 💻 T188 launched · attempt 1 · agent af9c75698b24a05f4
