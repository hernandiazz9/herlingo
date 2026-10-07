# Plan 009 — Inglés B2 + C1: the upper levels of the English pack

Status: active
Created: 2026-10-07
Base branch: plan-009-ingles-b2-c1
Goal: Complete the English pack with levels **B2 and C1**, each the full French-sized course (10 units + grammar, ~420 phrases, ~320 vocab, ~80 Q&A, 12 dialogues, 12 stories), using the molds plan 008 built for A2 and B1 (generic `levels`, level selector, `formal` register, `equivalents`). Small generic polish first (pack levels and situations, per-level story length, Prepárate register labels, copy that assumes a trip, content-guide docs), then content unit by unit (max 2 agents), dialogues, stories in two batches per level, a placement test rewritten for four levels (4 questions each), and en-US audio + pictures last on the Mac. Italian, French and the English A2/B1 content stay byte-identical; every on-device key keeps its shape. MVP speed: no automated tests; verification is `npm run verify`.
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-07 22:40Z 💻
- Writer: 💻 desktop (since 11:48Z)
- Branch: plan-009-ingles-b2-c1 @ 5137464
- Next step: integrate T125/T126, then T127 + T128; T129 on 💻 last
- Needs Hernán: -

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, docs/brief.md (app-wide, do not edit), **docs/brief-en.md** (English pack note: B2/C1 units, situations, grammar cards, language rules, ids, dialogues, stories, voices), docs/content-guide.md, docs/speech.md for matching. `content/en/` A2 and B1 (plan 008) are the models: copy their file format, conventions and quality, not their content.
- **Content only, generic code.** Code changes only where T111 says, and generic: nothing in `src/`, `api/` or `scripts/` names English or `en`. Italian and French behave exactly as today.
- **Never lose on-device data.** No stored key renamed or reshaped; no new keys are needed in this plan. Byte-identical in every task: `content/it/**`, `content/fr/**`, the A2/B1 files of `content/en/` (`units/` with order < 200, `dialogues/a2-*`, `dialogues/b1-*`, `stories/a2-*`, `stories/b1-*`), `public/audio/it/**`, `public/audio/fr/**`, and existing `public/audio/en/*.mp3` (T129 only adds).
- **Pack (T111).** `content/en/pack.json` is edited only by T111: `levels: ["A2", "B1", "B2", "C1"]`, situations `opiniones` 💬 "Opiniones y debate" and `cultura` 🎬 "Cultura y ocio" appended before `gramatica`. Content tasks report needed pack changes instead of editing it.
- **English content (T112–T127).** brief-en fixes unit ids, orders (B2 210–299, C1 310–399, grammar at x90), situations, register, ids (`b2-…`, `c1-…`, `gram.en-b2-…`, `dlg.en-b2-…`, `story.en-c1-…`, `placement.en-b2-…`), cast and voices. Unit files `content/en/units/<order>-<unit-id>.json`; grammar cards live in the grammar unit's own `grammar` array (so they get the level). Dialogue and story `order`: B2 201–212, C1 301–312; story files `b2-NN-<slug>.json` / `c1-NN-<slug>.json`. Later units reuse earlier English items by id (any level) instead of duplicating. Conventions from plan 008: numbers as words, `formal` for polite/formal wording and `tu` for casual, phrasal verbs and idioms explained in `notes`, Q&A and dialogue distractors = typical Spanish-speaker mistakes (never differing only by a contraction), Fluent icons only when one fits and exists, tags in id format, Q&A voices rotate over the four pack voices. Content tasks do not run `npm run audio`/`npm run images` (T129 does).
- **Cloud.** Content and code tasks run in the cloud (`Where: any`); T129 needs the Mac (edge-tts over the internet, iPhone check). ≤ 2 agents at a time; relay to a fresh session after ~6 integrated tasks.
- Verification: `npm run verify` → exit 0 for every task. UI changes: the writer queues a Visual line for the PC.

## Tasks

