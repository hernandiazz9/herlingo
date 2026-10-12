# Gramática (grammar reference)

Decided with Hernán on 2026-10-12 (plan 014; his description: docs/ideas.md, section 2).
Content format: docs/content-guide.md, "Grammar reference".

## Why

Grammar to **read and look up quickly**, not Duolingo games. If Hernán wants to see a verb, he
sees all its forms right away, hears them, and moves on. What he has read then shows up in the
exercises, so the grammar is learnt in use. No new mini-games: every exercise reuses "completa
el hueco".

## Where

- Route `/gramatica/` (index) and `/gramatica/<id>/` (a verb or a topic), generated for every
  pack like `/historias/<id>/`; the page finds the owner pack (`findGrammarPack(id)`) and lists
  the **active** language's entries.
- Nested section in `src/lib/navigation.ts` (`id: "grammar"`, parent `phrasebook`): the Frases
  tab lights up. The tab bar keeps its 5 tabs.
- Entry points: a "Gramática" button at the top of the Frasario, and a section card on the Ruta
  that replaces today's "Fichas de gramática" sheet (expressions keep their sheet).

## Index (`/gramatica/`)

- **Verbos**: a grid of tiles in `order` (Italian v1: 12 "verbos rey": essere, avere, fare,
  andare, venire, stare, volere, potere, dovere, sapere, dire, prendere). Tile = infinitive (big,
  target language), gloss (small), an "irregular" mark when `irregular`, and the read count
  ("×3") once read.
- **Temas**: the pack's grammar cards (by `order`, then pack order), except cards with `verb`
  (their verb tile covers them). Levelled packs show the current level's cards, as the Ruta does.
  Italian v1: tú o Lei, «vorrei», artículos, preposiciones, pronombres. Every pack gets its
  existing cards here for free; verbs come with each pack's own content plan.
- A pack with neither verbs nor cards hides the entry points.

## Verb page

- Header: infinitive (tap = audio), gloss, `notes`.
- **Tense chips** (from pack.json `grammar.tenses`, the verb's tenses only), the first one
  selected. One row per form: person · form (big) · gloss (small); tapping a row plays it
  ("io sono"), with the usual normal/slow audio. Irregular forms in another colour (tokens only).
  Below the table: the tense `notes` and its example sentence with audio.
- "Leído" button at the end (below).

## Topic page

The grammar card as lessons show it (title, summary, points, table, examples with audio), full
page, plus the "Leído" button. No drills on the page: drills are exercises.

## "Leído"

- A button at the end of every verb and topic page. Each tap counts one read; after the tap it
  shows the count ("Leído · ×4") and stays disabled until the page is left, so one visit counts
  once.
- **XP**: 3 XP for the first read of each entry per day, at most 15 XP a day from reading
  (source `grammar`; streak and Liga as any XP). Reading again the same day counts but gives no XP.
- **Storage**: `lang-lern:grammar:<lang>`, versioned, tolerant parsing (an invalid entry is
  dropped, never the whole key): `{ "v": 1, "reads": { "<id>": { "n": 4, "last": "2026-10-12" } },
  "xp": { "day": "2026-10-12", "amount": 6 } }`. It is a `lang-lern:*` key, so the Perfil backup and
  the cloud save carry it automatically. "Borrar progreso" of a pack clears it with the rest.

## Exercises

- **Drillable** entries: verbs (forms) and grammar cards with `drills`. The first read of a
  drillable entry adds its id to spaced repetition (`progress.srs`, box 0), so it never appears
  in exercises before it was read.
- **Drills** are `fill-gap` exercises (no new exercise screen), each with its audio:
  - card / verb `drills`: the sentence with `___`, the answer among its distractors;
  - verb forms: before = person label, gap = the form, options = other forms of the same tense
    (distinct texts), gloss = the form's gloss ("nosotros vamos"); tenses mixed, the first tense
    weighted more.
- **Repaso**: due drillable ids join the due items; each gives 2 drills. Outcomes are recorded on
  the entry id (SRS as any item).
- **Lessons**: up to 2 production slots of each lesson are given to drills from read entries,
  picking first the ones with lapses, then the lowest SRS box, then the least read. Lesson length
  stays the same. Nothing read → lessons are unchanged.

## Out of scope (v1)

Futuro and imperfetto, more verbs, other packs' verbs and drills (their own plans), searching
verbs from the Frasario search, a "see all forms" link from lesson grammar tips, reading aloud
with the microphone.
