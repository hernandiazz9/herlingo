# Plan 001 — Italian trainer MVP for the Sicily trip

Status: active
Created: 2026-09-30
Base branch: main
Goal: Ship fast a personal, mobile-first, offline-capable Next.js PWA to learn spoken Italian for Hernán's trip to Sicily in under two weeks: lesson path with mixed exercises, spaced-repetition review, pocket phrasebook and dialogue simulator, with ~400 phrases, ~300 words and neural audio, all tailored to docs/brief.md. MVP speed over tests: no automated test suites; verification is lint + typecheck + content check + build.
Test command: npm run verify
Worktree setup: npm ci

## Tasks

## T01 — Project scaffold, Sicilian theme and mobile shell
- Status: running (attempt 1)
- Depends on: none
- Goal: Create the Next.js app every other task builds on: tooling, Sicilian design system, mobile app shell with bottom navigation and the `npm run verify` command.
- Context: docs/brief.md (all product decisions). The repo only has docs/ and plans/. Use the latest stable Next.js (App Router), TypeScript strict, Tailwind, ESLint, `output: 'export'` (static export, no server runtime). Layout: `src/app`, `src/components`, `src/lib`, `content/<lang>/`, `scripts/`. No test frameworks (no Vitest, no Playwright).
- Scope: may touch everything at the repo root except plans/ and docs/brief.md / must not touch plans/, docs/brief.md; no learning features or content beyond placeholders.
- Done when:
  - Routes exist as placeholders with Spain-Spanish copy: `/` (path), `/repaso`, `/frasario`, `/dialogos`, `/perfil`, reachable from a bottom tab bar that respects iPhone safe areas; on desktop the app is a centred mobile-width column.
  - Design tokens as CSS variables (lemon yellow, sea blue, terracotta, neutrals, success/error) and base components: big rounded primary/secondary Button, Card, ProgressBar, IconButton, with a light press animation.
  - `npm run verify` runs lint, typecheck, build → exit 0; `out/index.html` exists after it.
  - CLAUDE.md documents the commands, folder layout and conventions (UI copy in Spain Spanish with "tú", language-agnostic code, content under `content/<lang>/`, no automated tests in the MVP).
- Outcome:

## T02 — Content model, loader, validator and basic speech
- Status: pending
- Depends on: T01
- Goal: Define the typed, language-agnostic data contract for a language pack, the loader the UI uses, a validator, a small sample pack, and a minimal `speak()` audio interface so UI and content tasks can all start in parallel right after this one.
- Context: docs/brief.md (content types, registers, exercise types, volumes). CLAUDE.md from T01. Right after this task, five tasks start in parallel: T03 (mp3 audio behind the same interface), T04 (lesson player), T05/T06 (real content), T08 (phrasebook and dialogues). Keep the contract clear and stable.
- Scope: may touch `src/lib/content/**`, `src/lib/audio/**`, `content/**`, `scripts/**`, `docs/content-guide.md`, package.json scripts, CLAUDE.md / must not touch UI routes or components.
- Done when:
  - Schemas (zod, types inferred) for: pack meta (lang code, names, speech locale, default voices), unit (id, title, situation, order, lessons), lesson (id, title, item refs), phrase (id, target text, Spanish translation, optional literal translation and notes, register tu/Lei/neutral, tags, situation, optional voice), vocab item (id, word, article/gender, Spanish, optional example phrase ref), Q&A pair for "answer" exercises (question, accepted replies, distractors), dialogue (id, title, situation, turns: native line with voice, learner turn with options, correct and acceptable answers, feedback), grammar card, recognition-only expression (for Sicilian), placement question. Every playable item has a stable audio key derived from its id.
  - Unit and dialogue files are discovered by glob (e.g. `content/<lang>/units/*.json`, `content/<lang>/dialogues/*.json`, `content/<lang>/extras/*.json`) so parallel content tasks never edit a shared index. Unit `order` ranges documented: 10–19 survival, 20–29 getting around, 30–39 talking with Italians, 40–49 food, 90+ grammar and Sicilian.
  - `npm run content:check` validates every pack (schema, unique ids, references resolve, non-empty translations, non-empty lessons) and is added to `npm run verify` before the build.
  - A small sample pack in `content/it/` (one unit with 2 lessons, ~15 phrases, ~10 vocab, a few Q&A pairs, 1 dialogue) with "sample" in its file names so T05 can delete it.
  - `src/lib/audio` exposes a small interface (e.g. `speak(item | text, { slow })`, `stop()`) implemented with browser `speechSynthesis` using the pack's locale; T03 will add mp3 playback behind the same interface without changing callers.
  - `docs/content-guide.md` explains the schema, id conventions, file layout, order ranges and quality rules for content authors.
  - `npm run verify` → exit 0.
