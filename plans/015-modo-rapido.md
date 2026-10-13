# Plan 015 — Prepárate "Modo rápido": a quick route to get out of a jam in a shop

Status: active
Created: 2026-10-13
Base branch: plan-015-modo-rapido
Goal: Hernán types a few words ("tengo que imprimir algo") and in ~15 s gets a **route**: the likely exchange with the clerk, chat style, skipping the obvious, every line in the target language (big) with Spain Spanish below and audio (normal and slow), each turn expandable to other ways they may say it, other answers and key words. Reached from a floating ⚡ button on every screen; routes are saved and work offline. A new Vercel function `POST /api/coach/route/` (fake mode included) next to Prepárate's. The AI evaluation of everything practised is a later, separate plan. Save tokens: one agent at a time, no code reviews, no visual checks by agents (Hernán checks on his iPhone).
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-13 06:21Z 💻
- Writer: me (💻 desktop session in lang_lern-rapido, since 06:21Z)
- Branch: plan-015-modo-rapido · pushed
- Next step: integrate T175 when its agent finishes, then launch T176 (one agent at a time)
- Gotchas: never switch branches in `lang_lern/` (plan 014 lives there); `.env.local` absent here on purpose (fake mode).

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, **docs/coach.md "Modo rápido"** (the contract: decisions, endpoint, schema, prompt, client, UI copy) and the parts of docs/coach.md it points to. docs/brief.md is app-wide; do not edit it. Do not edit `plans/`.
- **Static export stays.** The backend is only `api/` (Vercel functions, relative `.js` imports). `src/` never imports `api/`, `@anthropic-ai/sdk`, `@upstash/redis` or runtime zod (ESLint enforces it). No secrets in code; `.env.example` holds names only.
- **Never lose on-device data.** New key `lang-lern:coach:routes:<lang>` (`{ v: 1, routes }`) only. No existing key renamed, reshaped or dropped; no `localStorage.clear()`. `pruneCoachAudio` must keep the lines of every saved pack **and** route.
- **Packs and the interview behave exactly as today.** `PACK_SYSTEM` and `INTERVIEW_SYSTEM` stay byte-identical (prompt cache); the 10 generations/day are not used by routes.
- **UI**: Spain Spanish with "tú" (copy in the contract); design tokens only, both themes, `pressable` + `-ledge`, `PageHeader`, `TargetText`, `lang` on target-language text, targets ≥ 44 px; audio only through `speak()` inside the tap handler.
- **Language-agnostic.** Nothing names Italian outside fake fixtures keyed by language; gate UI with `coachAvailable(lang)`.
- **Verification**: `npm run verify` → exit 0 for every task. API checks in fake mode: `PORT=3107 npm run dev:coach` (no key needed; dev code `dev-owner`) + `curl`; stop the server afterwards. **No browser, no screenshots, no visual checks** (Hernán does them).
- Final message ≤ 15 lines.

## Tasks

