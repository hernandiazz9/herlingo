# Content guide (language packs)

How to write learning content. The source of truth for the format is
`src/lib/content/schema.ts` (zod); this guide explains it. Run `npm run content:check` after every
change: it must print `✓ content/<lang>: …` and exit 0.

## File layout

```
content/<lang>/
  pack.json            Pack meta: language, speech locale, voices, situations. Rarely edited.
  units/*.json         One unit per file, self-contained: its lessons AND the items they teach.
  dialogues/*.json     One dialogue per file.
  extras/*.json        Items that belong to no unit (phrasebook-only phrases, Sicilian
                       expressions, placement questions...). Any number of files.
```

Files are discovered by glob: **there is no index to edit**. Adding a unit = adding a file, so
parallel tasks never touch the same file. Name files after what they hold, e.g.
`units/20-tren.json`, `dialogues/tren-biglietteria.json`, `extras/siciliano.json`.

The files whose name contains `sample` (`units/sample-unit.json`, `dialogues/sample-bar.json`,
`extras/sample-extras.json`) are a small demo pack. Delete them all once real content exists.

## Ids

- Format: lowercase `a-z0-9` words joined by a single `-` or `.` (`tren.un-biglietto-per`).
  `--` is forbidden (it is reserved for audio keys).
- **One namespace per pack**: units, lessons, phrases, vocab, Q&A, grammar cards, expressions,
  dialogues and placement questions must all have different ids.
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

**pack.json**: `lang` (= folder name), `name`, `nativeName`, `speechLocale` (`it-IT`),
`voices` (edge-tts voice names; the first is the default), `situations` (`{ id, title, emoji? }`,
phrasebook sections in display order). If you need a new situation, add one line here.

**Unit file** (`units/*.json`): `id`, `order`, `title`, `description?`, `emoji?`, `situation`,
`lessons`, plus the item arrays `phrases`, `vocab`, `qa`, `grammar`, `expressions` (each optional).

- **Lesson**: `id`, `title`, `items` — ids (at least 1) of phrases, vocab, Q&A, grammar cards or
  expressions, in teaching order. Items may come from any file of the pack. Aim for ~5 minutes:
  6–12 items.

**Items**

- **Phrase**: `id`, `text` (target language, as spoken), `es`, `literal?` (word for word, only when
  it helps), `notes?` (short Spanish usage note), `register` (`tu` | `lei` | `neutral`),
  `situation`, `tags?`, `voice?`.
- **Vocab**: `id`, `word` (bare), `article?` (`il`, `lo`, `la`, `l'`, `i`, `gli`, `le`),
  `gender?` (`m` | `f` | `mf`), `plural?`, `es` (with article for nouns: "el billete"), `notes?`,
  `example?` (a phrase id), `situation?`, `tags?`, `voice?`. It is spoken as article + word
  ("il biglietto", "l'orario").
- **Q&A** (for "answer" exercises): `id`, `question` (what the Italian asks), `questionEs`,
  `accepted` (≥ 1 `{ text, es }`; the first is the model answer), `distractors` (≥ 2 `{ text, es }`,
  plausible but wrong), `register`, `situation`, `notes?`, `tags?`, `voice?` (of the question).
- **Grammar card**: `id`, `title`, `summary` (1–2 practical sentences), `points?` (bullets),
  `table?` (array of rows; first row is the header), `examples?` (`{ text, es }`), `tags?`.
- **Expression** (recognition only, e.g. Sicilian): `id`, `text`, `es`, `variety` ("Siciliano"),
  `standard?` (standard Italian equivalent), `notes?`, `tags?`, `voice?`.

**Dialogue file** (`dialogues/*.json`): `id`, `title`, `description?`, `situation`, `unit?`
(unit id it belongs with), `order?` (sort key), `register`, `turns` (≥ 2, at least one learner turn).
Turn ids must be unique inside the dialogue (`n1`, `l1`, `n2`…).

- Native turn: `{ id, speaker: "native", name?, text, es, voice? }`.
- Learner turn: `{ id, speaker: "learner", prompt (Spanish: what you want to say), options }`;
  each option `{ text, es, verdict: "correct" | "acceptable" | "wrong", feedback }` (Spanish,
  explains why). At least one `correct` option; 3 options is the norm.

**Extras file** (`extras/*.json`): any of `phrases`, `vocab`, `qa`, `grammar`, `expressions`,
plus `placement`:

- **Placement question**: `id`, `prompt` (Spanish), `text?` (target text shown and played),
  `options` (≥ 2), `answer` (0-based index), `lessons` (lesson ids marked done if correct).

## Audio keys

Every playable text gets a stable key derived from ids (`src/lib/content/keys.ts`); mp3s live at
`public/audio/<lang>/<key>.mp3`:

| Playable | Key |
| --- | --- |
| phrase, vocab, expression, placement text | `<id>` |
| Q&A question / accepted n / distractor n | `<id>--q`, `<id>--a<n>`, `<id>--d<n>` |
| grammar example n | `<id>--e<n>` |
| dialogue native turn / learner option n | `<dialogueId>--<turnId>`, `<dialogueId>--<turnId>--<n>` |

`n` is 1-based, so reordering replies or options changes their keys: regenerate audio after that.
`voice` must be one of `pack.json` `voices`; when missing, the first one is used.

## What `content:check` enforces

Schema (types, required fields, non-empty text, id format), unique ids across the pack, unique
unit `order`, known situations and voices, lesson items that exist and are lesson-item kinds,
non-empty lessons and units, `vocab.example` is a phrase, `dialogue.unit` is a unit, learner turns
have a correct option, placement answers in range and lessons that exist.

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
