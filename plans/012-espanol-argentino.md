# Plan 012 — Español argentino A1 (for Russian speakers): first pack with a gloss language other than Spain Spanish

Status: active
Created: 2026-10-09
Base branch: main
Goal: Add a small, fun **A1** Spanish pack (`content/es/`, es-AR) of Argentine Spanish (rioplatense base with Córdoba mixed in from the start), explained **in Russian**. This is the first pack whose learner does not speak Spain Spanish, so the code learns two generic things first: (1) a pack can carry glosses and notes in several languages (`ru` now; Spain Spanish `es` and English `en` later, reusing the same Spanish audio) and the learner picks one; (2) the learning screens (exercise instructions, feedback, lesson buttons) show in the chosen gloss language when it is Russian. Menus, Perfil and the rest of the UI stay Spain Spanish. Volume is deliberately small (about 800 mp3) to keep the deploy weight down. MVP speed: no automated tests; verification is `npm run verify`.
Test command: npm run verify
Worktree setup: npm ci

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, docs/brief.md (app-wide, do not edit), **docs/brief-es.md** (written by T151), docs/content-guide.md, docs/speech.md. `content/en/` A2 and `content/ru/` are format models: copy their file format and quality, not their content.
- **Generic code.** Code changes only in T149, T150 (and T155 if the audio/images scripts need a generic fix). Nothing in `src/`, `api/` or `scripts/` names Argentina or the `es` pack, except data maps that already list registers/pronouns and the Russian copy dictionary. Italian, French, English, Russian and Dutch behave and look exactly as today.
- **Never lose on-device data.** No stored key renamed or reshaped; a new key for the gloss choice is fine (`lang-lern:*`, included in backup and cloud save like the others). Byte-identical in every task: `content/{it,fr,en,ru,nl}/**`, `public/audio/{it,fr,en,ru,nl}/**`, `public/images/**` except files T155 adds.
- **Gloss model (T149 fixes the exact shape and documents it in docs/content-guide.md).** Existing packs keep their `es` fields unchanged, and `es` keeps meaning "Spain Spanish explanation". A pack lists the gloss languages it carries (e.g. `glossLangs: ["ru"]`; absent = `["es"]`). Every gloss-bearing field (item translation, Q&A question, notes, grammar card text, dialogue/story translations, story keyword, unit/lesson descriptions meant for the learner) can carry one value per listed language. `content:check` requires every listed language on every item. The learner's choice per pack defaults to the first listed language and changes on /perfil only when the pack lists more than one.
- **Learner.** A Russian speaker starting Spanish from zero, a tourist or newcomer in Argentina. Fun and light: short lessons, humour, pictures, recurring characters. Russian glosses are natural Russian, and notes are short and friendly (Cyrillic, no transliteration of Spanish). Typical Russian-speaker mistakes for distractors: articles (el/la, un/una missing), gender agreement, ser/estar, stress, b/v and ll/y spelling, `usted` vs `vos` forms, false friends.
- **Argentine Spanish.** Voseo everywhere informal (vos tenés, sos, podés, vení, mirá); `usted` in formal scenes (doctor, bank, police, office); "tú" only in one note saying it is hardly used in Argentina. Rioplatense lexicon (colectivo, subte, laburo, birra, plata, facturas, remís, kiosco, boliche, che, dale, re-). **Córdoba is mixed in from unit 1, not left for last**, at roughly one third of scenes (Córdoba capital, sierras, Villa Carlos Paz): a cordobés main character, fernet con coca, cuarteto, "¿qué hacé'?" and the tonada explained in notes; "culiado" only in a note as a strong regionalism, never in a phrase to learn or a formal scene. Buenos Aires for the rest.
- **Pack.** `content/es/pack.json` is edited only by T151 (`lang: "es"`, `name: "Español (Argentina)"`, `nativeName: "Español rioplatense"`, `speechLocale: "es-AR"`, emoji 🇦🇷, `formalRegister` = the `usted` value T149 adds, no `levels` (one course), voices `es-AR-ElenaNeural`, `es-AR-TomasNeural`, `es-UY-MateoNeural`, `es-UY-ValentinaNeural` (verified in `edge-tts --list-voices` on 2026-10-09; es-UY is rioplatense too: learner options and secondary characters), `numberWords`, articles, situations, `glossLangs: ["ru"]`). Content tasks report needed pack changes instead of editing it.
- **Volume (A1 mini).** 6 units + a short grammar unit (~8 cards: articles and gender, ser/estar, the vos present, `usted`, plurals, gustar, ir a + infinitive, questions), ~180 phrases, ~150 vocab (with a picture where a Fluent icon fits), ~40 Q&A, 6 dialogues, 6 stories (60–90 words), no placement test. Ids `es-a1-…`, `gram.es-a1-…`, `dlg.es-a1-…`, `story.es-a1-…`, unique across every pack. Later units reuse earlier items by id instead of duplicating. Numbers as words. Content tasks do not run `npm run audio`/`npm run images` (T155 does).
- Verification: `npm run verify` → exit 0 for every task.

