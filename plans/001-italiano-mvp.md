# Plan 001 — Italian trainer MVP for the Sicily trip

Status: active
Created: 2026-09-30
Base branch: main
Goal: Ship fast a personal, mobile-first, offline-capable Next.js PWA to learn spoken Italian for Hernán's trip to Sicily in under two weeks: lesson path with mixed exercises, spaced-repetition review, pocket phrasebook and dialogue simulator, with ~400 phrases, ~300 words and neural audio, all tailored to docs/brief.md. MVP speed over tests: no automated test suites; verification is lint + typecheck + content check + build.
Test command: npm run verify
Worktree setup: npm ci

## Tasks

## T01 — Project scaffold, Sicilian theme and mobile shell
- Status: done
- Depends on: none
- Goal: Create the Next.js app every other task builds on: tooling, Sicilian design system, mobile app shell with bottom navigation and the `npm run verify` command.
- Context: docs/brief.md (all product decisions). The repo only has docs/ and plans/. Use the latest stable Next.js (App Router), TypeScript strict, Tailwind, ESLint, `output: 'export'` (static export, no server runtime). Layout: `src/app`, `src/components`, `src/lib`, `content/<lang>/`, `scripts/`. No test frameworks (no Vitest, no Playwright).
- Scope: may touch everything at the repo root except plans/ and docs/brief.md / must not touch plans/, docs/brief.md; no learning features or content beyond placeholders.
- Done when:
  - Routes exist as placeholders with Spain-Spanish copy: `/` (path), `/repaso`, `/frasario`, `/dialogos`, `/perfil`, reachable from a bottom tab bar that respects iPhone safe areas; on desktop the app is a centred mobile-width column.
  - Design tokens as CSS variables (lemon yellow, sea blue, terracotta, neutrals, success/error) and base components: big rounded primary/secondary Button, Card, ProgressBar, IconButton, with a light press animation.
  - `npm run verify` runs lint, typecheck, build → exit 0; `out/index.html` exists after it.
  - CLAUDE.md documents the commands, folder layout and conventions (UI copy in Spain Spanish with "tú", language-agnostic code, content under `content/<lang>/`, no automated tests in the MVP).
- Outcome: Next.js 16 + Tailwind 4 static export, Sicilian tokens, 5-tab shell, verify = lint+typecheck+build · 419e2cf

## T02 — Content model, loader, validator and basic speech
- Status: done
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
- Outcome: zod schemas, glob-discovered packs bundled to src/lib/content/generated (git-ignored), content:check in verify, sample pack, speechSynthesis speak() · ddf0eb8

## T03 — Neural mp3 audio pipeline
- Status: done
- Depends on: T02
- Goal: Upgrade audio to natural neural voices: an idempotent edge-tts generation script, an audio manifest, and mp3 playback behind the existing `speak()` interface with speechSynthesis fallback and slow mode.
- Context: docs/brief.md (Audio, iPhone constraints), docs/content-guide.md, loader and `src/lib/audio` from T02. edge-tts is NOT installed on this machine: install it in a project-local Python venv (`.venv`, git-ignored) with a pinned `requirements.txt`. edge-tts needs internet at generation time only. Content is being written in parallel by T05/T06; generate audio for whatever exists now — T09 regenerates for the final content.
- Scope: may touch `scripts/audio/**`, `public/audio/**`, `src/lib/audio/**`, package.json scripts, `.gitignore`, CLAUDE.md / must not touch `content/**`, routes, components.
- Done when:
  - `npm run audio` generates an mp3 for every phrase, vocab item, Q&A line, dialogue line and recognition expression across all packs, named by a hash of text + voice, writes `public/audio/<lang>/manifest.json`, and prunes unreferenced files. Dialogue speakers use distinct voices. A second run generates 0 files.
  - `speak()` plays the mp3 via the manifest, falls back to `speechSynthesis` when missing or failing, stops the previous sound, supports slow rate, and unlocks audio on the first user gesture (iOS). Callers' API unchanged.
  - `npm run content:check -- --strict-audio` fails when an item has no mp3 (plain `content:check` does not check audio).
  - `npm run verify` → exit 0.
