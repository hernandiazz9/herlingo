# Plan 003 — Pictures for vocabulary

Status: active
Created: 2026-10-01
Base branch: main
Goal: Learn vocabulary faster with Duolingo-style pictures: flat illustrations for every drawable word (Microsoft Fluent Emoji Flat, MIT, plus custom SVGs drawn in the same style for the ~100 words it lacks), used in new lesson exercises (pick the picture from Spanish text or Italian audio, match pictures to Italian words, new-word intro card), in game mode (word cards in Descubrir, picture questions in the quick round), in a visual "Palabras" view inside the Frasario, in story keyword popovers, and as speaker avatars in dialogues. Everything stays offline (images precached, < 0.5 MB). MVP speed: no automated tests; verification is lint + content check + typecheck + build.
Test command: npm run verify
Worktree setup: npm ci

## Tasks

## T23 — Content model and pipeline for pictures
- Status: done
- Depends on: none
- Goal: Give the language pack an image contract and a build pipeline so content, drawing and UI tasks can work in parallel: an optional `image` on vocabulary (units and inline story keywords), an optional avatar on dialogue speakers, `npm run images`, content checks, loader helpers and one shared `Picture` component.
- Context: CLAUDE.md, docs/content-guide.md, `src/lib/content/{schema,types,build,index,keys}.ts`, `scripts/content.ts`, `scripts/audio/plan.ts` (pattern to copy: plan → files → strict check), `scripts/pwa/build.ts` (precaches all of `out/`, so `public/images/` is offline automatically). `plans/003-image-coverage.json` (read only) classifies all 358 vocab items: class A = fitting Fluent Emoji Flat icon (`image: "fluent:<icon>"`, 122), B = needs a custom drawing (`image: "custom:<slug>"`, slug = vocab id with dots → dashes, 102, split into drawTask T25/T26/T27), C = not drawable (134, no image).
  Decided with Hernán: image key format `fluent:<icon-name>` | `custom:<slug>`; Fluent SVGs come from the devDependency `@iconify-json/fluent-emoji-flat` (MIT) at build time, never at runtime; custom SVG sources live in `assets/images/custom/<slug>.svg` (language-agnostic); `npm run images` writes only the referenced images to `public/images/fluent/<icon>.svg` and `public/images/custom/<slug>.svg` (deterministic names, minified, unused files pruned; custom sources that do not exist yet are skipped with a warning) — committed like audio. Dark theme: pictures keep their colours on a card whose background is a surface token; pictures that are mostly near-black get a soft round backdrop in dark theme (detect it in the pipeline, e.g. luminance of the SVG fills, and expose a flag).