## Tasks

## T149 — Multi-language glosses (generic)
- Status: done
- Depends on: none
- Goal: Let a pack carry glosses and notes in several languages (`glossLangs`), let the learner pick one per pack, and show the chosen one everywhere a gloss is shown today, with no change for the existing packs.
- Context: `src/lib/content/schema.ts` (PackMeta ~99–136, `es` at 162, 193, 208, 249, 327, 333, 379, 397, `questionEs` 217, `titleEs` 429, notes/grammar/descriptions), `src/lib/content/types.ts`, `index.ts`, `src/lib/exercises/types.ts` + `generate.ts`, `src/lib/game/index.ts`, `src/lib/stories/games.ts`, about 20 components that read `.es` (Round, DialoguePlayer, MatchExercise, StoryReader, WordList, PhraseList, ReviewView…), `scripts/content.ts`, docs/content-guide.md, `src/lib/backup/`, `src/lib/cloud-save/` (key lists). Prepárate: `api/_lib/prompts.ts`, `src/app/preparar/`. `MicTestView.tsx:120` (Spanish card hidden only for `es-ES`), `LevelInterview.tsx`, `SituationForm.tsx`.
- Scope: may touch generic code in `src/`, `scripts/content.ts`, `docs/content-guide.md`, `docs/coach.md` (one line), CLAUDE.md (one line) / must not touch any pack's content, audio or images, `api/` except to keep Prepárate off for packs without `es` glosses, stored key names or shapes.
- Done when:
  - The schema accepts `glossLangs` and per-language values on every gloss-bearing field. Packs without `glossLangs` validate and build exactly as before (`packs.json` identical for it/fr/en/ru/nl except new defaulted fields, if any, explained in the outcome).
  - One resolver (e.g. `glossOf(value, glossLang)`) is the only way UI and exercise generation read a gloss; the gloss element gets the matching `lang` attribute.
  - The learner's gloss language is stored per pack in a new `lang-lern:*` key (in backup and cloud save), defaults to the pack's first gloss language, and is chosen on /perfil only when the pack lists more than one.
  - New `formalRegister` value for `usted`, and the register badge shows "vos" as the informal pronoun for that pack (data map, not a hard-coded pack id).
  - Prepárate entry points are hidden for a pack whose gloss languages do not include `es` (its prompts write Spain Spanish glosses); this goes under Proposals for later.
  - The mic test does not show the extra "En español" card when the active pack's `speechLocale` already starts with `es-`; a pack with no placement questions onboards straight to its first unit.
  - A scratch `es` pack with `glossLangs: ["ru"]` and one lesson (not committed) shows Russian glosses in a lesson, a game round and the phrasebook; report how you checked. `npm run verify` → exit 0.
- Outcome: glossLangs + sibling fields es/ru/en (questionRu, titleRu…) or {ru:…} maps; glossOf() in src/lib/content/gloss.ts, <Gloss>; key lang-lern:gloss:<lang>; register `usted` (badge 'Trato de vos'); Prepárate hidden without es glosses — d3b361a9

