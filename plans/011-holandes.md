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
- Status: done
- Depends on: none
- Goal: Create `content/nl/pack.json` and `docs/brief-nl.md` so A2 and B1 content can be written in parallel, plus any small generic code change Dutch needs.
- Context: plans/008-ingles.md and plans/009-ruso.md (foundation tasks T90 / T111), docs/brief-en.md and docs/brief-ru.md as the brief models, `content/en/pack.json`, `src/lib/content/schema.ts` (Register / FormalRegister), `src/components/dialogue/DialogueSimulator.tsx` (FORMAL_PRONOUN), `src/lib/coach/practice.ts`, `src/lib/exercises/normalize.ts` and the speech scoring, `api/_lib/languages.ts`.
- Scope: may touch `content/nl/pack.json`, `docs/brief-nl.md`, `docs/content-guide.md` (only to document new generic fields), generic code listed in Context, CLAUDE.md (one line naming the `nl` pack next to the others) / must not touch any other pack's content or audio, stored key names or shapes.
- Done when:
  - `docs/brief-nl.md` lists, per level, 10 unit ids with order, situation, topics and grammar focus, the grammar unit's ~10 cards, the 12 dialogue and 12 story topics with ids, the cast (names, roles, voices), situations, register rules and Dutch language rules (articles, separable verbs, diminutives, typical Spanish-speaker mistakes), and the volume targets above. A2 topics cover arriving and settling (gemeente, BSN, DigiD, housing, bank, supermarket, transport/bike, huisarts, neighbours, small talk); B1 covers work and deeper life (job search and interview, workplace and meetings, rental problems, health system, school/childcare, taxes/Belastingdienst basics, KNM culture and norms, opinions, news).
  - The `nl` pack loads but is hidden while it has no lessons (existing empty-pack behaviour), or shows an empty-level message; formal dialogues show "(u)" as the pronoun if the register map supports it.
  - Dutch matching: answers typed without diacritics (`een` for `één`, `ideeen` for `ideeën`) are accepted, if the existing normalization does not already do so (generic, not Dutch-named).
  - `npm run verify` → exit 0.
- Outcome: Dutch pack.json (A2/B1, nl-NL voices, new generic register 'u'), docs/brief-nl.md; diacritics already folded — e973589

## T136 — A2 units 1–4 (with the grammar unit)
- Status: done
- Depends on: T135
- Goal: Write the first four A2 units from brief-nl.md, including the A2 grammar unit (x90).
- Context: Shared contract, docs/brief-nl.md, `content/en/units/` A2 files as format model.
- Scope: may touch `content/nl/units/` (A2 files of these units only) / must not touch `content/nl/pack.json`, other packs.
- Done when:
  - 4 unit files exist, each with ~5 lessons and its share of ~45 phrases, ~33 vocab, ~9 Q&A per unit (grammar unit: ~10 cards) as brief-nl says.
  - `npm run content:check` → exit 0; `npm run verify` → exit 0.
- Outcome: units 10 hello, 12 numbers, 20 about-me, 90 grammar (188 phrases, 130 vocab, 33 Q&A, 11 cards) — 49b2083

## T137 — A2 units 5–8
- Status: done
- Depends on: T136
- Goal: Write A2 units 5–8 from brief-nl.md, reusing earlier items by id.
- Context: Shared contract, docs/brief-nl.md, T136's units.
- Scope: may touch `content/nl/units/` (these units only) / must not touch `content/nl/pack.json`, other units, other packs.
- Done when:
  - 4 unit files at the brief's volume; `npm run verify` → exit 0.
- Outcome: units 22 gemeente, 30 housing, 32 bank, 40 shopping (192 phrases, 135 vocab, 36 Q&A) — 6e02f4e

## T138 — A2 units 9–11 (A2 complete)
- Status: done
- Depends on: T137
- Goal: Write the remaining A2 units so A2 has 10 units + grammar unit at the target totals.
- Context: Shared contract, docs/brief-nl.md, earlier A2 units.
- Scope: may touch `content/nl/units/` (these units only) / must not touch `content/nl/pack.json`, other units, other packs.
- Done when:
  - A2 totals within ±10% of ~450 phrases, ~330 vocab, ~90 Q&A (report the counts); `npm run verify` → exit 0.
