# Plan 002 — Game mode and short stories

Status: active
Created: 2026-09-30
Base branch: main
Goal: Help Hernán get familiar with a lot of Italian fast before the Sicily trip, then polish details: a central "Jugar" button that opens a quick game mode by topic (discover cards with audio and a short explanation, then a 60-second listen-and-pick round), and a "Historias" section with 12 short stories following his trip, read sentence by sentence with Spanish on demand, followed by games on the story's words and expressions. Both feed XP, streak and spaced review. MVP speed: no automated tests; verification is lint + typecheck + content check + build.
Test command: npm run verify
Worktree setup: npm ci

## Tasks

## T13 — Navigation: central Jugar button and Historias tab
- Status: done
- Depends on: none
- Goal: Restructure the tab bar to Ruta · Historias · JUGAR (big central button) · Frases · Perfil, and move Repaso and Diálogos into cards on the Ruta home so nothing is lost.
- Context: CLAUDE.md (tabs live only in `src/lib/navigation.ts`, TabBar reads from it; tokens only, light + dark). Existing routes `/repaso/` and `/dialogos/` must keep working (deep links, SW precache). New routes `/jugar/` and `/historias/` are placeholders here; T18 and T19 fill them. Keep the central button visually distinct (raised, lemon or terracotta, press animation) and safe-area aware.
- Scope: may touch `src/lib/navigation.ts`, `src/components/shell/**`, `src/app/jugar/page.tsx`, `src/app/historias/page.tsx` (placeholders only), `src/app/page.tsx` and `src/components/path/**` (only to add Repaso and Diálogos cards with due-count / dialogue count), CLAUDE.md / must not touch `content/**`, `src/lib/content/**`, other routes' logic.
- Done when:
  - Tab bar shows Ruta · Historias · Jugar (central, prominent) · Frases · Perfil with correct active states; `/repaso/` and `/dialogos/` highlight Ruta.
  - Ruta home has a Repaso card (items due) and a Diálogos card linking to the existing pages.
  - `/jugar/` and `/historias/` exist as placeholders with Spain-Spanish copy.
  - `npm run verify` → exit 0.
- Outcome: tabs Ruta · Historias · Jugar (raised terracotta) · Frases · Perfil; Repaso/Diálogos cards on Ruta; placeholders · 6b57eef

## T14 — Content model: phrase explanations and stories
- Status: done
- Depends on: none
- Goal: Extend the language-pack contract so content tasks and UI tasks can work in parallel: an optional `explanation` on phrases, and a Story type with sentences, key words, comprehension questions and gap sentences; loader functions and audio coverage.
- Context: CLAUDE.md, docs/content-guide.md, `src/lib/content/{schema,types,index}.ts`, `scripts/content.ts`, `scripts/audio/plan.ts` (audio plan walks the Pack). Stories live in `content/<lang>/stories/*.json` (glob). Key words must be SRS-able: each key word references an existing vocab or phrase id, or defines a new vocab item inside the story file with its own id (prefix `story-`), so the Leitner store (ids) works unchanged. Every Italian string (sentences, key words, questions, answers) is a playable with audio key and voice.
- Scope: may touch `src/lib/content/**`, `scripts/content.ts`, `scripts/audio/**`, `content/it/stories/sample-*.json`, `docs/content-guide.md`, CLAUDE.md (one line) / must not touch UI routes, components, other content files.
- Done when:
  - Phrase schema has optional `explanation` (Spanish, "tú", 1–2 lines: when to use + pronunciation tip); types and loader expose it.
  - Story schema: id, title (it + es), situation, order, level, sentences [{id, it, es, voice?}], keywords (refs or inline vocab), comprehension questions [{question it, options, correct, es}], gap items [{sentence ref, answer keyword ref, distractors}]. Loader: `getStories()`, `getStory(id)`, and `listPlayables()` includes story playables; `npm run audio` plans them.
  - `content:check` validates stories (ids unique across the pack, refs resolve, 80–150 words guideline reported as warning only).
  - One sample story `content/it/stories/sample-story.json` (5 sentences, 4 keywords, 2 questions, 2 gaps) so UI tasks can build before real stories land; later story tasks delete it.
  - docs/content-guide.md documents explanations and stories (format, ids, voices, word count, number of keywords/questions/gaps).
  - `npm run verify` → exit 0.
