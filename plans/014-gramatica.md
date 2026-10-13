# Plan 014 — Gramática: a grammar reference to read, linked to the exercises

Status: active
Created: 2026-10-12
Base branch: plan-014-gramatica
Goal: Add **Gramática** (`/gramatica/`, nested under the Frases tab): a grid of 12 Italian "verbos rey" with full conjugations (presente, passato prossimo, condizionale, imperativo; gloss and audio per form, irregular forms highlighted, one example per tense) and a list of topics (tú/Lei, «vorrei», articles, prepositions, pronouns). A "Leído" button counts reads per entry (small daily-capped XP); read entries enter spaced repetition and show up as fill-the-gap drills in Repaso and lessons. Generic code and content format (any pack), Italian content only. MVP speed: no automated tests; verification is `npm run verify`.
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-13 15:04Z 💻
- Writer: released 11:47Z by 💻 → continue on 💻
- Branch: main (plan-014-gramatica merged)
- Next step: T184 + T185 running; Gemini Italian audio running in Hernán's terminal (uncommitted public/audio/it)
- Needs Hernán: visual queue (5) · T173 doubts (una amica…, l'accompagno) · push main with the audio?

## Shared contract (all tasks read this)

- Read first: CLAUDE.md (and AGENTS.md: this Next.js differs, read `node_modules/next/dist/docs/` before writing routes), **docs/grammar.md** (the feature: UX, storage, XP, exercises), **docs/content-guide.md "Grammar reference"** (format, ids, audio keys, checks). docs/brief.md only for content tasks.
- **Names every task uses** (T163 creates the content ones, T164 the storage ones; later tasks import, never redefine):
  - `@/lib/content`: types `Verb`, `VerbTense`, `VerbForm` (a `Playable`), `GrammarDrill` (a `Playable`: full sentence), `GrammarTenseDef` (pack `grammar.tenses` entry); `listVerbs(pack)` (by `order`), `getVerb(id, pack)`, `listGrammarTopics(pack, level?)` (cards by `order` then pack order, minus cards with `verb`), `getGrammarEntry(id, pack)` → `{ kind: "verb", verb } | { kind: "topic", card } | undefined`, `findGrammarPack(id)`, `isDrillable(id, pack)` (verb, or card with `drills`). Grammar cards gain `order?`, `verb?`, `drills?`.
  - `@/lib/grammar` (new, framework-free): `getGrammarReads(lang)`, `markGrammarRead(lang, id, now?)` → `{ count, xp }`, `subscribeGrammarReads`, `clearGrammarReads(lang)`, `parseGrammarReads(raw)`; constants `GRAMMAR_READ_XP = 3`, `GRAMMAR_DAILY_XP_CAP = 15`; hook `useGrammarReads(lang)` in `@/lib/grammar/use-grammar-reads`. XP source `"grammar"` (add to `XpSource`; Liga accepts any `^[a-z][a-z_-]{0,19}$`, no migration).
  - `@/lib/exercises`: `grammarDrills(id, pack, gloss, rng, count)` → `FillGapExercise[]` with `itemIds: [id]` (T167).
- **Storage**: one new key `lang-lern:grammar:<lang>` (shape in docs/grammar.md), versioned, tolerant parsing like `src/lib/stories/done.ts`. No other stored key renamed or reshaped (`progress.srs` entries keep their shape; grammar ids are just new keys in it). Never `localStorage.clear()`.
- **UI**: learning-screen strings through learn copy (`src/lib/i18n/learn-copy.ts`, so the Russian-gloss `es` pack reads well); headings from `navigation.ts`; Spain Spanish with "tú"; design tokens only, both themes; audio only via `speak()` from a tap; pictures not needed. Static export, works offline (new routes are precached automatically).
- **Generic code**: nothing in `src/` names Italian, a verb or a tense; tenses and persons come from pack.json `grammar`.
- **Tokens (Hernán, 2026-10-12)**: no screenshots, browser previews or visual checks by agents, no code-review passes. Hand checks are the last Done-when bullet and go to the Visual queue for Hernán. Agents read files by line ranges, reply in ≤15 lines.
- Verification: `npm run verify` → exit 0 for every task. One-off check scripts go to the scratchpad or `/tmp`, never committed.

## Tasks

## T163 — Content model for the grammar reference + verb.essere
- Status: done
- Depends on: none
- Where: any
- Goal: Implement the format of docs/content-guide.md "Grammar reference": pack.json `grammar` tenses, `verbs/*.json`, card `order`/`verb`/`drills`, loader functions and types from the contract, audio keys in `listPlayables`, and the `content:check` rules. Prove it with the Italian tenses and one complete verb, `verb.essere`.
- Context: docs/content-guide.md "Grammar reference"; `src/lib/content/schema.ts`, `types.ts`, `index.ts` (`listPlayables` ~L193, `findStoryPack` as the model for `findGrammarPack`), `keys.ts` (`audioKey`), `scripts/content.ts`; `content/it/extras/gramatica.json` (`gram.essere` table and examples as a starting point).
- Scope: may touch `src/lib/content/**`, `scripts/content.ts`, `content/it/pack.json` (only the `grammar` block), `content/it/verbs/essere.json` (new), `content/it/extras/gramatica.json` (only `"verb": "verb.essere"` on `gram.essere`), docs/content-guide.md (only if the format must deviate; say why) / must not touch UI, `src/lib/progress/`, other packs, `public/`.
- Done when:
  - `npm run content:check` → ✓, reports 1 verb for `it`; temporary broken copies (wrong form count, unknown tense, drill without `___`, answer among distractors, `verb` to a missing id) each fail with a clear message (reverted after).
  - A one-off `npx tsx` script: `listPlayables(getPack("it"))` holds `verb.essere` ("essere"), `verb.essere--presente--1` ("io sono"), `verb.essere--imperativo--1` (form only, no pronoun) and `verb.essere--presente--e`.
  - `npm run verify` → exit 0.
- Outcome: schema/types/loader (src/lib/content/grammar.ts: grammarPlayables, listVerbs, getVerb, listGrammarTopics, getGrammarEntry, findGrammarPack, isDrillable, getGrammarTenses), content:check rules, it pack.json tenses, verb.essere; audio plan uses grammarPlayables · 37855e6a · verify ✓ 💻 · not checked: --strict-audio fails for it until T174

## T164 — Read counts and XP for "Leído"
- Status: done
- Depends on: none
- Where: any
- Goal: Create `src/lib/grammar/` (contract names): the versioned `lang-lern:grammar:<lang>` store, `markGrammarRead` (+1 read; 3 XP for the first read of an id per day, at most 15 XP a day, through `recordReviewResult(…, "grammar")` with no items so streak, activity log and Liga work as for any XP), the hook, and clearing on "Borrar progreso".
- Context: docs/grammar.md "Leído"; `src/lib/stories/done.ts` (store pattern); `src/lib/progress/index.ts` (`XpSource` ~L184, `recordReviewResult` ~L312, `resetProgress` ~L342); `src/lib/backup/index.ts` `isBackupKey` (confirm the key is included; change nothing there).
- Scope: may touch `src/lib/grammar/**` (new), `src/lib/progress/index.ts` (`XpSource` + clear on reset only), CLAUDE.md (one folder-layout line) / must not touch content, UI, other stored keys.
- Done when:
  - One-off `npx tsx` script with a fake localStorage: first read of an id → xp 3; second read same day → count 2, xp 0; six different ids in a day → 15 XP total; next day → 3 again; `parseGrammarReads` of garbage, `{}`, a future `v`, an entry with a bad count → never throws, keeps the valid entries.
  - `npm run verify` → exit 0.
- Outcome: src/lib/grammar/ (reads.ts store v1, markGrammarRead 3 XP/day/id cap 15 via recordReviewResult 'grammar', hook), cleared by resetProgress · 7de37571 · verify ✓ 💻 · not checked: none (no UI)

## T165 — Gramática pages (index, verb page, topic page)
- Status: done
- Depends on: T163
- Where: any
- Goal: Nested section `grammar` (parent `phrasebook`) in `navigation.ts`; `/gramatica/` (Verbos grid + Temas list of the active language) and `/gramatica/[id]/` for every pack's verbs and topics (static params, owner via `findGrammarPack`), as described in docs/grammar.md. No "Leído" button and no entry points yet (T166).
- Context: docs/grammar.md "Where", "Index", "Verb page", "Topic page"; `src/lib/navigation.ts`; `src/app/historias/[id]/page.tsx` (static params + owner pack + active language); `src/components/exercises/GrammarTip.tsx` (extract its card body into a shared component for the topic page, keep the lesson tip identical); `MiniPlay` in `src/components/exercises/shared`; `useActiveLang`; learn copy.
- Scope: may touch `src/app/gramatica/**`, `src/components/grammar/**` (new), `src/lib/navigation.ts`, `src/components/exercises/GrammarTip.tsx` (extraction only), `src/lib/i18n/learn-copy.ts`, CLAUDE.md (folder-layout line) / must not touch `src/lib/progress/`, `src/lib/grammar/`, Frasario, Ruta, content.
- Done when:
  - `npm run build` writes `out/gramatica/index.html`, `out/gramatica/verb.essere/index.html` and a page for one Italian grammar card.
  - `npm run verify` → exit 0.
  - Hand check (PC): iPhone, light and dark: grid tiles, tense chips, row tap plays "io sono", irregular colour, example audio, topic page.
- Outcome: nested section grammar (parent phrasebook), /gramatica/ index + /gramatica/<id>/ for every visible pack (94 pages), tense chips, rows with normal + slow audio, irregular in terracotta, shared GrammarCardBody · 1860167a · verify ✓ 💻 · not checked: visual (queued)

## T166 — "Leído" button, read badges and entry points
- Status: done
- Depends on: T164, T165
- Where: any
- Goal: The "Leído" button at the end of verb and topic pages (count, disabled until the page is left, XP feedback as elsewhere), "×n" badges on tiles and topics, the "Gramática" button at the top of the Frasario, and a section card on the Ruta replacing the "Fichas de gramática" sheet (expressions keep theirs). Entry points hidden for a pack with no verbs and no topics.
- Context: docs/grammar.md "Leído", "Where"; `src/components/path/PathView.tsx` (grammar sheet ~L141–173, `SectionCard` ~L199); `src/components/phrasebook/Phrasebook.tsx`, `SearchHeader.tsx`; how other screens show XP (`subscribeXpAwards` users).
- Scope: may touch `src/components/grammar/**`, `src/app/gramatica/**`, `src/components/path/PathView.tsx`, `src/components/phrasebook/**`, learn copy / must not touch `src/lib/grammar/` (use its API), content.
- Done when:
  - `npm run verify` → exit 0.
  - Hand check (PC): iPhone: tap Leído → ×1 and XP once; again after leaving → ×2, no XP; Frasario button and Ruta card open /gramatica/; light and dark.
- Outcome: ReadButton (Leído · ×n, disabled until leaving, '+3 XP' toast via XpToast TOASTED grammar), ×n badges, Gramática row in Frasario, SectionCard on Ruta replacing the grammar sheet; entries hidden when empty · 76c17b63 · verify ✓ 💻 · not checked: visual (queued)

## T167 — Grammar drills in Repaso, SRS on first read
- Status: done
- Depends on: T163, T164
- Where: any
- Goal: `grammarDrills()` builds fill-gap drills from card/verb `drills` and from verb forms (docs/grammar.md "Exercises"); the first read of a drillable id adds it to `progress.srs` (box 0); `dueItemIds` and SRS scheduling accept drillable ids (today they skip `kind === "grammar"`); Repaso gives each due drillable id 2 drills and records outcomes on the id.
- Context: docs/grammar.md "Exercises"; `src/lib/exercises/generate.ts`, `types.ts` (`FillGapExercise` ~L63); `src/lib/progress/index.ts` (`dueItemIds` ~L254, `applyResult` ~L269); `src/app/repaso/ReviewView.tsx`; `src/lib/srs/dedupe.ts`.
- Scope: may touch `src/lib/exercises/**`, `src/lib/progress/index.ts`, `src/lib/grammar/**` (first read → SRS), `src/app/repaso/**`, `src/components/lesson/LessonPlayer.tsx` (only to pass drills through) / must not touch content, stored shapes.
- Done when:
  - One-off `npx tsx` script: after `markGrammarRead("it", "verb.essere")` the id is in SRS; a review built from it yields 2 fill-gap steps, answer among the options, options distinct, audio set; an unread verb never appears; non-grammar review sessions are unchanged for the same seed.
  - `npm run verify` → exit 0.
  - Hand check (PC): Repaso shows essere drills after reading it.
- Outcome: grammarDrills() (fill-gap from drills + verb forms, 2 tenses per verb, ≤4 options), startReviewing on read, dueItemIds/SRS accept drillable ids, Repaso 2 drills per due entry; 78/78 non-grammar sessions unchanged · 57b5233e · verify ✓ 💻 · not checked: visual (queued)

## T168 — Grammar drills in lessons
- Status: done
- Depends on: T167
- Where: any
- Goal: Lessons give up to 2 production slots to drills from read drillable entries (lapses first, then lowest box, then least read); same session length; no reads → identical sessions.
- Context: docs/grammar.md "Exercises"; `src/lib/exercises/generate.ts` (production step); `src/app/leccion/[id]/` and `LessonPlayer.tsx` (where options are built).
- Scope: may touch `src/lib/exercises/**`, `src/lib/grammar/**` (pick helper), `src/components/lesson/**`, `src/app/leccion/**` / must not touch content, stored shapes.
- Done when:
  - One-off `npx tsx` script: for 3 Italian lessons and a fixed seed, no reads → deep-equal to the session before this task (save it first); 2 read entries → same length, ≤ 2 fill-gap drills.
  - `npm run verify` → exit 0.
  - Hand check (PC): a lesson after reading two verbs shows their drills.
- Outcome: lessonDrillIds/rankDrillEntries: ≤2 drills from read entries (lapses, box, reads), own seed, same length; no reads → 6/6 sessions deep-equal; docs/grammar.md updated · fd818012 · verify ✓ 💻 · not checked: visual (queued)

## T169 — Italian verbs: avere, fare, andare, venire, stare, volere
- Status: done
- Depends on: T163
- Where: any
- Goal: Six verb files in the format of `content/it/verbs/essere.json`: the four tenses (imperative only where it is used), glosses in Spain Spanish, `irregular` per the guide, a short trip-useful example per tense (trains, bars, directions, small talk), `notes` for auxiliaries and traps.
- Context: docs/content-guide.md "Grammar reference" and "Quality rules"; `content/it/verbs/essere.json`; docs/brief.md (trip).
- Scope: may touch `content/it/verbs/{avere,fare,andare,venire,stare,volere}.json` only / must not touch anything else (no `verb` links: T172).
- Done when:
  - `npm run content:check` → ✓ with 7 Italian verbs.
  - `npm run verify` → exit 0.
- Outcome: avere 20, fare 30, andare 40, venire 50, stare 60, volere 65 (no imperative for volere; fa'/va'/sta' with fai/vai/stai in notes) · 048f7e61 · verify ✓ 💻 · not checked: accuracy (T173)

## T170 — Italian verbs: potere, dovere, sapere, dire, prendere
- Status: done
- Depends on: T163
- Where: any
- Goal: Same as T169 for these five (potere and dovere without imperative; prendere with participle "preso").
- Context: as T169.
- Scope: may touch `content/it/verbs/{potere,dovere,sapere,dire,prendere}.json` only.
- Done when:
  - `npm run content:check` → ✓ (12 verbs once T169 is in).
  - `npm run verify` → exit 0.
- Outcome: potere 70, dovere 80, sapere 90, dire 100, prendere 110 (no imperative for potere/dovere; di' say 'di') · 4832fc7c · verify ✓ 💻 · not checked: accuracy (T173)

## T171 — Italian topics: articles and prepositions
- Status: done
- Depends on: T163
- Where: any
- Goal: New grammar cards with tables, examples and 4–8 drills each: `gram.articoli-determinativi` (order 30), `gram.articoli-indeterminativi` (40), `gram.preposizioni` (50: a/in/da/di/su/per/con/tra with trip uses: "a Palermo", "in Sicilia", "in treno", "da Catania"), `gram.preposizioni-articolate` (60: al, del, dal, nel, sul… table). Article drills use words from the pack's vocab.
- Context: docs/content-guide.md "Grammar reference" and "Quality rules"; `content/it/extras/gramatica.json` (card style); Italian vocab `article` fields (`content/it/units/*.json`).
- Scope: may touch `content/it/extras/gramatica-temi.json` (new) only.
- Done when:
  - `npm run content:check` → ✓.
  - `npm run verify` → exit 0.
- Outcome: gramatica-temi.json: articoli det/indet, preposizioni, preposizioni articolate (order 30–60, 8 drills each; elided answers include the noun) · 7965ff94 · verify ✓ 💻 · not checked: accuracy (T173)

## T172 — Italian topics: pronouns, plus the existing cards
- Status: done
- Depends on: T163, T169, T170, T171
- Where: any
- Goal: Cards `gram.pronomi-diretti` (70), `gram.pronomi-indiretti` (80), `gram.ci-ne` (90: "c'è", "ci vado", "ne vorrei due", "ce l'ho") with drills, appended to `gramatica-temi.json`; in `gramatica.json`: `order` + 4–6 drills on `gram.tu-lei` (10) and `gram.vorrei` (20), and `verb` links on `gram.avere`, `gram.volere`, `gram.potere`, `gram.andare`.
- Context: as T171; docs/grammar.md "Index".
- Scope: may touch `content/it/extras/gramatica-temi.json`, `content/it/extras/gramatica.json` / nothing else.
- Done when:
  - `npm run content:check` → ✓; `listGrammarTopics(getPack("it"))` (one-off tsx) lists exactly 9 topics in order 10–90 and none of the verb cards.
  - `npm run verify` → exit 0.
- Outcome: pronomi diretti/indiretti, ci-ne (70–90) in gramatica-temi.json; order + drills on tu-lei (10) and vorrei (20); verb links on avere/volere/potere/andare; 9 topics, 12 verbs · 53ce69e7 · verify ✓ 💻 · not checked: accuracy (T173)

## T173 — Blind accuracy review of the Italian grammar content
- Status: done
- Depends on: T169, T170, T172
- Where: any
- Goal: For each of the 12 verbs and 4 tenses, first write the expected forms from your own knowledge, then compare with the file; check every drill (exactly one right answer, distractors really wrong), glosses and accents. Fix only certain errors; list every doubt (form, file, why) in the final message for Hernán.
- Context: docs/content-guide.md "Grammar reference" ("Accuracy"); `content/it/verbs/*.json`, `content/it/extras/gramatica*.json`.
- Scope: may touch `content/it/verbs/**`, `content/it/extras/gramatica*.json` / nothing else.
- Done when:
  - Final message lists checked counts (verbs × tenses, drills), fixes made, doubts.
  - `npm run verify` → exit 0.
- Outcome: 252 forms × 45 tables all matched blind; 65 card drills checked; fixes: irregular marks (fai, stai, sia, abbia, faccia, sappia; vieni unmarked), stare condizionale note, 'vado ___ medico' distractor al→sul · 5301ff93 · verify ✓ 💻 · doubts for Hernán (Needs Hernán)

## T174 — Audio for the Italian grammar reference
- Status: done
- Depends on: T173
- Where: pc (edge-tts needs internet and the `.venv`)
- Goal: Generate the mp3s for every new Italian playable (infinitives, forms, examples, drills) and commit them.
- Context: CLAUDE.md `npm run audio`; docs/content-guide.md "Audio keys".
- Scope: may touch `public/audio/it/**` only.
- Done when:
  - `npm run audio` adds only Italian files; other packs' `public/audio/*` byte-identical.
  - `npm run content:check -- --strict-audio` → exit 0.
  - `npm run verify` → exit 0.
  - Hand check (PC): final iPhone pass of the whole feature (Visual queue).
- Outcome: 383 Italian mp3 (verbs, examples, drills) via edge-tts; 5 transient 403s retried; --strict-audio ✓ for it; cba untouched · 30fcf8e9 · not checked: iPhone pass (queue)

## T184 — «Escuchar todo» on grammar pages
- Status: done
- Depends on: T166
- Where: any
- Goal: An «Escuchar todo» button on every verb page (plays the selected tense: each form in row order, as its row plays it, then the tense example; the row playing is highlighted; a short pause between items) and every topic page (plays its examples in order). Tap again = stop; leaving the page, switching tense or tapping any other play button stops it. Hernán asked for it (2026-10-13).
- Context: docs/grammar.md "Verb page", "Topic page"; `src/components/grammar/**` (pages from T165/T166); plan 015's «Escuchar todo» player `src/components/quick/listen-all.ts` and its use in `src/components/quick/` (already solves sequential audio on iOS after one tap): reuse it, generalising it into a shared module only if needed without changing Modo rápido's behaviour; `@/lib/audio` (`speak`, `stop`); learn copy for the label (es + ru).
- Scope: may touch `src/components/grammar/**`, `src/components/quick/listen-all.ts` (generalise only), a new shared module under `src/lib/audio/` or `src/components/`, `src/lib/i18n/learn-copy.ts`, docs/grammar.md / must not touch content, stored keys, Modo rápido behaviour.
- Done when:
  - `npm run verify` → exit 0.
  - Hand check (PC): iPhone: Escuchar todo on essere (presente) plays io sono → … → loro sono → example with the row highlighted; stop works; topic page plays its examples; light and dark.
- Outcome: play-all hook on speakSequence (600 ms pause, lemon frame on the playing row, stops on tap/tense change/leave); verb + topic pages; Modo rápido untouched · 1056f44e · verify ✓

## T185 — Italian grammar: more explanation and examples where needed
- Status: done
- Depends on: T173
- Where: any
- Goal: Read the 12 verbs and 9 topic cards as a Spanish-speaking A1–A2 learner and add text only where it helps (Hernán, 2026-10-13: "si ves la necesidad"): a clearer `summary`/`points` or tense `notes` (when to use the tense, the auxiliary, a trap for Spanish speakers), and 1–3 more `examples` on topic cards that have too few. Within the current schema; nothing everywhere "just because".
- Context: docs/content-guide.md "Grammar reference" and "Quality rules"; `content/it/verbs/*.json`, `content/it/extras/gramatica.json` (only cards listed as topics: gram.tu-lei, gram.vorrei), `content/it/extras/gramatica-temi.json`.
- Scope: may touch those files only / must not touch forms, drills or ids (T173 checked them), `public/audio/` (audio comes from the next `npm run audio`).
- Done when:
  - Final message lists each change (file: what, why) in ≤ 15 lines.
  - `npm run verify` → exit 0.
- Outcome: notes on essere/andare (sto bene, passato = he sido/fui, non + infinitivo), voi for groups in tu-lei, +5 examples (tu-lei, vorrei, pronomi-diretti) appended · d1101b02 · verify ✓ · audio for 5 new examples at next npm run audio

## T186 — Voice rotation (4 free Italian voices) and audio without Gemini
- Status: pending
- Depends on: T184
- Where: any
- Goal: Hernán (2026-10-13): Italian uses its 4 free edge-tts voices, varied by who speaks. Add pack.json `voiceRotation?: boolean` (Italian only: true; add `it-IT-GiuseppeMultilingualNeural` as 4th voice). With it, every playable whose content has no explicit `voice` gets a deterministic voice from `voices` (stable hash, so audio never churns between runs): phrases, vocab, expressions, placement by item id; Q&A question one voice and its replies a different one; dialogue native speakers one voice per speaker name (different speakers differ), learner options keep today's rule; story narrator by story id (sentence voices that are explicit stay); a verb's infinitive, forms and examples share one voice per verb; a grammar card's examples share one per card; drills by drill key. Explicit `voice` always wins. Also `npm run audio -- --no-gemini`: skip Gemini generation (existing Gemini mp3s keep being used; other lines get their edge-tts mp3). Keep the `ttsVoices` Gemini mapping as is.
- Context: where Playables get their default voice (`src/lib/content/`, find it), `scripts/audio/plan.ts` and `generate.ts` (Gemini path), `src/lib/content/schema.ts` (pack meta), docs/content-guide.md "Audio keys" / pack.json, CLAUDE.md (`npm run audio` row).
- Scope: may touch `src/lib/content/**`, `scripts/audio/**`, `content/it/pack.json`, docs/content-guide.md, CLAUDE.md / must not touch other packs' content or audio, `public/audio/**`, stored keys.
- Done when:
  - `npm run audio -- --dry-run --lang=it --no-gemini` works; a one-off script prints how many Italian playables each of the 4 voices gets (roughly even) and confirms Q&A question ≠ replies and two speakers of one dialogue differ.
  - `npm run audio -- --dry-run` shows 0 to generate and 0 manifest changes for every other pack (no churn).
  - `npm run verify` → exit 0.
- Outcome:

## Review queue

## Visual checks queue
- [ ] T165 @1860167a — /gramatica/ grid + temas, verb.essere chips/rows/audio/irregular colour, gram.tu-lei page; light + dark, iPhone (queued 2026-10-13 💻)
- [ ] T167 @57b5233e — Repaso after reading essere: 2 fill-gap drills, options, audio, verb listed in the preview (queued 2026-10-13 💻)
- [ ] T166 @76c17b63 — Leído ×1 + XP once, ×2 no XP after leaving; badges; Frasario row and Ruta card open /gramatica/; light + dark (queued 2026-10-13 💻)
- [ ] T168 @fd818012 — a lesson after reading two verbs shows one drill each at the end; length unchanged (queued 2026-10-13 💻)
- [ ] T174 @30fcf8e9 — final iPhone pass of the whole Gramática feature with real audio (queued 2026-10-13 💻)
- [ ] T184 @1056f44e — Escuchar todo on a verb (rows highlighted, then example) and a topic; stop; light + dark (queued 2026-10-13 💻)

## Decisions
- 2026-10-12 plan: Gramática lives at /gramatica/, nested under the Frases tab; entries from the Frasario and a Ruta card that replaces the "Fichas de gramática" sheet. (Hernán)
- 2026-10-12 plan: v1 topics = verbs + articles + prepositions + pronouns + the existing tú/Lei and «vorrei» cards; 12 verbs (essere, avere, fare, andare, venire, stare, volere, potere, dovere, sapere, dire, prendere); tenses presente, passato prossimo, condizionale, imperativo. (Hernán)
- 2026-10-12 plan: verb page = tense chips, gloss and audio per form, irregular forms highlighted, one example per tense. (Hernán)
- 2026-10-12 plan: "Leído" = button at the end; counts every read; 3 XP first read per entry per day, cap 15 XP/day. (Hernán)
- 2026-10-12 plan: read entries enter Repaso (SRS) and up to 2 lesson slots as fill-the-gap drills; unread entries never appear. (Hernán)
- 2026-10-12 plan: generic code and format; Italian content only in this plan; one agent writes, another checks blind, doubts go to Hernán. (Hernán)
- 2026-10-12 plan: topics are grammar cards (`order`, `verb`, `drills`); drills reuse the fill-gap exercise; no new exercise screen. (orchestrator, approved by Hernán)
- 2026-10-12 plan: save tokens: no visual checks or code reviews by agents; Hernán drains both queues on his iPhone/Mac. Max 2 agents. (Hernán)
- 2026-10-12 plan: work on branch plan-014-gramatica; no merge into main, PR or deploy without Hernán's explicit OK. (Hernán)
- 2026-10-13 plan: content tasks T169–T172 run on Sonnet to save tokens; T173 review and code tasks on Opus. (Hernán)
- 2026-10-13 T164: XP recorded only when > 0; bad 'last' keeps the count; grammar XP shows no toast yet (T166 decides feedback). (agent)
- 2026-10-13 T163: scripts/audio/plan.ts edited (outside scope) so npm run audio includes grammar playables; extra helper getGrammarTenses(pack); drill text = full sentence with before/after; essere marks only sii/siate irregular. (agent)
- 2026-10-13 T165: every grammar card gets a page (verb-linked ones not listed); slow-audio snail button per row; chips shown even with one tense; levelled packs show current level only; grammarHref() in src/components/grammar/GrammarScreen.tsx. (agent)
- 2026-10-13 T167: Repaso drills come on top of the session size (2 per due entry); every read (not only the first) adds a missing drillable to SRS; startReviewing(lang, id) in progress. (agent)
- 2026-10-13 T166: XpToast shows grammar XP (one line outside scope); Ruta 'Para saber más' only with side units or expressions. (agent)
- 2026-10-13 T170: per-form irregular only where a tense mixes regular and irregular forms; uniform irregularity explained in tense notes. (agent)
- 2026-10-13 T169: tense-wide irregularity (participles, future/conditional stems) goes in tense notes, not per form; passato glosses give preterite / perfect. (agent)
- 2026-10-13 T171: normaliser ignores apostrophes, so near-duplicate options were replaced; new topic cards are in no lesson (Gramática only). (agent)
- 2026-10-13 T168: lessons drill any read entry (due or not); one drill per entry, at most half the production slots; pack lessons only. (agent)
- 2026-10-13 T172: drills avoid register-only distractors; elided answers carry the next word. (agent)
- 2026-10-13 T173: irregular-mark rule: presente vs regular endings (essere none); passato/condizionale never per form (notes); imperativo tu/noi/voi when ≠ present, Lei when ≠ present lui form with last vowel changed. (agent)
- 2026-10-13 T174: run by the orchestrator in the main checkout (one command, saves an agent); --max-credits=0 and cba changes discarded, so only public/audio/it is committed. (orchestrator)
- 2026-10-13 plan: merged into main and pushed at Hernán's request (2026-10-13), with main's plan 015 brought in first; T174 audio and the visual queue still open. (Hernán)
- 2026-10-13 plan: T184 «Escuchar todo» on grammar pages and T185 extra explanation/examples added at Hernán's request. (Hernán)
- 2026-10-13 plan: Italian audio = 4 free edge-tts voices with deterministic rotation (Q&A asker ≠ answerer, one voice per dialogue speaker); keep the 77 Gemini clips, no more Gemini generation (100/day cap). (Hernán)

## Proposals (new scope)
- 2026-10-12 plan: futuro and imperfetto; more verbs; verbs and drills for fr/en/nl/es; Frasario search finds verbs; "ver todas las formas" link from lesson grammar tips; read aloud with the microphone.
- 2026-10-13 T166: remove dead GrammarCardView export in src/components/path/SideSheet.tsx
- 2026-10-13 T173: state the irregular-mark rule in docs/content-guide.md

## Log
- 2026-10-12 18:48Z 💻 plan written from the interview; not approved yet
- 2026-10-13 06:19Z 💻 plan approved by Hernán
- 2026-10-13 06:20Z 💻 T163 launched · attempt 1 · agent a5414467c5dd30344
- 2026-10-13 06:20Z 💻 T164 launched · attempt 1 · agent a909563e334169d27
- 2026-10-13 06:24Z 💻 T164 done → 7de37571 · verify ✓
- 2026-10-13 06:29Z 💻 T163 done → 37855e6a · verify ✓
- 2026-10-13 06:29Z 💻 T165 launched · attempt 1 · agent a850158fa3794dd66
- 2026-10-13 06:29Z 💻 T167 launched · attempt 1 · agent aeed9052586a45fcd
- 2026-10-13 06:36Z 💻 T165 done → 1860167a · verify ✓
- 2026-10-13 06:36Z 💻 T166 launched · attempt 1 · agent a7f76fd2debe0bff4
- 2026-10-13 06:38Z 💻 T167 done → 57b5233e · verify ✓
- 2026-10-13 06:38Z 💻 T168 launched · attempt 1 · agent af8d21a232fa84515
- 2026-10-13 06:40Z 💻 T168 stopped at Hernán's request (tokens); worktree gone, back to pending
- 2026-10-13 06:42Z 💻 T166 done → 76c17b63 · verify ✓
- 2026-10-13 10:57Z 💻 resumed by Hernán; T169 launched (Sonnet) · agent a54946f4499d23216
- 2026-10-13 10:57Z 💻 T170 launched (Sonnet) · agent aaffd503674f180f5; verb orders: T169 20–65, T170 70–110
- 2026-10-13 11:02Z 💻 T170 done → 4832fc7c · verify ✓
- 2026-10-13 11:02Z 💻 T171 launched (Sonnet) · agent a958b89e98253e87b
- 2026-10-13 11:03Z 💻 T169 done → 048f7e61 · verify ✓ (12 Italian verbs)
- 2026-10-13 11:03Z 💻 T168 launched · attempt 2 · agent a683ae414881fd113
- 2026-10-13 11:09Z 💻 T171 done → 7965ff94 · verify ✓
- 2026-10-13 11:09Z 💻 T168 done → fd818012 · verify ✓
- 2026-10-13 11:09Z 💻 T172 launched (Sonnet) · agent a1d526e70e81209cf
- 2026-10-13 11:16Z 💻 T172 done → 53ce69e7 · verify ✓
- 2026-10-13 11:16Z 💻 T173 launched (Opus) · agent a3b557d8bb2ca46fb
- 2026-10-13 11:26Z 💻 T173 done → 5301ff93 · verify ✓
- 2026-10-13 11:26Z 💻 T174 started in main checkout
- 2026-10-13 11:47Z 💻 T174 blocked: all 405 Italian lines 403 from edge-tts; partial manifest change reverted
- 2026-10-13 11:53Z 💻 merged origin/main (plan 015) into plan-014-gramatica: conflicts navigation.ts (grammar + quick sections) and ReviewView.tsx (drills + useHideQuickFab) resolved; verify ✓; main fast-forwarded and pushed
- 2026-10-13 12:24Z 💻 T174 done (Hernán ran npm run audio; orchestrator retried 4 failed lines)
- 2026-10-13 13:32Z 💻 T184 launched · agent aea97f0357358c3f7
- 2026-10-13 13:32Z 💻 T185 launched (Sonnet) · agent a8a65c75d0d3b6dc3
- 2026-10-13 13:35Z 💻 T185 done → d1101b02
- 2026-10-13 13:36Z 💻 T184 done → 1056f44e
