# Plan 009 — Ruso: Russian A1 pack with Cyrillic, stress marks and romanization

Status: active
Created: 2026-10-07
Base branch: plan-009-ruso
Goal: Add Russian (`ru`) as the fourth pack, a levelled pack with one level (A1) for a total beginner travelling and living day to day. Russian is the first pack in a non-Latin script, so this plan first makes the code generic for it: a `vy` register (badge "Trato de usted/tú"), a pack `stress` rule (marks checked by `content:check`, ignored when matching, stripped before TTS), a pack `romanization` table that shows a Latin line under target text (switch on Perfil, per language, on by default) and lets typed answers be written in Latin, and `ё`/`е` folding. Then the full French-sized A1 course (alphabet unit + 10 units + grammar, ~420 phrases, ~320 vocab, ~80 Q&A, 12 dialogues, 12 stories, 8 placement questions), ru-RU neural audio and pictures on the Mac. Italian, French and English content and every on-device key stay untouched. MVP speed: no automated tests; verification is `npm run verify`.
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-07 22:24Z 💻
- Writer: me (💻 desktop)
- Branch: plan-009-ruso @ cfe71d6 (from main)
- Next step: T112 + T114 running; then T115–T119, T125
- Needs Hernán: -

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, docs/brief.md (app-wide decisions, do not edit), **docs/brief-ru.md** (Russian pack note, Hernán 2026-10-07: script, stress, romanization, units, ids, register, cast, voices), docs/content-guide.md, docs/brief-en.md (levelled pack model). `content/en/` (levels) and `content/fr/` are the closest models of a finished pack. UI copy is Spain Spanish with "tú", accessible names too.
- **Content only, generic code.** Code changes are allowed only where a non-Latin pack needs them, and must be generic: nothing in `src/`, `api/` or `scripts/` names Russian, `ru` or Cyrillic letters (no `lang === "ru"`, no Cyrillic tables in code). Behaviour comes from `pack.json` fields (`levels`, `formalRegister`, `stress`, `romanization`, `fold`, `numberWords`). Italian, French and English work exactly as today: a pack without those fields shows no Latin line and matches answers as before.
- **Never lose on-device data.** Every existing `lang-lern:*` key keeps its name and shape. New state only in the new key `lang-lern:romanization:<lang>` `{ v: 1, show }` (tolerant parsing, default `show: true`, covered by the Perfil backup automatically). Italian, French and English content files stay byte-identical (`git diff --stat content/it content/fr content/en` empty in every task), and so do `public/audio/{it,fr,en}/**`.
- **Schema (T111).** `Register` and `FormalRegister` gain `"vy"` (badge "Trato de usted" / "Trato de tú", like `lei`). `pack.json` gains optional:
  - `stress: { mark: string, vowels: string, selfStressed?: string }` — `content:check` requires exactly one `mark` after a vowel in every target-language word with ≥ 2 `vowels` that has no `selfStressed` letter (ё), and none in one-vowel words (an error with the item id and word; checks text of phrases, vocab, Q&A, dialogue turns/options, grammar examples, stories, placement). The mark is stripped from text sent to TTS (`scripts/audio`, and `speechSynthesis` in `@/lib/audio`) and from both sides of answer matching and speech scoring, and never produces an "acento" note.
  - `romanization: { map: Record<string, string>, wordStart?: Record<string, string>, afterVowel?: Record<string, string>, stressAccent?: boolean, alternatives?: Record<string, string[]> }` — greedy per-letter map (case kept on the first letter), word-start and after-vowel variants (е → ye), the stress mark turned into an acute on the romanized vowel when `stressAccent`; `alternatives` = other Latin spellings accepted when typing (`"j": ["kh", "h"]`, `"ia": ["ya"]`…). One framework-free function `romanize(text, pack)` in `src/lib/content/` used by display and matching.
  - `fold: Record<string, string>` — letters treated as equal when matching and scoring (`"ё": "е"`).
  `content/ru/pack.json` is written by T111 and only T111 edits it (content tasks report needed changes in DECISIONS).