- Outcome: phrase `explanation?`, Story schema + getStories/getStory/getStoryKeywords, stories in listPlayables/audio plan, content:check story validation, sample story · 9d1e54e

## T15 — Explanations for getting-around and talking phrases
- Status: done
- Depends on: T14
- Goal: Write the `explanation` for every phrase in units ordered 20–39 (move-*, talk-*): when to use it and one pronunciation tip.
- Context: docs/brief.md (learner: Spain Spanish "tú", A1, Sicily trip), docs/content-guide.md (explanation rules from T14). Files `content/it/units/2*.json` and `3*.json`. Keep each explanation 1–2 short lines, concrete ("Se lo dices al revisor cuando…"; "«gli» suena como una «ll» suave"). Don't change Italian texts or ids.
- Scope: may touch `content/it/units/2*.json`, `content/it/units/3*.json` (only adding `explanation`) / must not touch other files.
- Done when:
  - Every phrase in those units has an explanation (count reported).
  - `npm run verify` → exit 0.
- Outcome: 260/260 phrases in move/talk units have explanations · 69e85f9

## T16 — Explanations for survival, emergencies and food phrases
- Status: done
- Depends on: T14
- Goal: Write the `explanation` for every phrase in units ordered 10–19 and 40–49 (surv, emer, food) and any phrase in 90+ units: when to use it and one pronunciation tip.
- Context: same as T15. Files `content/it/units/1*.json`, `4*.json`, `9*.json`. Don't change Italian texts or ids.
- Scope: may touch `content/it/units/1*.json`, `content/it/units/4*.json`, `content/it/units/9*.json` (only adding `explanation`) / must not touch other files.
- Done when:
  - Every phrase in those units has an explanation (count reported).
  - `npm run verify` → exit 0.
- Outcome: 215/215 phrases in surv/emer/food/gram have explanations · bb95c64

## T17 — Stories 1–6: arriving and moving around
- Status: done
- Depends on: T14
- Goal: Write the first six stories of Hernán's trip, A1–A2, 80–150 words each, natural current Italian, with Spain-Spanish translation per sentence, 8–10 key words/expressions, 3–4 comprehension questions and 4–6 gap items each.
- Context: docs/brief.md (persona in content/it/units/32-persona-sobre-mi.json: Hernán, Spanish traveller, alone, ~10 days, Palermo → Cefalù → Agrigento → Catania → Siracusa), docs/content-guide.md (story format from T14). Stories: 1 Arrivo a Palermo (airport, Prestia e Comandè bus to the centre), 2 In ostello / B&B check-in, 3 Il mercato di Ballarò, 4 In treno per Cefalù (ticket, convalidare, ritardo), 5 Una giornata a Cefalù (spiaggia, chiedere indicazioni), 6 Il pullman per Agrigento (AST/SAIS, fermata, sciopero). Reuse existing vocab/phrase ids as key words where they exist (look them up), new ones inline with `story-` prefix. Order values 1–6. Delete `content/it/stories/sample-story.json`.
- Scope: may touch `content/it/stories/0[1-6]-*.json`, deleting the sample story / must not touch other content files, `src/**`, `public/**`.
- Done when:
  - 6 story files, each within 80–150 words, with the counts above (report them).
  - `npm run verify` → exit 0.
- Outcome: 6 stories (104–131 words, 9–10 keywords, 4 questions, 5–6 gaps), 0 warnings; sample deleted · aecfb6b

