# Plan 008 — Inglés: English pack by CEFR level (A2 + B1), level selector

Status: active
Created: 2026-10-06
Base branch: plan-008-ingles (worktree .claude/worktrees/plan-008)
Goal: Add English (`en`, American English) as the third pack, the first one split by CEFR level. Packs gain optional generic `levels`; units, dialogues, stories and placement questions carry a `level`; the learner picks a level per language (stored on the device in a new key) and Ruta shows only that level's units, while the placement test suggests a level. This plan builds the foundation (levels, a generic `formal` register, contraction-aware answer matching, `content/en/pack.json`) and the full French-sized course for **A2 and B1** (each: 10 units + grammar, ~420 phrases, ~320 vocab, ~80 Q&A, 12 dialogues, 12 stories), 12 placement questions, then en-US neural audio and pictures on the Mac. B2 and C1 follow in a later plan with the same molds. Italian and French content and every on-device key stay untouched. MVP speed: no automated tests; verification is `npm run verify`.
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-06 13:38Z 💻
- Writer: 💻 desktop (worktree .claude/worktrees/plan-008)
- Branch: plan-008-ingles @ 4bb405e
- Next step: integrate T105/T106; then T108 placement, T107 stories
- Needs Hernán: -

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, docs/brief.md (app-wide decisions, do not edit), docs/brief-en.md (English pack note, Hernán 2026-10-06: levels, units, ids, register, cast, voices), docs/content-guide.md; docs/brief-fr.md and `content/fr/` are the closest model of a finished pack. UI copy is Spain Spanish with "tú", accessible names too.
- **Plans running in parallel.** Plan 006 (main checkout) and plan 007 voice (`.claude/worktrees/plan-007`, rewrites `src/lib/speech/**`, `src/lib/exercises/**` and the mic UI) run in other sessions. No task here touches those paths except T110, which waits until plan 007 is merged into main and merged into this branch.
- **Content only, generic code.** Adding English adds content; code changes are allowed only where the schema needs them, and must be generic: nothing in `src/`, `api/` or `scripts/` names English or `en` (no `lang === "en"`, no English word lists). Behaviour comes from `pack.json` fields (`levels`, `formalRegister`, `articles`, `equivalents`, `numberWords`). Italian and French work exactly as today: a pack without `levels` shows no selector.
- **Never lose on-device data.** Every existing `lang-lern:*` key keeps its name and shape. New state only in the new key `lang-lern:level:<lang>` `{ v: 1, level }` (tolerant parsing, covered by the Perfil backup automatically). Italian and French content files stay byte-identical (`git diff --stat content/it content/fr` empty in every task), and so do `public/audio/it/**` and `public/audio/fr/**`.
- **Schema (T90).** `Register` and `FormalRegister` gain `"formal"`; English `formalRegister: "formal"`. `Level` (`schema.ts`) becomes `A1 A2 B1 B2 C1 C2`. `pack.json` gains optional `levels: Level[]` (ordered) and optional `equivalents: Record<string, string>` (contracted → full form, lower case, used on both sides by answer and speech matching). With `levels`, `content:check` requires `level` (one of the pack's levels) on every unit, dialogue, story and placement question; without it, `level` is not allowed on units/dialogues/placement. A phrase/vocab/Q&A's level = its unit's level, derived by the loader. `content/en/pack.json` is written by T90 and only T90 edits it (content tasks report needed changes).
- **Level selector (T91).** `getLevel(lang)` / `setLevel(lang, level)` / `useLevel()` (framework-free + hook, like `@/lib/content/active`). Ruta shows only the selected level's units (unlock order within the level; progress of other levels kept); level chips on Ruta and in Perfil (only for packs with `levels`). Diálogos and Historias default to the selected level with a "Todos" option; Frasario shows everything with a level filter chip. Repaso and Jugar unchanged. Placement: each question has a `level`; the result suggests the highest level L where the learner got ≥ 2/3 of L's questions and every lower level also passed (else the first level), writes it on confirm ("Te recomendamos el nivel B1" + choose another), and still marks proven lessons as today.
- **English content (T92–T108).** docs/brief-en.md fixes unit ids, orders, situations, levels, register, ids and cast; docs/content-guide.md fixes the format. Each content task owns its own files under `content/en/` (no shared index). Unit files: `content/en/units/<order>-<unit-id>.json` (`30-a2-airport.json`, `130-b1-interview.json`); the loader sorts by `order`, not by file name. Story and dialogue `order`: A2 1–12, B1 101–112. Later units may reuse earlier English items by id. Content tasks do not run `npm run audio`/`npm run images` (T109 on the Mac does); they still set picture keys.
- Verification: `npm run verify` → exit 0 for every task. UI changes: check light and dark at 375 px with `npm run dev` or `npm run build && npm start` when the agent can; otherwise the writer queues a Visual line.

## Tasks

## T90 — English foundation: generic levels, `formal` register, en pack.json
- Status: done
- Depends on: none
- Where: any
- Goal: Make the schema, loader and checks ready for a levelled pack and write `content/en/pack.json`, per the Shared contract ("Schema"): `formal` register (dialogue badge "Registro formal" / "Registro informal" when the pack's `formalRegister` is `formal`, today's labels otherwise); `Level` A1–C2; optional `levels`, `equivalents`; `level` rules in `content:check`; loader exposes `pack.meta.levels`, `pack.meta.equivalents` and a derived level for units, dialogues, stories, placement questions and items. No change to answer matching or speech code here (plan 007 voice rewrites it; T110 wires `equivalents` in afterwards). `content/en/pack.json`: lang `en`, name "Inglés", nativeName "English", emoji 🇺🇸, speechLocale `en-US`, the four en-US voices, `formalRegister: "formal"`, `articles: ["a", "an"]`, `levels: ["A2", "B1"]`, the 18 situations of brief-en, `numberWords` 0–100 + hundreds + thousand, `equivalents` for the common contractions (I'm, you're, he's, it's, we're, they're, I've, I'll, I'd, don't, doesn't, didn't, can't, won't, isn't, aren't, wasn't, weren't, haven't, hasn't, couldn't, shouldn't, wouldn't, let's, what's, where's, that's, there's). `npm run content:check` and `verify` must pass while the English pack has no units yet (empty pack hidden from the language picker until it has a unit, generically).
- Context: `src/lib/content/schema.ts` (Register :33, FormalRegister :36, PackMeta :50, Level :295, PlacementQuestion :223, DialogueFile :272, UnitFile :210), `src/lib/content/build.ts` (register check :123, articles :129, story words :27), `src/lib/content/index.ts`, `src/components/dialogue/DialogueSimulator.tsx:11`, `src/lib/coach/practice.ts:27`, `content/fr/pack.json` (model); docs/content-guide.md (document `levels`, `level`, `equivalents`, `formal`, and point to brief-en).
- Scope: may touch `src/lib/content/**`, `src/components/dialogue/**`, the language picker component (empty-pack rule only), `scripts/content.ts`, `content/en/pack.json` (new), docs/content-guide.md / must not touch `content/it/**`, `content/fr/**`, `public/**`, `api/**`, `supabase/**`, `docs/brief*.md`, `src/lib/exercises/**`, `src/lib/speech/**` (plan 007 voice owns them), `plans/`.
- Done when:
  - `npm run content:check` → ✓ for it, fr and en; `git diff --stat content/it content/fr` → empty.
  - `grep -rnE '"en"|lang === .en|english' src scripts api` → nothing new beyond comments.
  - `npm run verify` → exit 0
- Outcome: schema: formal register, Level A1–C2, optional levels/equivalents, level rules in content:check, derived item levels, getLevels(); en/pack.json (en-US, a/an, A2+B1, 18 situations, numberWords, 29 equivalents); dialogue badge Registro formal/informal · a048f4c · verify ✓ 💻 · not checked: badge in UI

## T91 — Level selector: Ruta, Perfil, Diálogos, Historias, Frasario, placement suggestion
- Status: done
- Depends on: T90
- Where: any
- Goal: The learner chooses a CEFR level per language for packs with `levels`, per the Shared contract ("Level selector"): new key `lang-lern:level:<lang>`, `getLevel`/`setLevel`/`useLevel`, level chips on Ruta and Perfil, Ruta filtered to the level, Diálogos/Historias defaulting to it with "Todos", Frasario level filter, placement result suggesting a level. Packs without `levels` (it, fr) render exactly as before. Spain Spanish copy with "tú" ("Tu nivel", "Cambiar nivel", "Te recomendamos el nivel B1").
- Context: `src/app/page.tsx` (Ruta), `src/lib/progress/path.ts`, `src/app/perfil/`, `src/app/dialogos/`, `src/app/historias/`, `src/app/frasario/`, the placement/onboarding components, `src/lib/content/active.ts` + `use-active-lang` (pattern for the store and hook), `src/lib/backup/` (must pick up the new key with no change).
- Scope: may touch `src/app/**`, `src/components/**`, `src/lib/progress/**`, `src/lib/content/level*.ts` (new) / must not touch `content/**`, `public/**`, `api/**`, `supabase/**`, `plans/`.
- Done when:
  - With a temporary local levelled test pack (or English once T92 lands), Ruta shows only the selected level's units and switching level keeps each level's progress; Italian and French screens unchanged.
  - Only `lang-lern:level:<lang>` is new in localStorage; no other key renamed or rewritten.
  - `npm run verify` → exit 0
  - Hand check (PC): level chips on Ruta and Perfil, Diálogos/Historias/Frasario filters, placement suggestion, in light and dark at 375 px; Italian Ruta unchanged.
- Outcome: level.ts (get/set/subscribe/suggestLevel) + useLevel, LevelChips; Ruta filtered by level (side units order%100>=90), Perfil 'Tu nivel', Diálogos/Historias/Frasario view filters, placement suggests level, stored on 'Ir a mi ruta'; only new key lang-lern:level:<lang> · 7683f96 · verify ✓ 💻 · not checked: UI light/dark 375 px

## T92 — English A2: hello, numbers and A2 grammar
- Status: done
- Depends on: T90
- Where: any
- Goal: Units `a2-hello` (10), `a2-numbers` (12) and `a2-grammar` (90) with the 10 A2 grammar cards, per docs/brief-en.md: ~5-minute lessons ending with their Q&A, pronunciation tips for a Spanish speaker, US dates, prices and tipping, phone numbers and years.
- Context: docs/brief-en.md; docs/content-guide.md; `content/fr/units/10-salut.json`, `12-nombres.json`, `90-grammaire.json`, `content/fr/extras/grammaire.json` as format models (not as content).
- Scope: may touch `content/en/units/10-*.json`, `content/en/units/12-*.json`, `content/en/units/90-*.json`, `content/en/extras/grammar-a2.json` / must not touch `content/en/pack.json`, `content/it/**`, `content/fr/**`, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, ~10 grammar cards, 10–12 lessons in these three units, all `level: "A2"`.
  - Every phrase has `register` and an `explanation`; ids follow brief-en ("Ids").
  - `npm run verify` → exit 0
- Outcome: units a2-hello, a2-numbers, a2-grammar (10 gram.en-a2-* cards in the unit's grammar array): 12 lessons, 97 phrases, 72 vocab, 19 Q&A; numbers/years/prices as words · f81dc63 · verify ✓ 💻 · not checked: native review, audio/pictures (T109)

## T93 — English A2: about me, daily life
- Status: done
- Depends on: T90
- Where: any
- Goal: Units `a2-about-me` (20) and `a2-daily` (22) per docs/brief-en.md (persona: Hernán, from Madrid, programmer).
- Context: as T92 (format models `content/fr/units/20-presenter.json`, `30-maison.json`).
- Scope: may touch `content/en/units/20-*.json`, `content/en/units/22-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~80 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "A2"`.
  - `npm run verify` → exit 0
- Outcome: units a2-about-me (6 lessons) + a2-daily (5): 89 phrases, 68 vocab, 18 Q&A, 38 Fluent pictures; neutral with some formal/tu · 7356c8b · verify ✓ 💻 · not checked: native review, audio/pictures (T109)

## T94 — English A2: airport, hotel
- Status: done
- Depends on: T90
- Where: any
- Goal: Units `a2-airport` (30) and `a2-hotel` (32) per docs/brief-en.md.
- Context: as T92 (format models `content/it/units/` transport units, `content/fr/units/50-ville.json`).
- Scope: may touch `content/en/units/30-*.json`, `content/en/units/32-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "A2"`.
  - `npm run verify` → exit 0
- Outcome: units a2-airport + a2-hotel (5 lessons each): 87 phrases, 70 vocab, 19 Q&A; formal for I'd like/Could you · 56781fd · verify ✓ 💻 · not checked: native review, audio/pictures (T109)

## T95 — English A2: food, shopping
- Status: done
- Depends on: T90
- Where: any
- Goal: Units `a2-food` (40) and `a2-shopping` (42) per docs/brief-en.md (coffee shop, restaurant, tip; supermarket, clothes, returns).
- Context: as T92 (format models `content/fr/units/40-manger.json`, `42-courses.json`).
- Scope: may touch `content/en/units/40-*.json`, `content/en/units/42-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~90 phrases, ~70 vocab, ~16 Q&A, 10–12 lessons, `level: "A2"`.
  - `npm run verify` → exit 0
- Outcome: units a2-food (6 lessons) + a2-shopping (5): 98 phrases, 73 vocab, 18 Q&A, reuses earlier items by id · ffa24c6 · verify ✓ 💻 · not checked: native review, audio/pictures (T109)

## T96 — English A2: city, health
- Status: done
- Depends on: T90
- Where: any
- Goal: Units `a2-city` (50) and `a2-health` (52) per docs/brief-en.md (subway/bus/rideshare, directions; pharmacy, doctor, 911).
- Context: as T92 (format models `content/fr/units/50-ville.json`, `52-sante.json`).
- Scope: may touch `content/en/units/50-*.json`, `content/en/units/52-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~60 vocab, ~16 Q&A, 9–11 lessons, `level: "A2"`.
  - `npm run verify` → exit 0
- Outcome: units a2-city (Chicago: Ventra, 'L', Uber) + a2-health (drugstore, urgent care vs ER, 911): 10 lessons, 91 phrases, 61 vocab, 18 Q&A · 0987f5c · verify ✓ 💻 · not checked: native review, audio/pictures (T109)

## T97 — English A2: 12 dialogues
- Status: done
- Depends on: T92, T93, T94, T95, T96
- Where: any
- Goal: The 12 A2 dialogues listed in docs/brief-en.md (`level: "A2"`, `unit`, avatars, register-honest options with Spanish feedback).
- Context: docs/brief-en.md ("Dialogues and stories"); docs/content-guide.md (Dialogue file); `content/en/units/[1-9]*.json` (A2 units); `content/fr/dialogues/*.json` as format models.
- Scope: may touch `content/en/dialogues/a2-*.json` (new) / must not touch units, `pack.json`, `content/it/**`, `content/fr/**`, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; 12 A2 dialogues (6–10 turns, ≥ 3 learner turns, 3 options each).
  - `npm run verify` → exit 0
  - Hand check (PC): play two English dialogues with device voices.
- Outcome: 12 A2 dialogues (9 turns, 4 learner turns × 3 options, Spanish-speaker mistakes as distractors) · d91ede2 · verify ✓ 💻 · not checked: playing with device voices, avatars (T109)

## T98 — English A2: stories 1–6
- Status: done
- Depends on: T92, T93, T94, T95, T96
- Where: any
- Goal: A2 stories 1–6 with the brief-en cast in Chicago (Pablo's visit), `level: "A2"`, following the A2 units' order; key words reuse unit items by id where possible.
- Context: docs/brief-en.md; docs/content-guide.md (Story file, guidelines); A2 units; `content/fr/stories/01-*.json` as format model.
- Scope: may touch `content/en/stories/a2-0[1-6]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings (80–150 words, 8–10 key words, 3–4 questions, 4–6 gaps).
  - `npm run verify` → exit 0
- Outcome: A2 stories 1–6 (Pablo García visits Maya and Jordan in Logan Square), no ⚠; T99 outline in Decisions · 2ce823e · verify ✓ 💻 · not checked: native review, audio (T109)

## T99 — English A2: stories 7–12
- Status: done
- Depends on: T98
- Where: any
- Goal: A2 stories 7–12 (past simple in the last ones), continuing T98's cast and reusing its inline key words by id.
- Context: as T98, plus `content/en/stories/a2-0[1-6]-*.json`.
- Scope: may touch `content/en/stories/a2-0[7-9]-*.json`, `content/en/stories/a2-1[0-2]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings.
  - `npm run verify` → exit 0
- Outcome: A2 stories 7–12 per T98 outline (11–12 past simple; 12 sets up B1: Maya offers Pablo a job at her startup), new inline word story-en-deep-dish-pizza, no ⚠ · 4c1c036 · verify ✓ 💻 · not checked: native review, audio (T109)

## T100 — English B1: friends, plans and B1 grammar
- Status: done
- Depends on: T90
- Where: any
- Goal: Units `b1-friends` (110), `b1-plans` (112) and `b1-grammar` (190) with the 10 B1 grammar cards, per docs/brief-en.md; phrasal verbs explained in `notes`.
- Context: as T92; the A2 units and `content/en/units/90-a2-grammar.json` (its `grammar` array holds the A2 cards) once landed (reuse, don't duplicate).
- Scope: may touch `content/en/units/110-*.json`, `content/en/units/112-*.json`, `content/en/units/190-*.json` (the B1 grammar cards go in the `grammar` array of `190-b1-grammar.json`, like A2, so they get the B1 level) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~60 vocab, ~16 Q&A, ~10 grammar cards, 10–12 lessons, `level: "B1"`.
  - `npm run verify` → exit 0
- Outcome: units b1-friends + b1-plans + b1-grammar (10 gram.en-b1-* cards, 12 work phrasal verbs): 12 lessons, 101 phrases, 59 vocab, 19 Q&A · 0f454fe · verify ✓ 💻 · not checked: native review, audio/pictures (T109)

## T101 — English B1: office, email and calls
- Status: done
- Depends on: T90
- Where: any
- Goal: Units `b1-office` (120) and `b1-calls` (122) per docs/brief-en.md (first days at work, team, stand-ups; email, chat, phone and video calls).
- Context: as T100.
- Scope: may touch `content/en/units/120-*.json`, `content/en/units/122-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "B1"`.
  - `npm run verify` → exit 0
- Outcome: units b1-office + b1-calls (5 lessons each): 94 phrases, 67 vocab, 18 Q&A; formal emails vs casual chat · 08fdeb0 · verify ✓ 💻 · not checked: native review, audio/pictures (T109)

## T102 — English B1: job interview, technology
- Status: done
- Depends on: T90
- Where: any
- Goal: Units `b1-interview` (130) and `b1-tech` (132) per docs/brief-en.md (experience, skills, questions to ask; computers, apps, explaining a problem, IT support).
- Context: as T100.
- Scope: may touch `content/en/units/130-*.json`, `content/en/units/132-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "B1"`.
  - `npm run verify` → exit 0
- Outcome: units b1-interview + b1-tech (5 lessons each): 92 phrases, 68 vocab, 18 Q&A, new phrasal verbs tagged · fbd3ec5 · verify ✓ 💻 · not checked: native review, audio/pictures (T109)

## T103 — English B1: travel problems, renting
- Status: done
- Depends on: T90
- Where: any
- Goal: Units `b1-trips` (140) and `b1-renting` (142) per docs/brief-en.md (delays, lost luggage, complaints, rebooking; renting, bills, repairs, neighbours).
- Context: as T100.
- Scope: may touch `content/en/units/140-*.json`, `content/en/units/142-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "B1"`.
  - `npm run verify` → exit 0
- Outcome: units b1-trips (delays, rebooking, lost luggage, complaints, on the road) + b1-renting (5 lessons each): 94 phrases, 68 vocab, 20 Q&A · edc33c4 · verify ✓ 💻 · not checked: native review, audio/pictures (T109)

## T104 — English B1: bank and money, telling what happened
- Status: done
- Depends on: T90
- Where: any
- Goal: Units `b1-money` (150) and `b1-stories` (152) per docs/brief-en.md (account, payments, returns and complaints; experiences, anecdotes, feelings with past tenses).
- Context: as T100.
- Scope: may touch `content/en/units/150-*.json`, `content/en/units/152-*.json` / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; ~85 phrases, ~65 vocab, ~16 Q&A, 9–11 lessons, `level: "B1"`.
  - `npm run verify` → exit 0
- Outcome: units b1-money + b1-stories (5 lessons each): 97 phrases, 68 vocab, 16 Q&A, reuses A2/B1 items · 7aa62c2 · verify ✓ 💻 · not checked: native review, audio/pictures (T109)

## T105 — English B1: 12 dialogues
- Status: running (attempt 1 · 💻 · agent a2fac5b84b0da1e21 · since 13:33Z)
- Depends on: T100, T101, T102, T103, T104
- Where: any
- Goal: The 12 B1 dialogues listed in docs/brief-en.md (`level: "B1"`, longer turns, more `formal`/`tu` contrast at work vs with friends).
- Context: as T97, plus `content/en/dialogues/a2-*.json` once landed and the B1 units.
- Scope: may touch `content/en/dialogues/b1-*.json` (new) / must not touch units, `pack.json`, `content/it/**`, `content/fr/**`, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; 12 B1 dialogues (6–10 turns, ≥ 3 learner turns, 3 options each).
  - `npm run verify` → exit 0
- Outcome:

## T106 — English B1: stories 1–6
- Status: done
- Depends on: T99, T100, T101, T102, T103, T104
- Where: any
- Goal: B1 stories 1–6 (Pablo back in Chicago working at Maya's startup), `level: "B1"`, mixed tenses, same cast as A2, reusing inline key words by id.
- Context: as T98, plus `content/en/stories/a2-*.json` and the B1 units.
- Scope: may touch `content/en/stories/b1-0[1-6]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings.
  - `npm run verify` → exit 0
- Outcome: B1 stories 101–106 (office, party/Nina, cancelled plans, video call with Mr. Park, Jordan's studio interview, IT bug), side cast Sam/Priya/Nina/Mr. Park/Kevin, no ⚠ · 4bb405e · verify ✓ 💻 · not checked: native review, audio (T109)

## T107 — English B1: stories 7–12
- Status: pending
- Depends on: T106
- Where: any
- Goal: B1 stories 7–12 continuing T106.
- Context: as T106, plus `content/en/stories/b1-0[1-6]-*.json`.
- Scope: may touch `content/en/stories/b1-0[7-9]-*.json`, `content/en/stories/b1-1[0-2]-*.json` (new) / must not touch other `content/**` files, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓ with no story ⚠ warnings.
  - `npm run verify` → exit 0
- Outcome:

## T108 — English placement test (A2 + B1)
- Status: pending
- Depends on: T91, T92, T93, T94, T95, T96, T100, T101, T102, T103, T104
- Where: any
- Goal: 12 graded placement questions (6 `level: "A2"`, 6 `level: "B1"`, easy → hard), spread over the units of each level, each marking the lessons it proves, so T91's suggestion picks A2 or B1.
- Context: docs/brief-en.md; docs/content-guide.md (Placement); `content/fr/extras/placement.json` as format model; every `content/en/units/*.json`.
- Scope: may touch `content/en/extras/placement.json` (new) / must not touch units, `pack.json`, `content/it/**`, `content/fr/**`, `src/**`, `public/**`, `plans/`.
- Done when:
  - `npm run content:check` → ✓; 12 questions, 6 per level, covering every unit except the grammar units.
  - `npm run verify` → exit 0
  - Hand check (PC): English placement answered well → suggests B1; answered poorly → A2.
- Outcome:

## T109 — English audio and pictures, final offline check
- Status: pending
- Depends on: T97, T99, T105, T107, T108
- Where: pc (edge-tts needs the Mac's internet; on-device check)
- Goal: Generate en-US neural mp3 for every English playable and the English pictures, commit them, and prove the English course (A2 and B1) works offline with only its audio cached.
- Context: CLAUDE.md commands (`npm run audio`, `npm run images`, strict checks); docs/brief-en.md ("Audio and pictures"); plan 006 T73 (same job for French).
- Scope: may touch `public/audio/en/**` (new), `public/images/**`, `assets/images/custom/**` only if an English vocab needs a new drawing (else pick a Fluent icon in the content and note it), `content/en/**` except `pack.json` (picture keys or text fixes the audio run reveals) / must not touch `public/audio/it/**`, `public/audio/fr/**` (byte-identical), `src/**`, `plans/`.
- Done when:
  - `npm run audio && npm run images` → exit 0; `git diff --stat public/audio/it public/audio/fr` → empty.
  - `npm run content:check -- --strict-audio --strict-images` → exit 0.
  - `npm run verify` → exit 0
  - Hand check (PC): installed PWA with English active, airplane mode: an A2 lesson, a B1 dialogue and a story play neural audio; switching it ↔ en keeps each language's progress.
- Outcome:

## T110 — Contraction-aware answer and speech matching (`equivalents`)
- Status: blocked (waits for plan 007 voice merged into main, then main merged into plan-008-ingles)
- Depends on: T90
- Where: any
- Goal: Answer matching and speech scoring (whatever plan 007 voice leaves in place) expand the active pack's `pack.json` `equivalents` on both sides, so "I'm" and "I am", "don't" and "do not" count as equal, and hyphenated number words ("twenty-one") match. Generic: packs without `equivalents` (it, fr) behave exactly as before.
- Context: `src/lib/exercises/normalize.ts`, `src/lib/speech/**` as plan 007 voice left them; `content/en/pack.json` `equivalents` (T90).
- Scope: may touch `src/lib/exercises/**`, `src/lib/speech/**` / must not touch `content/**`, `public/**`, `api/**`, `plans/`.
- Done when:
  - A scratch check (not committed) shows `I'm from Madrid` ↔ `I am from Madrid` pass both ways with the en pack and fail with the it pack; "twenty-one" matches 21.
  - `npm run verify` → exit 0
- Outcome:

## Review queue
- [ ] T90 @a048f4c — code review (schema, build.ts levels) (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T91 @7683f96 — code review (path.ts, level store) (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T92 @f81dc63 — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T93 @7356c8b — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T94 @56781fd — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T96 @0987f5c — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T95 @ffa24c6 — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T98 @2ce823e — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T97 @d91ede2 — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T99 @4c1c036 — English language review (gap distractors) (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T100 @0f454fe — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T101 @08fdeb0 — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T102 @fbd3ec5 — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T103 @edc33c4 — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T104 @7aa62c2 — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T106 @4bb405e — English language review (queued 2026-10-06 💻) (queued 2026-10-06 💻)

## Visual checks queue
- [ ] T91 @7683f96 — level chips Ruta/Perfil, Diálogos/Historias/Frasario filters, placement suggestion; light + dark 375 px; Italian Ruta unchanged; 'Tu nivel' vs 'Tu nivel para la IA' in Perfil (queued 2026-10-06 💻) (queued 2026-10-06 💻)
- [ ] T97 @d91ede2 — play two English A2 dialogues with device voices (queued 2026-10-06 💻) (queued 2026-10-06 💻)

## Decisions
- 2026-10-06 plan: English (`en`) is the third pack, American English (en-US voices and speechLocale, US spelling and formats); content only, generic code where the schema needs it; product note in docs/brief-en.md (docs/brief.md not edited); never lose on-device data, it/fr content and audio byte-identical. (Hernán)
- 2026-10-06 plan: English is split by CEFR level with a per-language level selector (generic `levels` in pack.json; Ruta filtered to the chosen level; Diálogos/Historias default to it; Frasario filter); the placement test suggests a level; A2–C1 for English, other packs unchanged. (Hernán)
- 2026-10-06 plan: full French volume per level (~10 units + grammar, ~420 phrases, ~320 vocab, ~80 Q&A, 12 dialogues, 12 stories); plan 008 = foundation + A2 + B1, B2 and C1 in a later plan. (Hernán)
- 2026-10-06 plan: topics mix everyday life with travel and work/technology, harder each level. (Hernán)
- 2026-10-06 plan: register: generic `formal` value added to Register/FormalRegister; English uses `neutral` mostly, `formal` for polite/formal wording, `tu` for casual; badge "Registro formal/informal". (Hernán)
- 2026-10-06 plan: vocab articles `a`/`an` on countable singular nouns, none on uncountable/plural, no gender. (Hernán)
- 2026-10-06 plan: stories in Chicago with a fixed cast across levels (Maya, Jordan, Mrs. Carter, Pablo). (Hernán)
- 2026-10-06 plan: Prepárate and Liga need nothing for English (already per language). (Hernán)
- 2026-10-06 plan: contractions matched through generic `pack.json` `equivalents` (survey: normalizeAnswer splits "don't" into "don t"; "I am" vs "I'm" would fail); the matching code waits for plan 007 voice (T110). (orchestrator)
- 2026-10-06 plan: Base branch `plan-008-ingles` from main @ 1c8aab4, in its own worktree `.claude/worktrees/plan-008`: plan 006 (main checkout) and plan 007 voice (`.claude/worktrees/plan-007`, T76–T84) run in other sessions at the same time; this plan was drafted as 007 and renumbered to 008 / T90+ to avoid collisions. Hybrid push policy: the writer pushes the plan branch after every integrated task; never main, no PR, merge or deploy without Hernán's OK. (orchestrator)
- 2026-10-06 T92: grammar cards live in the grammar unit's own grammar array (not extras) so they get the level; T100 scope updated accordingly. (orchestrator)
- 2026-10-06 T98: outline for A2 stories 7–12 (T99): 7 coffee shop + deep-dish pizza, tip; 8 winter coat + returning a sweater; 9 L train to the Loop, lost, the lake; 10 cold, pharmacy via Mrs. Carter; 11 urgent care + telling his week (past simple); 12 goodbye at O'Hare (past simple), sets up B1. Voices: narrator Ava, Pablo Andrew, Maya/Mrs. Carter Emma (never together), Jordan Brian. (agent)
- 2026-10-06 plan: Hernán: plan 008 runs entirely on the Mac (this session), not in the cloud. (Hernán)
- 2026-10-06 T106: outline for B1 stories 7–12 (T107): 107 one-bedroom on Halsted (lease, deposit, utilities); 108 moving in (leak/heating, the super, noisy neighbors, Mrs. Carter helps); 109 checking account, card declined, unknown charge; 110 work trip to Denver, delay, missed connection, rebooked; 111 lost suitcase + telling it back with past continuous; 112 one year in Chicago, party, Pablo decides to stay. Jordan now works at a recording studio. Voices: side characters reuse a non-speaking cast member's voice (Sam/Mr. Park/Kevin Brian, Nina Emma). (agent)

## Proposals (new scope)
- 2026-10-06 T90: Prepárate PackView/PackPractice still label register 'Trato de usted/tú'; English coach packs would show it
- 2026-10-06 T91: docs/content-guide.md should document the order%100>=90 side-unit rule for levelled packs

## Log
- 2026-10-06 11:30Z 💻 plan written from the interview; not approved yet
- 2026-10-06 11:41Z 💻 plan approved by Hernán (as 007; renumbered 008/T90+ after plan 007 voice appeared); T90 launched · attempt 1 · agent aab34ce7c5a906ee7
- 2026-10-06 11:45Z 💻 T90 done · worktree-agent-aab34ce7c5a906ee7 → a048f4c · verify ✓
- 2026-10-06 11:45Z 💻 T91 launched · attempt 1 · agent abe7cc49ff9a9bd1b
- 2026-10-06 11:45Z 💻 T92 launched · attempt 1 · agent adea40484a0eb938e
- 2026-10-06 11:52Z 💻 T91 done · worktree-agent-abe7cc49ff9a9bd1b → 7683f96 · verify ✓
- 2026-10-06 11:52Z 💻 T93 launched · attempt 1 · agent a82a20e7ade54cab9
- 2026-10-06 11:54Z 💻 T92 done · worktree-agent-adea40484a0eb938e → f81dc63 · verify ✓
- 2026-10-06 11:54Z 💻 T94 launched · attempt 1 · agent a2b5e82c901d31a33
- 2026-10-06 12:00Z 💻 T93 done · worktree-agent-a82a20e7ade54cab9 → 7356c8b · verify ✓
- 2026-10-06 12:00Z 💻 T95 launched · attempt 1 · agent ae9ae727412ff8139
- 2026-10-06 12:00Z 💻 T94 done · worktree-agent-a2b5e82c901d31a33 → 56781fd · verify ✓
- 2026-10-06 12:00Z 💻 T96 launched · attempt 1 · agent a2c3dd70602ba7d52
- 2026-10-06 12:09Z 💻 T96 done · worktree-agent-a2c3dd70602ba7d52 → 0987f5c · verify ✓
- 2026-10-06 12:09Z 💻 T95 done · worktree-agent-ae9ae727412ff8139 → ffa24c6 · verify ✓
- 2026-10-06 12:09Z 💻 T97 launched · attempt 1 · agent af3986671c9ff79ca
- 2026-10-06 12:09Z 💻 T98 launched · attempt 1 · agent a5ade6dd27df593cd
- 2026-10-06 12:15Z 💻 T98 done · worktree-agent-a5ade6dd27df593cd → 2ce823e · verify ✓
- 2026-10-06 12:15Z 💻 T97 done · worktree-agent-af3986671c9ff79ca → d91ede2 · verify ✓; usage limit, writer released
- 2026-10-06 13:09Z 💻 resumed on 💻 (Hernán: all on the Mac); T99 launched · agent aff36bf9f0b5fb64f; T100 launched · agent a31a5f0d322050405
- 2026-10-06 13:15Z 💻 T99 done · worktree-agent-aff36bf9f0b5fb64f → 4c1c036 · verify ✓
- 2026-10-06 13:15Z 💻 T101 launched · attempt 1 · agent af79a9ac470fd9c2c
- 2026-10-06 13:17Z 💻 T100 done · worktree-agent-a31a5f0d322050405 → 0f454fe · verify ✓
- 2026-10-06 13:17Z 💻 T102 launched · attempt 1 · agent a564d131cc1effd2d
- 2026-10-06 13:23Z 💻 T101 done · worktree-agent-af79a9ac470fd9c2c → 08fdeb0 · verify ✓
- 2026-10-06 13:23Z 💻 T103 launched · attempt 1 · agent a4c5260f9084f5cfc
- 2026-10-06 13:25Z 💻 T102 done · worktree-agent-a564d131cc1effd2d → fbd3ec5 · verify ✓
- 2026-10-06 13:25Z 💻 T104 launched · attempt 1 · agent aac01f4b40eee4d97
- 2026-10-06 13:32Z 💻 T103 done · worktree-agent-a4c5260f9084f5cfc → edc33c4 · verify ✓
- 2026-10-06 13:33Z 💻 T104 done · worktree-agent-aac01f4b40eee4d97 → 7aa62c2 · verify ✓
- 2026-10-06 13:33Z 💻 T105 launched · agent a2fac5b84b0da1e21; T106 launched · agent ab9c8ed4cb82f5db9
- 2026-10-06 13:38Z 💻 T106 done · worktree-agent-ab9c8ed4cb82f5db9 → 4bb405e · verify ✓