## T150 — Russian copy for the learning screens
- Status: running
- Depends on: T149
- Goal: When the chosen gloss language is `ru`, the screens a beginner needs to learn (lesson exercises, review, game rounds, dialogue player, story reader and its games) show their instructions, feedback and buttons in Russian. The rest of the app stays Spain Spanish.
- Context: T149's resolver and gloss setting; exercise and game components (`Round.tsx` 186–189 "lee en español", `SearchHeader.tsx:48`, `QuestionExercise.tsx:37` "Ver en español", lesson/review/dialogue/story views). Copy rules: CLAUDE.md (Spain Spanish UI with tú stays the default).
- Scope: may touch a new generic copy dictionary (e.g. `src/lib/i18n/learn-copy.ts`, keys = gloss language, `es` = today's strings verbatim) and the learning components that use it / must not touch content, navigation/tab names, Perfil, Liga, cloud save, Prepárate copy, stored keys.
- Done when:
  - With gloss `es` every learning screen shows exactly today's strings (same text, a dictionary lookup instead of a literal).
  - With gloss `ru` those screens are in natural Russian, including `aria-label`s; strings that name "español" as the gloss language now name the chosen gloss language instead.
  - `npm run verify` → exit 0; list the screens covered and those left in Spanish.
- Outcome:

## T151 — Spanish (Argentina) pack foundation and brief
- Status: running
- Depends on: T149
- Goal: Create `content/es/pack.json` and `docs/brief-es.md` so the content tasks can run.
- Context: Shared contract; docs/brief-ru.md and docs/brief-nl.md as brief models; `content/ru/pack.json` as the pack model; T149's documented gloss shape.
- Scope: may touch `content/es/pack.json`, `docs/brief-es.md`, CLAUDE.md (add `es` next to the other packs in Folder layout) / must not touch code, other packs.
- Done when:
  - `docs/brief-es.md` lists the 6 units (ids, orders 10–60, situation, topics, Córdoba share per unit), the grammar unit's ~8 cards (order 90), 6 dialogue and 6 story topics with ids, at least 2 of each set in Córdoba/sierras/Carlos Paz and not all at the end, the cast (a Russian learner protagonist, a porteño friend and a cordobés friend from unit 1, names, roles, voices), register rules, the Argentine lexicon list, Córdoba rules ("culiado" only in a note), typical Russian-speaker mistakes, and the volume targets. Suggested units: greetings and che/vos, getting around (colectivo, subte, remís), food and drink (facturas, mate, asado, fernet), shopping and money (kiosco, plata), people and plans (boliche, cuarteto, "¿qué hacé'?"), help and health (farmacia, usted).
  - The `es` pack loads (hidden while it has no lessons, as today); `npm run verify` → exit 0.
- Outcome:

## T152 — Units 1–3 and the grammar unit
- Status: pending
- Depends on: T151
- Goal: Write units 10, 20, 30 and the grammar unit 90 from brief-es.md, with Russian glosses and notes.
- Context: Shared contract, docs/brief-es.md, `content/ru/units/` and `content/en/units/` as format models.
- Scope: may touch `content/es/units/` (these units only) / must not touch `content/es/pack.json`, other packs.
- Done when:
  - 4 unit files at about half the A1 volume (~90 phrases, ~75 vocab, ~20 Q&A, ~8 grammar cards); `npm run verify` → exit 0. Report counts.
- Outcome:

## T153 — Units 4–6 (A1 complete)
- Status: pending
- Depends on: T152
- Goal: Write units 40, 50, 60, reusing earlier items by id, so the pack reaches the A1 mini totals.
- Context: Shared contract, docs/brief-es.md, T152's units.
- Scope: may touch `content/es/units/` (these units only) / must not touch `content/es/pack.json`, other units, other packs.
- Done when:
  - Totals within ±10% of ~180 phrases, ~150 vocab, ~40 Q&A; an uncommitted script finds no two phrases or vocab items with the same normalized text (report counts); `npm run verify` → exit 0.
- Outcome:

## T154 — Dialogues (6) and stories (6)
- Status: pending
- Depends on: T153
- Goal: Write the 6 dialogues (orders 1–6) and 6 stories (orders 1–6, files `a1-NN-<slug>.json`) from brief-es.md with A1 vocabulary, vos/usted as the scene needs, and Córdoba mixed through the order.
- Context: Shared contract, docs/brief-es.md, `content/ru/dialogues/`, `content/ru/stories/` as format models.
- Scope: may touch `content/es/dialogues/`, `content/es/stories/` / must not touch units, pack.json, other packs.
- Done when:
  - 6 dialogues (about 7 turns, 3 options, Russian-speaker-mistake distractors, never differing only by punctuation or accents) and 6 stories (60–90 words, keywords, 3–4 questions); `npm run verify` → exit 0.
- Outcome:

## T155 — es-AR audio, pictures and offline check
- Status: pending
- Depends on: T150, T154
- Goal: Generate the mp3s and pictures for the `es` pack and check it works offline in the built app, in Russian.
- Context: CLAUDE.md commands `npm run audio`, `npm run images`, `--strict-audio`, `--strict-images`; plan 011 T147 outcome. Needs internet (edge-tts).
- Scope: may touch `public/audio/es/**`, `public/images/**` (only additions), a generic fix in `scripts/audio` or `scripts/images` if needed / must not touch other languages' audio or content.
- Done when:
  - `npm run content:check -- --strict-audio --strict-images` → exit 0; report the es mp3 count and MB (target ≤ ~900 files, ≤ ~18 MB) and the repo's total file count.
  - `npm run verify` → exit 0; `out/sw.js` lists audio for `es`.
  - `git diff --stat main -- public/audio/it public/audio/fr public/audio/en public/audio/ru public/audio/nl` → empty.
- Outcome:

## Decisions
- 2026-10-09 Hernán: Argentine Spanish pack, rioplatense base with Córdoba mixed in from the start (not mostly cordobés, not left for last); scenes in Buenos Aires, Córdoba capital, sierras and Carlos Paz.
- 2026-10-09 Hernán: three gloss languages over time, all in one `es` pack sharing the same audio: Russian first, then Spain Spanish (monolingual, so it works from Spain) and English; later also higher levels.
- 2026-10-09 Hernán: start small, basic and fun (A1 mini, ~800 mp3), watching the file count.
- 2026-10-09 Hernán: learning screens (instructions, feedback, lesson buttons) in Russian when the gloss is Russian; menus and Perfil stay Spain Spanish.
- 2026-10-09 Hernán: vos by default + usted in formal scenes; 4 voices (es-AR Elena, Tomás; es-UY Mateo, Valentina).
- 2026-10-09 Hernán: Vercel weight: keep it on the free plan for now; if a limit is hit he pays rather than break the app. A plan for growth (e.g. audio outside Vercel) is a separate proposal.
- 2026-10-09 orchestrator: Prepárate stays hidden for packs without `es` glosses in this plan; no placement test for a one-course A1 pack.

- 2026-10-09 T149: gloss shape = sibling fields per language for es-named fields, {lang: text} map for the rest; new-pack welcome screen still shown once before the route (agent)

## Proposals (new scope)
- 2026-10-09 orchestrator: growth of the deploy (audio is 279 MB / 16,299 files; repo 17,048 files, `.git` 245 MB): serve mp3s from Cloudflare R2 or similar (audio base URL, CORS, cross-origin SW cache and Range) and/or re-encode at a lower bitrate. Its own plan when needed.
- 2026-10-09 orchestrator: later plans for the `es` pack: `en` and `es` glosses (text only, no new audio), Prepárate with the learner's gloss language, A2 level with placement.

## Log
- 2026-10-09 T149 launched · attempt 1
- 2026-10-09 T149 done → d3b361a9
- 2026-10-09 T150 launched · attempt 1
- 2026-10-09 T151 launched · attempt 1