## T18 — Stories 7–12: Sicily encounters
- Status: done
- Depends on: T14
- Goal: Write the last six stories of the trip, same format and level as T17.
- Context: same as T17. Stories: 7 La Valle dei Templi e una chiacchierata, 8 Granita e brioche a Catania, 9 Al mercato del pesce di Catania, 10 In farmacia a Siracusa, 11 Una cena a Ortigia (prenotare, allergie, il conto), 12 L'ultimo giorno: saluti e ritorno. Order values 7–12. T17 deletes the sample story; do not touch it.
- Scope: may touch `content/it/stories/0[7-9]-*.json`, `content/it/stories/1[0-2]-*.json` / must not touch other content files, `src/**`, `public/**`.
- Done when:
  - 6 story files, each within 80–150 words, with the counts above (report them).
  - `npm run verify` → exit 0.
- Outcome: 6 stories (103–127 words, 10 keywords, 4 questions, 5–6 gaps), 0 warnings · dfee50d

## T19 — Game mode
- Status: done
- Depends on: T13, T14
- Goal: The quick game mode behind the central Jugar button: pick a topic, discover its phrases with audio and explanation, then a 60-second listen-and-pick round with combo, points and a record per topic.
- Context: CLAUDE.md (tokens only, light + dark; audio via `speak()` from a user gesture; content via `@/lib/content`, never hard-coded ids). Topics = situations in the pack that have phrases (`getSituation()`), with phrase count and personal record. Explanations arrive in parallel (T15/T16): show `explanation` when present, fall back to `notes` or nothing. Progress: use the existing store in `src/lib/progress/**` and SRS in `src/lib/srs/**` (add small exported helpers if needed: award XP, mark streak day, record item outcomes) — T20 runs in parallel and needs the same, so keep helpers additive in a new file `src/lib/progress/activity.ts` and coordinate by name: `recordActivity({ xp, outcomes })`.
- Scope: may touch `src/app/jugar/**`, `src/components/game/**`, `src/lib/game/**`, `src/lib/progress/activity.ts` / must not touch `content/**`, `src/lib/content/**`, other routes, navigation.
- Done when:
  - `/jugar/`: grid of topics with phrase counts and record; a "Mezcla" option with all topics.
  - Descubrir: one card per phrase (auto-plays on arrival after the first tap, replay, slow, translation, explanation), "La sé" / "Otra vez" (Otra vez cards come back at the end), skippable to the round.
  - Ronda rápida: 60 s, "Escucha y elige" questions (audio → pick the Spanish meaning among 4; and the reverse: Spanish → pick the Italian among 4, each playable), combo multiplier, score, end screen with record per topic stored locally.
  - XP and streak recorded, wrong items sent to SRS via `recordActivity`.
  - `npm run verify` → exit 0.
- Outcome: /jugar topic grid + Mezcla, Descubrir decks of 10, 60 s listen-and-pick round with combo x1–x4 and records, recordActivity · 92dfcd4

## T20 — Stories reader and story games
- Status: done
- Depends on: T13, T14
- Goal: The Historias section: list of the 12 stories in trip order with progress, a sentence-by-sentence reader with audio and Spanish on demand, then four games on the story (key words, fill the gaps, comprehension, order the story).
- Context: CLAUDE.md (tokens only, light + dark; audio via `speak()`; content via `@/lib/content` `getStories()/getStory()`; never hard-code ids). Build against the sample story; real stories arrive in parallel (T17/T18). Reuse answer checking from `src/lib/exercises` where it fits. Progress: same `recordActivity({ xp, outcomes })` helper as T19 in `src/lib/progress/activity.ts` — if it does not exist yet in your branch, create it with exactly that name and signature (additive, tolerant); the orchestrator resolves any merge overlap.
- Scope: may touch `src/app/historias/**`, `src/components/stories/**`, `src/lib/stories/**`, `src/lib/progress/activity.ts` / must not touch `content/**`, `src/lib/content/**`, other routes, navigation.
- Done when:
  - `/historias/`: stories in order with title (it + es), situation, done state; `/historias/[id]/` statically generated.
  - Reader: Italian text sentence by sentence; tap a sentence to hear it; per-sentence and global "Ver traducción"; "Escuchar todo" plays sentences in sequence with highlight; key words highlighted, tap shows meaning and plays it.
  - Games after reading (each skippable, then a summary): key words (match pairs + listen and pick), fill the gaps (chips), comprehension (3–4 questions with audio), order the story (tap sentences in order).
  - Finishing records XP, streak and wrong key words to SRS; story marked done locally.
  - `npm run verify` → exit 0.