## T175 — Route generation on the server
- Status: running (attempt 1 · 💻 · agent a80b78e238b64f1ac · since 06:21Z)
- Depends on: none
- Where: any
- Goal: Server modules that turn a description into a validated `Route` (fake or real Claude), no endpoint yet.
- Context: docs/coach.md "Modo rápido" + "Pack schema", "Prompts", "The call"; models to follow: the pack's code in `api/_lib/schema.ts`, `normalize.ts`, `prompts.ts`, `fake.ts`, `generators.ts`.
- Scope: may touch `api/_lib/{schema,normalize,prompts,fake,generators}.ts` / must not touch `src/`, `api/coach/`, `content/`, the bytes of `PACK_SYSTEM` and `INTERVIEW_SYSTEM`.
- Done when:
  - `ROUTE_ARRAY_LIMITS`, `GeneratedRoute`, `Route`, `RouteRequest` (zod) exported per the contract; `normalizeRoute` trims turns → 10, alts → 3, words → 4 and logs `[coach] trimmed route overflow …` (paths and counts only).
  - `ROUTE_SYSTEM` and `routeUserPrompt` follow the contract's rules, reusing the pack's `<target_language>`, `<stress_marks>`, `<learner>`, `<about_me>` blocks and the `<`→`‹` escaping.
  - `generateRoute(input, onUsage)`: fake → `fakeRoute(meta, description)` (Italian fixture: printing a document from the phone, 6–8 turns, learner first, alts and words; placeholders for other languages like `fakePack`) with `FAKE_ROUTE_USAGE` (~2.5k cache write, ~1.7k output); real → `generateStructured` with `effort: "low"`, `maxTokens: 6000`.
  - A throwaway `npx tsx` check (not committed): the fake for `it` and for one other pack language passes `GeneratedRoute`; a 12-turn object with 5 alts is trimmed and passes; a native first turn and two learner turns in a row fail.
  - `git diff` shows `PACK_SYSTEM` and `INTERVIEW_SYSTEM` unchanged.
  - `npm run verify` → exit 0.
- Outcome:

## T176 — `POST /api/coach/route/`, route counter and usage
- Status: pending
- Depends on: T175
- Where: any
- Goal: The endpoint, its own daily counter and the usage additions, working in fake mode.
- Context: docs/coach.md "Modo rápido" + "Limits and ledger"; `api/coach/pack.ts` (copy its flow: authenticate → body → budget → reserve → generate → bill → refund only if not billed), `api/coach/usage.ts`, `api/_lib/{ledger,config,http,languages}.ts`, `scripts/coach/dev.ts`, `vercel.json` (its `api/coach/*.ts` glob already covers the new file), `.env.example`.
- Scope: may touch `api/coach/route.ts` (new), `api/coach/usage.ts`, `api/_lib/{ledger,config}.ts`, `scripts/coach/dev.ts` (only if it lists endpoints), `.env.example` / must not touch `src/`, prompts, the other endpoints' behaviour.
- Done when:
  - `CallKind` gains `"route"`; `reserveRoute(caller)` uses `<day>:route:<name>` (expires after 2 days) with `COACH_ROUTE_DAILY_LIMIT` (default 20); `recordCall("route")` adds `<month>:routes` and `<month>:routeSpend`; `readUsage` returns `routes`, `avgRouteUsd`, `routesToday`.
  - Fake mode (`PORT=3107 npm run dev:coach`, `x-coach-code: dev-owner`): POST `/api/coach/route/` `{"lang":"it","description":"tengo que imprimir algo"}` → 200, `route.turns[0].speaker == "learner"`, ids `r1…`, `voices` set, `usage.today` = route counter; with `COACH_ROUTE_DAILY_LIMIT=2` the third call → 429 `daily_limit` with the route message; no code → 401; `"description":""` → 400; `GET /usage/` shows the three new fields and `today` (generations) unchanged by routes.
  - `.env.example` lists `COACH_ROUTE_DAILY_LIMIT` (name only).
  - `npm run verify` → exit 0.
- Outcome:

## T177 — Client: route types, API call, storage and audio
- Status: pending
- Depends on: T176
- Where: any
- Goal: `@/lib/coach` support for routes, per the contract's "Client" table.
- Context: docs/coach.md "Modo rápido" → "Client", "Generated audio"; `src/lib/coach/{types,parse,api,packs,audio,store,usage,use-coach,index}.ts`, `src/lib/audio/generated.ts`.
- Scope: may touch `src/lib/coach/**` / must not touch existing storage keys or shapes, `api/`, UI.
- Done when:
  - `CoachRoute*` types, `parseRoute`, `generateRoute`, `getSavedRoutes` / `getSavedRoute` / `saveRoute` / `deleteRoute`, `routeLine` / `routePlayables`, `useSavedRoutes(lang)` exported as the contract says.
  - `saveRoute` downloads the route's audio in the background (shared prefetch); `deleteRoute` prunes; `pruneCoachAudio` keeps every saved pack's and route's lines in every language.
  - Tolerant parsing: a corrupt value or invalid route is dropped, never thrown; the usage parser accepts `routes`, `avgRouteUsd`, `routesToday` as optional (an old stored usage still parses).
  - `npm run verify` → exit 0.