- Outcome: edge-tts venv pipeline (`npm run audio`, hashed mp3s + manifest, prune), speak() mp3→TTS fallback, --strict-audio · e2ceb65

## T04 — Lesson player and exercise engine
- Status: done
- Depends on: T02
- Goal: The core learning loop: a lesson session that generates mixed exercises from a lesson's items, checks answers leniently, gives immediate feedback with audio, re-queues mistakes and ends with a result.
- Context: Use design tokens only, never hard-coded colours (light and dark themes, T11). docs/brief.md (exercise types, iPhone mic limits), content loader and `speak()` from T02. Build against the sample pack; real content arrives in parallel (T05/T06), so never hard-code content ids. Progress persistence is T07: expose a typed `LessonResult` (per-item outcomes, XP earned, duration) via an `onComplete` callback and keep persistence out of this task. Put the answer normalizer and the speech-recognition helper in `src/lib/exercises` / `src/lib/speech` so T08 can reuse them.
- Scope: may touch `src/app/leccion/**`, `src/components/exercises/**`, `src/components/lesson/**`, `src/lib/exercises/**`, `src/lib/speech/**` / must not touch `content/**`, `src/lib/audio/**`, `src/lib/content/**`, other routes.
- Done when:
  - Route `/leccion/[id]` statically generated for every lesson; a session of ~10–12 exercises generated with a seeded, deterministic generator from the lesson items.
  - Exercise types: listen and pick the meaning; read Italian and pick the meaning; Spanish → Italian with word tiles (with distractors); fill the gap; dictation; answer the question (from Q&A pairs, audio question, pick the reply); match 5 pairs (vocab); say it aloud.
  - Answer checking ignores case, punctuation and apostrophe variants; missing accents are accepted with a "cuidado con el acento" note.
  - Say-it-aloud uses Web Speech recognition (it-IT) when available with a fuzzy similarity threshold; otherwise self-evaluation ("Me ha salido / No me ha salido"). A "No puedo hablar ahora" option disables speaking exercises for 15 minutes.
  - Feedback sheet (green/red) with the correct answer and a play button; wrong items re-queued at the end; progress bar; exit with confirmation; completion screen with XP.
  - `npm run verify` → exit 0.
- Outcome: /leccion/[id] full-screen player, 8 exercise types, lenient check, speech + self-eval fallback, XP completion · b67778b

## T05 — Content: getting around Sicily and talking with Italians
- Status: done
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
- Outcome: 5 units / 22 lessons, 260 phrases, 177 vocab, 51 Q&A, 9 dialogues; persona in units/32-persona-sobre-mi.json; sample deleted · f7b3157

## T06 — Content: survival, food, grammar cards and Sicilian expressions
- Status: done
- Depends on: T02
- Goal: Write the remaining content: survival basics, basic food, minimal grammar cards and recognition-only Sicilian expressions.
- Context: docs/brief.md (priorities 3–6), docs/content-guide.md (order ranges 10–19, 40–49, 90+). The learner already knows greetings and numbers at A1: go quickly past them and focus on what he will hear and need (not understanding, asking to repeat, prices, time, emergencies, pharmacy). Food: bar (caffè, cornetto, granita e brioche, arancini/arancine) and restaurant (table, ordering, allergies, bill, "coperto"). Grammar cards: tu vs Lei, "vorrei", present of essere, avere, volere, potere, andare. Sicilian: ~25 common words/expressions to recognise, with standard Italian equivalent. Audio is generated later (T03/T09): do not generate mp3s here.
- Scope: may touch `content/it/**` (own unit files in order ranges 10–19, 40–49, 90+, own dialogue and extras files) / must not touch `src/**`, `public/**`, other units' files, the sample files (T05 deletes them).
- Done when:
  - About 180 phrases, 140 vocab items, 4 dialogues, Q&A pairs for every lesson, grammar cards and ~25 Sicilian expressions, in 4–5 units.
  - Every phrase has register and a Spain-Spanish translation.
  - `npm run verify` → exit 0.