- Outcome: /historias list + /historias/[id] reader (tap-to-hear, translations, Escuchar todo, keyword popovers) and 4 games, XP/streak/SRS, done state · 7fd21d4

## T21 — Story review and final audio
- Status: running (attempt 1)
- Depends on: T15, T16, T17, T18
- Goal: Native-level review of the 12 stories (Italian naturalness, level A1–A2, consistency of the trip narrative and persona, Spain-Spanish translations with "tú") and of a sample of the new explanations, then generate audio for every new playable.
- Context: docs/brief.md, docs/content-guide.md, docs/content-review.md (style of the previous review). Never rename or delete ids. Also remove the stale mentions of the deleted `stories/sample-story.json` in docs/content-guide.md (T17). Story voices: narrator Elsa, Hernán Diego, women Isabella (T17/T18). `npm run audio` creates .venv itself and needs internet.
- Scope: may touch `content/it/**`, `public/audio/it/**`, `docs/content-review.md`, `docs/content-guide.md` / must not touch `src/**`.
- Done when:
  - Fixes applied in place and appended to docs/content-review.md (categories with counts).
  - `npm run audio` run, mp3s committed; `npm run content:check -- --strict-audio` → exit 0.
  - `npm run verify` → exit 0.
- Outcome:

## Decisions
- 2026-09-30 plan: tabs become Ruta · Historias · Jugar (central) · Frases · Perfil; Repaso and Diálogos move into cards on Ruta. (Hernán)
- 2026-09-30 plan: game mode = Descubrir cards + 60 s round; the round uses only "Escucha y elige" (both directions). (Hernán)
- 2026-09-30 plan: explanation per phrase = when to use + pronunciation tip. (Hernán)
- 2026-09-30 plan: 12 trip stories, 80–150 words, read sentence by sentence; games: key words, fill the gaps, comprehension, order. Games and stories give XP, streak and feed SRS. (Hernán)
- 2026-09-30 plan: T19 and T20 share `recordActivity({ xp, outcomes })` in src/lib/progress/activity.ts; overlap resolved at integration. Up to 5 agents in parallel. (orchestrator)
- 2026-09-30 T13: navigation.ts NESTED list (repaso, dialogos → parent path), `central: true` for Jugar; new icons in src/components/shell/icons.tsx; Ruta top stats reduced to streak + XP. (agent)
- 2026-09-30 T14: story fields `text` (sentences/options), `title` + `titleEs`, question `es`, `correct` 0-based; ids story.<slug>, inline keywords story-<slug>, local s1/q1/g1; keywords may reference vocab, phrase or expression; gaps have optional `gap` form + built before/after; gap chips no audio; narrator voice = story voice or default; content:check warns outside 80–150 words, 8–10 keywords, 3–4 questions, 4–6 gaps; story order unique, sample uses 0. (agent)
- 2026-09-30 orchestrator: run all 6 ready tasks (T15–T20) at once, per Hernán's max-speed request. (orchestrator)
- 2026-09-30 T16: pronunciation respelling scheme: stressed syllable in capitals, gi/ge→dy, ci/ce→chi/che, z→ts/dz, gli→soft ll, gn→ñ, doubles marked, silent h. (agent)
- 2026-09-30 T15: explanation inserted before register; for phrases the learner hears (announcements, inspector) the tip says where you hear it and what to do. (agent)
- 2026-09-30 T19: recordActivity({lang?, xp, outcomes:{itemId,correct}[]}) wraps recordReviewResult(); only wrong items to SRS (+same-text ids); deck = 10 cards, unknown first, 'La sé' stored in lang-lern:game:<lang>; 10 pts × combo (x2@3, x3@6, x4@9); XP = 5 + 1 per right answer; card shows translation + explanation directly; round intro screen. (agent)
- 2026-09-30 T17: voices: narrator Elsa, Hernán Diego, other characters Isabella; inline keywords story-palermo-*/story-cefalu-*/story-pullman-agrigento-*; story 6 route Cefalù→Palermo train then pullman, AST strike/SAIS runs; prices plausible fiction; levels A1 (1,2,3,5) and A2 (4,6). (agent)
- 2026-09-30 T18: recurring character Chiara (teacher from Milan, frutta secca allergy) in 7, 11, 12; route Agrigento→Catania→Siracusa→Interbus to Catania airport; Hernán Diego, women Isabella, other men narrator; keyword prefixes story-agrigento/catania/siracusa/ortigia/ritorno-*. (agent)
- 2026-09-30 T20: kept T19 recordActivity; stories send every practised keyword (wrong→box 1, right→up), game sends only wrong ones; done state in lang-lern:stories:<lang>; XP 10 + 1 per first-try right; order game up to 5 sentences; summary counts as finished; keyword matching by word/article/plural/gap/stem. (agent)