- Scope: may touch `src/lib/content/**`, `scripts/content.ts`, `scripts/images/**` (new), `package.json` (script + devDependency), `package-lock.json`, `src/components/ui/Picture.tsx` + `src/components/ui/index.ts`, `assets/images/custom/` (create with a README or `.gitkeep`), `public/images/**`, up to 8 vocab items in `content/it/units/40-cibo*.json` (sample `image` fields, use the coverage file's A icons), docs/content-guide.md, CLAUDE.md / must not touch other content files, routes, other components.
- Done when:
  - Vocab schema (units and inline story keywords) has optional `image`; dialogue speakers can carry an optional avatar image key (same format) — pick the right place in the dialogue schema and document it.
  - Runtime: a vocab item exposes `image?: { src: string; dark?: boolean }` only when the file exists in `public/images/` (missing images = no image, never a broken img). Loader helpers exported from `@/lib/content`: `listVocab({ situation?, withImage? })` (pack order) and whatever a UI task needs to get a vocab item by id with its image; dialogue avatars resolved the same way.
  - `npm run images` implemented as above; `npm run content:check` errors on an unknown fluent icon or malformed key and warns on a missing custom source; `npm run content:check -- --strict-images` fails if any referenced image is missing from `public/images/` or stale.
  - `Picture` component (`@/components/ui`): square rounded card, tokens only, sizes for 2×2 grid / intro card / small avatar, `alt` from a prop, dark-theme backdrop when flagged, works in both themes.
  - The 8 sample words show images after `npm run images`; files committed.
  - docs/content-guide.md documents image keys, the coverage file, the custom drawing style guide (viewBox 0 0 32 32 like Fluent, flat solid fills, rounded shapes, no outlines, no text, Fluent-like palette, centered with ~2px margin, < 6 KB) and the commands; CLAUDE.md gets the `npm run images` row and one convention line.
  - `npm run verify` → exit 0.
- Outcome: image key on vocab + dialogue `avatars` map, npm run images (Fluent via iconify + resvg dark detection), --strict-images, listVocab/getVocab/hasImage/getDialogueSpeakers, Picture (grid/intro/avatar), 8 sample words · 0a37a7e

## T24 — Assign pictures to vocabulary
- Status: pending
- Depends on: T23
- Goal: Put the `image` field on every A and B word of the pack following `plans/003-image-coverage.json`, fixing doubtful mappings, and generate the Fluent images.
- Context: docs/content-guide.md (image section from T23), `plans/003-image-coverage.json` (47 entries flagged `unsure`, each with a note: e.g. binario → railway-track, strada → motorway, ragazzo/ragazza → child emoji, conto/scontrino/ricevuta share receipt). Rule: a picture must clearly evoke the word for a learner; if a Fluent icon may mislead, either pick a better Fluent icon or switch it to `custom:<slug>` (then list it in Decisions so T32 draws it) or drop it. Words that share one icon are allowed, but list the groups in Decisions (UI tasks avoid them as options in the same question). B words get `custom:<slug>` exactly as in the coverage file — T25–T27 draw those files in parallel with this task; do not draw them here. Don't change Italian texts or ids.
- Scope: may touch `content/it/units/*.json` and `content/it/stories/*.json` (only adding/changing `image`), `public/images/fluent/**` / must not touch `assets/**`, `public/images/custom/**`, `src/**`, the coverage file.
- Done when:
  - Every A and B word has `image` (counts reported: fluent, custom, dropped, changed from the coverage file).
  - `npm run images` run, Fluent SVGs committed.
  - `npm run verify` → exit 0 (missing custom sources are warnings only).
- Outcome:

## T25 — Custom drawings: bar, restaurant and shopping
- Status: pending
- Depends on: T23
- Goal: Draw the custom SVGs for the coverage entries with `drawTask: "T25"` (34 words: cannolo, arancina, granita, brioche, cassata, panelle, sfincione, pistacchio, banco, cassa, cameriere, menù, forchetta…).
- Context: docs/content-guide.md (custom drawing style guide from T23), `plans/003-image-coverage.json` (file name = the `custom:<slug>` key; `reference` = a related icon in another set, for ideas only — never copy non-MIT artwork), Fluent Emoji Flat icons in `node_modules/@iconify-json/fluent-emoji-flat/icons.json` as the style reference (same viewBox, palette, level of detail). Each drawing must be recognisable at 80px, with no text inside. To check your work, render a contact sheet to PNG in a temp folder (e.g. with `npx @resvg/resvg-js-cli` or any SVG renderer you install outside the repo) on a light and a dark background next to a few Fluent icons, and look at it with the Read tool; redraw what does not read well.
- Scope: may touch `assets/images/custom/<slug>.svg` for the T25 entries only / must not touch `content/**`, `public/**`, `src/**`, `package.json`.
- Done when:
  - One SVG per T25 entry, each valid, within the style guide and < 6 KB (report count, sizes, and any word you think should stay without a picture).
  - `npm run verify` → exit 0.
- Outcome:

## T26 — Custom drawings: transport and lodging
- Status: pending
- Depends on: T23
- Goal: Draw the custom SVGs for the coverage entries with `drawTask: "T26"` (29 words: pullman, corriera, autostazione, biglietteria, macchinetta, obliteratrice, tabellone, controllore, capotreno, tassista, tassametro, POS, carrello, passaporto…).
- Context: same as T25.
- Scope: may touch `assets/images/custom/<slug>.svg` for the T26 entries only / must not touch `content/**`, `public/**`, `src/**`, `package.json`.
- Done when:
  - One SVG per T26 entry, each valid, within the style guide and < 6 KB (report count, sizes, and any word you think should stay without a picture).
  - `npm run verify` → exit 0.
- Outcome:

## T27 — Custom drawings: health, streets and the rest
- Status: pending
- Depends on: T23
- Goal: Draw the custom SVGs for the coverage entries with `drawTask: "T27"` (39 words: farmacia, sciroppo, tosse, scottatura, pronto soccorso, testa, gola, caviglia, mercato, bancarella, piazza, duomo, museo, vicolo, lungomare, strisce pedonali, la Spagna…).
- Context: same as T25.
- Scope: may touch `assets/images/custom/<slug>.svg` for the T27 entries only / must not touch `content/**`, `public/**`, `src/**`, `package.json`.
- Done when:
  - One SVG per T27 entry, each valid, within the style guide and < 6 KB (report count, sizes, and any word you think should stay without a picture).
  - `npm run verify` → exit 0.
- Outcome:

## T28 — Picture exercises and new-word intro in lessons
- Status: pending
- Depends on: T23
- Goal: Three new lesson steps generated automatically from the content: "Elige la imagen" (both directions), "Empareja" with pictures (Hernán's sketch), and a new-word intro card.
- Context: T23 API: `listVocab({ situation?, withImage? })` (withImage → `PicturedVocab[]`), `getVocab(id)`, `hasImage(item)`, `getDialogueSpeakers(dialogue)`, `ImageRef { src; dark? }`; `<Picture image alt size="grid"|"intro"|"avatar" bordered? className? />` from `@/components/ui`. Sample pictured words: food.caffe, cornetto, limone, panino (bar), food.vino, pesce, melanzane, uova (restaurante). CLAUDE.md (tokens only, light + dark; audio via `speak()` from a user gesture; content only via `@/lib/content`; never hard-code ids), `src/lib/exercises/{types,generate}.ts` (8 types, `generateSession()`), `src/components/exercises/**` (ExerciseView switch, Choice, Match, shared), `src/components/lesson/{LessonPlayer,FeedbackSheet}.tsx`, `src/lib/progress/**` + `src/lib/srs/**` (to know whether a word was seen before), `Picture` from T23. Build against T23's 8 sample words; the rest arrive in parallel (T24). Decided with Hernán:
  - Pick the picture: 4 square cards in a 2×2 grid, each with the picture and the Italian word below; tapping a card plays its audio and selects it; "Comprobar" then the green/red sheet. Variant A: prompt "¿Cuál es «el café»?" (Spanish). Variant B: Italian audio only (big play button, no text), the cards show pictures without the Italian word until checked.
  - Match with pictures: pictures in one column, Italian words (tap = audio) in the other, shuffled, 3–4 pairs.
  - New-word intro: the first time any vocab word appears (never seen in progress/SRS), show a card with its picture if it has one, Italian word with audio (auto-play from the tap that advanced), Spanish translation, "Continuar"; then it is asked as usual. Words already seen are not introduced again.
  - Picture steps only use words whose `image` is present; options never share the same image `src`; distractors from the same lesson first, then the same situation, then the pack. Picture exercises take part of the recognition slots for words with images; the existing match becomes a picture match when ≥ 3 lesson words have pictures. Repaso uses the same generator, so it gets them too.
- Scope: may touch `src/lib/exercises/**`, `src/components/exercises/**`, `src/components/lesson/**` / must not touch `content/**`, `src/lib/content/**`, `src/components/ui/**` (ask in Decisions if Picture needs a change), other routes.
- Done when:
  - A lesson with sample words shows the intro card for new words and the three picture steps; answers record outcomes like the other types; lessons without pictured words behave as before.
  - Both themes checked by eye on `npm run dev` (describe what you saw).
  - `npm run verify` → exit 0.
- Outcome:

## T29 — Pictures in game mode
- Status: pending
- Depends on: T23
- Goal: Bring pictured words into the game: word cards in Descubrir and picture questions in the 60-second round.
- Context: T23 API: `listVocab({ situation?, withImage? })` (withImage → `PicturedVocab[]`), `getVocab(id)`, `hasImage(item)`, `getDialogueSpeakers(dialogue)`, `ImageRef { src; dark? }`; `<Picture image alt size="grid"|"intro"|"avatar" bordered? className? />` from `@/components/ui`. Sample pictured words: food.caffe, cornetto, limone, panino (bar), food.vino, pesce, melanzane, uova (restaurante). CLAUDE.md, `src/lib/game/index.ts` (topics = situations with phrases, `buildDeck`, `makeQuestion`, known cards in `lang-lern:game:<lang>`), `src/components/game/{GameView,Discover,Round}.tsx`, `recordActivity` in `src/lib/progress/activity.ts`, `listVocab({ situation, withImage: true })` and `Picture` from T23. Decided with Hernán: inside each topic (and Mezcla) Descubrir deals the topic's pictured words first (card: big picture, Italian word with audio, Spanish), then phrases, same "La sé" / "Otra vez"; the round adds two question kinds for pictured words — "Escucha y elige la imagen" (audio → 2×2 pictures) and "¿Cuál es «el café»?" (Spanish → 2×2 pictures) — mixed with the existing ones; options never share the same image `src`. A topic with pictured words but no phrases becomes playable. Build against T23's sample words.
- Scope: may touch `src/lib/game/**`, `src/components/game/**`, `src/app/jugar/**` / must not touch `content/**`, `src/lib/content/**`, `src/components/ui/**`, other routes.
- Done when:
  - Descubrir and the round show picture cards/questions for topics with pictured words; scoring, combo, records, XP and SRS outcomes work for them like for phrases.
  - Both themes checked by eye on `npm run dev`.
  - `npm run verify` → exit 0.
- Outcome:

## T30 — "Palabras" view in the Frasario and pictures in story keywords
- Status: pending
- Depends on: T23
- Goal: A visual vocabulary view inside the Frasario and the word picture in the story keyword popover.
- Context: T23 API: `listVocab({ situation?, withImage? })` (withImage → `PicturedVocab[]`), `getVocab(id)`, `hasImage(item)`, `getDialogueSpeakers(dialogue)`, `ImageRef { src; dark? }`; `<Picture image alt size="grid"|"intro"|"avatar" bordered? className? />` from `@/components/ui`. Sample pictured words: food.caffe, cornetto, limone, panino (bar), food.vino, pesce, melanzane, uova (restaurante). CLAUDE.md, `src/components/phrasebook/{Phrasebook,ShowMode,search}.tsx` (phrases grouped by situation, chips, search, tap-to-play), `src/app/frasario/page.tsx`, story reader keyword popover in `src/components/stories/**`, `listVocab()` and `Picture` from T23. Decided with Hernán: a "Frases | Palabras" segmented switch at the top of the Frasario (remember the choice locally); Palabras groups words by situation (same chips and search, matching Italian or Spanish), shows a grid of picture cards (picture + Italian word); tapping a card plays its audio and shows the word with article and the Spanish translation; words without a picture follow at the end of each topic as text cards. No full-screen show mode for words. In stories, the keyword popover shows the picture when the word has one.
- Scope: may touch `src/components/phrasebook/**`, `src/app/frasario/**`, the keyword popover in `src/components/stories/**` / must not touch `content/**`, `src/lib/content/**`, `src/components/ui/**`, other routes.
- Done when:
  - `/frasario/` switches between Frases (unchanged) and Palabras as described; search and chips work in both.
  - Story keyword popovers show pictures when present.
  - Both themes checked by eye on `npm run dev`.
  - `npm run verify` → exit 0.
- Outcome:

## T31 — Speaker avatars in dialogues
- Status: pending
- Depends on: T23
- Goal: Every native speaker in the dialogues gets a Fluent Emoji Flat avatar (revisore, barista, farmacista…) shown next to their speech bubble.
- Context: T23 API: `listVocab({ situation?, withImage? })` (withImage → `PicturedVocab[]`), `getVocab(id)`, `hasImage(item)`, `getDialogueSpeakers(dialogue)`, `ImageRef { src; dark? }`; `<Picture image alt size="grid"|"intro"|"avatar" bordered? className? />` from `@/components/ui`. Sample pictured words: food.caffe, cornetto, limone, panino (bar), food.vino, pesce, melanzane, uova (restaurante). CLAUDE.md, docs/content-guide.md (avatar key from T23), `content/it/dialogues/*.json`, dialogue UI in `src/components/dialogue/**` and `src/app/dialogos/**`, `Picture` (small size) from T23. T23 put avatars at dialogue level: `"avatars": { "<native turn name>": "fluent:<icon>" }` (one dialogue has two native speakers); read them with `getDialogueSpeakers(dialogue)` / `NativeTurn.avatar`. Pick people emoji that match role and gender (e.g. `fluent:man-police-officer`, `fluent:woman-cook`); the learner's side has no avatar. Run `npm run images` so the avatar files exist.
- Scope: may touch `content/it/dialogues/**` (only adding avatar keys), `src/components/dialogue/**`, the dialogue route, `public/images/fluent/**` / must not touch other content, `src/lib/content/**`, `src/components/ui/**`.
- Done when:
  - Every native speaker in every dialogue has an avatar shown beside their bubble in both themes.
  - `npm run verify` → exit 0.
- Outcome:

## T32 — Picture review and final images
- Status: pending
- Depends on: T24, T25, T26, T27, T28, T29, T30, T31
- Goal: Make the whole picture set consistent and correct, then generate and commit every final image.
- Context: docs/content-guide.md, docs/content-review.md (style of previous reviews), `plans/003-image-coverage.json`, Decisions of T24–T27 in this plan (words switched to custom, shared icons, words left without picture). Run `npm run images`, then render a contact sheet PNG (outside the repo) of every referenced picture with its Italian word, on light and dark surfaces, and look at it with the Read tool: fix wrong or misleading mappings, redraw custom SVGs that clash with the Fluent style or do not read at 80px, draw any custom key still missing (or remove that `image`), and flag near-black pictures for the dark backdrop if the pipeline missed them. Never rename or delete ids.
- Scope: may touch `content/it/**` (only `image`/avatar fields), `assets/images/custom/**`, `assets/images/backdrop.json` (manual dark/light backdrop overrides), `public/images/**`, `docs/content-review.md`, `docs/content-guide.md` / must not touch `src/**`.
- Done when:
  - Fixes applied and appended to docs/content-review.md (categories with counts; total pictured words; final size of `public/images/`).
  - `npm run content:check -- --strict-images` → exit 0 and `npm run content:check -- --strict-audio` → exit 0.
  - `npm run verify` → exit 0 and the build log shows the precache total.
- Outcome:

## Decisions
- 2026-10-01 plan: image source = Microsoft Fluent Emoji Flat (MIT, via @iconify-json/fluent-emoji-flat at build time) + custom SVGs drawn by agents in the same style for all 102 drawable words it lacks; no AI images, no runtime keys. (Hernán)
- 2026-10-01 plan: `image` field on vocab (`fluent:<icon>` | `custom:<slug>`), `npm run images` → `public/images/`, committed, strict check like audio; only drawable words (122 Fluent + 102 custom; 134 abstract words stay without picture). (Hernán)
- 2026-10-01 plan: dark theme = pictures unchanged on a token card, soft backdrop for near-black ones. (Hernán)
- 2026-10-01 plan: lessons get pick-the-picture (Spanish text → picture and Italian audio → picture, 2×2), picture match with Italian words + audio (Hernán's sketch), and an intro card for every new word (picture when present). (Hernán)
- 2026-10-01 plan: game = pictured words inside each topic (Descubrir first, picture questions in the round). (Hernán)
- 2026-10-01 plan: visual vocabulary = "Frases | Palabras" switch in the Frasario, words without picture as text cards at the end of each topic; pictures also in story keyword popovers; no full-screen show mode for words. (Hernán)
- 2026-10-01 plan: Fluent avatars for native speakers in dialogues in this batch. (Hernán)
- 2026-10-01 plan: precache grows < 0.5 MB (measured: 122 Fluent icons ≈ 140 KB raw); everything precached, no cap. (orchestrator)
- 2026-10-01 plan: coverage file `plans/003-image-coverage.json` (read only for agents) fixes the custom slugs so T24 and T25–T27 run in parallel without coordination; drawing tasks never run `npm run images` (T32 does). Run every ready task at once (max speed). (orchestrator)

- 2026-10-01 T23: no image manifest; near-black detection via @resvg/resvg-js (≥60% painted area luminance < 0.07) writes `data-backdrop="dark"` into the SVG, manual overrides in assets/images/backdrop.json; dialogue avatars as dialogue-level `avatars` map keyed by native turn name; content:check validates every file in assets/images/custom (bad name/non-SVG/scripts = error; viewBox/text/raster/>6 KB = warning); --strict-images also errors on unreferenced public/images files; dark backdrop = bg-ink/45 + mix-blend-screen on bg-surface. (agent)
- 2026-10-01 orchestrator: T23 first integration failed only because main lacked the new devDependencies; installed them on main and merged. Added assets/images/backdrop.json to T32 scope. (orchestrator)

## Proposals (new scope)

## Log
- 2026-10-01 16:10 T23 launched · attempt 1 · agent a4034505d63a1bf0f
- 2026-10-01 16:24 T23 done · branch worktree-agent-a4034505d63a1bf0f → 0a37a7e