- Outcome: units surv/emer/food/gram/sic, 31 lessons, 215 phrases, 155 vocab, 36 Q&A, 4 dialogues, 7 grammar cards, 28 Sicilian expressions · ef7b48d

## T08 — Pocket phrasebook and dialogue simulator
- Status: done
- Depends on: T02
- Goal: The two trip-time tools: a fast phrasebook to find and play phrases on the spot, and a dialogue simulator to practise understanding and answering real conversations.
- Context: Use design tokens only, never hard-coded colours (light and dark themes, T11). docs/brief.md (Phrasebook, Dialogues). Loader and `speak()` from T02. T04 runs in parallel and owns `src/lib/exercises` and `src/lib/speech`: do not edit them; if you need answer normalisation or speech recognition before T04 lands, keep a small local helper inside your own folders. Never hard-code content ids.
- Scope: may touch `src/app/frasario/**`, `src/app/dialogos/**`, `src/components/phrasebook/**`, `src/components/dialogue/**`, `src/lib/favorites/**` / must not touch `content/**`, `src/lib/exercises/**`, `src/lib/speech/**`, `src/lib/audio/**`, `src/lib/content/**`, other routes.
- Done when:
  - Phrasebook: phrases grouped by situation, accent-insensitive search in Italian or Spanish, favourites stored locally, tap to play, slow-play button, and a full-screen "Mostrar" mode with big text to show an Italian.
  - Dialogues: list by situation; the simulator plays each native line (after a user gesture), text hidden by default with a "Ver texto" toggle and replay; the learner picks or says the answer; feedback per turn; final transcript with translations and play buttons.
  - `npm run verify` → exit 0.
- Outcome: /frasario (search, favourites, Mostrar) and /dialogos/[id] simulator (hidden text, pick/say answer, transcript) · 541ce3d

## T07 — Path, progress, spaced repetition, placement test and profile
- Status: done
- Depends on: T04, T05, T06, T11
- Goal: Turn lessons into a course: the home path of units, persistent progress with streak and XP, spaced-repetition review, the first-launch placement test and the profile/settings screen.
- Context: Use design tokens only, never hard-coded colours (light and dark themes, T11). docs/brief.md (sections, gamification, placement). Lesson player and `LessonResult` from T04; real content from T05/T06 (loaded by glob, never hard-coded). The lesson page does not pass `onComplete` yet: add a small client wrapper in `src/app/leccion/[id]/page.tsx` to persist `LessonResult`; nothing links to `/leccion/<id>/` yet. Lessons can hold up to ~29 items while a session samples 10–12 exercises: a lesson counts as done after one completion, and the SRS should cover the items not yet practised. Storage is localStorage with a versioned schema and safe parsing. Keep the `ThemeToggle` from T11 in the profile settings.
- Scope: may touch `src/app/page.tsx` (path), `src/app/repaso/**`, `src/app/perfil/**`, an onboarding route, `src/lib/progress/**`, `src/lib/srs/**`, `src/components/path/**`, `content/it/extras/placement.json` (placement questions; T09 runs in parallel and never renames ids); may wire `onComplete` in the lesson route / must not change exercise logic in `src/lib/exercises/**` except exporting what it needs.
- Done when:
  - Home path: units in `order`, lesson nodes locked / available / done, current node highlighted, unit progress, grammar cards and Sicilian expressions reachable as side content.
  - Progress store: lessons done, XP, daily streak (local time zone, survives reload), per-item SRS state; tolerant of empty or corrupt stored values.
  - SRS: items answered wrong or due are scheduled (Leitner or SM-2-lite); `/repaso` runs a session through the T04 player with due items, with an empty state when nothing is due.
  - Placement: first launch shows a short welcome and a ~12-question, ~3-minute placement test across units; mastered lessons are marked done; retakeable from the profile.
  - Profile: XP, streak, words learned, settings (slow audio default, speaking exercises on/off, reset progress with confirmation, retake placement).
  - `npm run verify` → exit 0.
