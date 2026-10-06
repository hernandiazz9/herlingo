# Product note — French pack (`content/fr/`)

Decided with Hernán on 2026-10-06 (plan 006). `docs/brief.md` still holds every app-wide decision
and stays untouched; this note only says how the **French** pack differs. Every French content
task reads both.

## Learner and goal
- Same learner (native Spanish speaker, Spain Spanish UI with "tú"), but **no trip**: French is
  for everyday life, learnt from **a basic level with little prior knowledge** (A0 → A1, a few
  A2 touches at the end).
- Goal: understand and say the things of an ordinary day (greet, introduce yourself, family,
  home and routine, free time and weather, eating and shopping, getting around a town, the
  doctor and the pharmacy), build **new vocabulary** and a stock of **useful phrases**.
- Oral first, like Italian: audio on every item, short phrases, no grammar for its own sake.

## Volume and format
Same format as Italian (`docs/content-guide.md`) and roughly the same volume: **~420 phrases,
~320 vocabulary words, ~80 Q&A, 10 units + a grammar unit, ~50 lessons (8–30 items each),
~10 grammar cards, 12 placement questions, 12 dialogues, 12 stories**.

## Units (order, id, situation)

| Order | Unit id | Spanish title (guide) | Situation |
| --- | --- | --- | --- |
| 10 | `salut` | Saludos, cortesía y "no entiendo" | `saludos`, `no-entiendo` |
| 12 | `nombres` | Números, hora, días y fechas, precios | `numeros` |
| 20 | `presenter` | Presentarte: nombre, origen, edad, trabajo, idiomas | `presentarse` |
| 22 | `famille` | Familia, amigos y describir a alguien | `familia` |
| 30 | `maison` | Casa, rutina diaria y días de la semana | `casa` |
| 32 | `loisirs` | Tiempo libre, gustos, tiempo y planes | `ocio` |
| 40 | `manger` | Comer y beber: café, panadería, restaurante | `comida` |
| 42 | `courses` | Compras: supermercado, mercado, ropa | `compras` |
| 50 | `ville` | Por la ciudad: transporte y direcciones | `ciudad` |
| 52 | `sante` | Salud: médico, farmacia, emergencias | `salud` |
| 90 | `grammaire` | Gramática mínima (cards, recognition first) | `gramatica` |

Order ranges for French: 10–19 basics, 20–29 people, 30–39 daily life, 40–49 food and shopping,
50–59 out and about, 90+ grammar. Units 10 and 12 come first because everything else uses them.

**Situations** (`content/fr/pack.json`, phrasebook order): `saludos` 👋 Saludos y cortesía ·
`no-entiendo` ❓ Cuando no entiendes · `numeros` 🔢 Números, hora y fechas · `presentarse` 🙂
Presentarte · `familia` 👨‍👩‍👧 Familia y amigos · `casa` 🏠 Casa y rutina · `ocio` ⚽ Tiempo libre y
clima · `comida` 🥐 Comer y beber · `compras` 🛒 Compras · `ciudad` 🚇 Por la ciudad · `salud` 💊
Salud y emergencias · `gramatica` 📘 Gramática.

**Grammar cards** (`gram.fr-<slug>`): tu vs vous; articles and gender (le/la/l'/les, un/une/des);
être; avoir; aller (+ futur proche: je vais + infinitive); faire; vouloir/pouvoir (je voudrais);
negation ne … pas; questions (est-ce que, intonation, qu'est-ce que); -er verbs in the present.

## Language rules
- **Natural, current standard French (France)**, as people say it today; short phrases (≤ 10
  words when possible). Correct accents, apostrophes and elision (`l'eau`, `j'ai`, `qu'est-ce que`).
  Punctuation: **no space before ? ! : ;** in the JSON (simpler matching; the audio is unaffected).
- **Register is honest**: `vous` with strangers, staff and the doctor; `tu` with friends, family
  and peers; `neutral` only when the phrase has no verb/pronoun marking. Q&A replies and dialogue
  options match it.
- Spoken French where it is the norm (`on` for "nosotros" in casual phrases, dropped `ne` only in
  `tu` phrases and marked in `notes`); never slang a beginner would misuse.
- **Pronunciation tips** (phrase `explanation`) are written for a Spanish speaker: nasal vowels,
  silent final letters, liaison (`les‿amis`), the French `u` and `r`.
- Vocab: nouns carry `article` (`le`, `la`, `l'`, `les`) and `gender`; for `l'` and `les` set
  `gender` so the learner knows it. `es` with its Spanish article.
- **Numbers**: French counting from 70 is irregular (soixante-dix, quatre-vingts,
  quatre-vingt-dix). Teach them as content (unit `nombres`, its own lesson for 70–100 and prices),
  with Spain-Spanish notes; there is no number-to-words code in the app.

## Ids
Ids are **unique across every pack** (routes like `/leccion/<id>/` are shared). French ids use
French slugs: unit `salut`, lesson `salut.l.bonjour`, phrase `salut.bonjour`, Q&A
`salut.qa.ca-va`, grammar `gram.fr-etre`, dialogue `dlg.fr-boulangerie`, placement
`placement.fr-<slug>`, story `story.fr-<slug>`, story inline word `story-fr-<slug>`.
`npm run content:check` rejects a collision with any other pack.

## Dialogues and stories
- **Dialogues (12)**: everyday scenes, one or two per situation (boulangerie, café, a new
  neighbour, a friend's birthday, the market, a clothes shop, the doctor, the pharmacy, asking the
  way, the metro/bus ticket machine and a helper, a phone call to book a table, a work/class
  introduction). Native turns use the pack voices; 3 options per learner turn.
- **Stories (12)**, A1 (the last ones A1–A2), present tense mostly, 80–150 words, recurring
  cast in an ordinary French city (Lyon): **Camille** (30, works in a bookshop), her flatmate
  **Julien**, their neighbour **Madame Martin**, and **Pablo**, a Spanish friend who is learning
  French like you. Order follows the units (week, shopping, a dinner, a weekend, a cold…).

## Audio and pictures
- Neural mp3 with edge-tts **fr-FR** voices (`fr-FR-DeniseNeural`, `fr-FR-HenriNeural`,
  `fr-FR-EloiseNeural`), generated on the Mac with `npm run audio`; `speechSynthesis` `fr-FR`
  as fallback. Speech recognition locale `fr-FR`.
- Pictures follow docs/content-guide.md ("Pictures"): Fluent icons for concrete vocab, avatars for
  dialogue speakers.