- Outcome:

## T178 — `/rapido/` screen: route view and Mis rutas
- Status: pending
- Depends on: T177
- Where: any
- Goal: The screen that lists saved routes and shows one (chat-style turns, audio, «Más»), reachable by URL.
- Context: docs/coach.md "Modo rápido" → "Decisions", "UI copy"; models: `src/components/coach/{CoachView,PackView,SavedPacks,nav,shared,ConfirmDialog}`, `src/app/preparar/page.tsx` (Suspense + `useSearchParams`), `src/lib/navigation.ts`.
- Scope: may touch `src/lib/navigation.ts` (NESTED `quick`: `/rapido/`, label "Rápido", title "Modo rápido", parent `play`), `src/app/rapido/**`, `src/components/quick/**` (new), `src/components/coach/*` only to export an existing piece, CLAUDE.md (folder layout, one line) / must not touch `api/`, `src/lib/coach/**`.
- Done when:
  - `/rapido/`: PageHeader, an empty slot for the form (T179), "Mis rutas" (newest first, empty-state line); `?ruta=<id>` opens a route in place (shallow pushState; "← Modo rápido" back; unknown id → "Ruta no encontrada" + back button).
  - A route: title, «description», turns as chat bubbles ("Te dicen" native / "Tú" learner, distinct token colours), target text big + Spanish below, 🔊 and 🐌 per line, «Más»/«Menos» (`aria-expanded`) only when the turn has alts or words, showing "También te pueden decir" / "También puedes decir" and "Palabras", each with audio; taps call `recordListen`.
  - Delete with confirmation from the list and the route view.
  - `npm run verify` → exit 0 and `out/rapido/index.html` exists.
- Outcome:

## T179 — Quick form and generation
- Status: pending
- Depends on: T178
- Where: any
- Goal: Typing a situation on `/rapido/` produces, saves and opens a route.
- Context: docs/coach.md "Modo rápido"; models: `src/components/coach/{SituationForm,generation,AccessCard,CoachView,shared,AiUsagePanel}`; `src/lib/coach/use-coach.ts`.
- Scope: may touch `src/components/quick/**`, `src/components/coach/generation.ts` only to generalise it (packs keep working identically), `src/components/coach/AiUsagePanel.tsx` (one "Rutas rápidas" row: count and average this month, when present) / must not touch `api/`, `src/lib/coach/**` storage.
- Done when:
  - Text-only form (500 limit with counter, "Prepárame" disabled when empty, pending, offline or over the limit), pending state "Preparando tu ruta…", server error messages shown as is, no code or 401 → `AccessCard`, offline notice.
  - The request survives leaving the screen; on arrival the route is saved and opened with the saved / not-saved notice; a not-saved route stays in memory until opened or dismissed (like packs).
  - After a route: "Te quedan N rutas hoy" from `usage.today`.
  - Fake end-to-end of the API with `PORT=3107 npm run dev:coach` + curl still green; the UI path checked by reading the code (no browser).
  - `npm run verify` → exit 0.
- Outcome:

## T180 — Floating ⚡ button
- Status: pending
- Depends on: T178
- Where: any
- Goal: One tap to Modo rápido from every screen.
- Context: docs/coach.md "Modo rápido" → "Access"; `src/app/layout.tsx`, `src/components/shell/TabBar.tsx`, `src/lib/pwa/UpdatePrompt.tsx` and the install prompt (positions), `src/app/globals.css` (`--tabbar-height`, `--safe-bottom`, `--column-width`); pages with fixed bottom controls or running exercises (find them); `coachAvailable`, `useActiveLang`.
- Scope: may touch `src/components/shell/QuickFab.tsx` (new), `src/app/layout.tsx`, `src/app/globals.css` (a spacing variable), the flows that must hide it (a path list or one hide call each) / must not touch `api/`, `src/lib/coach/**`.
- Done when:
  - Round ⚡ link to `/rapido/` (`aria-label="Modo rápido"`), bottom right inside the 480 px column, above the tab bar and safe areas, `pressable` with a ledge, tokens only.
  - Hidden per the contract (on `/rapido/`, flows with fixed bottom controls or a running exercise, packs without `coachAvailable`, before the active language is ready); the final list is written in the component's comment.
  - While visible, `<main>` gets extra bottom space so the last item is never covered; it never overlaps the update or install prompts.
  - `npm run verify` → exit 0.
- Outcome:

## T181 — iPhone check (Hernán, by hand)
- Status: pending
- Depends on: T179, T180
- Where: pc (Hernán on his iPhone; never an agent)
- Goal: Hernán checks the whole flow on the phone; findings become fix tasks.
- Context: fake mode over the LAN: `npm run build && COACH_LAN=1 npm run start:coach` (http on a LAN address: no Cache Storage, audio silent in fake mode). Real voices and real cost only after a deploy with Hernán's OK.
- Scope: none (no code).
- Done when:
  - ⚡ on every tab, light and dark, not covering content or prompts; hidden inside lessons, games, dialogues, stories.
  - Type a situation → route in place; bubbles readable at phone width; 🔊/🐌 respond; «Más» opens and closes; "Mis rutas" lists it; delete asks first.
  - Airplane mode: a saved route still opens (on the deployed https app).
- Outcome:

## Review queue

## Visual checks queue

## Decisions
- 2026-10-13 plan: Access = one global floating ⚡ button (no cards on Ruta, Frasario or Jugar). (Hernán)
- 2026-10-13 plan: Input = free text only; no dictation, no example chips. (Hernán)
- 2026-10-13 plan: Route = loose chat-style turns (4–10, prompt asks 6–8), learner opens with the need; «Más» per turn shows alternatives + key words. (Hernán; "learner opens" from his own example in docs/ideas.md)
- 2026-10-13 plan: New endpoint `POST /api/coach/route/`; Sonnet 5.5 effort low (~0.02 USD, ~10–15 s, estimated); own counter 20/day/code; no refinements; shared monthly budget. (Hernán)
- 2026-10-13 plan: Saved automatically like packs, audio cached, offline; key `lang-lern:coach:routes:<lang>`. (Hernán)
- 2026-10-13 plan: No practice in v1; the AI evaluation (short exam + serious report, sketch in docs/coach.md) is a separate later plan. (Hernán)
- 2026-10-13 plan: Save tokens: one agent at a time, no code reviews, no visual checks by agents; Hernán checks on his iPhone (T181). (Hernán)
- 2026-10-13 plan: Work on branch `plan-015-modo-rapido`; pushes only there with `guarded_push.sh`; no merge into main, PR or deploy without Hernán's explicit OK. (Hernán)

## Proposals (new scope)
- 2026-10-13 plan: Light practice after a route, no AI: hear a native line (main or alt) → pick its meaning among 3.
- 2026-10-13 plan: Measure the first real routes (tokens, cost, latency) and record them in docs/coach.md; compare Haiku 5.5 on 3 situations if Sonnet feels slow.
- 2026-10-13 plan: Plan 016: evaluation of everything practised (short exam + report), per docs/coach.md "Later".

## Log
- 2026-10-12 22:26Z 💻 plan written from the interview; not approved yet
- 2026-10-13 06:02Z 💻 approved by Hernán ("OK, en carpeta aparte"); worktree ../lang_lern-rapido created, npm ci done
- 2026-10-13 06:21Z 💻 resume on 💻 (lang_lern-rapido) · writer lock taken
- 2026-10-13 06:21Z 💻 T175 launched · attempt 1 · agent a80b78e238b64f1ac
