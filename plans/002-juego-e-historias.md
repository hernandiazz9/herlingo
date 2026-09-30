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
- Status: running (attempt 1)
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
- Outcome:

## T15 — Explanations for getting-around and talking phrases
- Status: pending
- Depends on: T14
- Goal: Write the `explanation` for every phrase in units ordered 20–39 (move-*, talk-*): when to use it and one pronunciation tip.
- Context: docs/brief.md (learner: Spain Spanish "tú", A1, Sicily trip), docs/content-guide.md (explanation rules from T14). Files `content/it/units/2*.json` and `3*.json`. Keep each explanation 1–2 short lines, concrete ("Se lo dices al revisor cuando…"; "«gli» suena como una «ll» suave"). Don't change Italian texts or ids.
- Scope: may touch `content/it/units/2*.json`, `content/it/units/3*.json` (only adding `explanation`) / must not touch other files.
- Done when:
  - Every phrase in those units has an explanation (count reported).
  - `npm run verify` → exit 0.
- Outcome:

## T16 — Explanations for survival, emergencies and food phrases
- Status: pending
- Depends on: T14
- Goal: Write the `explanation` for every phrase in units ordered 10–19 and 40–49 (surv, emer, food) and any phrase in 90+ units: when to use it and one pronunciation tip.
- Context: same as T15. Files `content/it/units/1*.json`, `4*.json`, `9*.json`. Don't change Italian texts or ids.
- Scope: may touch `content/it/units/1*.json`, `content/it/units/4*.json`, `content/it/units/9*.json` (only adding `explanation`) / must not touch other files.
- Done when:
  - Every phrase in those units has an explanation (count reported).
  - `npm run verify` → exit 0.
- Outcome:

## T17 — Stories 1–6: arriving and moving around
- Status: pending
- Depends on: T14
- Goal: Write the first six stories of Hernán's trip, A1–A2, 80–150 words each, natural current Italian, with Spain-Spanish translation per sentence, 8–10 key words/expressions, 3–4 comprehension questions and 4–6 gap items each.
- Context: docs/brief.md (persona in content/it/units/32-persona-sobre-mi.json: Hernán, Spanish traveller, alone, ~10 days, Palermo → Cefalù → Agrigento → Catania → Siracusa), docs/content-guide.md (story format from T14). Stories: 1 Arrivo a Palermo (airport, Prestia e Comandè bus to the centre), 2 In ostello / B&B check-in, 3 Il mercato di Ballarò, 4 In treno per Cefalù (ticket, convalidare, ritardo), 5 Una giornata a Cefalù (spiaggia, chiedere indicazioni), 6 Il pullman per Agrigento (AST/SAIS, fermata, sciopero). Reuse existing vocab/phrase ids as key words where they exist (look them up), new ones inline with `story-` prefix. Order values 1–6. Delete `content/it/stories/sample-story.json`.
- Scope: may touch `content/it/stories/0[1-6]-*.json`, deleting the sample story / must not touch other content files, `src/**`, `public/**`.
- Done when:
  - 6 story files, each within 80–150 words, with the counts above (report them).
  - `npm run verify` → exit 0.
- Outcome:

## T18 — Stories 7–12: Sicily encounters
- Status: pending
- Depends on: T14
- Goal: Write the last six stories of the trip, same format and level as T17.
- Context: same as T17. Stories: 7 La Valle dei Templi e una chiacchierata, 8 Granita e brioche a Catania, 9 Al mercato del pesce di Catania, 10 In farmacia a Siracusa, 11 Una cena a Ortigia (prenotare, allergie, il conto), 12 L'ultimo giorno: saluti e ritorno. Order values 7–12. T17 deletes the sample story; do not touch it.
- Scope: may touch `content/it/stories/0[7-9]-*.json`, `content/it/stories/1[0-2]-*.json` / must not touch other content files, `src/**`, `public/**`.
- Done when:
  - 6 story files, each within 80–150 words, with the counts above (report them).
  - `npm run verify` → exit 0.
- Outcome:

## T19 — Game mode
- Status: pending
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
- Outcome:

## T20 — Stories reader and story games
- Status: pending
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
- Outcome:

## T21 — Story review and final audio
- Status: pending
- Depends on: T15, T16, T17, T18
- Goal: Native-level review of the 12 stories (Italian naturalness, level A1–A2, consistency of the trip narrative and persona, Spain-Spanish translations with "tú") and of a sample of the new explanations, then generate audio for every new playable.
- Context: docs/brief.md, docs/content-guide.md, docs/content-review.md (style of the previous review). Never rename or delete ids. `npm run audio` creates .venv itself and needs internet.
- Scope: may touch `content/it/**`, `public/audio/it/**`, `docs/content-review.md` / must not touch `src/**`.
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

## Proposals (new scope)

## Log
- 2026-09-30 19:20 T13 launched · attempt 1 · agent af774e91af56fba92
- 2026-09-30 19:20 T14 launched · attempt 1 · agent a12dc90909565ae69
- 2026-09-30 T13 done · branch worktree-agent-af774e91af56fba92 → 6b57eef
