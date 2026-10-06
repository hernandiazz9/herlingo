# Content guide (language packs)

How to write learning content. The source of truth for the format is
`src/lib/content/schema.ts` (zod); this guide explains it. Run `npm run content:check` after every
change: it must print `✓ content/<lang>: …` and exit 0.

## File layout

```
content/<lang>/
  pack.json            Pack meta: language, flag, speech locale, voices, situations, register,
                       articles, default flag. Rarely edited.
  units/*.json         One unit per file, self-contained: its lessons AND the items they teach.
  dialogues/*.json     One dialogue per file.
  extras/*.json        Items that belong to no unit (phrasebook-only phrases, Sicilian
                       expressions, placement questions...). Any number of files.
  stories/*.json       One short story per file (Historias), e.g. `stories/01-arrivo-a-palermo.json`.
```

Files are discovered by glob: **there is no index to edit**. Adding a unit = adding a file, so
parallel tasks never touch the same file. Name files after what they hold, e.g.
`units/20-tren.json`, `dialogues/tren-biglietteria.json`, `extras/siciliano.json`.

**Several packs.** Each language is one folder (`content/it/`, `content/fr/`…). Exactly one
`pack.json` sets `"default": true` (Italian): it is the app's fallback language and comes first
in the language picker; `content:check` fails with zero or several defaults. A pack with no units
yet is accepted (`content:check` reports it as empty). Situations are per pack.

The `sample` demo pack (files whose name contains `sample`) has been removed from `it`; do not
ship sample files in a real pack.

## Ids

- Format: lowercase `a-z0-9` words joined by a single `-` or `.` (`tren.un-biglietto-per`).
  `--` is forbidden (it is reserved for audio keys).
- **One namespace across every pack**: units, lessons, phrases, vocab, Q&A, grammar cards,
  expressions, dialogues, stories (and inline story key words) and placement questions must all
  have different ids, in this pack and in every other pack (routes like `/leccion/<id>/` are shared
  by all packs). Use the pack's own slugs (French: `salut.bonjour`, `gram.fr-etre`,
  `dlg.fr-boulangerie`, `story.fr-<slug>`, `story-fr-<slug>`; see docs/brief-fr.md).
  Situation ids are per pack.
- **Stable**: progress (localStorage) and audio files are keyed by id. Never rename an id once
  shipped; fix the text instead.
- Conventions:

| Thing | Pattern | Example |
| --- | --- | --- |
| unit | `<slug>` | `tren` |
| lesson | `<unit>.l.<slug>` | `tren.l.biglietti` |
| phrase / vocab | `<unit>.<slug>` | `tren.binario`, `tren.a-che-ora-parte` |
| Q&A | `<unit>.qa.<slug>` | `tren.qa.biglietto` |
| grammar card | `gram.<slug>` | `gram.vorrei` |
| expression | `sic.<slug>` | `sic.amuni` |
| dialogue | `dlg.<slug>` | `dlg.biglietteria` |
| placement | `placement.<slug>` | `placement.saludos` |
| story | `story.<slug>` | `story.arrivo-a-palermo` |
| story key word defined inline | `story-<slug>` | `story-finestrino`, `story-in-ritardo` |
| story sentence / question / gap | local: `s<n>` / `q<n>` / `g<n>` | `s1`, `q2`, `g3` |

Sentence, question and gap ids are local to their story (unique inside it, one namespace).

## Unit order ranges

Units are sorted by `order` (integer, unique in the pack). Pick a number inside your range and
leave gaps:

| Range | Content |
| --- | --- |
| 0–9 | demo / sample only |
| 10–19 | survival basics (greetings, courtesy, numbers, "no entiendo", emergencies) |
| 20–29 | getting around (train, bus, airport, taxi, on foot) |
| 30–39 | talking with Italians (introducing yourself, small talk) |
| 40–49 | food (bar, restaurant) |
| 90+ | minimal grammar and Sicilian (recognition only) |

## Schema

`?` = optional. All text fields must be non-empty. Spanish is **Spain Spanish with "tú"**.