- Outcome: path with side content, progress/streak/XP store, Leitner SRS /repaso, /bienvenida placement (12 q), profile settings · 9516e54

## T09 — Italian content quality review and final audio
- Status: done
- Depends on: T03, T05, T06
- Goal: A native-level review of all Italian content so Hernán learns correct, natural, current spoken Italian, then generate the final audio for everything.
- Context: docs/brief.md, docs/content-guide.md, everything under `content/it/`. Never rename or delete existing ids (T07 references them in parallel): fix texts in place, add new items with new ids. Review as a native Italian teacher who knows Sicily: grammar, articles and gender, naturalness, register (Lei vs tu) consistency, realistic dialogues, correct Sicilian place and transport names, Spain-Spanish translations with "tú". Also double-check the less common Sicilian items (`sic.sabbinidica`, `sic.babbiare`) and how the TTS reads "112" (T06). Recheck facts flagged by T05: prices (Cefalù train €6.10, airport bus €7) and "validators on the platform". Update docs/content-guide.md's "6–12 items per lesson" rule to match reality (T05 lessons hold 12–29 items). Audio pipeline from T03 (`npm run audio` creates .venv itself; hashed file names + `public/audio/<lang>/manifest.json`). Also fix `docs/content-guide.md` "Audio keys" section and the `Playable` comment in `src/lib/content/types.ts`, which still say mp3s are `<audioKey>.mp3`.
- Scope: may touch `content/it/**` (except `content/it/extras/placement.json`, which T07 writes in parallel), `public/audio/it/**`, `docs/content-review.md`, `docs/content-guide.md`, the `Playable` comment in `src/lib/content/types.ts` / must not touch `src/**`, schemas.
- Done when:
  - Every error found is fixed in place; `docs/content-review.md` lists the categories of fixes with counts and any remaining doubts.
  - Totals are at least ~380 phrases, ~280 vocab items and 10 dialogues (fill gaps if short); no sample content remains.
  - `npm run audio` run, mp3s committed; `npm run content:check -- --strict-audio` → exit 0.
  - `npm run verify` → exit 0.
- Outcome: 34 fixes (docs/content-review.md), 475 phrases / 332 vocab / 13 dialogues, 1443 mp3s generated, strict-audio passes · 384e072

## T10 — Offline PWA, install guide and deploy docs
- Status: running (attempt 1)
- Depends on: T07, T08, T09
- Goal: Make the app installable and fully usable offline on an iPhone, and document how Hernán runs, updates and deploys it.
- Context: Use design tokens only, never hard-coded colours (light and dark themes, T11). docs/brief.md (Platform, iPhone with Chrome). Static export from T01. All routes and audio exist by now. Audio: `public/audio/<lang>/manifest.json` (loaded at runtime by src/lib/audio) plus hashed mp3s (~1000 files, ~14 MB): precache both.
- Scope: may touch `public/**` (manifest, icons, service worker; audio only by re-running `npm run audio`), `src/app/layout.tsx`, an install-guide route, `src/lib/pwa/**`, `scripts/**`, README.md, CLAUDE.md, next config / must not touch `content/**`, feature logic of other sections.
- Done when:
  - Web app manifest (name, Sicilian theme colours, standalone) and icons (including apple-touch-icon); iOS meta tags.
  - A service worker, generated at build from the export output, precaches every route, JS/CSS and all audio; new versions update cleanly (prompt to reload).
  - In-app install guide for iPhone (Chrome and Safari: Share → Add to Home Screen) reachable from the profile, noting the microphone works best in Safari.
  - README.md: run locally, open on the phone over LAN, regenerate audio, edit the persona file, deploy to Vercel (exact commands for Hernán to run), install on iPhone.
  - `npm run audio` re-run (covers placement questions added by T07) and `npm run content:check -- --strict-audio` → exit 0.
  - `npm run verify` → exit 0, and a manual check: serve `out/`, load once, then offline reload still shows the app (describe how you checked).