- Outcome:

## T03 — Neural mp3 audio pipeline
- Status: pending
- Depends on: T02
- Goal: Upgrade audio to natural neural voices: an idempotent edge-tts generation script, an audio manifest, and mp3 playback behind the existing `speak()` interface with speechSynthesis fallback and slow mode.
- Context: docs/brief.md (Audio, iPhone constraints), docs/content-guide.md, loader and `src/lib/audio` from T02. edge-tts is NOT installed on this machine: install it in a project-local Python venv (`.venv`, git-ignored) with a pinned `requirements.txt`. edge-tts needs internet at generation time only. Content is being written in parallel by T05/T06; generate audio for whatever exists now — T09 regenerates for the final content.
- Scope: may touch `scripts/audio/**`, `public/audio/**`, `src/lib/audio/**`, package.json scripts, `.gitignore`, CLAUDE.md / must not touch `content/**`, routes, components.
- Done when:
  - `npm run audio` generates an mp3 for every phrase, vocab item, Q&A line, dialogue line and recognition expression across all packs, named by a hash of text + voice, writes `public/audio/<lang>/manifest.json`, and prunes unreferenced files. Dialogue speakers use distinct voices. A second run generates 0 files.
  - `speak()` plays the mp3 via the manifest, falls back to `speechSynthesis` when missing or failing, stops the previous sound, supports slow rate, and unlocks audio on the first user gesture (iOS). Callers' API unchanged.
  - `npm run content:check -- --strict-audio` fails when an item has no mp3 (plain `content:check` does not check audio).
  - `npm run verify` → exit 0.
- Outcome:

## T04 — Lesson player and exercise engine
- Status: pending
- Depends on: T02
- Goal: The core learning loop: a lesson session that generates mixed exercises from a lesson's items, checks answers leniently, gives immediate feedback with audio, re-queues mistakes and ends with a result.
- Context: docs/brief.md (exercise types, iPhone mic limits), content loader and `speak()` from T02. Build against the sample pack; real content arrives in parallel (T05/T06), so never hard-code content ids. Progress persistence is T07: expose a typed `LessonResult` (per-item outcomes, XP earned, duration) via an `onComplete` callback and keep persistence out of this task. Put the answer normalizer and the speech-recognition helper in `src/lib/exercises` / `src/lib/speech` so T08 can reuse them.
- Scope: may touch `src/app/leccion/**`, `src/components/exercises/**`, `src/components/lesson/**`, `src/lib/exercises/**`, `src/lib/speech/**` / must not touch `content/**`, `src/lib/audio/**`, `src/lib/content/**`, other routes.
- Done when:
  - Route `/leccion/[id]` statically generated for every lesson; a session of ~10–12 exercises generated with a seeded, deterministic generator from the lesson items.
  - Exercise types: listen and pick the meaning; read Italian and pick the meaning; Spanish → Italian with word tiles (with distractors); fill the gap; dictation; answer the question (from Q&A pairs, audio question, pick the reply); match 5 pairs (vocab); say it aloud.
  - Answer checking ignores case, punctuation and apostrophe variants; missing accents are accepted with a "cuidado con el acento" note.
  - Say-it-aloud uses Web Speech recognition (it-IT) when available with a fuzzy similarity threshold; otherwise self-evaluation ("Me ha salido / No me ha salido"). A "No puedo hablar ahora" option disables speaking exercises for 15 minutes.
  - Feedback sheet (green/red) with the correct answer and a play button; wrong items re-queued at the end; progress bar; exit with confirmation; completion screen with XP.
  - `npm run verify` → exit 0.
- Outcome:

## T05 — Content: getting around Sicily and talking with Italians
- Status: pending
- Depends on: T02
- Goal: Write the two highest-priority content areas with natural, current spoken Italian: getting around by train, bus, taxi and on foot in Sicily, and talking with Italians. Delete the sample pack content from T02.
- Context: docs/brief.md (priorities 1 and 2, registers, persona), docs/content-guide.md (schema, order ranges 20–29 and 30–39). Translations in Spain Spanish with "tú". Real Sicilian context: Palermo Centrale, Catania Centrale, Siracusa, Agrigento, Cefalù, Taormina; Trenitalia regionale, AST/SAIS/Interbus, Prestia e Comandè, Alibus; "convalidare", "binario", "ritardo", "sciopero", "fermata", "capolinea". Include what Italians SAY to him (ticket inspector, driver, station staff, people asking where he's from) so he learns to understand and answer. Audio is generated later (T03/T09): do not generate mp3s here.
- Scope: may touch `content/it/**` (own unit files in order ranges 20–39, own dialogue files, deleting the sample files) / must not touch `src/**`, `public/**`, other units' files.
- Done when:
  - About 220 phrases, 160 vocab items, 8 dialogues, and Q&A pairs for every lesson, in 4–5 units of 4–5 lessons each.
  - The "about me" persona phrases live in one clearly marked unit file with a generic Spanish traveller persona, easy to edit.
  - Every phrase has register and a Spain-Spanish translation; dialogues include realistic misunderstandings ("Può ripetere?").
  - Sample pack files from T02 are deleted.
  - `npm run verify` → exit 0.
- Outcome:

## T06 — Content: survival, food, grammar cards and Sicilian expressions
- Status: pending
- Depends on: T02
- Goal: Write the remaining content: survival basics, basic food, minimal grammar cards and recognition-only Sicilian expressions.
- Context: docs/brief.md (priorities 3–6), docs/content-guide.md (order ranges 10–19, 40–49, 90+). The learner already knows greetings and numbers at A1: go quickly past them and focus on what he will hear and need (not understanding, asking to repeat, prices, time, emergencies, pharmacy). Food: bar (caffè, cornetto, granita e brioche, arancini/arancine) and restaurant (table, ordering, allergies, bill, "coperto"). Grammar cards: tu vs Lei, "vorrei", present of essere, avere, volere, potere, andare. Sicilian: ~25 common words/expressions to recognise, with standard Italian equivalent. Audio is generated later (T03/T09): do not generate mp3s here.
- Scope: may touch `content/it/**` (own unit files in order ranges 10–19, 40–49, 90+, own dialogue and extras files) / must not touch `src/**`, `public/**`, other units' files, the sample files (T05 deletes them).
- Done when:
  - About 180 phrases, 140 vocab items, 4 dialogues, Q&A pairs for every lesson, grammar cards and ~25 Sicilian expressions, in 4–5 units.
  - Every phrase has register and a Spain-Spanish translation.
  - `npm run verify` → exit 0.
- Outcome:

## T08 — Pocket phrasebook and dialogue simulator
- Status: pending
- Depends on: T02
- Goal: The two trip-time tools: a fast phrasebook to find and play phrases on the spot, and a dialogue simulator to practise understanding and answering real conversations.
- Context: docs/brief.md (Phrasebook, Dialogues). Loader and `speak()` from T02. T04 runs in parallel and owns `src/lib/exercises` and `src/lib/speech`: do not edit them; if you need answer normalisation or speech recognition before T04 lands, keep a small local helper inside your own folders. Never hard-code content ids.
- Scope: may touch `src/app/frasario/**`, `src/app/dialogos/**`, `src/components/phrasebook/**`, `src/components/dialogue/**`, `src/lib/favorites/**` / must not touch `content/**`, `src/lib/exercises/**`, `src/lib/speech/**`, `src/lib/audio/**`, `src/lib/content/**`, other routes.
- Done when:
  - Phrasebook: phrases grouped by situation, accent-insensitive search in Italian or Spanish, favourites stored locally, tap to play, slow-play button, and a full-screen "Mostrar" mode with big text to show an Italian.
  - Dialogues: list by situation; the simulator plays each native line (after a user gesture), text hidden by default with a "Ver texto" toggle and replay; the learner picks or says the answer; feedback per turn; final transcript with translations and play buttons.
  - `npm run verify` → exit 0.
- Outcome:

## T07 — Path, progress, spaced repetition, placement test and profile
- Status: pending
- Depends on: T04, T05, T06
- Goal: Turn lessons into a course: the home path of units, persistent progress with streak and XP, spaced-repetition review, the first-launch placement test and the profile/settings screen.
- Context: docs/brief.md (sections, gamification, placement). Lesson player and `LessonResult` from T04; real content from T05/T06 (loaded by glob, never hard-coded). Storage is localStorage with a versioned schema and safe parsing.
- Scope: may touch `src/app/page.tsx` (path), `src/app/repaso/**`, `src/app/perfil/**`, an onboarding route, `src/lib/progress/**`, `src/lib/srs/**`, `src/components/path/**`, `content/it/placement*` (placement questions); may wire `onComplete` in the lesson route / must not change exercise logic in `src/lib/exercises/**` except exporting what it needs.
- Done when:
  - Home path: units in `order`, lesson nodes locked / available / done, current node highlighted, unit progress, grammar cards and Sicilian expressions reachable as side content.
  - Progress store: lessons done, XP, daily streak (local time zone, survives reload), per-item SRS state; tolerant of empty or corrupt stored values.
  - SRS: items answered wrong or due are scheduled (Leitner or SM-2-lite); `/repaso` runs a session through the T04 player with due items, with an empty state when nothing is due.
  - Placement: first launch shows a short welcome and a ~12-question, ~3-minute placement test across units; mastered lessons are marked done; retakeable from the profile.
  - Profile: XP, streak, words learned, settings (slow audio default, speaking exercises on/off, reset progress with confirmation, retake placement).
  - `npm run verify` → exit 0.
- Outcome:

## T09 — Italian content quality review and final audio
- Status: pending
- Depends on: T03, T05, T06
- Goal: A native-level review of all Italian content so Hernán learns correct, natural, current spoken Italian, then generate the final audio for everything.
- Context: docs/brief.md, docs/content-guide.md, everything under `content/it/`. Review as a native Italian teacher who knows Sicily: grammar, articles and gender, naturalness, register (Lei vs tu) consistency, realistic dialogues, correct Sicilian place and transport names, Spain-Spanish translations with "tú". Audio pipeline from T03.
- Scope: may touch `content/it/**` (except placement files), `public/audio/it/**`, `docs/content-review.md` / must not touch `src/**`, schemas.
- Done when:
  - Every error found is fixed in place; `docs/content-review.md` lists the categories of fixes with counts and any remaining doubts.
  - Totals are at least ~380 phrases, ~280 vocab items and 10 dialogues (fill gaps if short); no sample content remains.
  - `npm run audio` run, mp3s committed; `npm run content:check -- --strict-audio` → exit 0.
  - `npm run verify` → exit 0.
- Outcome:

## T10 — Offline PWA, install guide and deploy docs
- Status: pending
- Depends on: T07, T08, T09
- Goal: Make the app installable and fully usable offline on an iPhone, and document how Hernán runs, updates and deploys it.
- Context: docs/brief.md (Platform, iPhone with Chrome). Static export from T01. All routes and audio exist by now.
- Scope: may touch `public/**` (manifest, icons, service worker; not audio files), `src/app/layout.tsx`, an install-guide route, `src/lib/pwa/**`, `scripts/**`, README.md, CLAUDE.md, next config / must not touch `content/**`, feature logic of other sections.
- Done when:
  - Web app manifest (name, Sicilian theme colours, standalone) and icons (including apple-touch-icon); iOS meta tags.
  - A service worker, generated at build from the export output, precaches every route, JS/CSS and all audio; new versions update cleanly (prompt to reload).
  - In-app install guide for iPhone (Chrome and Safari: Share → Add to Home Screen) reachable from the profile, noting the microphone works best in Safari.
  - README.md: run locally, open on the phone over LAN, regenerate audio, edit the persona file, deploy to Vercel (exact commands for Hernán to run), install on iPhone.
  - `npm run verify` → exit 0, and a manual check: serve `out/`, load once, then offline reload still shows the app (describe how you checked).
- Outcome:

## Decisions
- 2026-09-30 plan: T01 has no green baseline to check against (empty repo); the main-branch check runs after T01 is integrated. (orchestrator)
- 2026-09-30 plan: content split into two parallel tasks with disjoint unit order ranges; units discovered by glob so they never share an index file. (orchestrator)
- 2026-09-30 plan: no automated tests (Vitest/Playwright dropped); verify = lint + typecheck + content check + build. (Hernán)
- 2026-09-30 plan: up to 5 agents in parallel; T02 ships a speechSynthesis `speak()` so T03/T04/T05/T06/T08 all start right after T02; content tasks don't generate audio, T09 does. (Hernán + orchestrator)

## Proposals (new scope)

## Log
- 2026-09-30 17:20 T01 launched · attempt 1 · agent ad7263c44e095d704
- 2026-09-30 17:30 plan revised: tests dropped, parallelism raised to 5 (T01 notified via SendMessage)