**pack.json**: `default?` (`true` on exactly one pack), `lang` (= folder name), `name` (in
Spanish, "Francés"), `nativeName` ("Français"), `emoji?` (flag shown by the language picker, 🇫🇷),
`speechLocale` (`it-IT`), `voices` (edge-tts voice names; the first is the default),
`formalRegister` (`lei` | `vous`: the formal register this pack's items use), `articles` (definite
articles allowed in vocab `article`: Italian `il lo la l' i gli le`, French `le la l' les`),
`numberWords` (optional, `{ "40": "quaranta", … }`: speech recognition often returns digits, so
spoken answers are compared with digits written out with these words), `situations`
(`{ id, title, emoji? }`, phrasebook sections in display order). If you need a new situation, add
one line here.

**Unit file** (`units/*.json`): `id`, `order`, `title`, `description?`, `emoji?`, `situation`,
`lessons`, plus the item arrays `phrases`, `vocab`, `qa`, `grammar`, `expressions` (each optional).

- **Lesson**: `id`, `title`, `items` — ids (at least 1) of phrases, vocab, Q&A, grammar cards or
  expressions, in teaching order. Items may come from any file of the pack. Aim for ~5 minutes:
  8–30 items (the Italian lessons hold 8–29). Vocab and short phrases are quick, so a lesson
  can be long; keep it to one situation and end with its Q&A items.

**Items**

- **Phrase**: `id`, `text` (target language, as spoken), `es`, `literal?` (word for word, only when
  it helps), `notes?` (short Spanish usage note), `explanation?` (see below), `register`
  (`tu` | `neutral` | the pack's `formalRegister`: `lei` in Italian, `vous` in French),
  `situation`, `tags?`, `voice?`.
- **Phrase `explanation`** (shown on the Jugar discovery cards; the UI falls back to `notes`):
  Spain Spanish with "tú", **1–2 short lines, max ~200 characters**: (1) when you use it, concrete
  (who you say it to, where), and (2) one pronunciation tip for the tricky sound, written for a
  Spanish speaker. Don't repeat the translation. Example for "Vorrei un biglietto per Catania.":
  `"Lo dices en la taquilla o a la máquina de billetes. «gli» suena como una «ll» suave: bi-LLE-tto."`
- **Vocab**: `id`, `word` (bare), `article?` (one of pack.json `articles`: `il`, `lo`, `la`, `l'`, `i`, `gli`, `le` in Italian),
  `gender?` (`m` | `f` | `mf`), `plural?` (bare word, no article: "biglietti", "autobus"), `es` (with article for nouns: "el billete"), `notes?`,
  `example?` (a phrase id), `situation?`, `tags?`, `voice?`, `image?` (picture key, see
  "Pictures"). It is spoken as article + word ("il biglietto", "l'orario").
- **Q&A** (for "answer" exercises): `id`, `question` (what the Italian asks), `questionEs`,
  `accepted` (≥ 1 `{ text, es }`; the first is the model answer), `distractors` (≥ 2 `{ text, es }`,
  plausible but wrong), `register`, `situation`, `notes?`, `tags?`, `voice?` (of the question).
- **Grammar card**: `id`, `title`, `summary` (1–2 practical sentences), `points?` (bullets),
  `table?` (array of rows; first row is the header), `examples?` (`{ text, es }`), `tags?`.
- **Expression** (recognition only, e.g. Sicilian): `id`, `text`, `es`, `variety` ("Siciliano"),
  `standard?` (standard Italian equivalent), `notes?`, `tags?`, `voice?`.

**Dialogue file** (`dialogues/*.json`): `id`, `title`, `description?`, `situation`, `unit?`
(unit id it belongs with), `order?` (sort key), `register`, `avatars?` (native speaker `name` →
picture key, see "Pictures"), `turns` (≥ 2, at least one learner turn).
Turn ids must be unique inside the dialogue (`n1`, `l1`, `n2`…).

- Native turn: `{ id, speaker: "native", name?, text, es, voice? }`.
- Learner turn: `{ id, speaker: "learner", prompt (Spanish: what you want to say), options }`;
  each option `{ text, es, verdict: "correct" | "acceptable" | "wrong", feedback }` (Spanish,
  explains why). At least one `correct` option; 3 options is the norm.

**Extras file** (`extras/*.json`): any of `phrases`, `vocab`, `qa`, `grammar`, `expressions`,
plus `placement`:

- **Placement question**: `id`, `prompt` (Spanish), `text?` (target text shown and played),
  `options` (≥ 2), `answer` (0-based index), `lessons` (lesson ids marked done if correct).

**Story file** (`stories/*.json`, one per file; e.g. `stories/01-arrivo-a-palermo.json`):

| Field | Meaning |
| --- | --- |
| `id` | `story.<slug>` |
| `order` | Trip order, unique among stories (1, 2, 3…). Name the file `NN-<slug>.json`. |
| `title` / `titleEs` | Title in the target language / in Spanish. |
| `description?`, `emoji?` | One Spanish line for the list; one emoji. |
| `situation` | Situation id from pack.json. |
| `level` | `A1` \| `A2` \| `B1`. |
| `voice?` | Narrator voice (sentences, questions, options); default = first pack voice. |
| `sentences` | `[{ id, text, es, voice? }]` in reading order. `text` = one target-language sentence (≤ ~15 words); `es` = natural Spain-Spanish translation; `voice?` for a character's line (a pack voice other than the narrator's). |
| `keywords` | Key words/expressions. Each entry is either **an existing item id** (vocab, phrase or expression anywhere in the pack: look it up and reuse it) or **a new vocab item written inline** (same fields as Vocab, id `story-<slug>`). Inline items become normal pack vocab: another story reuses them by id. |
| `questions` | Comprehension: `[{ id, question, es, options: [{ text, es }] (≥ 3), correct }]`. `question` and options in the target language; `correct` = 0-based index; exactly one right option, the others plausible from the story. |
| `gaps` | Fill the gap: `[{ id, sentence, answer, gap?, distractors }]`. `sentence` = a sentence id; `answer` = one of this story's key word ids; `gap?` = exact text blanked in the sentence (whole word(s), case-insensitive, first occurrence), default = the key word's bare `word` (vocab) or `text` (phrase/expression) — set it when the sentence uses another form ("cerca" for `cercare`, "biglietti"); `distractors` = ≥ 2 wrong chips in the same form (same person, gender, number), never also correct. |