- Outcome:

## T11 — Dark mode
- Status: done
- Depends on: T01
- Goal: Add a dark theme to the Sicilian design system: follows the system setting by default, with a System / Light / Dark choice stored on the device.
- Context: docs/brief.md (Visual style). Design tokens are CSS variables in `src/app/globals.css` (T01). T02 runs in parallel (content/lib only). Later UI tasks (T04, T07, T08, T10) will be told to use tokens only, never hard-coded colours.
- Scope: may touch `src/app/globals.css`, `src/app/layout.tsx`, `src/components/**` existing base components and shell, `src/lib/theme/**`, `src/app/perfil/page.tsx` (only to place the toggle), CLAUDE.md / must not touch `content/**`, `src/lib/content/**`, `src/lib/audio/**`, other routes.
- Done when:
  - Dark values for every token (lemon, sea, terracotta adjusted for contrast on dark, neutrals, success/error, surfaces, text) under `prefers-color-scheme: dark` and under an explicit `data-theme` attribute on `<html>`.
  - An inline script in the layout applies the stored choice before paint (no flash); `ThemeToggle` component (Sistema / Claro / Oscuro) stored in localStorage, placed on the `/perfil` placeholder; `theme-color` meta follows the theme.
  - Base components and the shell (tab bar, ribbon) use tokens only and look right in both themes.
  - CLAUDE.md states: UI code uses tokens only, never hard-coded colours, so both themes work.
  - `npm run verify` → exit 0.
- Outcome: dark tokens (system + data-theme), no-flash script, ThemeToggle on /perfil · 64a4bbd

