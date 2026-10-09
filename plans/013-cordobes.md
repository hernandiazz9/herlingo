# Plan 013 — Cordobés: a pack for Spain-Spanish speakers who want to understand and speak like Córdoba (Argentina)

Status: active
Created: 2026-10-09
Base branch: main
Goal: Add a medium pack `cba` ("Cordobés", es-AR) for a speaker of Spain Spanish: no basics, only what differs, with every word and phrase compared with Spain (equivalent, false friends, register). Built from the researched reference **docs/cordobes-lexico.md** (523 lexicon rows, 81 expressions, phonetics, grammar, culture, 16 sources). Everything is taught for understanding and use, including vulgar and offensive words, always with a clear register warning. Explanations are Spain Spanish (`es`, the default gloss language). The tonada is explained in notes and, if Hernán picks one of the voice experiments, also imitated in the audio. MVP speed: no automated tests; verification is `npm run verify`.
Test command: npm run verify
Worktree setup: npm ci

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, docs/brief.md (app-wide, do not edit), **docs/brief-cba.md** (written by T156), **docs/cordobes-lexico.md** (the source of truth for words, meanings, Spain equivalents, register and confidence), docs/content-guide.md, docs/speech.md. `content/es/` (plan 012) is the format model for an es-AR pack; copy format and quality, not content.
- **Content only, generic code.** Code changes only in T156 (and T161/T162 if voice or audio scripts need a generic change). Nothing in `src/`, `api/` or `scripts/` names Córdoba or `cba` except data maps. Every other pack behaves and looks exactly as today.
- **Never lose on-device data.** No stored key renamed or reshaped. Byte-identical in every task: `content/{it,fr,en,ru,nl,es}/**`, `public/audio/{it,fr,en,ru,nl,es}/**`, `public/images/**` except files T162 adds.
- **Learner.** A speaker of Spain Spanish (Madrid-style, uses tú/vosotros) going to Córdoba: friends, a trip, a partner's family. Knows Spanish perfectly; needs the differences. No A1 basics ("hola", "gracias") unless the Córdoba form differs.
- **Every item compares with Spain.** Gloss `es` = the Spain equivalent ("¿Qué hacés?" → "¿Qué haces? / ¿Qué tal?"). Notes say what it means, when cordobeses say it, how a Spaniard would say it, and traps (e.g. "coger" in Spain vs Argentina). Never a gloss equal to the text: when Spain says the same, say what changes (stress, voseo form, tone).
- **Register, honestly.** Teach everything the lexicon has with confidence alta/media, including "culiado/culiao" in its four degrees and insults; each such item's note starts with a register tag (`Coloquial`, `Vulgar`, `Ofensivo`) and says with whom it is fine and with whom it is not. Never use offensive words in formal scenes. Skip confidence-baja items or put them only in notes with "(dudoso)".
- **Voseo and pronunciation.** Córdoba voseo forms per the lexicon (vos tenés/tené', sos), `usted` in formal scenes, the dropped final -s written with an apostrophe only in dialogue lines and expressions where the lexicon documents it ("¿qué hacé'?"), standard spelling elsewhere so search and matching keep working.
- **Pack.** `content/cba/pack.json` is edited only by T156 (`lang: "cba"`, `name: "Cordobés"`, `nativeName: "Cordobés"`, `speechLocale: "es-AR"`, emoji 🇦🇷 or a fitting one, `formalRegister: "usted"`, no `levels`, no `glossLangs` (default `es`), es-AR/es-UY voices as in content/es/pack.json, situations). Content tasks report needed pack changes.
- **Volume (medium).** 8 units: greetings and how people address each other; people and nicknames (negro/a, guaso, car'e…); food and drink (fernet, lomito, sanguche de milanesa, empanadas, facturas); going out and cuarteto; money and work; places, transport, sierras and Carlos Paz; emotions, intensifiers and fillers; false friends with Spain + insults and "culiado". Plus a short pronunciation-and-grammar unit (tonada, -s aspiration, voseo, article before names, diminutives, intensifiers). About 250 phrases, 250 vocab, 60 Q&A, 8 dialogues, 8 stories (90–130 words), no placement. Ids `cba-…`, unique across packs.
- Verification: `npm run verify` → exit 0 for every task.

## Tasks

## T156 — Cordobés pack foundation and brief
- Status: done
- Depends on: none
- Goal: Create `content/cba/pack.json` and `docs/brief-cba.md`, and make the small generic fixes a same-language pack needs.
- Context: docs/cordobes-lexico.md, docs/brief-es.md and content/es/pack.json as models, `src/lib/game/index.ts` and `src/lib/exercises/generate.ts` (distractor dedupe drops options whose gloss equals the text), Prepárate availability (`src/lib/coach/available.ts`, `api/_lib/prompts.ts`: written for learners of another language), `src/lib/i18n/learn-copy.ts` (strings like "lee en español").
- Scope: may touch `content/cba/pack.json`, `docs/brief-cba.md`, generic code in Context, CLAUDE.md (one line) / must not touch other packs' content or audio, stored keys.
- Done when:
  - `docs/brief-cba.md` lists the 9 units (ids, orders, situation, lexicon sections each one draws from and how many rows), 8 dialogue + 8 story topics with ids (Córdoba capital barrios, La Cañada, Güemes, the stadium, a cuarteto dance, Carlos Paz, the sierras, Cosquín), a cast (a Spanish visitor + cordobés friends with voices), register rules, and the comparison style.
  - Prepárate is hidden for a pack whose target language and gloss language are the same language family (generic flag or data map, not `cba` hard-coded), unless it already behaves sensibly (explain).
  - Copy that says "lee en español" or similar reads sensibly when target and gloss are both Spanish.
  - `npm run verify` → exit 0; the `cba` pack loads hidden while empty.
- Outcome: pack cba (🧉, 4 voices), brief-cba (units 10 saludos, 20 gente, 30 comida, 40 salir, 50 plata, 60 lugares, 70 emociones, 80 trampas, 90 tonada; cast Álex from Madrid/Mateo, Cami/Elena, Nico/Tomás, narrator Valentina); glossIsTargetLanguage() hides Prepárate and switches learn copy to 'Equivalente en España' — 635e8cba

## T157 — Units 1–4 and the pronunciation/grammar unit
- Status: running
- Depends on: T156
- Goal: Write the first four topic units and the pronunciation/grammar unit from brief-cba.md.
- Context: Shared contract, docs/brief-cba.md, docs/cordobes-lexico.md (sections 2–4 for these topics), content/es/units/ as format model.
- Scope: may touch `content/cba/units/` (these units only) / must not touch pack.json, other packs.
- Done when:
  - 5 unit files at about half the volume (~125 phrases, ~125 vocab, ~30 Q&A, ~8 cards); every item has a Spain comparison; `npm run verify` → exit 0. Report counts and which lexicon rows were used.
- Outcome:

## T158 — Units 5–8 (pack complete)
- Status: pending
- Depends on: T157
- Goal: Write units 5–8 so the pack reaches the totals and covers every alta/media lexicon row and expression that fits a unit.
- Context: Shared contract, docs/brief-cba.md, docs/cordobes-lexico.md, T157's units.
- Scope: may touch `content/cba/units/` (these units only) / must not touch pack.json, other units, other packs.
- Done when:
  - Totals within ±10% of ~250 phrases, ~250 vocab, ~60 Q&A; an uncommitted script reports lexicon coverage (rows used / alta+media rows) and finds no duplicate normalized texts; `npm run verify` → exit 0.
- Outcome:

## T159 — Dialogues (8)
- Status: pending
- Depends on: T158
- Goal: Write 8 dialogues where a Spaniard copes in Córdoba; options include Spain-Spanish answers that are understood but sound foreign, and false-friend traps.
- Context: Shared contract, docs/brief-cba.md, content/es/dialogues/ as format model.
- Scope: may touch `content/cba/dialogues/` / must not touch units, pack.json, other packs.
- Done when: 8 dialogue files (about 9 turns, 3 options); `npm run verify` → exit 0.
- Outcome:

## T160 — Stories (8)
- Status: pending
- Depends on: T158
- Goal: Write 8 stories (90–130 words, files `NN-<slug>.json`) full of cordobés, with keywords pointing at unit items and comprehension questions.
- Context: Shared contract, docs/brief-cba.md, content/es/stories/ as format model.
- Scope: may touch `content/cba/stories/` / must not touch units, dialogues, pack.json, other packs.
- Done when: 8 story files; `npm run verify` → exit 0.
- Outcome:

## T161 — Cordobés voice
- Status: blocked (Hernán picks an option after the test clips)
- Depends on: none
- Goal: Make the audio sound as cordobés as possible within edge-tts, or with real recordings.
- Context: test clips 2026-10-09 (Tomás/Elena: plain, cordobés spelling, lengthened pretonic vowels, slower and higher); scripts/audio/ (generate.ts, plan.ts, tts.py); `public/audio/<lang>/manifest.json`.
- Scope: depends on the option: (a) a generic per-pack `ttsRespell` rule set or per-item `ttsText` used only for synthesis (display text unchanged) and per-pack rate/pitch; (b) a generic "recorded" audio source: files in `assets/audio/<lang>/` named by audioKey override the neural mp3 / must not change other packs' audio.
- Done when: chosen option implemented generically; 10 sample lines generated and approved by Hernán; `npm run verify` → exit 0.
- Outcome:

## T162 — Audio, pictures and offline check
- Status: pending
- Depends on: T159, T160, T161
- Goal: Generate the `cba` mp3s and pictures and check the pack works offline in the built app.
- Context: CLAUDE.md commands `npm run audio`, `npm run images`, `--strict-audio`, `--strict-images`; plan 012 T155 outcome.
- Scope: may touch `public/audio/cba/**`, `public/images/**` (additions only), generic fixes in scripts / must not touch other languages' audio or content.
- Done when: strict audio/images pass; report mp3 count and MB (target ≤ ~1400 files, ≤ ~25 MB); `npm run verify` → exit 0; other languages' audio unchanged.
- Outcome:

## Decisions
- 2026-10-09 Hernán: own pack "Cordobés" (`cba`) for Spain-Spanish speakers, explanations in Spain Spanish with comparisons; medium size; teach everything including vulgar/offensive words (with register warnings); try to make a cordobés voice ourselves.
- 2026-10-09 orchestrator: lexicon research first → docs/cordobes-lexico.md (523 rows, 81 expressions, 16 sources; doubtful: bobina, arroiar, pecho frío, choncaco, "noventa dos diez", fartusco).
- 2026-10-10 orchestrator: brief-cba fixed to Hernán's choice: vulgar and offensive words are practised items with register tags (not recognition-only); expressions only for regional/social markers (~25)

## Proposals (new scope)

## Log
- 2026-10-10 T156 launched · attempt 1
- 2026-10-10 T156 done → 635e8cba
- 2026-10-10 T157 launched · attempt 1