## T111 — English B2/C1 foundation and generic polish
- Status: done
- Depends on: none
- Where: any
- Goal: (1) `content/en/pack.json`: levels A2–C1 and the two new situations (Shared contract, "Pack"). (2) `content:check` story word range per CEFR level, generic in build.ts: A1–B1 80–150 (unchanged, so it/fr/en stories keep passing), B2 100–200, C1 120–250. (3) Prepárate's register badge (`src/components/coach/PackView.tsx`, `PackPractice.tsx`) uses the same rule as DialogueSimulator: "Registro formal"/"Registro informal" when the active pack's `formalRegister` is `formal`, today's "Trato de usted"/"Trato de tú" otherwise. (4) Copy that assumes a trip: Ruta subtitle (`src/app/page.tsx`) and Onboarding (`src/components/path/Onboarding.tsx`) say "situaciones del viaje" for every pack → generic wording ("Lecciones cortas, de unos 5 minutos, por situaciones."; Hernán's default, 2026-10-07). (5) docs/content-guide.md documents levelled packs: `level` fields, side units `order % 100 >= 90`, story files `<level>-NN-<slug>.json`, the per-level word ranges, grammar cards in the grammar unit, and points to brief-en.
- Context: `src/lib/content/build.ts` (story word range), `DialogueSimulator.tsx` (register label rule from plan 008 T90), `src/lib/content/level.ts`, plan 008 Outcome lines and Proposals.
- Scope: may touch `content/en/pack.json`, `src/lib/content/**`, `src/components/coach/**`, `src/app/page.tsx`, `src/components/path/Onboarding.tsx`, docs/content-guide.md / must not touch other `content/**`, `public/**`, `api/**`, `supabase/**`, `docs/brief*.md`, `plans/`
- Done when:
  - `npm run content:check` → ✓ for it, fr, en; `git diff --stat content/it content/fr` empty; English Ruta with B2 selected shows the empty-level message.
  - `grep -rn 'situaciones del viaje' src` → nothing.
  - `npm run verify` → exit 0
  - Hand check (PC): level chips with four levels; Prepárate badge in English and Italian; Ruta subtitle; light + dark 375 px.
- Outcome: pack levels A2–C1 + opiniones/cultura, per-level story words, registerBadge, generic Ruta/Onboarding copy, content-guide levelled packs · b45105e · verify ✓ ☁️ · not checked: level chips, Prepárate badge en/it, copy, themes 375 px