**Story guidelines** (`content:check` prints ⚠ warnings, never fails): **80–150 words** in all
sentences, **8–10 key words**, **3–4 questions**, **4–6 gaps** (each on a different sentence
when possible). A1–A2 Italian, present tense mostly, natural and current; the story follows
Hernán's trip (persona in `units/32-persona-sobre-mi.json`). Spanish with "tú".

Runtime: `getStories()` (sorted by `order`), `getStory(id)`, `getStoryKeywords(story)` (resolved
items). Each gap comes with `gap`, `before` and `after` (`before + gap + after` = sentence text).
Record SRS outcomes on key word ids (normal item ids).

## Audio keys

Every playable text gets a stable key derived from ids (`src/lib/content/keys.ts`). `npm run audio`
writes one mp3 per playable, named by a hash of voice + text (`public/audio/<lang>/<hash>.mp3`,
so identical lines share a file and any text or voice change makes a new one), and maps each key
to its file in `public/audio/<lang>/manifest.json`. Run it after every content change and commit
`public/audio/`; `npm run content:check -- --strict-audio` fails if a playable has no current mp3.
Dialogue learner options are voiced with a pack voice that no native turn of that dialogue uses.

| Playable | Key |
| --- | --- |
| phrase, vocab, expression, placement text | `<id>` |
| Q&A question / accepted n / distractor n | `<id>--q`, `<id>--a<n>`, `<id>--d<n>` |
| grammar example n | `<id>--e<n>` |
| dialogue native turn / learner option n | `<dialogueId>--<turnId>`, `<dialogueId>--<turnId>--<n>` |
| story sentence | `<storyId>--<sentenceId>` |
| story question / option n | `<storyId>--<questionId>`, `<storyId>--<questionId>--<n>` |
| story key word | its item id (inline ones included) |