## T12 — Remove duplicate phrases from phrasebook and review, small copy fixes
- Status: running (attempt 1)
- Depends on: T07, T09
- Goal: 35 Italian texts exist under two ids (e.g. "Sei di qui?", "il bagno"), so the phrasebook and review show them twice; fix it at display/queue time without deleting ids. Also fix two small leftovers.
- Context: T09 found the duplicates (docs/content-review.md); ids must not be deleted because lessons, placement and SRS reference them. Phrasebook code in src/components/phrasebook/** and src/app/frasario/**; SRS/review in src/lib/srs/** and src/app/repaso/**. The lesson intro says "Unos 5 minutos…" also for review sessions. T10 runs in parallel (PWA, layout, public/): stay out of its files.
- Scope: may touch `src/components/phrasebook/**`, `src/app/frasario/**`, `src/lib/srs/**`, `src/app/repaso/**`, `src/components/lesson/**` (intro copy only) / must not touch `content/**`, `public/**`, `src/app/layout.tsx`, PWA files.
- Done when:
  - Phrasebook lists each Italian text once (dedupe by normalised Italian text, keep the first by unit order; favourites keyed on the kept id still work).
  - A review session never asks the same Italian text twice (dedupe the queue by normalised text).
  - Review sessions show review-appropriate intro copy, not "Unos 5 minutos…".
  - `npm run verify` → exit 0.
- Outcome:

## Decisions
- 2026-09-30 plan: T01 has no green baseline to check against (empty repo); the main-branch check runs after T01 is integrated. (orchestrator)
- 2026-09-30 plan: content split into two parallel tasks with disjoint unit order ranges; units discovered by glob so they never share an index file. (orchestrator)
- 2026-09-30 plan: no automated tests (Vitest/Playwright dropped); verify = lint + typecheck + content check + build. (Hernán)
- 2026-09-30 plan: up to 5 agents in parallel; T02 ships a speechSynthesis `speak()` so T03/T04/T05/T06/T08 all start right after T02; content tasks don't generate audio, T09 does. (Hernán + orchestrator)

- 2026-09-30 T01: Next.js 16.3.7, React 19.2.8, Tailwind 4, ESLint 9; trailingSlash export; lint/tsconfig/Tailwind ignore .claude/** (nested worktrees); tab labels Ruta/Repaso/Frases/Diálogos/Perfil; placeholder app name "Lang Lern" in src/lib/app-config.ts; light theme only; system font. (agent)
- 2026-09-30 orchestrator: integration runs `npm ci && npm run verify` so dependency changes are picked up in main. (orchestrator)
- 2026-09-30 T11: new tokens -ledge, --on-accent/--on-lemon, --shadow; dark uses lighter accents with dark text on filled buttons; theme stored as localStorage `lang-lern:theme` ("Sistema" clears it); ThemeToggle in src/components/shell/. (agent)
- 2026-09-30 T02: content bundled by `scripts/content.ts build` into git-ignored src/lib/content/generated/packs.json (rebuilt before dev/typecheck/build); added zod + tsx; one id namespace per pack, ids never contain `--`, audio key = id (+ `--part`); 16 situations predefined in content/it/pack.json; unit order unique, 0–9 = sample; sample files units/sample-unit.json, dialogues/sample-bar.json, extras/sample-extras.json; audio API speak(item|text,{slow,lang}), stop(), canSpeak(), SLOW_RATE 0.7, listPlayables(). (agent)
- 2026-09-30 T03: mp3 name = first 16 hex of sha1(voice+text), flat manifest {audioKey: file}; learner options in dialogues use first pack voice not used by native turns; audio plan walks the Pack directly; `.venv` auto-created (Python 3.9.6, edge-tts 7.2.8), 6 parallel jobs, 4 retries; manifest loaded at runtime, TTS until loaded. (agent)
- 2026-09-30 T08: phrasebook shows phrases only (no vocab/expressions); tap row = play + actions; favourites in localStorage `lang-lern:favorites:<lang>`; Ver texto per bubble; score counts first attempts; voice answer matched to closest option (word overlap ≥0.6); local helpers fold() in components/phrasebook/search.ts and recognition in components/dialogue/recognition.ts. (agent)
- 2026-09-30 T05: id prefixes move-treno, move-bus, move-strada, talk-chiacchiere, talk-io, dlg.move-*/dlg.talk-* (orders 20, 22, 24, 30, 32); every item placed in a lesson (12–29 items per lesson, relies on the player sampling 10–12 exercises); persona = Hernán, Spanish from Madrid, programmer, travelling alone ~10 days Palermo→Cefalù→Agrigento→Catania→Siracusa (Madrid/job are guesses, Hernán to check); phrases Italians say tagged `te-dicen` with Diego/Isabella voices. (agent)
- 2026-09-30 T04: order = recognition first, one match, then shuffled production; grammar cards = ungraded "Un apunte" steps; seed = Date.now() (prop overrides); wrong exercise re-queued max 2×; fill-gap uses chips; XP = 10 + 1 per first-try correct + 5 if perfect; lesson is a full-screen overlay; speaking pause in localStorage; helpers checkAnswer/similarity in src/lib/exercises, listenOnce/scoreSpeech in src/lib/speech. (agent)
- 2026-09-30 T06: units surv (10), emer (14), food (40, single unit with 10 lessons), gram (90), sic (95); grammar in extras/gramatica.json, expressions in extras/siciliano.json; ~20% over target volume kept; "voi" questions marked neutral; Palermo arancina / Catania arancino. (agent)
- 2026-09-30 T07: units order ≥90 are side content ("Para saber más"), always open; first lesson of every main unit open, lessons within a unit unlock in order; Leitner 1/2/4/7/14 days, mistake → box 1; unpractised lesson items enter as new; keys `lang-lern:progress:<lang>` v1 and `lang-lern:settings`; placement masters a lesson only if all its questions are right, retake never touches played lessons, no XP; small additive edits to LessonPlayer props and speak() slow setting. (agent)
- 2026-09-30 T09: airport bus 6.50 € on board, Cefalù return 14.20 €, validators "in stazione"; vocab plural = bare word; "Possiamo darci del tu?" neutral; 112/101 read as numbers; content-guide lesson size 8–30 items. (agent)
- 2026-09-30 orchestrator: added T12 (dedupe duplicate texts in phrasebook/review + review intro copy), a fix for duplicates found by T09. (orchestrator)