## T112 — English B2: meetings, opinions and B2 grammar
- Status: done
- Depends on: T111
- Where: any
- Goal: Units `b2-meetings` (210), `b2-opinions` (212) and `b2-grammar` (290) with the 10 B2 grammar cards in its `grammar` array, per docs/brief-en.md: `level: "B2"`, phrases ≤ 18 words, every lesson ending with its Q&A, explanations for a Spanish speaker.
- Context: docs/brief-en.md; docs/content-guide.md; the B1 units (`content/en/units/1[1-9]*.json`) as models and for reuse by id
- Scope: may touch `content/en/units/210-*.json`, `content/en/units/212-*.json`, `content/en/units/290-*.json` (grammar cards in the grammar unit's `grammar` array) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~60 vocab, ~16 Q&A, ~10 grammar cards, 10–12 lessons, `level: "B2"`.
  - `npm run verify` → exit 0
- Outcome: b2-meetings/opinions/grammar: 88 phrases, 59 vocab, 18 Q&A, 10 grammar, 12 lessons · eaac50e · verify ✓ ☁️ · not checked: audio/images (T129)

## T113 — English B2: tech talk, projects
- Status: done
- Depends on: T111, T112
- Where: any
- Goal: Units `b2-tech-talk` (220) and `b2-projects` (222) (architecture, trade-offs, code review; deadlines, risks, priorities, feedback), per docs/brief-en.md: `level: "B2"`, phrases ≤ 18 words, every lesson ending with its Q&A, explanations for a Spanish speaker.
- Context: docs/brief-en.md; docs/content-guide.md; the B1 units (`content/en/units/1[1-9]*.json`) as models and for reuse by id; the B2 grammar unit from T112
- Scope: may touch `content/en/units/220-*.json`, `content/en/units/222-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "B2"`.
  - `npm run verify` → exit 0
- Outcome: b2-tech-talk/projects: 88 phrases, 70 vocab, 16 Q&A, 10 lessons · 2040b43 · verify ✓ 💻 · not checked: audio/images (T129), wording by eye

## T114 — English B2: news, wellbeing
- Status: done
- Depends on: T111, T112
- Where: any
- Goal: Units `b2-news` (230) and `b2-wellbeing` (232), per docs/brief-en.md: `level: "B2"`, phrases ≤ 18 words, every lesson ending with its Q&A, explanations for a Spanish speaker.
- Context: docs/brief-en.md; docs/content-guide.md; the B1 units (`content/en/units/1[1-9]*.json`) as models and for reuse by id; the B2 grammar unit from T112
- Scope: may touch `content/en/units/230-*.json`, `content/en/units/232-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "B2"`.
  - `npm run verify` → exit 0
- Outcome: b2-news/wellbeing: 92 phrases, 70 vocab, 19 Q&A, 10 lessons · 8dd8cae · verify ✓ 💻 · not checked: audio/images (T129), wording by eye

## T115 — English B2: independent travel, paperwork
- Status: done
- Depends on: T111, T112
- Where: any
- Goal: Units `b2-travel` (240) and `b2-paperwork` (242) (planning, car rental, the unexpected; insurance, contracts, formal complaints), per docs/brief-en.md: `level: "B2"`, phrases ≤ 18 words, every lesson ending with its Q&A, explanations for a Spanish speaker.
- Context: docs/brief-en.md; docs/content-guide.md; the B1 units (`content/en/units/1[1-9]*.json`) as models and for reuse by id; the B2 grammar unit from T112
- Scope: may touch `content/en/units/240-*.json`, `content/en/units/242-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "B2"`.
  - `npm run verify` → exit 0
- Outcome: b2-travel/paperwork: 87 phrases, 63 vocab, 16 Q&A, 10 lessons · 6a29c92 · verify ✓ 💻 · not checked: audio/images (T129), wording by eye

## T116 — English B2: relationships, culture
- Status: done
- Depends on: T111, T112
- Where: any
- Goal: Units `b2-relationships` (250) and `b2-culture` (252), per docs/brief-en.md: `level: "B2"`, phrases ≤ 18 words, every lesson ending with its Q&A, explanations for a Spanish speaker.
- Context: docs/brief-en.md; docs/content-guide.md; the B1 units (`content/en/units/1[1-9]*.json`) as models and for reuse by id; the B2 grammar unit from T112
- Scope: may touch `content/en/units/250-*.json`, `content/en/units/252-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "B2"`.
  - `npm run verify` → exit 0
- Outcome: b2-relationships/culture: 89 phrases, 67 vocab, 16 Q&A, 10 lessons · 7eb3c50 · verify ✓ 💻 · not checked: audio/images (T129), wording by eye

## T117 — English B2: 12 dialogues
- Status: done
- Depends on: T112, T113, T114, T115, T116
- Where: any
- Goal: The 12 B2 dialogues listed in docs/brief-en.md (`level: "B2"`, `unit`, one native speaker with a Spanish role name, Fluent avatar and an en-US voice, register-honest options with Spanish feedback), order 201–212.
- Context: docs/brief-en.md; the B2 units; `content/en/dialogues/b1-*.json` as models.
- Scope: may touch `content/en/dialogues/b2-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; 12 B2 dialogues (6–10 turns, ≥ 3 learner turns, 3 options each).
  - `npm run verify` → exit 0
  - Hand check (PC): play two B2 dialogues with device voices.
- Outcome: 12 B2 dialogues (201–212, 9 turns, 4 learner turns × 3 options; 7 formal, 3 tu, 2 neutral) · 55efa70 · verify ✓ 💻 · not checked: play two with device voices, audio (T129)

## T118 — English B2: stories 1–6
- Status: done
- Depends on: T112, T113, T114, T115, T116
- Where: any
- Goal: B2 stories 1–6 (order 201–206, `level: "B2"`) with the Chicago cast, following the arc in docs/brief-en.md; key words reuse unit items by id; end the final message with an outline of stories 7–12 for T119.
- Context: docs/brief-en.md; the B2 units; the latest stories (`content/en/stories/b1-*.json`) for cast, voices and continuity.
- Scope: may touch `content/en/stories/b2-0[1-6]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings (100–200 words after T111).
  - `npm run verify` → exit 0
- Outcome: B2 stories 1–6 (201–206, 15–16 sentences, key words reuse B2 items) · 5f44b8a · verify ✓ 💻 · not checked: audio + memoir picture (T129), reading in app

## T119 — English B2: stories 7–12
- Status: done
- Depends on: T118
- Where: any
- Goal: B2 stories 7–12 (order 207–212) following T118's outline (in Decisions).
- Context: as T118, plus `content/en/stories/b2-0[1-6]-*.json`.
- Scope: may touch `content/en/stories/b2-0[7-9]-*.json`, `content/en/stories/b2-1[0-2]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings.
  - `npm run verify` → exit 0
- Outcome: B2 stories 7–12 (207–212) per T118 outline · 38e56f8 · verify ✓ 💻 · not checked: audio + tour picture (T129), reading in app

## T120 — English C1: negotiation, presenting and C1 grammar
- Status: done
- Depends on: T111
- Where: any
- Goal: Units `c1-negotiation` (310), `c1-presenting` (312) and `c1-grammar` (390) with the 10 C1 grammar cards in its `grammar` array, per docs/brief-en.md: `level: "C1"`, phrases ≤ 22 words, every lesson ending with its Q&A, explanations for a Spanish speaker.
- Context: docs/brief-en.md; docs/content-guide.md; the B1 units (`content/en/units/1[1-9]*.json`) as models and for reuse by id
- Scope: may touch `content/en/units/310-*.json`, `content/en/units/312-*.json`, `content/en/units/390-*.json` (grammar cards in the grammar unit's `grammar` array) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~60 vocab, ~16 Q&A, ~10 grammar cards, 10–12 lessons, `level: "C1"`.
  - `npm run verify` → exit 0
- Outcome: c1-negotiation/presenting/grammar: 88 phrases, 59 vocab, 19 Q&A, 10 grammar, 12 lessons · f73954b · verify ✓ 💻 · not checked: audio/images (T129), wording by eye

## T121 — English C1: leading, tech decisions
- Status: done
- Depends on: T111, T120
- Where: any
- Goal: Units `c1-leading` (320) and `c1-tech-decisions` (322) (difficult feedback, 1:1s, delegating; incidents, postmortems, persuading the team), per docs/brief-en.md: `level: "C1"`, phrases ≤ 22 words, every lesson ending with its Q&A, explanations for a Spanish speaker.
- Context: docs/brief-en.md; docs/content-guide.md; the B1 units (`content/en/units/1[1-9]*.json`) as models and for reuse by id; the C1 grammar unit from T120
- Scope: may touch `content/en/units/320-*.json`, `content/en/units/322-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "C1"`.
  - `npm run verify` → exit 0
- Outcome: c1-leading/tech-decisions: 86 phrases, 66 vocab, 20 Q&A, 10 lessons · 478ccbf · verify ✓ 💻 · not checked: audio/images (T129), wording by eye

## T122 — English C1: nuance, idioms
- Status: done
- Depends on: T111, T120
- Where: any
- Goal: Units `c1-nuance` (330) and `c1-idioms` (332) (hedging, irony, indirect politeness; advanced idioms and phrasal verbs, each explained in `notes`), per docs/brief-en.md: `level: "C1"`, phrases ≤ 22 words, every lesson ending with its Q&A, explanations for a Spanish speaker.
- Context: docs/brief-en.md; docs/content-guide.md; the B1 units (`content/en/units/1[1-9]*.json`) as models and for reuse by id; the C1 grammar unit from T120
- Scope: may touch `content/en/units/330-*.json`, `content/en/units/332-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~70 vocab, ~16 Q&A, 9–11 lessons, `level: "C1"`.
  - `npm run verify` → exit 0
- Outcome: c1-nuance/idioms: 89 phrases, 69 vocab, 17 Q&A, 10 lessons · 2b11f14 · verify ✓ 💻 · not checked: audio/images (T129), wording by eye

## T123 — English C1: networking, complex problems
- Status: done
- Depends on: T111, T120
- Where: any
- Goal: Units `c1-networking` (340) and `c1-problems` (342), per docs/brief-en.md: `level: "C1"`, phrases ≤ 22 words, every lesson ending with its Q&A, explanations for a Spanish speaker.
- Context: docs/brief-en.md; docs/content-guide.md; the B1 units (`content/en/units/1[1-9]*.json`) as models and for reuse by id; the C1 grammar unit from T120
- Scope: may touch `content/en/units/340-*.json`, `content/en/units/342-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "C1"`.
  - `npm run verify` → exit 0
- Outcome: c1-networking/problems: 92 phrases, 63 vocab, 16 Q&A, 10 lessons · 4c95f94 · verify ✓ 💻 · not checked: audio (T129), wording by eye

## T124 — English C1: society debates, storytelling
- Status: done
- Depends on: T111, T120
- Where: any
- Goal: Units `c1-society` (350) and `c1-storytelling` (352), per docs/brief-en.md: `level: "C1"`, phrases ≤ 22 words, every lesson ending with its Q&A, explanations for a Spanish speaker.
- Context: docs/brief-en.md; docs/content-guide.md; the B1 units (`content/en/units/1[1-9]*.json`) as models and for reuse by id; the C1 grammar unit from T120
- Scope: may touch `content/en/units/350-*.json`, `content/en/units/352-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "C1"`.
  - `npm run verify` → exit 0
- Outcome: c1-society/storytelling: 89 phrases, 66 vocab, 16 Q&A, 10 lessons · 5137464 · verify ✓ 💻 · not checked: audio/images (T129), wording by eye

## T125 — English C1: 12 dialogues
- Status: done
- Depends on: T120, T121, T122, T123, T124
- Where: any
- Goal: The 12 C1 dialogues listed in docs/brief-en.md (`level: "C1"`, `unit`, one native speaker with a Spanish role name, Fluent avatar and an en-US voice, register-honest options with Spanish feedback), order 301–312.
- Context: docs/brief-en.md; the C1 units; `content/en/dialogues/b1-*.json` as models.
- Scope: may touch `content/en/dialogues/c1-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; 12 C1 dialogues (6–10 turns, ≥ 3 learner turns, 3 options each).
  - `npm run verify` → exit 0
  - Hand check (PC): play two C1 dialogues with device voices.
- Outcome: 12 C1 dialogues (301–312, 7–9 turns, 3–4 learner turns × 3 options) · 60de43a · verify ✓ 💻 · not checked: play two with device voices, avatars woman-artist/man-raising-hand/man-student/man-cook + audio (T129)

## T126 — English C1: stories 1–6
- Status: done
- Depends on: T120, T121, T122, T123, T124, T119
- Where: any
- Goal: C1 stories 1–6 (order 301–306, `level: "C1"`) with the Chicago cast, following the arc in docs/brief-en.md; key words reuse unit items by id; end the final message with an outline of stories 7–12 for T127.
- Context: docs/brief-en.md; the C1 units; the latest stories (`content/en/stories/b2-*.json`) for cast, voices and continuity.
- Scope: may touch `content/en/stories/c1-0[1-6]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings (120–250 words after T111).
  - `npm run verify` → exit 0
- Outcome: C1 stories 1–6 (301–306), continue from B2 story 12 · 9f21e06 · verify ✓ 💻 · not checked: audio (T129), reading in app

## T127 — English C1: stories 7–12
- Status: pending
- Depends on: T126
- Where: any
- Goal: C1 stories 7–12 (order 307–312) following T126's outline (in Decisions).
- Context: as T126, plus `content/en/stories/c1-0[1-6]-*.json`.
- Scope: may touch `content/en/stories/c1-0[7-9]-*.json`, `content/en/stories/c1-1[0-2]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings.
  - `npm run verify` → exit 0
- Outcome:

## T128 — English placement test for four levels
- Status: pending
- Depends on: T112, T113, T114, T115, T116, T120, T121, T122, T123, T124
- Where: any
- Goal: Rewrite `content/en/extras/placement.json` with 16 graded questions, 4 per level (A2, B1, B2, C1; easy → hard), covering every non-grammar unit of each level and marking the lessons each proves, so `suggestLevel` (≥ 2/3 of a level and every lower level passed) suggests the right level. Keep the best existing A2/B1 questions by id where they fit.
- Context: plan 008 T108 Outcome; `src/lib/content/level.ts` (`suggestLevel`); docs/content-guide.md (Placement).
- Scope: may touch `content/en/extras/placement.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`
- Done when:
  - `npm run content:check` → ✓; 16 questions, 4 per level, every non-grammar unit covered.
  - A scratch script (not committed) with the real pack: all right → C1; A2+B1 right only → B1; A2 only → A2.
  - `npm run verify` → exit 0
  - Hand check (PC): English placement suggests the expected level.
- Outcome:

## T129 — English B2/C1 audio and pictures, final offline check
- Status: pending
- Depends on: T117, T119, T125, T127, T128
- Where: pc (edge-tts needs the Mac's internet; on-device check)
- Goal: Generate en-US neural mp3 for every new English playable and the new pictures, commit them, and prove B2/C1 work offline with only English audio cached.
- Context: CLAUDE.md commands (`npm run audio`, `npm run images`, strict checks); plan 008 T109 Outcome.
- Scope: may touch `public/audio/en/**` (adds only), `public/images/**`, `content/en/**` B2/C1 files only for picture keys or text fixes the audio run reveals / must not touch `public/audio/it/**`, `public/audio/fr/**`, existing en mp3, `src/**`, `plans/`
- Done when:
  - `npm run audio && npm run images` → exit 0; `git diff --stat public/audio/it public/audio/fr` empty; no existing `public/audio/en/*.mp3` modified or deleted.
  - `npm run content:check -- --strict-audio --strict-images` → exit 0.
  - `npm run verify` → exit 0
  - Hand check (PC): installed PWA, English, airplane mode: a B2 lesson, a C1 dialogue and a C1 story play neural audio.
- Outcome:

## Review queue
- [ ] T111 @b45105e — code review (queued 2026-10-07 ☁️)
- [ ] T112 @eaac50e — content review (queued 2026-10-07 ☁️)
- [ ] T114 @8dd8cae — content review (queued 2026-10-07 💻)
- [ ] T113 @2040b43 — content review (queued 2026-10-07 💻)
- [ ] T116 @7eb3c50 — content review (queued 2026-10-07 💻)
- [ ] T115 @6a29c92 — content review (queued 2026-10-07 💻)
- [ ] T117 @55efa70 — content review (queued 2026-10-07 💻)
- [ ] T120 @f73954b — content review (queued 2026-10-07 💻)
- [ ] T118 @5f44b8a — content review (queued 2026-10-07 💻)
- [ ] T121 @478ccbf — content review (queued 2026-10-07 💻)
- [ ] T119 @38e56f8 — content review (queued 2026-10-07 💻)
- [ ] T122 @2b11f14 — content review (queued 2026-10-07 💻)
- [ ] T123 @4c95f94 — content review (note: second 'timeline' vocab entry, complaint sense, vs b2-meetings schedule sense) (queued 2026-10-07 💻)
- [ ] T124 @5137464 — content review (note: c1-storytelling.make-up 'inventarse' vs b2-relationships.make-up 'hacer las paces', kept separate) (queued 2026-10-07 💻)
- [ ] T125 @60de43a — content review (queued 2026-10-07 💻)
- [ ] T126 @9f21e06 — content review (queued 2026-10-07 💻)

## Visual checks queue
- [ ] T111 @b45105e — four level chips + B2 empty-level message, Prepárate register badge (en formal / it usted), Ruta subtitle + Onboarding copy; light + dark 375 px (queued 2026-10-07 ☁️)
- [ ] T117 @55efa70 — play two B2 dialogues with device voices (queued 2026-10-07 💻)
- [ ] T125 @60de43a — play two C1 dialogues with device voices (queued 2026-10-07 💻)

## Decisions
- 2026-10-07 plan: B2 and C1 complete the English pack with the full French-sized volume per level and the plan 008 molds; units, grammar, dialogues and stories in docs/brief-en.md (B2/C1 sections added 2026-10-07). (Hernán: "plan b2 c1", same structure)
- 2026-10-07 plan: two new situations `opiniones` and `cultura`; phrase length ≤ 18 words at B2, ≤ 22 at C1; story length per CEFR level (B2 100–200, C1 120–250 words), generic in content:check. (orchestrator default)
- 2026-10-07 plan: placement rewritten for four levels, 4 questions each (16 total). (orchestrator default)
- 2026-10-07 plan: generic copy instead of "situaciones del viaje" (Ruta subtitle, Onboarding) and Prepárate register badge "Registro formal/informal" for packs with `formalRegister: "formal"` (plan 008 Proposals). (orchestrator default, Hernán to confirm)
- 2026-10-07 plan: runs in a cloud session (hybrid skill); T129 on the Mac. Base branch `plan-009-ingles-b2-c1` from main @ 1455082; guarded push of the plan branch only; no merge to main or deploy without Hernán's OK. (Hernán)
- 2026-10-07 T119 outline (from T118): 07 viajes — Jordan's band Midwest tour, Pablo plans a road trip to join (b2-travel) · 08 viajes/dinero — rental car breaks down near Wisconsin, band still plays (b2-travel, b2-paperwork) · 09 dinero — formal insurance claim, arguing with the call centre (b2-paperwork) · 10 social — a text taken the wrong way, Jordan feels left out, they make up (b2-relationships) · 11 salud — Mrs. Carter's health scare while finishing her book; doctor, stress, habits (b2-wellbeing) · 12 opiniones — dinner about Mrs. Carter's reading in local news, Pablo looks back on the year, sets up the C1 acquisition rumour (b2-news, b2-grammar wish/third conditional). Voices: Ava narrator, Pablo Andrew, Jordan/Sam Brian, Maya/Mrs. Carter/Priya Emma.
- 2026-10-07 B2 story 12 leaves the cast (for T126): Mrs. Carter's bookstore reading in the local paper, her book about to come out; Maya shares an unconfirmed rumour that a big tech company wants to buy the startup; Pablo has mixed feelings, wishes he had more time in Chicago; Jordan's band back from its Midwest tour.
- 2026-10-07 T127 outline (from T126): 07 trabajo — Maya's hard call: blunt feedback / performance plan for Sam after the acquisition · 08 cultura — Jordan's record deal: clause, deal-breaker, Maya helps negotiate, cold feet · 09 dinero — Pablo's US work-permit renewal red tape, formal complaint, pushes him to decide · 10 opiniones — dinner-party debate (remote work, AI, Chicago rents), Pablo devil's advocate on moving back to Spain · 11 cultura — Mrs. Carter's book launch, anecdote about the four, a chapter about Pablo · 12 social — rooftop farewell: Pablo takes Laura's Valencia offer and stays connected with the startup (default ending; brief leaves it open), hindsight. Cast so far: Greg (HR), Rachel (CEO), Laura (Valencia fintech); extra women = Emma, men = Brian/Andrew as in B2.

## Proposals (new scope)
- 2026-10-07 T111: content-guide story/unit-range parts still describe the Italian trip ("Trip order", "A1–A2 Italian")

## Log
- 2026-10-07 💻 plan drafted from plan 008's molds and Hernán's request; starts in the cloud
- 2026-10-07 07:53Z ☁️ resume on ☁️ session_01TRpJSE1mnE3mnYdfYQTXo5 · seven-day rate-limit warning → 1 agent
- 2026-10-07 07:54Z ☁️ T111 launched · attempt 1 · agent a31cc210f51247cf5
- 2026-10-07 07:59Z ☁️ T111 done · worktree-agent-a31cc210f51247cf5 → b45105e · verify ✓
- 2026-10-07 07:59Z ☁️ T112 launched · attempt 1 · agent a49235f2b326166fc
- 2026-10-07 08:10Z ☁️ T112 done · worktree-agent-a49235f2b326166fc → eaac50e · verify ✓
- 2026-10-07 08:11Z ☁️ handoff ☁️ → ☁️ (relay, >5M cache-read) · plan-009-ingles-b2-c1 @ eaac50e
- 2026-10-07 11:44Z ☁️ resume on ☁️ session_011Ty23Vt9nLP3RjeDwVppCy · writer taken (was released)
- 2026-10-07 11:44Z ☁️ T113 launched · attempt 1 · agent a0e62ce07be57b2e1
- 2026-10-07 11:48Z 💻 writer taken over from session_011Ty23Vt9nLP3RjeDwVppCy by Hernán's choice · T113 attempt 1 orphaned (cloud agent unreachable) → pending
- 2026-10-07 11:48Z 💻 T113 launched · attempt 2 · agent a176265d9f321e1f8
- 2026-10-07 11:48Z 💻 T114 launched · attempt 1 · agent af7ea21a6dae32bc8
- 2026-10-07 21:29Z 💻 T113 attempt 2 stalled (stream watchdog, no commits) · relaunched · attempt 3 · agent a67cae1912ecd9cb9
- 2026-10-07 21:29Z 💻 T114 attempt 1 stalled (stream watchdog, no commits) · relaunched · attempt 2 · agent aead2af6b3d053a8e
- 2026-10-07 21:39Z 💻 T114 done · worktree-agent-aead2af6b3d053a8e → 8dd8cae · verify ✓
- 2026-10-07 21:39Z 💻 T113 done · worktree-agent-a67cae1912ecd9cb9 → 2040b43 · verify ✓
- 2026-10-07 21:39Z 💻 T115 launched · attempt 1 · agent a2877f122eec5dbe6
- 2026-10-07 21:39Z 💻 T116 launched · attempt 1 · agent af3a48e958b4a6b7d
- 2026-10-07 21:48Z 💻 T116 done · worktree-agent-af3a48e958b4a6b7d → 7eb3c50 · verify ✓
- 2026-10-07 21:48Z 💻 T120 launched · attempt 1 · agent a093dd1264c1aa5ed
- 2026-10-07 21:49Z 💻 T115 done · worktree-agent-a2877f122eec5dbe6 → 6a29c92 · verify ✓
- 2026-10-07 21:49Z 💻 T117 launched · attempt 1 · agent a938a7ec4e3724faa
- 2026-10-07 21:56Z 💻 T117 done · worktree-agent-a938a7ec4e3724faa → 55efa70 · verify ✓
- 2026-10-07 21:56Z 💻 T118 launched · attempt 1 · agent ae7f64c74ac840123
- 2026-10-07 22:00Z 💻 T120 done · worktree-agent-a093dd1264c1aa5ed → f73954b · verify ✓
- 2026-10-07 22:00Z 💻 T121 launched · attempt 1 · agent ad2efc66ff7fd045c
- 2026-10-07 22:03Z 💻 T118 done · worktree-agent-ae7f64c74ac840123 → 5f44b8a · verify ✓
- 2026-10-07 22:04Z 💻 T119 launched · attempt 1 · agent a504eb9fe3fcbf7b3
- 2026-10-07 22:10Z 💻 T121 done · worktree-agent-ad2efc66ff7fd045c → 478ccbf · verify ✓
- 2026-10-07 22:10Z 💻 T122 launched · attempt 1 · agent ae73dcc4ba6a5f6ec
- 2026-10-07 22:11Z 💻 T119 done · worktree-agent-a504eb9fe3fcbf7b3 → 38e56f8 · verify ✓
- 2026-10-07 22:12Z 💻 T123 launched · attempt 1 · agent a014857546e18c137
- 2026-10-07 22:21Z 💻 T122 done · worktree-agent-ae73dcc4ba6a5f6ec → 2b11f14 · verify ✓
- 2026-10-07 22:21Z 💻 T124 launched · attempt 1 · agent a1005de88ee4b83f0
- 2026-10-07 22:22Z 💻 T123 done · worktree-agent-a014857546e18c137 → 4c95f94 · verify ✓
- 2026-10-07 22:32Z 💻 T124 done · worktree-agent-a1005de88ee4b83f0 → 5137464 · verify ✓
- 2026-10-07 22:33Z 💻 T125 launched · attempt 1 · agent a66884cf1615c93da
- 2026-10-07 22:33Z 💻 T126 launched · attempt 1 · agent a371e626f987dedd8
- 2026-10-07 22:40Z 💻 T125 done · worktree-agent-a66884cf1615c93da → 60de43a · verify ✓
- 2026-10-07 22:40Z 💻 T126 done · worktree-agent-a371e626f987dedd8 → 9f21e06 · verify ✓