Gap chips are not voiced (play the whole sentence instead).

`n` is 1-based, so reordering replies or options changes their keys: run `npm run audio` after that
(the mp3s themselves are reused; only the manifest changes).
`voice` must be one of `pack.json` `voices`; when missing, the first one is used.

## Pictures

Drawable words get a flat illustration (Duolingo-style picture exercises, game cards, Frasario
"Palabras", story popovers); dialogue speakers can get an avatar. Abstract words (numbers,
adjectives, "il ritardo" / "la coincidenza"-type concepts that no picture makes clear) have **no**
picture.

**Image keys** (same format everywhere):

| Key | Source | Written to |
| --- | --- | --- |
| `fluent:<icon>` | Microsoft Fluent Emoji Flat (MIT), icon name as in `node_modules/@iconify-json/fluent-emoji-flat/icons.json` (e.g. `fluent:hot-beverage`, `fluent:man-cook`) | `public/images/fluent/<icon>.svg` |
| `custom:<slug>` | our drawing `assets/images/custom/<slug>.svg`; slug = vocab id with dots → dashes (`food.cannolo` → `custom:food-cannolo`); the same word on several ids shares one drawing (`move-strada.mercato` → `custom:surv-mercato`) | `public/images/custom/<slug>.svg` |

- **Vocab** (units, extras and inline story key words): optional `"image": "fluent:croissant"`.
  A picture must clearly evoke the word for a learner; several words may share one icon (the UI
  never puts two options with the same picture in one question).
- **Dialogue avatars**: optional `"avatars": { "<name>": "<key>" }` at dialogue level, keyed by
  the native turns' `name` (`{ "Camarero": "fluent:man-cook" }`); a dialogue with two speakers
  lists both. Every key must be a `name` used by a native turn. The learner has no avatar.
- **Coverage**: `plans/003-image-coverage.json` (read only) classifies every vocab item: `A` =
  fitting Fluent icon (`image` given), `B` = custom drawing needed (`image: "custom:<slug>"`,
  `drawTask` says who draws it), `C` = not drawable (no `image`). `unsure` entries have a `note`.

**Runtime** (`@/lib/content`): a vocab item has `image: { src, dark? }` **only when the file exists
in `public/images/`** (a key whose file is missing = no picture, never a broken image); `imageKey`
keeps the source key. `listVocab({ situation?, withImage? })` (pack order), `getVocab(id)`,
`hasImage(item)`; native dialogue turns have `avatar`, and `getDialogueSpeakers(dialogue)` lists
`{ name, avatar? }`. Show pictures with `<Picture image={…} alt={…} size="grid" | "intro" | "avatar" />`
from `@/components/ui`.

**Dark theme**: pictures keep their colours on a `surface` card. `npm run images` renders each
picture and marks it `data-backdrop="dark"` when ≥ 60 % of its painted area is near-black; then
`image.dark` is true and `Picture` puts a soft light disc behind it in dark theme. If the
detection is wrong for a picture, list its key in `assets/images/backdrop.json`
(`{ "dark": ["fluent:top-hat"], "light": ["custom:…"] }`, both optional) and re-run `npm run images`.

**Commands**

- `npm run images`: writes every referenced picture to `public/images/` (Fluent from the
  devDependency, custom drawings minified), deterministic names, only changed files rewritten,
  unreferenced files deleted; referenced custom drawings that do not exist yet are skipped with a
  ⚠. Then refreshes the content bundle. **Commit `public/images/`** (like audio).
- `npm run content:check`: errors on a malformed key, an unknown Fluent icon, a bad avatar name,
  a custom file that is not a valid `<slug>.svg`; ⚠ warns on referenced custom drawings that do
  not exist yet and on style-guide misses in any file of `assets/images/custom/`.
