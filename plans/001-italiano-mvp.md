# Plan 001 — Italian trainer MVP for the Sicily trip

Status: active
Created: 2026-09-30
Base branch: main
Goal: Build a personal, mobile-first, offline-capable Next.js PWA to learn spoken Italian for Hernán's trip to Sicily in under two weeks: lesson path with mixed exercises, spaced-repetition review, pocket phrasebook and dialogue simulator, with ~400 phrases, ~300 words and neural audio, all tailored to docs/brief.md.
Test command: npm run verify
Worktree setup: npm ci && npx playwright install chromium webkit

## Tasks

## T01 — Project scaffold, Sicilian theme and mobile shell
- Status: pending
- Depends on: none
- Goal: Create the Next.js app every other task builds on: tooling, Sicilian design system, mobile app shell with bottom navigation, test harness and the `npm run verify` command.
- Context: docs/brief.md (all product decisions). The repo only has docs/ and plans/. Use the latest stable Next.js (App Router), TypeScript strict, Tailwind, ESLint, `output: 'export'` (static export, no server runtime). Layout: `src/app`, `src/components`, `src/lib`, `content/<lang>/`, `scripts/`, `tests/e2e/`.
- Scope: may touch everything at the repo root except plans/ and docs/brief.md / must not touch plans/, docs/brief.md; no learning features or content beyond placeholders.
- Done when:
  - Routes exist as placeholders with Spain-Spanish copy: `/` (path), `/repaso`, `/frasario`, `/dialogos`, `/perfil`, reachable from a bottom tab bar that respects iPhone safe areas; on desktop the app is a centred mobile-width column.
  - Design tokens as CSS variables (lemon yellow, sea blue, terracotta, neutrals, success/error) and base components: big rounded primary/secondary Button, Card, ProgressBar, IconButton, with a light press animation.
  - Vitest + Testing Library configured with at least one component test; Playwright configured with an iPhone (WebKit) project and a mobile Chromium project, running against the built static export served locally.
  - `npm run verify` runs, in order: lint, typecheck, unit tests, build, e2e → exit 0.
  - An e2e spec taps through all 5 tabs on the iPhone project → passes.
  - `out/index.html` exists after the build.
  - CLAUDE.md documents the commands, folder layout and conventions (UI copy in Spain Spanish with "tú", language-agnostic code, content under `content/<lang>/`, tests never hard-code content ids or counts).
- Outcome:

## T02 — Content model, loader and validator
- Status: pending
- Depends on: T01
- Goal: Define the typed, language-agnostic data contract for a language pack, the loader the UI uses, a strict validator, and a small sample pack so UI tasks can build against real data before the real content lands.
- Context: docs/brief.md (content types, registers, exercise types, volumes). CLAUDE.md from T01. Later tasks: T03 adds audio, T05/T06 write the real Italian content in parallel, T04 generates exercises from items, T07 builds the placement test.
- Scope: may touch `src/lib/content/**`, `content/**`, `scripts/**`, `tests/**`, `docs/content-guide.md`, package.json scripts, CLAUDE.md / must not touch UI routes or components beyond what the loader needs.
- Done when:
  - Schemas (zod or equivalent, types inferred) for: pack meta (lang code, names, default voices), unit (id, title, situation, order, lessons), lesson (id, title, item refs), phrase (id, target text, Spanish translation, optional literal translation and notes, register tu/Lei/neutral, tags, audio key, optional voice), vocab item (id, word, article/gender, Spanish, optional example phrase ref, audio key), Q&A pair for "answer" exercises (question, accepted replies, distractors), dialogue (id, title, situation, turns: native line with audio key and voice, learner turn with options, correct and acceptable answers, feedback), grammar card, recognition-only expression (for Sicilian), placement question type.
  - Unit files are discovered by glob (e.g. `content/<lang>/units/*.json`, `content/<lang>/dialogues/*.json`) so parallel content tasks never edit a shared index. Unit `order` ranges are documented: 10–19 survival, 20–29 getting around, 30–39 talking with Italians, 40–49 food, 90+ grammar and Sicilian.
  - `npm run content:check` validates every pack: schema, unique ids, all references resolve, non-empty translations, lessons non-empty; it is added to `npm run verify` before the build.
  - Unit tests with fixtures under `tests/fixtures/` prove the validator rejects duplicate ids, broken refs and missing translations.
  - A small sample pack in `content/it/` (one unit with 2 lessons, ~15 phrases, ~10 vocab, a few Q&A pairs, 1 dialogue), clearly marked as sample in its file name so T05 can delete it.
  - `docs/content-guide.md` explains the schema, id conventions, file layout, order ranges and quality rules for content authors.
  - `npm run verify` → exit 0.