- **Display (T112).** Wherever the app shows a target-language sentence or word as text (lesson items and exercises, feedback, Repaso, Frasario, Jugar, dialogues, stories and their key words, grammar examples, placement, Prepárate packs), a pack with `romanization` shows the Latin line under it in a muted, smaller style, through one shared component (no per-screen romanization code), when `lang-lern:romanization:<lang>` says `show`. Perfil shows the switch "Mostrar transliteración" only for packs with `romanization`. Frasario search also matches the romanization.
- **Matching (T113).** Typed answers: Cyrillic or Latin. Latin input is compared with the romanization of each accepted answer after normalizing both with `alternatives`, accents stripped, typo tolerance as today. Stress marks stripped and `fold` applied on both sides (typed and spoken). Packs without these fields: identical results to today.
- **Russian content (T114–T123).** docs/brief-ru.md fixes unit ids, orders, situations, register, ids, cast; docs/content-guide.md fixes the format. Every unit, dialogue, story and placement question has `level: "A1"`. Each content task owns its own files under `content/ru/` (no shared index). Unit files: `content/ru/units/<order>-<unit-id>.json` (`30-ru-a1-transport.json`). Stress marks on every multi-syllable word (`content:check` enforces it). Later units may reuse earlier Russian items by id. Content tasks do not run `npm run audio`/`npm run images` (T124 on the Mac does); they still set picture keys.
- Verification: `npm run verify` → exit 0 for every task. UI changes: check light and dark at 375 px with `npm run dev` or `npm run build && npm start` when the agent can; otherwise the writer queues a Visual line.

## Tasks