## Proposals (new scope)
- 2026-09-30 T07: speaking-pause key uses `lang_lern:` prefix instead of `lang-lern:`.
- 2026-09-30 T09: seasonal doubts for mid-October (oranges just starting, mulberry granita may be off menu).
- 2026-09-30 T04: move snail/mic icons into src/components/icons.tsx.
- 2026-09-30 T08: after T04, move fold() and recognition helpers into src/lib/exercises / src/lib/speech (dedupe).
- 2026-09-30 T01: real app name (Hernán to decide).
- 2026-09-30 T11: light --lemon-deep (#d9b10f) is hard to read as text on --lemon-soft; adjust light palette.
- 2026-09-30 T11: dark mode added to the plan, follows system + manual toggle in profile. (Hernán)

## Log
- 2026-09-30 17:20 T01 launched · attempt 1 · agent ad7263c44e095d704
- 2026-09-30 17:30 plan revised: tests dropped, parallelism raised to 5 (T01 notified via SendMessage)
- 2026-09-30 17:27 T01 integration tests_failed (ESLint scanned nested .claude/worktrees) · reverted 3f7df65 · fix sent to same agent
- 2026-09-30 17:28 T01 done · branch worktree-agent-ad7263c44e095d704 → 419e2cf
- 2026-09-30 17:29 T02 launched · attempt 1 · agent aaa442c049f27e641
- 2026-09-30 17:32 T11 launched · attempt 1 · agent a3be29bf937ae5eef
- 2026-09-30 17:36 T11 done · branch worktree-agent-a3be29bf937ae5eef → 64a4bbd
- 2026-09-30 17:38 T02 done (after CLAUDE.md conflict fix) · branch worktree-agent-aaa442c049f27e641 → ddf0eb8
- 2026-09-30 17:40 T03 launched · attempt 1 · agent aca7f0cc882e0c93c
- 2026-09-30 17:40 T04 launched · attempt 1 · agent a0a9ff17219f94c6d
- 2026-09-30 17:40 T05 launched · attempt 1 · agent aded81b07fd5834ff
- 2026-09-30 17:40 T06 launched · attempt 1 · agent ad1ff0cf0c0fcc3fb
- 2026-09-30 17:40 T08 launched · attempt 1 · agent a321e18356bfddd85
- 2026-09-30 17:44 T03 done · branch worktree-agent-aca7f0cc882e0c93c → e2ceb65
- 2026-09-30 17:46 T08 done · branch worktree-agent-a321e18356bfddd85 → 541ce3d
- 2026-09-30 17:55 T05 done · branch worktree-agent-aded81b07fd5834ff → f7b3157
- 2026-09-30 17:56 T04 done · branch worktree-agent-a0a9ff17219f94c6d → b67778b
- 2026-09-30 17:59 T06 done · branch worktree-agent-ad1ff0cf0c0fcc3fb → ef7b48d
- 2026-09-30 18:01 T07 launched · attempt 1 · agent a0c24a87e45145f6e
- 2026-09-30 18:01 T09 launched · attempt 1 · agent ae8eb6b9ed05bf4c9
- 2026-09-30 18:12 T07 done · branch worktree-agent-a0c24a87e45145f6e → 9516e54
- 2026-09-30 18:12 T09 done · branch worktree-agent-ae8eb6b9ed05bf4c9 → 384e072
