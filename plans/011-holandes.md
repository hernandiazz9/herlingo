# Plan 011 — Holandés A2 + B1: a Dutch pack for living and working in the Netherlands

Status: active
Created: 2026-10-08
Base branch: main
Goal: Add a Dutch pack (`content/nl/`, nl-NL) with two selectable levels, **A2 and B1**, each the full English-sized course (10 units + grammar unit, ~450 phrases, ~330 vocab, ~90 Q&A, 12 dialogues, 12 stories), plus a placement test and nl-NL audio and pictures. The learner wants to live and work in the Netherlands, so the content follows daily life there, guided by the inburgeringsexamen themes (gemeente, BSN, DigiD, huisarts, huur, werk, KNM topics) without simulating the exam. Code stays language-agnostic and reuses plan 008's level model (`levels`, per-unit `level`, level chips, placement suggestion). A2 and B1 are built in parallel. MVP speed: no automated tests; verification is `npm run verify`.
Test command: npm run verify
Worktree setup: npm ci

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, docs/brief.md (app-wide, do not edit), **docs/brief-nl.md** (written by T135: Dutch pack note), docs/content-guide.md, docs/speech.md for matching. `content/en/` A2 and B1 are the models: copy their file format, conventions and quality, not their content.
- **Content only, generic code.** Code changes only in T135 (and T147 if the audio script needs a generic fix), and generic: nothing in `src/`, `api/` or `scripts/` names Dutch or `nl` except data maps that already list registers/pronouns. Italian, French, English and Russian behave exactly as today.
- **Never lose on-device data.** No stored key renamed or reshaped. Byte-identical in every task: `content/{it,fr,en,ru}/**`, `public/audio/{it,fr,en,ru}/**`, `public/images/**` except files T147 adds.
- **Pack.** `content/nl/pack.json` is edited only by T135 (`lang: "nl"`, `name: "Neerlandés"`, `nativeName: "Nederlands"`, `speechLocale: "nl-NL"`, emoji 🇳🇱, `levels: ["A2", "B1"]`, `formalRegister` matching the je/u choice, nl-NL edge-tts voices that exist in `edge-tts --list-voices` (Fenna, Maarten, Colette), `numberWords`, articles, situations). Content tasks report needed pack changes instead of editing it.
- **Learner and setting.** Hernán, Spanish speaker (Spain Spanish UI with tú), moving to live and work in the Netherlands. Base city Utrecht, with scenes in Amsterdam, Rotterdam and Den Haag. Register mixed: `je` with colleagues, neighbours and friends; `u` at the gemeente, the doctor, a job interview, the landlord's agency. Formal wording marked with the pack's formal register, casual with `tu`, like English.
- **Dutch content.** brief-nl fixes unit ids and topics, orders (A2 10–99, B1 110–199, grammar unit at x90), situations, ids (`nl-a2-…`, `nl-b1-…`, `gram.nl-a2-…`, `dlg.nl-b1-…`, `story.nl-a2-…`, `placement.nl-…`; unique across every pack), cast and voices. Unit files `content/nl/units/<order>-<unit-id>.json`; grammar cards in the grammar unit's own `grammar` array. Dialogue and story `order`: A2 1–12, B1 101–112; story files `a2-NN-<slug>.json` / `b1-NN-<slug>.json`. Later units reuse earlier Dutch items by id (any level) instead of duplicating. Every noun shows its article (de/het) in vocab; separable verbs, V2 word order, diminutives and idioms explained in `notes`; Q&A and dialogue distractors = typical Spanish-speaker mistakes (de/het, word order, false friends), never differing only by punctuation or diacritics. Numbers as words. Fluent icons only when one fits and exists. Content tasks do not run `npm run audio`/`npm run images` (T147 does).
- Verification: `npm run verify` → exit 0 for every task.

## Tasks

