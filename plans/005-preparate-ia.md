# Plan 005 — Prepárate: AI situation coach

Status: active
Created: 2026-10-02
Base branch: claude/game-ai-chat-claude-1907dd-pmtpbd
Goal: A new "Prepárate" section, entered from Jugar, where the learner describes a real-life situation in Spanish (typed or dictated, e.g. "pedir un granizado en Catania") and Claude generates a preparation pack: a step-by-step guide, key phrases and a scripted role-play dialogue played in the existing dialogue simulator, all with neural Italian audio. Packs are saved on the device ("Mis situaciones"), so practising them again is free and works offline. A short AI level interview plus a "Sobre mí" card give Claude context about the learner. A small Vercel function holds the secrets (Anthropic key, Upstash), checks access codes, enforces spending limits and keeps a cost ledger, shown in an "Uso de IA" panel. The rest of the app stays a static export and keeps working offline; only Prepárate needs internet to generate. This batch runs on its own branch in parallel with plan 004 (Liga, other branch); the last task merges main back in. MVP speed: no automated tests; verification is `npm run verify`.
Test command: npm run verify
Worktree setup: npm ci

## Shared contract (all tasks read this)

- Brief override (Hernán, 2026-10-01): docs/brief.md says "static export (no server runtime, no API keys)". That is superseded for this feature only: one Vercel function backend for Prepárate. The site itself stays `output: "export"`; everything else stays serverless and offline. docs/brief.md stays untouched; the decision is recorded in `docs/coach.md`.
- Names: UI "Prepárate" (Spain Spanish, "tú"). Route `/preparar/`, registered in `NESTED` under the Jugar tab in `src/lib/navigation.ts` (no new tab). Entry: a highlighted card at the top of /jugar/ — "Prepárate para una situación" / "Cuéntame qué vas a hacer y te preparo". Client code in `src/lib/coach/` and `src/components/coach/`. Server code in `api/` (Vercel functions) plus shared server modules (for example `api/_lib/`, which Vercel does not expose as routes). Docs in `docs/coach.md`.
- Internet: Prepárate requires internet to generate (Hernán: "no hace falta que funcione sin internet para la IA"). Saved packs and their cached audio play offline. Offline → clear message, never a crash.
- Model: `claude-sonnet-5-5` (Hernán). Official `@anthropic-ai/sdk` on the server only. Structured outputs (`output_config.format`, JSON schema) for every generation; low/medium effort to keep cost down; stable cached system prompt; check `stop_reason` (refusal, max_tokens) before parsing. Server-side `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) as recommended for Sonnet 5.5 on the Claude API. The model id and the price table live in one place.
- Endpoints (all JSON, all require header `x-coach-code`, except where noted; names may be refined by T42 but must be documented in docs/coach.md):
  - `POST /api/coach/pack` `{ lang, description (≤500 chars), profile, refine?: { packId, instruction (≤200 chars), previous } }` → `{ pack, usage }`.
  - `POST /api/coach/interview` `{ lang, history[] }` → next question, or the final assessment `{ done: true, assessment }`.
  - `POST /api/coach/tts` `{ text (≤300 chars), voice (allowlist from the pack's voices) }` → `audio/mpeg`.
  - `GET /api/coach/usage` → `{ month, spentUsd, capUsd, remainingUsd, tokens {input, output, cacheRead}, packs, avgPackUsd, today {used, limit}, isOwner }`; `PUT /api/coach/usage { capUsd }` is owner only.
- Pack shape (JSON validated on the server with zod; the client gets runtime types, never zod): `{ id, createdAt, lang, description, title, register: "formal"|"informal", guide: [{ es }] (3–7 steps), keyPhrases: [{ text, es, note? }] (8–12), dialogue: { title, turns: [native { id, name?, text, es } | learner { id, prompt (es), options: [{ text, es, verdict: correct|acceptable|wrong, feedback (es) }] (2–3) }] (6–10 turns) }, refinements: number }`. Language-agnostic: the prompt gets the language and region from the pack (`getPack()` metadata), nothing Italian is hard-coded in `src/` or `api/`.
- Learner context sent with each pack request (built on the device, short, no personal identifiers beyond what the user typed in "Sobre mí"): progress numbers (lessons done/total, words learned, XP, placement test result), the latest interview assessment (estimated level, strengths, weak points, facts the learner shared), and the "Sobre mí" notes.
- Access: env `COACH_ACCESS_CODES` = comma-separated `name:code` pairs; `COACH_OWNER` = the name of the owner entry (Hernán). The user enters the code once in Prepárate; it is stored on the device. Wrong/missing code → 401 → the app asks for the code again. Only the owner can change the monthly cap.
- Limits (Hernán): monthly cap 5 USD total (default; the owner can change it from the app), at most 10 generations per day per code (pack generations and refinements; an interview counts as one generation, max 10 turns), at most 3 refinements/regenerations per pack (enforced on the server, mirrored in the UI), description ≤500 chars. Over a limit → 429 with a Spanish message the UI shows as is ("Has llegado al límite de hoy", "Se ha agotado el presupuesto de este mes").
- Spend ledger (like /Users/heralc/Desktop/HDDev/andrevallenails `lib/gasto/`, read it for the pattern): Upstash Redis REST (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`), every key prefixed `langlern:`, micro-dollars per month and per code with `incrby`, cost from the response `usage` (input, output, cache write, cache read) × a hand-written price table with its source and review date. In-memory fallback when Upstash is not configured (local dev). "Remaining" = cap − spent this month (Anthropic does not report a balance); the panel links to the Anthropic billing page.
- Voice: the TTS endpoint uses edge-tts (Microsoft neural voices, the same ones `npm run audio` uses, no key) from Node. Native speakers and the learner's options get different voices, like the static dialogues. The client caches every mp3 on the device (Cache Storage) keyed by a hash of voice + text, so each line is fetched once. If TTS fails, playback falls back to `speechSynthesis`. All playback still goes through `@/lib/audio` (extend it to accept a generated playable whose mp3 comes from the coach cache/endpoint) and starts from a user gesture.
- Fake mode: `COACH_FAKE=1` (and automatically when `ANTHROPIC_API_KEY` is missing in local dev) makes every endpoint return realistic canned data (a fixture pack, a 3-question fake interview, a short silent or bundled mp3, a fake usage) with no network calls, so every client task can be built and checked without keys. `npm run verify` never needs any env var.
- Local dev: one command (e.g. `npm run dev:coach`, documented in CLAUDE.md) that serves the app with working `/api/coach/*` locally (fake or real depending on env). The production build stays a static export in `out/`; Vercel deploys `api/` as functions next to it (`vercel.json` updated as needed). The service worker must never cache or intercept `/api/` requests.
- Secrets: never in the repo or in client code. Local: `.env.local` (git-ignored; `.env.example` lists the names with empty values). Production: Vercel env vars, set by Hernán. Agents never touch the real Vercel project or the real Upstash data beyond the T49 smoke test.
- XP: finishing a generated role-play awards XP like a game round (by correct answers, via `recordActivity({ lang, xp, outcomes: [] })`), only the first time per day per pack.
- Out of this batch (Hernán): live free chat with Claude, cultural-tips section, "what they'll say to you" section, mini exercises, adding generated phrases to Repaso (SRS).

## Tasks

## T42 — Coach backend skeleton: functions, access codes, limits, ledger, fake mode
- Status: pending
- Depends on: none
- Goal: The whole server side of Prepárate except the real Claude prompts and the real TTS: Vercel functions for every endpoint in the contract, access-code check, limits, Upstash ledger with in-memory fallback, price table, fake mode returning canned data for every endpoint, local dev command, deploy config, and docs/coach.md with the full API contract and pack schema, so client tasks can start against fake mode.
- Context: the plan's Shared contract; CLAUDE.md; vercel.json; next.config.ts; scripts/serve.ts; /Users/heralc/Desktop/HDDev/andrevallenails/lib/gasto/ (ledger, price table, caps pattern; read only); Vercel docs for Node functions in `api/` with a static output directory (WebFetch); `claude-api` skill for SDK usage, structured outputs, pricing.
- Scope: may touch `api/**` (new), `package.json`/`package-lock.json` (add `@anthropic-ai/sdk`, `@upstash/redis`, zod already exists, any dev tool for the local command), `vercel.json`, `tsconfig.json`/`eslint.config.*` (so `api/` is linted and typechecked), `scripts/**` (local dev command), `docs/coach.md` (new: decision record, architecture, API contract, pack schema, limits, ledger, env vars, Hernán's setup steps: Vercel env vars, Upstash database, Anthropic spending limit in the console, access codes), `.env.example` (new), CLAUDE.md (commands row, folder layout line, the "Static export only" convention amended for the `api/` exception) / must not touch `src/**`, `content/**`, `docs/brief.md`, `public/**`.
- Done when:
  - The local dev command starts, and with `COACH_FAKE=1`: `curl` POST `/api/coach/pack` with a valid code → 200 with a pack matching the schema; without a code → 401; the 11th generation in a day → 429; GET `/api/coach/usage` reflects the calls; PUT usage with a non-owner code → 403.
  - The pack schema (zod) and the price table exist in exactly one place each; the app bundle (`src/`) does not import zod or server code.
  - `npm run build` still writes the static export to `out/`; `npm run verify` → exit 0 with no env vars set.
  - docs/coach.md documents the contract and the setup steps.
- Outcome:

## T43 — Claude generation: pack, refinement and level interview
- Status: pending
- Depends on: T42
- Goal: Replace the fake generators with real Claude calls: the pack prompt (guide, key phrases, role-play dialogue, adapted to the learner context and register), refinement with one instruction (max 3 per pack), and the adaptive level interview (about 8 questions mixing comprehension, "how would you answer" and personal questions about the trip, then a final assessment).
- Context: Shared contract; docs/coach.md (T42); `claude-api` skill (Sonnet 5.5, structured outputs, prompt caching, refusal handling, fallbacks); docs/content-guide.md (quality rules for phrases and dialogues: natural spoken register, Spain Spanish translations, verdicts and feedback style); a few `content/it/dialogues/*.json` as style examples; `getPack()` metadata for language/region.
- Scope: may touch `api/**` (prompts, generators, schemas, ledger calls), docs/coach.md (prompt design section, measured token use and cost per pack) / must not touch `src/**`, `content/**`, `vercel.json`, `public/**`.
- Done when:
  - With `ANTHROPIC_API_KEY` unset or `COACH_FAKE=1`, behaviour is unchanged (fake data).
  - With a real key (if `.env.local` has one in this environment): one real pack, one refinement and one full interview validate against the schemas, each call is recorded in the ledger with its cost, and the measured cost per pack is written in docs/coach.md. If no key is available here, say so in DECISIONS and leave the real check to T49.
  - Refusal, max_tokens and invalid JSON return a clean 502 with a Spanish message, never a crash; no partial pack is stored.
  - `npm run verify` → exit 0.
- Outcome:

## T44 — Neural TTS endpoint (edge-tts)
- Status: pending
- Depends on: T42
- Goal: `POST /api/coach/tts` returns a real mp3 for a line of target-language text using edge-tts from Node, with the voice allowlist taken from the pack's voices (native and learner voices differ), input limits, the access-code check, and strong cache headers.
- Context: Shared contract; docs/coach.md; `scripts/audio/` (which voices and settings `npm run audio` uses); `src/lib/content/` for the pack's voice metadata; candidate Node packages for edge-tts (evaluate maintenance and size; pick one and record why).
- Scope: may touch `api/**` (tts handler and helpers), `package.json`/`package-lock.json` (one TTS dependency), docs/coach.md (TTS section) / must not touch `src/**`, `content/**`, `scripts/audio/**`, `public/**`.
- Done when:
  - The local dev command + `curl` with a valid code and an allowed voice → 200 `audio/mpeg` that plays (check file size > 0 and `file` says MPEG); disallowed voice or text > 300 chars → 400; no code → 401.
  - Fake mode returns a short mp3 without network.
  - If the edge-tts service is unreachable from this environment, the endpoint returns 503 and the docs say the client falls back to device voice; record what was verified in DECISIONS.
  - `npm run verify` → exit 0.
- Outcome:

## T45 — Client coach layer: API client, saved packs, audio cache, learner profile
- Status: pending
- Depends on: T42
- Goal: The framework-free + hooks layer every Prepárate screen uses: API client (base URL, access code on the device, typed errors for offline/401/429/502), saved packs ("Mis situaciones" in localStorage, versioned, tolerant parsing, delete), mp3 cache in Cache Storage with speechSynthesis fallback wired into `@/lib/audio`, learner profile store (interview assessments + "Sobre mí" notes) and the learner-context builder from progress, and the service worker change so `/api/` is network-only and the coach audio cache survives SW updates.
- Context: Shared contract; docs/coach.md (contract and pack schema); `src/lib/audio/` (speak, mp3, speech-synthesis); `src/lib/progress/` (index.ts, settings.ts, use-progress.ts hook + change-event pattern to mirror, `wordsLearned`, placement); `scripts/pwa/` (SW generation); CLAUDE.md audio and storage conventions.
- Scope: may touch `src/lib/coach/**` (new), `src/lib/audio/**` (extension for generated playables only, existing behaviour unchanged), `scripts/pwa/**` (SW: bypass `/api/`, keep the coach cache), docs/coach.md (client section), CLAUDE.md (folder layout line) / must not touch `src/app/**`, `src/components/**`, `api/**`, `content/**`, `src/lib/progress/**` (read only; add nothing there).
- Done when:
  - Hooks exist for: access code (`useCoachAccess`), saved packs (`useSavedPacks` with save/replace/delete), usage (`useCoachUsage`), learner profile (`useLearnerProfile`), and a `buildLearnerContext(lang)` used by the pack request; storage keys under `lang-lern:coach:*`.
  - `speak()` plays a generated playable from the cached mp3, fetches and caches it once otherwise, and falls back to speechSynthesis on any failure; static content audio is unchanged.
  - Built SW (`npm run build`, read `out/sw.js`) does not handle `/api/` requests and does not delete the coach audio cache on activate.
  - `npm run verify` → exit 0.
- Outcome:

## T46 — Prepárate screens: entry card, access, form, pack view, Mis situaciones
- Status: pending
- Depends on: T45
- Goal: `/preparar/` end to end against fake mode: Jugar entry card, access-code screen, the form (text box ≤500 chars, dictation in Spanish when the browser supports it, example chips), generating state, the pack view (title, guide steps, key phrases with normal and slow audio and translations), "Ajustar" with one instruction and "Generar otra vez" (counter of the 3 allowed), "Mis situaciones" list (open, delete with confirmation), the remaining-budget line ("Te quedan 3,20 $ este mes"), and offline/limit/error states. Leave a clear "Practicar el diálogo" slot for T47.
- Context: Shared contract; docs/coach.md; `src/lib/coach/` hooks (T45); `src/components/game/GameView.tsx` (where the entry card goes); `src/lib/navigation.ts` (`NESTED`); CLAUDE.md UI conventions (tokens only, both themes, `pressable`, PageHeader, Spain Spanish "tú", trailing slashes); `src/components/ui/`; `src/lib/speech/` for dictation; `node_modules/next/dist/docs/` for anything Next-specific.
- Scope: may touch `src/app/preparar/**` (new), `src/components/coach/**` (new), `src/components/game/GameView.tsx` (entry card only), `src/lib/navigation.ts` (NESTED entry) / must not touch `src/lib/coach/**` except small fixes recorded in DECISIONS, `src/lib/progress/**`, `src/components/dialogue/**`, `api/**`, `content/**`.
- Done when:
  - With the local dev command in fake mode: enter code → describe → pack appears → audio plays → adjust works up to 3 times then the button disables → the pack is in Mis situaciones after a reload → delete works; wrong code, 429 and offline show their Spanish messages.
  - /preparar/ lights up the Jugar tab; checked by hand in both themes at 375 px (describe what was checked in DECISIONS).
  - `npm run verify` → exit 0.
- Outcome:

## T47 — Role-play of the generated dialogue + XP
- Status: pending
- Depends on: T46
- Goal: Practise the pack's dialogue in the existing dialogue simulator (refactor it to accept a dialogue object, keeping `/dialogos/[id]` unchanged), with generated audio, speech recognition where available, and XP on finishing (first time per day per pack).
- Context: Shared contract; `src/components/dialogue/DialogueSimulator.tsx` and `recognition.ts`; `src/lib/content/types.ts` (Dialogue runtime type); `src/lib/progress/activity.ts` (`recordActivity`); `src/lib/game/index.ts` (`roundXp`); `src/lib/coach/` (T45); the "Practicar el diálogo" slot from T46.
- Scope: may touch `src/components/dialogue/**` (split into a loader wrapper + an inner player that takes a Dialogue object; static dialogues behave exactly as before), `src/components/coach/**`, `src/app/preparar/**`, `src/lib/coach/**` (pack → Dialogue adapter, per-day XP marker) / must not touch `src/lib/progress/**`, `src/lib/content/**`, `content/**`, `api/**`.
- Done when:
  - A static dialogue in /dialogos/ still plays as before (checked by hand).
  - A generated pack's dialogue plays with audio, options, feedback and recognition fallback; finishing awards XP once per day per pack (visible in /perfil XP).
  - `npm run verify` → exit 0.
- Outcome:

## T48 — Level interview, "Sobre mí" and "Uso de IA" in Perfil
- Status: pending
- Depends on: T45
- Goal: In /perfil: a "Tu nivel para la IA" section that runs the AI level interview (question by question, typed answers, dictation where supported; result shown as level, strengths, weak points; repeatable) and stores the assessment; a "Sobre mí" card with editable notes; an "Uso de IA" panel (spent this month, cap, remaining, tokens, average cost per pack, today's generations, link to Anthropic billing; the owner can edit the cap). Prepárate offers the interview when no assessment exists yet (a link, never blocking).
- Context: Shared contract; docs/coach.md; `src/lib/coach/` hooks (T45); `src/app/perfil/ProfileView.tsx` (settings and confirm-dialog style); CLAUDE.md UI conventions.
- Scope: may touch `src/app/perfil/**`, `src/components/coach/**` (interview, about-me and usage components; coordinate names with T46's files, do not edit T46's screens), a new route for the interview if needed (`src/app/preparar/nivel/**`), `src/lib/navigation.ts` (NESTED entry only if a new route is added) / must not touch `src/lib/progress/**`, `src/lib/coach/**` except small fixes recorded in DECISIONS, `api/**`, `content/**`.
- Done when:
  - In fake mode: the interview runs to the end and the assessment appears in /perfil and in the learner context sent with the next pack request (check the request body in the dev tools or a log); "Sobre mí" persists after a reload; the usage panel shows the fake numbers, and the cap editor appears only for the owner code.
  - Checked by hand in both themes at 375 px (describe what was checked in DECISIONS).
  - `npm run verify` → exit 0.
- Outcome:

## T49 — Real end-to-end check and setup docs
- Status: pending
- Depends on: T43, T44, T46, T47, T48
- Goal: Run the whole flow once against the real services with the keys in `.env.local` (a few cents): generate a pack, refine it, play its audio, run an interview, check the ledger and the usage panel; fix what breaks; finish docs/coach.md with the exact setup steps for Vercel and Upstash and the measured costs.
- Context: Shared contract; docs/coach.md; `.env.local` in the worktree (copied through `.worktreeinclude`, or provided as environment variables in the cloud); every Done-when of T42–T48.
- Scope: may touch any file of this batch to fix integration bugs (record each fix in DECISIONS), docs/coach.md, README.md (deploy section: new env vars) / must not touch `content/**`, `docs/brief.md`, the real Vercel project settings, deploys.
- Done when:
  - With real keys: one pack + one refinement + 3 audio lines + one interview succeed; the ledger total matches the sum of the calls' costs within rounding; at most ~10 real API calls in total.
  - If keys or network are unavailable in this environment, report exactly what was not verified and stop (status blocked) instead of guessing.
  - `npm run verify` → exit 0.
- Outcome:

## T50 — Bring main into the Prepárate branch
- Status: pending
- Depends on: T49
- Goal: Merge the current main into this branch, resolve conflicts (navigation, GameView, ProfileView, CLAUDE.md, package.json are the likely ones), and make sure Prepárate and everything from main work together.
- Context: `git log main` since the branch point; CLAUDE.md; docs/coach.md.
- Scope: may touch any conflicting file, keeping both sides' intent / must not touch `docs/brief.md`; no push.
- Done when:
  - `git merge main` committed with conflicts resolved; `npm run verify` → exit 0.
  - /preparar/, /jugar/ and /perfil/ checked by hand in fake mode after the merge.
- Outcome:

## Decisions
- 2026-10-01 plan: Hernán's interview answers: Vercel function holds the secrets; guide + scripted role-play, no live chat this batch; base branch claude/game-ai-chat-claude-1907dd with main merged at the end; Sonnet 5.5; route /preparar/ "Prepárate" from Jugar; saved packs on the device; edge-tts through the function; text + dictation + example chips; pack = guide + key phrases + role-play dialogue; AI level interview + "Sobre mí"; regenerations limited; ledger like andrevallenails in a new Upstash database; limits 5 USD/month, 10/day, 3 refinements; usage in /perfil and /preparar with an owner-only cap; XP on finishing the dialogue; generated phrases to Repaso deferred; agents may make a few real calls with keys in .env.local. (Hernán)
- 2026-10-02 plan: Hernán asked to reuse the andrevallenails `.env` keys. Only `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` would be needed (never the other secrets in that file). Reusing that Upstash database instead of a new one is fine because every key is prefixed `langlern:`; to be confirmed by Hernán when the keys are set up. Nothing has been copied yet. (orchestrator)
- 2026-10-02 plan: Hernán moved the work to a cloud session before approval. `.env.local` is git-ignored and does not travel; in the cloud the keys must be set as environment variables of the cloud environment, or T43/T44/T49 report what they could not verify. (orchestrator)

## Proposals (new scope)
- 2026-10-01 plan: live free chat with Claude playing the Italian side, with short corrections and a "¿Qué digo?" hint (prompt caching of the pack, ~20-turn cap).
- 2026-10-01 plan: "Añadir al repaso": generated phrases into the Leitner SRS with their own ids.
- 2026-10-01 plan: cultural tips and "what they'll say to you" sections in the pack; mini exercises before the dialogue.

## Log
- 2026-10-02 plan written from the interview; not approved yet
- 2026-10-02 approved by Hernán; base branch is the cloud session branch claude/game-ai-chat-claude-1907dd-pmtpbd