- `npm run content:check -- --strict-images`: also fails when a referenced picture is missing from
  `public/images/` or stale (differs from its source), or a file there is unreferenced.

### Custom drawing style guide

Custom SVGs must sit next to Fluent Emoji Flat icons without looking foreign:

- `viewBox="0 0 32 32"` (like Fluent), no `width`/`height` needed; subject centred with ~2px
  margin (draw inside 2…30).
- **Flat solid fills** only (`fill="#…"`); no gradients, filters, shadows or blur. **No outlines**
  (no strokes around shapes; shape edges are colour changes, as in Fluent). A thin stroke is only
  acceptable for something that is really a line (a straw, fork tines) — prefer a thin filled shape.
- **Rounded, friendly shapes**: rounded corners and ends, slightly chunky proportions, 2–4 tones
  per material (base, lighter highlight, darker shade), 3/4 or front view like the emoji.
- **No text**, letters, numbers or logos inside the picture; no raster `<image>`; no scripts.
- **Fluent-like palette** (most used Fluent fills): whites/greys `#ffffff` `#f4f4f4` `#e6e6e6`
  `#d3d3d3` `#9b9b9b` `#636363`; "black" is dark purple `#533566` / `#321b41` (avoid pure
  `#000` areas); browns `#7d4533` `#a56953` `#593b39`; yellows/oranges `#ffc83d` `#fcd53f`
  `#f9c23c` `#ffb02e` `#ff6723`; reds `#f8312f` `#f92f60`; blue `#00a6ed`; purple `#8b62bf`; skin
  `#ffd7c2` `#eebfaa`; greens: take them from a Fluent food icon (e.g. `green-salad`, `cucumber`).
- **Recognisable at 80px**: one clear subject, few details; check it on a light and on a dark
  surface next to a few Fluent icons.
- **< 6 KB** after minification (`content:check` warns above that); one file per slug, file name
  exactly `<slug>.svg`. Hand-written or exported SVG is fine: `npm run images` strips the XML
  prolog, comments, metadata and editor attributes.
- Draw only original artwork (Fluent icons may be used as style reference and as parts, since they
  are MIT; never copy non-MIT icon sets).

## What `content:check` enforces

Schema (types, required fields, non-empty text, id format), unique ids across every pack,
exactly one default pack, `register` limited to `tu`, `neutral` and the pack's `formalRegister`,
vocab `article` limited to the pack's `articles`, unique unit `order`, known situations and voices, lesson items that exist and are lesson-item kinds,
non-empty lessons and units, `vocab.example` is a phrase, `dialogue.unit` is a unit, learner turns
have a correct option, placement answers in range and lessons that exist. Stories: unique
`order`, unique local ids, inline key words prefixed `story-`, key words that exist and are vocab /
phrase / expression (no repeats), question `correct` in range, gap sentence and answer (a key word
of the story) that exist, gap text found in the sentence, distractors different from the answer
and from each other. Pictures: well-formed keys, known Fluent icons, avatar names that exist,
valid custom files (see "Pictures"). Guideline misses (story length and counts) and custom
drawings not drawn yet are ⚠ warnings.

## Quality rules

- **Useful on the trip first**: real situations in Sicily (Trenitalia regional trains, AST/SAIS/
  Interbus, Prestia e Comandè, Alibus, bars…). No grammar for its own sake.
- **Natural, current Italian** as people actually say it; short phrases (≤ 10 words when possible).
  Correct accents and apostrophes (`caffè`, `perché`, `un'acqua`, `l'orario`).
- **Register is honest**: `lei` with strangers and staff, `tu` with peers, `neutral` only when the
  phrase has no verb/pronoun marking. Q&A replies and dialogue options match the register.
- **Spanish** is natural Spain Spanish ("billete", "coger el tren", "vale"), not a calque; put
  the calque in `literal` if it helps.
- **Distractors and wrong options are plausible** (typical learner mistakes), never absurd, and
  never also correct. Feedback says why in one sentence.
- One idea per phrase; keep `notes` to one short sentence.
- Reuse items across lessons by id instead of duplicating text with a new id.