## T135 — Dutch pack foundation and brief
- Status: pending
- Depends on: none
- Goal: Create `content/nl/pack.json` and `docs/brief-nl.md` so A2 and B1 content can be written in parallel, plus any small generic code change Dutch needs.
- Context: plans/008-ingles.md and plans/009-ruso.md (foundation tasks T90 / T111), docs/brief-en.md and docs/brief-ru.md as the brief models, `content/en/pack.json`, `src/lib/content/schema.ts` (Register / FormalRegister), `src/components/dialogue/DialogueSimulator.tsx` (FORMAL_PRONOUN), `src/lib/coach/practice.ts`, `src/lib/exercises/normalize.ts` and the speech scoring, `api/_lib/languages.ts`.
- Scope: may touch `content/nl/pack.json`, `docs/brief-nl.md`, `docs/content-guide.md` (only to document new generic fields), generic code listed in Context, CLAUDE.md (one line naming the `nl` pack next to the others) / must not touch any other pack's content or audio, stored key names or shapes.
- Done when:
  - `docs/brief-nl.md` lists, per level, 10 unit ids with order, situation, topics and grammar focus, the grammar unit's ~10 cards, the 12 dialogue and 12 story topics with ids, the cast (names, roles, voices), situations, register rules and Dutch language rules (articles, separable verbs, diminutives, typical Spanish-speaker mistakes), and the volume targets above. A2 topics cover arriving and settling (gemeente, BSN, DigiD, housing, bank, supermarket, transport/bike, huisarts, neighbours, small talk); B1 covers work and deeper life (job search and interview, workplace and meetings, rental problems, health system, school/childcare, taxes/Belastingdienst basics, KNM culture and norms, opinions, news).
  - The `nl` pack loads but is hidden while it has no lessons (existing empty-pack behaviour), or shows an empty-level message; formal dialogues show "(u)" as the pronoun if the register map supports it.
  - Dutch matching: answers typed without diacritics (`een` for `één`, `ideeen` for `ideeën`) are accepted, if the existing normalization does not already do so (generic, not Dutch-named).
  - `npm run verify` → exit 0.
- Outcome:

## T136 — A2 units 1–4 (with the grammar unit)
- Status: pending
- Depends on: T135
- Goal: Write the first four A2 units from brief-nl.md, including the A2 grammar unit (x90).
- Context: Shared contract, docs/brief-nl.md, `content/en/units/` A2 files as format model.
- Scope: may touch `content/nl/units/` (A2 files of these units only) / must not touch `content/nl/pack.json`, other packs.
- Done when:
  - 4 unit files exist, each with ~5 lessons and its share of ~45 phrases, ~33 vocab, ~9 Q&A per unit (grammar unit: ~10 cards) as brief-nl says.
  - `npm run content:check` → exit 0; `npm run verify` → exit 0.
- Outcome:

## T137 — A2 units 5–8
- Status: pending
- Depends on: T136
- Goal: Write A2 units 5–8 from brief-nl.md, reusing earlier items by id.
- Context: Shared contract, docs/brief-nl.md, T136's units.
- Scope: may touch `content/nl/units/` (these units only) / must not touch `content/nl/pack.json`, other units, other packs.
- Done when:
  - 4 unit files at the brief's volume; `npm run verify` → exit 0.
- Outcome:

## T138 — A2 units 9–11 (A2 complete)
- Status: pending
- Depends on: T137
- Goal: Write the remaining A2 units so A2 has 10 units + grammar unit at the target totals.
- Context: Shared contract, docs/brief-nl.md, earlier A2 units.
- Scope: may touch `content/nl/units/` (these units only) / must not touch `content/nl/pack.json`, other units, other packs.
- Done when:
  - A2 totals within ±10% of ~450 phrases, ~330 vocab, ~90 Q&A (report the counts); `npm run verify` → exit 0.
- Outcome:

## T139 — B1 units 1–4 (with the grammar unit)
- Status: pending
- Depends on: T135
- Goal: Write the first four B1 units from brief-nl.md, including the B1 grammar unit (190).
- Context: Shared contract, docs/brief-nl.md, `content/en/units/` B1 files as format model. A2 may be in progress in parallel: do not depend on A2 items that are not on main yet.
- Scope: may touch `content/nl/units/` (B1 files of these units only) / must not touch `content/nl/pack.json`, A2 units, other packs.
- Done when:
  - 4 unit files at the brief's volume; `npm run verify` → exit 0.
- Outcome:

## T140 — B1 units 5–8
- Status: pending
- Depends on: T139
- Goal: Write B1 units 5–8 from brief-nl.md.
- Context: Shared contract, docs/brief-nl.md, T139's units.
- Scope: may touch `content/nl/units/` (these units only) / must not touch `content/nl/pack.json`, other units, other packs.
- Done when:
  - 4 unit files at the brief's volume; `npm run verify` → exit 0.
- Outcome:

## T141 — B1 units 9–11 (B1 complete)
- Status: pending
- Depends on: T140
- Goal: Write the remaining B1 units so B1 has 10 units + grammar unit at the target totals.
- Context: Shared contract, docs/brief-nl.md, earlier B1 units.
- Scope: may touch `content/nl/units/` (these units only) / must not touch `content/nl/pack.json`, other units, other packs.
- Done when:
  - B1 totals within ±10% of ~450 phrases, ~330 vocab, ~90 Q&A (report the counts); `npm run verify` → exit 0.
- Outcome:

## T142 — A2 dialogues (12)
- Status: pending
- Depends on: T138
- Goal: Write the 12 A2 dialogues from brief-nl.md (orders 1–12), using A2 vocabulary, mixed je/u register.
- Context: Shared contract, docs/brief-nl.md, `content/en/dialogues/a2-*` as format model.
- Scope: may touch `content/nl/dialogues/a2-*` / must not touch units, pack.json, other packs.
- Done when:
  - 12 dialogue files with learner options and Spanish-speaker-mistake distractors; `npm run verify` → exit 0.
- Outcome:

## T143 — B1 dialogues (12)
- Status: pending
- Depends on: T141
- Goal: Write the 12 B1 dialogues from brief-nl.md (orders 101–112).
- Context: Shared contract, docs/brief-nl.md, `content/en/dialogues/b1-*` as format model.
- Scope: may touch `content/nl/dialogues/b1-*` / must not touch units, pack.json, other packs.
- Done when:
  - 12 dialogue files; `npm run verify` → exit 0.
- Outcome:

## T144 — A2 stories (12)
- Status: pending
- Depends on: T138
- Goal: Write the 12 A2 stories from brief-nl.md (orders 1–12, files `a2-NN-<slug>.json`), at the English A2 story length.
- Context: Shared contract, docs/brief-nl.md, `content/en/stories/a2-*` as format model.
- Scope: may touch `content/nl/stories/a2-*` / must not touch units, dialogues, pack.json, other packs.
- Done when:
  - 12 story files with keywords and comprehension questions; `npm run verify` → exit 0.
- Outcome:

## T145 — B1 stories (12)
- Status: pending
- Depends on: T141
- Goal: Write the 12 B1 stories from brief-nl.md (orders 101–112, files `b1-NN-<slug>.json`), at the English B1 story length.
- Context: Shared contract, docs/brief-nl.md, `content/en/stories/b1-*` as format model.
- Scope: may touch `content/nl/stories/b1-*` / must not touch units, dialogues, pack.json, other packs.
- Done when:
  - 12 story files; `npm run verify` → exit 0.
- Outcome:

## T146 — Placement test (A2/B1)
- Status: pending
- Depends on: T138, T141
- Goal: Write `content/nl/extras/placement.json` that suggests A2 or B1 (about 8 questions per level, with audio questions like English).
- Context: Shared contract, `content/en/extras/placement.json`, the placement logic in src (read only).
- Scope: may touch `content/nl/extras/placement.json` / must not touch code, other packs.
- Done when:
  - `npm run verify` → exit 0; a beginner's answers land on A2 and a strong learner's on B1 (explain how you checked).
- Outcome:

## T147 — nl-NL audio, pictures and offline check
- Status: pending
- Depends on: T142, T143, T144, T145, T146
- Goal: Generate nl-NL mp3s and pictures for the whole Dutch pack, and check the pack works offline in the built app.
- Context: CLAUDE.md commands `npm run audio`, `npm run images`, `--strict-audio`, `--strict-images`; plan 008 T109 and plan 009-ruso T124 outcomes. Needs internet (edge-tts).
- Scope: may touch `public/audio/nl/**`, `public/images/**` (only additions for Dutch), a generic fix in `scripts/audio` or `scripts/images` if needed / must not touch other languages' audio or content.
- Done when:
  - `npm run content:check -- --strict-audio --strict-images` → exit 0.
  - `npm run verify` → exit 0; `out/sw.js` build line lists audio for `nl`.
  - `git diff --stat main -- public/audio/it public/audio/fr public/audio/en public/audio/ru` → empty.
- Outcome:

## Decisions
- 2026-10-08 Hernán: levels A2 + B1; goal live/work in the Netherlands, guided by inburgering themes; nl-NL voices; English-sized volume per level; mixed je/u; base Utrecht plus other cities; A2 and B1 built in parallel.

## Proposals (new scope)

## Log