- Outcome:

## T03 — Audio pipeline and player
- Status: pending
- Depends on: T02
- Goal: Make every Italian string playable: an idempotent generation script with edge-tts neural voices, an audio manifest, and a client player with speechSynthesis fallback and slow mode.
- Context: docs/brief.md (Audio, iPhone constraints), docs/content-guide.md and the loader from T02. edge-tts is NOT installed on this machine: install it in a project-local Python venv (`.venv`, git-ignored) with a pinned `requirements.txt`. edge-tts needs internet at generation time only.
- Scope: may touch `scripts/audio/**`, `public/audio/**`, `src/lib/audio/**`, `src/components/**` (speakable components), `content/**` (only audio keys/voices if needed), package.json scripts, `.gitignore`, CLAUDE.md, tests / must not touch routes other than wiring a demo into an existing placeholder.
- Done when:
  - `npm run audio` generates an mp3 for every phrase, vocab item, Q&A line, dialogue line and recognition expression across all packs, named by a hash of text + voice, writes `public/audio/<lang>/manifest.json`, and prunes files no longer referenced. Dialogue speakers use distinct voices.
  - Running `npm run audio` a second time → generates 0 files.
  - A client audio module plays the mp3 for an item, falls back to `speechSynthesis` (it-IT, or the pack's locale) when the mp3 is missing or fails, stops the previous sound before playing a new one, supports a slow rate, and unlocks audio on the first user gesture (iOS).
  - A tappable `SpeakableText` (or similar) component is used on at least one placeholder screen.
  - `npm run content:check -- --strict-audio` fails when an item has no mp3 and passes on the sample pack (mp3s committed).
  - Unit tests cover mp3-then-fallback logic with mocked `Audio`/`speechSynthesis`.
  - `npm run verify` → exit 0.
- Outcome:

## T04 — Lesson player and exercise engine
- Status: pending
- Depends on: T03
- Goal: The core learning loop: a lesson session that generates mixed exercises from a lesson's items, checks answers leniently, gives immediate feedback with audio, re-queues mistakes and ends with a result.
- Context: docs/brief.md (exercise types, iPhone mic limits), content loader (T02), audio module (T03). Build against the sample pack; e2e tests pick the first available lesson from the loader, never a hard-coded id. Progress persistence is T07: expose a typed `LessonResult` (per-item outcomes, XP earned, duration) via an `onComplete` callback and keep persistence out of this task.
- Scope: may touch `src/app/leccion/**`, `src/components/exercises/**`, `src/components/lesson/**`, `src/lib/exercises/**`, `src/lib/speech/**`, tests / must not touch `content/**`, `public/audio/**`, the path/home page beyond a link to start a lesson.
- Done when:
  - Route `/leccion/[id]` statically generated for every lesson; a session of ~10–12 exercises generated with a seeded, deterministic generator from the lesson items.
  - Exercise types implemented: listen and pick the meaning; read Italian and pick the meaning; Spanish → Italian with word tiles (with distractors); fill the gap; dictation (type what you hear); answer the question (from Q&A pairs, audio question, pick the reply); match 5 pairs (vocab); say it aloud.
  - Answer checking ignores case, punctuation and apostrophe variants; missing accents are accepted with a "watch the accent" note; unit tests cover the normalizer and each exercise's checker.
  - Say-it-aloud: uses Web Speech recognition (it-IT) when available with a fuzzy similarity threshold; otherwise self-evaluation ("Me ha salido / No me ha salido"). A "No puedo hablar ahora" option disables speaking exercises for 15 minutes.
  - Feedback sheet (green/red) shows the correct answer with a play button; wrong items are re-queued at the end; progress bar; exit with confirmation; completion screen with XP.
  - e2e (iPhone project): complete a whole lesson answering correctly and one exercise wrongly → completion screen shown.
  - `npm run verify` → exit 0.
- Outcome:

## T05 — Content: getting around Sicily and talking with Italians
- Status: pending
- Depends on: T03
- Goal: Write the two highest-priority content areas with natural, current spoken Italian: getting around by train, bus, taxi and on foot in Sicily, and talking with Italians. Delete the sample pack content from T02.
- Context: docs/brief.md (priorities 1 and 2, registers, persona), docs/content-guide.md (schema, order ranges 20–29 and 30–39). Content is read by the learner in Spain Spanish with "tú". Real Sicilian context: Palermo Centrale, Catania Centrale, Siracusa, Agrigento, Cefalù, Taormina; Trenitalia regionale, AST/SAIS/Interbus, Prestia e Comandè, Alibus; "convalidare", "binario", "ritardo", "sciopero", "fermata", "capolinea". Include the typical things Italians SAY to him (ticket inspector, driver, station staff, people asking where he's from) so he learns to understand and answer.
- Scope: may touch `content/it/**` (own unit files in order ranges 20–39, own dialogue files, deleting the sample files), `public/audio/it/**` / must not touch `src/**`, other units' files.
- Done when:
  - About 220 phrases, 160 vocab items, 8 dialogues, and Q&A pairs for every lesson, in 4–5 units of 4–5 lessons each.
  - The "about me" persona phrases live in one clearly marked unit file with a generic Spanish traveller persona, easy to edit.
  - Every phrase has register and Spain-Spanish translation; dialogues include realistic misunderstandings ("Può ripetere?").
  - Sample pack files from T02 are deleted.
  - `npm run audio` run and mp3s committed; `npm run content:check -- --strict-audio` → exit 0.
  - `npm run verify` → exit 0.
- Outcome:

## T06 — Content: survival, food, grammar cards and Sicilian expressions
- Status: pending
- Depends on: T03
- Goal: Write the remaining content: survival basics, basic food, minimal grammar cards and recognition-only Sicilian expressions.
- Context: docs/brief.md (priorities 3–6), docs/content-guide.md (order ranges 10–19, 40–49, 90+). The learner already knows greetings and numbers at A1 level: go quickly past them and focus on what he will hear and need (not understanding, asking to repeat, prices, time, emergencies, pharmacy). Food: bar (caffè, cornetto, granita e brioche, arancini/arancine) and restaurant (table, ordering, allergies, bill, "coperto"). Grammar cards: tu vs Lei, "vorrei", present of essere, avere, volere, potere, andare. Sicilian: ~25 common words/expressions to recognise, with standard Italian equivalent.
- Scope: may touch `content/it/**` (own unit files in order ranges 10–19, 40–49, 90+, own dialogue files), `public/audio/it/**` / must not touch `src/**`, other units' files, the sample files (T05 deletes them).
- Done when:
  - About 180 phrases, 140 vocab items, 4 dialogues, Q&A pairs for every lesson, grammar cards and ~25 Sicilian expressions, in 4–5 units.
  - Every phrase has register and Spain-Spanish translation.
  - `npm run audio` run and mp3s committed; `npm run content:check -- --strict-audio` → exit 0.
  - `npm run verify` → exit 0.
- Outcome:

## T07 — Path, progress, spaced repetition, placement test and profile
- Status: pending
- Depends on: T04, T05, T06
- Goal: Turn lessons into a course: the home path of units, persistent progress with streak and XP, spaced-repetition review, the first-launch placement test and the profile/settings screen.
- Context: docs/brief.md (sections, gamification, placement). Lesson player and `LessonResult` from T04; real content from T05/T06 (loaded by glob, never hard-coded). Storage is localStorage with a versioned schema and safe parsing.
- Scope: may touch `src/app/page.tsx` (path), `src/app/repaso/**`, `src/app/perfil/**`, `src/app/bienvenida/**` (or similar onboarding route), `src/lib/progress/**`, `src/lib/srs/**`, `src/components/path/**`, `content/it/placement*` (placement questions), tests; may wire `onComplete` in the lesson route / must not change exercise logic in `src/lib/exercises/**` except exporting what it needs.
- Done when:
  - Home path: units in `order`, lesson nodes locked / available / done, current node highlighted, unit progress, grammar cards and Sicilian expressions reachable as side content.
  - Progress store: lessons done, XP, daily streak (local time zone, survives reload), per-item SRS state; unit tests cover streak edge cases (same day, next day, gap) and schema migration from an empty/corrupt value.
  - SRS: items answered wrong or due are scheduled (Leitner or SM-2-lite); `/repaso` runs a session through the T04 player with due items, and shows an empty state when nothing is due; unit tests cover scheduling.
  - Placement: first launch shows a short welcome and a ~12-question, ~3-minute placement test across units; mastered lessons are marked done; it can be retaken from the profile.
  - Profile: XP, streak, words learned, settings (slow audio default, speaking exercises on/off, reset progress with confirmation, retake placement).
  - e2e (iPhone project): first launch → placement → path → complete a lesson → XP and streak visible after reload → review session available.
  - `npm run verify` → exit 0.
- Outcome:

## T08 — Pocket phrasebook and dialogue simulator
- Status: pending
- Depends on: T04
- Goal: The two trip-time tools: a fast phrasebook to find and play phrases on the spot, and a dialogue simulator to practise understanding and answering real conversations.
- Context: docs/brief.md (Phrasebook, Dialogues). Loader (T02), audio (T03), answer checking and speech components from T04 (reuse them). Tests must not depend on specific content ids or counts.
- Scope: may touch `src/app/frasario/**`, `src/app/dialogos/**`, `src/components/phrasebook/**`, `src/components/dialogue/**`, `src/lib/favorites/**`, tests / must not touch `content/**`, `src/lib/exercises/**` except exporting what it needs, the path/review/profile screens.
- Done when:
  - Phrasebook: phrases grouped by situation, accent-insensitive search in Italian or Spanish, favourites stored locally, tap to play, slow-play button, and a full-screen "Mostrar" mode with big text to show an Italian.
  - Dialogues: list by situation; the simulator plays each native line (after a user gesture), text hidden by default with a "Ver texto" toggle and replay; the learner picks or says the answer; feedback per turn; final transcript with translations and play buttons.
  - e2e (iPhone project): search a phrase and open "Mostrar"; complete one dialogue end to end.
  - `npm run verify` → exit 0.
- Outcome:

## T09 — Italian content quality review
- Status: pending
- Depends on: T05, T06
- Goal: A native-level review of all Italian content so Hernán learns correct, natural, current spoken Italian, plus a volume and consistency check.
- Context: docs/brief.md, docs/content-guide.md, everything under `content/it/`. Review as a native Italian teacher who knows Sicily: grammar, articles and gender, naturalness, register (Lei vs tu) consistency, realistic dialogues, correct Sicilian place and transport names, Spain-Spanish translations with "tú".
- Scope: may touch `content/it/**`, `public/audio/it/**`, `docs/content-review.md` / must not touch `src/**`, schemas.
- Done when:
  - Every error found is fixed in place; `docs/content-review.md` lists the categories of fixes with counts and any remaining doubts.
  - Totals are at least ~380 phrases, ~280 vocab items and 10 dialogues (fill gaps if short); no sample content remains.
  - `npm run audio` re-run so changed texts get new mp3s and stale ones are pruned; `npm run content:check -- --strict-audio` → exit 0.
  - `npm run verify` → exit 0.
- Outcome:

## T10 — Offline PWA, install guide, full-journey test and deploy docs
- Status: pending
- Depends on: T07, T08, T09
- Goal: Make the app installable and fully usable offline on an iPhone, prove the whole journey works, and document how Hernán runs, updates and deploys it.
- Context: docs/brief.md (Platform, iPhone with Chrome). Static export from T01. All routes and audio exist by now.
- Scope: may touch `public/**` (manifest, icons, service worker), `src/app/layout.tsx`, `src/app/instalar/**` (or similar), `src/lib/pwa/**`, `scripts/**`, `tests/e2e/**`, README.md, CLAUDE.md, next config / must not touch `content/**`, feature logic of other sections.
- Done when:
  - Web app manifest (name, Sicilian theme colours, standalone) and icons generated at build time (including apple-touch-icon); iOS meta tags.
  - A service worker, generated at build from the export output, precaches every route, JS/CSS and all audio; new versions update cleanly (prompt to reload).
  - An in-app install guide for iPhone (Chrome and Safari: Share → Add to Home Screen) reachable from the profile, and a note that the microphone works best in Safari.
  - e2e: after a first visit, with the context offline, reload and navigate path → lesson → phrasebook → dialogue, and an mp3 request is served from the cache.
  - e2e: full journey on the iPhone project (placement → lesson → review → phrasebook → dialogue) passes.
  - README.md: run locally, test on the phone over LAN, regenerate audio, edit the persona file, deploy to Vercel (exact commands for Hernán to run), install on iPhone.
  - `npm run verify` → exit 0.
- Outcome:

## Decisions
- 2026-09-30 plan: T01 has no green baseline to check against (empty repo); the main-branch test check runs after T01 is integrated. (orchestrator)
- 2026-09-30 plan: content split into two parallel tasks with disjoint unit order ranges; units discovered by glob so they never share an index file. (orchestrator)

## Proposals (new scope)

## Log