## T111 — Russian foundation: `vy` register, `stress`, `romanization`, `fold`, ru pack.json
- Status: done
- Depends on: none
- Where: any
- Goal: Make schema, loader, `content:check`, the audio script and `@/lib/audio` ready for a non-Latin pack, per the Shared contract ("Schema"), and write `content/ru/pack.json`: lang `ru`, name "Ruso", nativeName "Русский", emoji 🇷🇺, speechLocale `ru-RU`, voices `ru-RU-SvetlanaNeural`, `ru-RU-DmitryNeural` (plus any other ru-RU voice `edge-tts --list-voices` shows, if the network allows), `formalRegister: "vy"`, `levels: ["A1"]`, no `articles`, the 13 situations of brief-ru, `numberWords` 0–100 + hundreds + 1000 with stress marks, `stress` (U+0301, Russian vowels, `selfStressed` ё), the Spanish-reader `romanization` of brief-ru with `alternatives`, `fold` ё→е. Export `romanize()` and a `stripStress()`/`foldText()` helper from `@/lib/content` (framework-free). `content:check` and `verify` must pass while the Russian pack has no units yet (an empty pack stays hidden, as for English).
- Context: `src/lib/content/schema.ts` (Register, FormalRegister, PackMeta, Level), `src/lib/content/build.ts`, `src/lib/content/index.ts`, `src/components/dialogue/DialogueSimulator.tsx` (register badge), `src/lib/coach/practice.ts` (register labels), `scripts/audio/` (text → TTS, hash), `src/lib/audio/` (speechSynthesis fallback), `content/en/pack.json` (model); document the new fields in docs/content-guide.md.
- Scope: may touch `src/lib/content/**`, `src/components/dialogue/**`, `src/lib/coach/practice.ts`, `src/lib/audio/**`, `scripts/content.ts`, `scripts/audio/**`, `content/ru/pack.json` (new), docs/content-guide.md / must not touch `content/{it,fr,en}/**`, `public/**`, `api/**`, `supabase/**`, `docs/brief*.md`, `src/lib/exercises/**`, `src/lib/speech/**` (T113), `plans/`.
- Done when:
  - `npm run content:check` → ✓ for it, fr, en and ru; `git diff --stat content/it content/fr content/en public/audio` → empty.
  - `npm run audio -- --dry-run` (or the script's plan step) → no it/fr/en file changes; a quick node/tsx check prints `romanize("Здра́вствуйте, молоко́, ещё, я, Хорошо́")` → `Zdrávstvuite, molokó, yeshchió, ya, Joroshó`-style output matching brief-ru's scheme (report it).
  - `grep -rnE "lang === .ru|[а-яё]" src scripts api --include='*.ts' --include='*.tsx'` → nothing new beyond comments.
  - `npm run verify` → exit 0
- Outcome: helpers in src/lib/content/script.ts (romanize, stripStress, foldText, stressIssues); articles optional; Gender n/pl; audio --dry-run; voices Svetlana+Dmitry only → 5c16137

## T112 — Romanization line under target text + Perfil switch
- Status: running (attempt 1)
- Depends on: T111
- Where: any
- Goal: Per the Shared contract ("Display"): one shared component renders target text plus, for packs with `romanization` and the switch on, the muted Latin line; every screen that shows target-language text uses it; new key `lang-lern:romanization:<lang>` `{ v: 1, show }` with `getShowRomanization`/`setShowRomanization`/`useShowRomanization` (framework-free + hook, like `@/lib/content/active`); Perfil switch "Mostrar transliteración" only for such packs; Frasario search matches romanization. Packs without `romanization` render exactly as before.
- Context: `src/components/exercises/**`, `src/components/dialogue/**`, story and grammar components, Frasario, Repaso, Jugar, placement, `src/app/perfil/`, `src/lib/content/active.ts` (store model), `src/lib/backup/` (must pick the key up automatically).
- Scope: may touch `src/components/**`, `src/app/**`, `src/lib/content/**` (display store only; not `romanize()`), `src/lib/progress/settings*` if settings live there / must not touch `content/**`, `public/**`, `api/**`, `src/lib/exercises/**`, `src/lib/speech/**`, `scripts/**`, `plans/`.
- Done when:
  - With a temporary local ru unit (not committed) or after T114 lands: a Russian item shows Cyrillic + Latin line; the switch hides it; Italian screens unchanged (report how checked).
  - `npm run verify` → exit 0
- Outcome:

## T113 — Script-aware answer matching and speech scoring
- Status: done
- Depends on: T111
- Where: any
- Goal: Per the Shared contract ("Matching"): typed answers accept Cyrillic or Latin (romanization + `alternatives`, accents stripped, existing typo tolerance); stress marks stripped and `fold` applied on both sides for typed answers, tiles, dictation and speech scoring (`scoreHeard`/`bestOption`); a missing stress mark never triggers the "acento" note. Packs without `stress`/`romanization`/`fold` give identical results to today.
- Context: `src/lib/exercises/normalize.ts` (`normalizeAnswer`, `expandEquivalents`, `checkAnswer` options), `src/lib/exercises/**` callers, `src/lib/speech/score.ts`, docs/speech.md; T110's `equivalents` wiring is the model for passing pack fields down.
- Scope: may touch `src/lib/exercises/**`, `src/lib/speech/score.ts` and its callers' option passing, `src/components/exercises/**` (option passing only), docs/speech.md / must not touch `content/**`, `public/**`, `api/**`, `src/lib/speech/platform.ts`, `plans/`.
- Done when:
  - A node/tsx check (not committed) with the ru pack meta prints correct for: "privet" vs "приве́т", "spasibo" vs "спаси́бо", "jorosho"/"khorosho" vs "хорошо́", "ещё" vs "еще", "Привет" vs "приве́т"; and an it/en answer set gives the same results as on main (report the table).
  - `npm run verify` → exit 0
- Outcome: scriptRules(meta)/prepareScript in @/lib/exercises; Latin path via romanize + alternatives; it/en/fr 0 diffs over 256k comparisons → bde39f8

## T114 — Russian A1: alphabet and greetings
- Status: running (attempt 1)
- Depends on: T111
- Where: any
- Goal: Units `ru-a1-alphabet` (10) and `ru-a1-hello` (12) per docs/brief-ru.md: reading lessons by letter group with real short words (vocab with pictures where concrete) and a Spanish `explanation` per group; greetings, politeness, ты/вы, "no entiendo / más despacio / ¿cómo se dice?", with Q&A.
- Context: docs/brief-ru.md, docs/content-guide.md, `content/fr/units/10-salut.json`, `content/en/units/10-a2-hello.json` (models).
- Scope: may touch `content/ru/units/10-*.json`, `content/ru/units/12-*.json` / must not touch anything else.
- Done when:
  - `npm run content:check` → ✓ (stress rule included)
  - `npm run verify` → exit 0
- Outcome:

## T115 — Russian A1: numbers and grammar
- Status: pending
- Depends on: T111
- Where: any
- Goal: Units `ru-a1-numbers` (14) and `ru-a1-grammar` (90) with the 13 A1 grammar cards of brief-ru (recognition first, short examples with stress marks), prices in rubles, times, phone numbers.
- Context: docs/brief-ru.md, docs/content-guide.md, `content/en/units/12-a2-numbers.json`, `content/en/units/90-a2-grammar.json` (grammar cards in the grammar unit's own array).
- Scope: may touch `content/ru/units/14-*.json`, `content/ru/units/90-*.json` / must not touch anything else.
- Done when:
  - `npm run content:check` → ✓
  - `npm run verify` → exit 0
- Outcome:

## T116 — Russian A1: about me, daily life
- Status: pending
- Depends on: T111
- Where: any
- Goal: Units `ru-a1-about-me` (20) and `ru-a1-daily` (22) per docs/brief-ru.md (persona: Hernán, from Madrid, programmer; home, routine, free time, weekdays, weather).
- Context: docs/brief-ru.md, docs/content-guide.md, `content/en/units/20-a2-about-me.json` (model).
- Scope: may touch `content/ru/units/20-*.json`, `content/ru/units/22-*.json` / must not touch anything else.
- Done when:
  - `npm run content:check` → ✓
  - `npm run verify` → exit 0
- Outcome:

## T117 — Russian A1: transport, hotel
- Status: pending
- Depends on: T111
- Where: any
- Goal: Units `ru-a1-transport` (30) and `ru-a1-hotel` (32) per docs/brief-ru.md (airport, train, metro, taxi, tickets; booking, check-in, asking for things, small problems).
- Context: docs/brief-ru.md, docs/content-guide.md, `content/en/units/30-a2-airport.json`, `content/en/units/32-a2-hotel.json` (models).
- Scope: may touch `content/ru/units/30-*.json`, `content/ru/units/32-*.json` / must not touch anything else.
- Done when:
  - `npm run content:check` → ✓
  - `npm run verify` → exit 0
- Outcome:

## T118 — Russian A1: food, shopping
- Status: pending
- Depends on: T111
- Where: any
- Goal: Units `ru-a1-food` (40) and `ru-a1-shopping` (42) per docs/brief-ru.md (café, restaurant, ordering, the bill, typical dishes; shop, market, supermarket, clothes, paying).
- Context: docs/brief-ru.md, docs/content-guide.md, `content/en/units/40-a2-food.json`, `content/en/units/42-a2-shopping.json` (models).
- Scope: may touch `content/ru/units/40-*.json`, `content/ru/units/42-*.json` / must not touch anything else.
- Done when:
  - `npm run content:check` → ✓
  - `npm run verify` → exit 0
- Outcome:

## T119 — Russian A1: city, health
- Status: pending
- Depends on: T111
- Where: any
- Goal: Units `ru-a1-city` (50) and `ru-a1-health` (52) per docs/brief-ru.md (directions, museums, places, meeting up; pharmacy, doctor, 112).
- Context: docs/brief-ru.md, docs/content-guide.md, `content/en/units/50-a2-city.json`, `content/en/units/52-a2-health.json` (models).
- Scope: may touch `content/ru/units/50-*.json`, `content/ru/units/52-*.json` / must not touch anything else.
- Done when:
  - `npm run content:check` → ✓
  - `npm run verify` → exit 0
- Outcome:

## T120 — Russian A1: 12 dialogues
- Status: pending
- Depends on: T114, T115, T116, T117, T118, T119
- Where: any
- Goal: The 12 dialogues listed in docs/brief-ru.md (`level: "A1"`, `unit`, one native speaker each, avatars, register-honest options `vy`/`tu` with Spanish feedback), order 1–12.
- Context: docs/brief-ru.md, docs/content-guide.md, `content/en/dialogues/` (model).
- Scope: may touch `content/ru/dialogues/**` / must not touch anything else.
- Done when:
  - `npm run content:check` → ✓
  - `npm run verify` → exit 0
- Outcome:

## T121 — Russian A1: stories 1–6
- Status: pending
- Depends on: T114, T115, T116, T117, T118, T119
- Where: any
- Goal: Stories 1–6 with the brief-ru cast in Saint Petersburg (Lucía's arrival, the flat, breakfast, the metro, the market, a museum), `level: "A1"`, present tense, 80–130 words; key words reuse unit items by id where possible. Leave a one-line outline for stories 7–12 in DECISIONS (voices included).
- Context: docs/brief-ru.md, docs/content-guide.md, `content/en/stories/` (model).
- Scope: may touch `content/ru/stories/**` (stories 1–6 only) / must not touch anything else.
- Done when:
  - `npm run content:check` → ✓
  - `npm run verify` → exit 0
- Outcome:

## T122 — Russian A1: stories 7–12
- Status: pending
- Depends on: T121
- Where: any
- Goal: Stories 7–12 continuing T121's outline (café, white nights, a cold and the pharmacy, a dacha weekend, the past week in past tense, goodbye at the airport), reusing T121's inline key words by id.
- Context: docs/brief-ru.md, T121's outline in the plan's Decisions (the writer pastes it into the prompt), `content/ru/stories/` 1–6.
- Scope: may touch `content/ru/stories/**` (new files for 7–12 only) / must not touch anything else.
- Done when:
  - `npm run content:check` → ✓
  - `npm run verify` → exit 0
- Outcome:

## T123 — Russian placement test
- Status: pending
- Depends on: T114, T115, T116, T117, T118, T119
- Where: any
- Goal: 8 graded placement questions (`level: "A1"`, easy → hard, with `audio`), spread over the A1 units, each marking the lessons it proves, for a learner who already knows some Russian.
- Context: docs/brief-ru.md, docs/content-guide.md, `content/en/extras/placement.json` (model).
- Scope: may touch `content/ru/extras/placement.json` (new) / must not touch anything else.
- Done when:
  - `npm run content:check` → ✓
  - `npm run verify` → exit 0
- Outcome:

## T124 — Russian audio and pictures, final offline check
- Status: pending
- Depends on: T112, T113, T120, T122, T123
- Where: mac
- Goal: Generate ru-RU neural mp3 for every Russian playable (text without stress marks) and the Russian pictures, commit them, and prove the Russian course works offline with only its audio cached.
- Context: CLAUDE.md (`npm run audio`, `npm run images`, offline PWA), docs/brief-ru.md ("Audio and pictures").
- Scope: may touch `public/audio/ru/**`, `public/images/**` (new Russian pictures only), `content/ru/**` only to fix a picture key / must not touch `public/audio/{it,fr,en}/**`, `src/**`, `plans/`.
- Done when:
  - `npm run audio` and `npm run images` → done; `npm run content:check -- --strict-audio --strict-images` → ✓
  - `git diff --stat public/audio/it public/audio/fr public/audio/en` → empty
  - `npm run verify` → exit 0
- Outcome:

## T125 — Prepárate: stress marks for packs with a `stress` rule
- Status: pending
- Depends on: T111
- Where: any
- Goal: When the active pack has `stress`, Prepárate's generation request tells the model to write the stress mark on every multi-syllable word (generic: the rule comes from the pack meta the client already sends or from a new optional field in the request contract); the generated pack's text is shown through T112's component automatically. Fake mode returns canned data with marks for such packs. No change for other packs.
- Context: docs/coach.md (contract, schemas, fake mode), `api/_lib/` (prompt building, zod schemas), `src/lib/coach/` (client, `buildLearnerContext()`).
- Scope: may touch `api/**`, `src/lib/coach/**`, docs/coach.md / must not touch `content/**`, `public/**`, `supabase/**`, `plans/`.
- Done when:
  - `npm run dev:coach` in fake mode with Russian active → a pack generates (report how checked; queue a Visual line otherwise).
  - `npm run verify` → exit 0
- Outcome:

## Review queue
- [ ] T111 @5c16137 — code review (script.ts, build.ts stress check, audio strip) (queued 2026-10-07 💻)
- [ ] T113 @bde39f8 — code review (normalize.ts Latin path, score.ts) (queued 2026-10-07 💻)

## Visual checks queue
- [ ] T113 @bde39f8 — type 'privet' / 'jorosho' in a Russian answer exercise and say 'привет' with the mic (queued 2026-10-07 💻)

## Decisions
- 2026-10-07 plan: Russian (`ru`) is the fourth pack, levelled with one level A1 (`levels: ["A1"]`), full French volume; A2 later with the same molds; product note in docs/brief-ru.md (docs/brief.md not edited). (Hernán)
- 2026-10-07 plan: Cyrillic everywhere with stress marks, plus a generated Latin romanization line the learner can hide on Perfil (per language, on by default). (Hernán)
- 2026-10-07 plan: typed answers accept Cyrillic or Latin transliteration; stress marks never count, ё = е. (Hernán)
- 2026-10-07 plan: goal travel + everyday life; stories in Saint Petersburg (Lucía, Anya, Dima, Vera Petrovna). (Hernán)
- 2026-10-07 plan: generic pack fields `stress`, `romanization`, `fold` and register `vy` instead of any Russian-specific code; Spanish-reader romanization scheme (х → j); TTS gets text without stress marks; one native speaker per dialogue because edge-tts has two ru-RU voices. (orchestrator)
- 2026-10-07 plan: Base branch `plan-009-ruso` from main @ cfe71d6 in the main checkout (no other plan running); push policy: guarded push of the plan branch after every integrated task; never main, no PR, merge or deploy without Hernán's OK. (orchestrator)
- 2026-10-07 T111: ru alternatives table is a first pass for T113 (j→kh/h, ia→ya/a, io→yo/o/e, y→i); vy badge 'Trato de usted' without pronoun; gap text must match whole words incl. stress marks (agent)
- 2026-10-07 plan: T112 and T113 both touch src/components/exercises → run T113 first, T112 after it (orchestrator)
- 2026-10-07 T113: alternatives one-way (expected romanization → listed alternative) inside typo distance; tiles/fill-gap get scriptRules only (agent)
- 2026-10-07 T113→T112: FeedbackSheet.tsx:50 diffWords needs getPack(lang).meta as 3rd arg; added to T112's prompt (orchestrator)

## Proposals (new scope)
- 2026-10-07 T111: server-side Prepárate TTS (api/) still gets stress marks; client strips them today

## Log
- 2026-10-07 💻 plan written from the interview; not approved yet
- 2026-10-07 22:11Z 💻 plan approved by Hernán
- 2026-10-07 22:11Z 💻 T111 launched · attempt 1 · agent a45b2c48e4ff6e874
- 2026-10-07 22:18Z 💻 T111 done · → 5c16137 · verify ✓
- 2026-10-07 22:18Z 💻 T113 launched · attempt 1 · agent a62d0af1e05cdb73c
- 2026-10-07 22:18Z 💻 T114 launched · attempt 1 · agent ae2634e7774cc36ea
- 2026-10-07 22:24Z 💻 T113 done · → bde39f8 · verify ✓