- Outcome: units 42 transport, 50 huisarts, 52 neighbours; A2 = 471 phrases, 338 vocab, 93 Q&A, 56 lessons — d3aae14

## T139 — B1 units 1–4 (with the grammar unit)
- Status: done
- Depends on: T135
- Goal: Write the first four B1 units from brief-nl.md, including the B1 grammar unit (190).
- Context: Shared contract, docs/brief-nl.md, `content/en/units/` B1 files as format model. A2 may be in progress in parallel: do not depend on A2 items that are not on main yet.
- Scope: may touch `content/nl/units/` (B1 files of these units only) / must not touch `content/nl/pack.json`, A2 units, other packs.
- Done when:
  - 4 unit files at the brief's volume; `npm run verify` → exit 0.
- Outcome: units 110 job-search, 112 interview, 120 workplace, 190 grammar (182 phrases, 122 vocab, 32 Q&A, 12 cards) — d790d8c

## T140 — B1 units 5–8
- Status: done
- Depends on: T139
- Goal: Write B1 units 5–8 from brief-nl.md.
- Context: Shared contract, docs/brief-nl.md, T139's units.
- Scope: may touch `content/nl/units/` (these units only) / must not touch `content/nl/pack.json`, other units, other packs.
- Done when:
  - 4 unit files at the brief's volume; `npm run verify` → exit 0.
- Outcome: units 122 meetings, 130 renting, 132 health, 140 school (175 phrases, 122 vocab, 37 Q&A) — 83058a5

## T141 — B1 units 9–11 (B1 complete)
- Status: done
- Depends on: T140
- Goal: Write the remaining B1 units so B1 has 10 units + grammar unit at the target totals.
- Context: Shared contract, docs/brief-nl.md, earlier B1 units.
- Scope: may touch `content/nl/units/` (these units only) / must not touch `content/nl/pack.json`, other units, other packs.
- Done when:
  - B1 totals within ±10% of ~450 phrases, ~330 vocab, ~90 Q&A (report the counts); `npm run verify` → exit 0.
- Outcome: units 142 taxes, 150 culture, 152 opinions; B1 = 457 phrases, 335 vocab, 91 Q&A, 55 lessons — 5051d55

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
- Depends on: T142, T143, T144, T145, T146, T148
- Goal: Generate nl-NL mp3s and pictures for the whole Dutch pack, and check the pack works offline in the built app.
- Context: CLAUDE.md commands `npm run audio`, `npm run images`, `--strict-audio`, `--strict-images`; plan 008 T109 and plan 009-ruso T124 outcomes. Needs internet (edge-tts).
- Scope: may touch `public/audio/nl/**`, `public/images/**` (only additions for Dutch), a generic fix in `scripts/audio` or `scripts/images` if needed / must not touch other languages' audio or content.
- Done when:
  - `npm run content:check -- --strict-audio --strict-images` → exit 0.
  - `npm run verify` → exit 0; `out/sw.js` build line lists audio for `nl`.
  - `git diff --stat main -- public/audio/it public/audio/fr public/audio/en public/audio/ru` → empty.
- Outcome:

## T148 — Dutch duplicate cleanup
- Status: pending
- Depends on: T138, T141
- Goal: A2 and B1 units were written in parallel, so some Dutch phrases and vocab exist twice under different ids (e.g. "Leuk u te ontmoeten." in nl-a2-about-me and nl-b1-interview; verhuurder, borg, verwarming, koorts, rug in B1 vs A2 housing/huisarts). Keep one item per text (the earliest unit's), point later lessons to it by id, and remove the copies. The nl pack is not released yet, so changing nl ids is safe.
- Context: Shared contract, `content/nl/units/`, docs/content-guide.md (reuse by id), `npm run content:check` output.
- Scope: may touch `content/nl/units/` / must not touch `content/nl/pack.json`, dialogues, stories, other packs.
- Done when:
  - a script you run (not committed) finds no two nl phrases or vocab items with the same normalized text (report the before/after counts); level totals stay within ±10% of the targets.
  - `npm run verify` → exit 0.
- Outcome:

## Decisions
- 2026-10-08 Hernán: levels A2 + B1; goal live/work in the Netherlands, guided by inburgering themes; nl-NL voices; English-sized volume per level; mixed je/u; base Utrecht plus other cities; A2 and B1 built in parallel.
- 2026-10-08 T135: new generic register value `u` (badge 'Trato de usted (u)'); voices Fenna=narrator, Maarten=men, Colette=women (only 3 nl-NL voices), stories quote ≤1 man + 1 woman; new situation `tramites`; equivalents 't/m'n/z'n; placement 12 questions (6+6); cast Diego (Zaragoza), Femke, Ria + Sanne, Joost, Lucía, Martina at B1 (agent)
- 2026-10-08 orchestrator: unit split by brief order — T136 = 10, 12, 20 + 90; T137 = 22, 30, 32, 40; T138 = 42, 50, 52; T139 = 110, 112, 120 + 190; T140 = 122, 130, 132, 140; T141 = 142, 150, 152.
- 2026-10-08 T136: days/months as vocab without article; learner persona as English A2 (Madrid, 32, programmer); grammar unit also carries phrases/vocab/Q&A with items meant for reuse; Q&A voices Maarten/Colette, phrases Fenna (agent)
- 2026-10-08 T139: B1 grammar unit carries example phrases per card (34); B1 remaining units aim ~40 phrases each to stay within +10% (agent + orchestrator)
- 2026-10-08 orchestrator: from T140 on each agent gets its own scratch folder (parallel agents overwrote each other's helper scripts in the shared scratchpad)
- 2026-10-09 T137: 'de bank' only as the sofa in vocab (bank unit uses bankrekening/bankkantoor); iDEAL without article (brand) (agent)
- 2026-10-09 T140: wrote verhuurder, borg, verwarming, koorts, rug itself because A2 housing/huisarts were not on main yet → possible duplicates (agent)
- 2026-10-09 orchestrator: added T148 (Dutch duplicate cleanup) after T138/T141, because A2 and B1 were written in parallel and duplicated some words/phrases; T147 now also depends on T148
- 2026-10-09 T138: smaller last A2 units to stay within +10%; directions imperatives register neutral; 112 written 'één één twee'; extra Q&A character Bas (agent)
- 2026-10-09 T141: avoided A2 42/50/52 topics to keep duplicates low; grammar cards not listed in topic lessons (agent)
- 2026-10-09 orchestrator: run T148 (cleanup, changes unit item ids) before dialogues/stories that might reference item ids; T148 + T142 first

## Proposals (new scope)
- 2026-10-08 T135: docs/content-guide.md still says only English uses `levels` (Russian and Dutch too); fix the line.

## Log
- 2026-10-08 23:27 T135 launched · attempt 1 · agent ada48689fcc653b83
- 2026-10-08 23:34 T135 done · branch worktree-agent-ada48689fcc653b83 → e973589
- 2026-10-08 23:35 T136 launched · attempt 1 · agent a42f151109d93fddb
- 2026-10-08 23:35 T139 launched · attempt 1 · agent a1326ce7d1a975f97
- 2026-10-08 23:47 T136 done → 49b2083
- 2026-10-08 23:47 T137 launched · attempt 1 · agent a1dce65903e5a9b1c
- 2026-10-08 23:49 T139 done → d790d8c
- 2026-10-08 23:49 T140 launched · attempt 1 · agent a8593eaeb9bdb12a6
- 2026-10-09 00:00 T137 done → 6e02f4e
- 2026-10-09 00:00 T140 done → 83058a5
- 2026-10-09 00:01 T138 launched · attempt 1 · agent a037369d995a97426
- 2026-10-09 00:01 T141 launched · attempt 1 · agent a5ce8df4ff5521c15
- 2026-10-09 00:12 T141 done → 5051d55
- 2026-10-09 00:12 T138 done → d3aae14