## Proposals (new scope)
- 2026-09-30 T20: resetProgress on /perfil does not clear stories/game keys; ExitDialog says '¿Salir de la lección?' in stories; lesson components hard-code lang="it"; one keyword in story.pullman-per-agrigento is never highlighted.
- 2026-09-30 T17: docs/content-guide.md still mentions deleted stories/sample-story.json (lines 24, 120).
- 2026-09-30 T19: check game mode in light theme by eye.

## Log
- 2026-09-30 19:20 T13 launched · attempt 1 · agent af774e91af56fba92
- 2026-09-30 19:20 T14 launched · attempt 1 · agent a12dc90909565ae69
- 2026-09-30 T13 done · branch worktree-agent-af774e91af56fba92 → 6b57eef
- 2026-09-30 T14 stalled (watchdog) · resumed same agent via SendMessage
- 2026-09-30 20:21 T14 done · branch worktree-agent-a12dc90909565ae69 → 9d1e54e
- 2026-09-30 20:23 T15 launched · attempt 1 · agent aaf6fced4038653b6
- 2026-09-30 20:23 T16 launched · attempt 1 · agent a647d201261a0ed35
- 2026-09-30 20:23 T17 launched · attempt 1 · agent a0b08ee802ecd9d4b
- 2026-09-30 20:23 T18 launched · attempt 1 · agent acd02c29fc0662347
- 2026-09-30 20:23 T19 launched · attempt 1 · agent adc312cab832b2d6f
- 2026-09-30 20:23 T20 launched · attempt 1 · agent a34289261fb6eccd3
- 2026-09-30 T16 done · branch worktree-agent-a647d201261a0ed35 → bb95c64
- 2026-09-30 T15 done · branch worktree-agent-aaf6fced4038653b6 → 69e85f9
- 2026-09-30 T19 done · branch worktree-agent-adc312cab832b2d6f → 92dfcd4
- 2026-09-30 T17 done · branch worktree-agent-a0b08ee802ecd9d4b → aecfb6b
- 2026-09-30 T18 done · branch worktree-agent-acd02c29fc0662347 → dfee50d
- 2026-09-30 20:31 T20 integration conflict (activity.ts) · conflict message sent to same agent
- 2026-09-30 20:32 T21 launched · attempt 1 · agent af162457e0fd6a83d
- 2026-09-30 T20 done · branch worktree-agent-a34289261fb6eccd3 → 7fd21d4
