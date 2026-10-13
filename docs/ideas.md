# Ideas pending (Hernán's backlog)

Not planned yet. Each one becomes a plan (`plans/`) after a design session with Hernán.

## 1. Prepárate "Modo rápido": get out of a jam in a shop (2026-10-12)

**Planned:** plan 015 (`plans/015-modo-rapido.md`); decisions in docs/coach.md "Modo rápido".

**Real case.** Hernán walked into a shop to print something and had to use a translator. A
literal translation of "imprimir" is not enough: it depends on the context (a copy, a document,
from a USB stick, from the phone, black and white or colour...), and on how the words are put
together in Italian. He wants to type quickly "tengo que imprimir algo" and get ready in a
minute.

**What he wants**
- **Easy access**: one tap from the main screens, not buried in Prepárate.
- He writes the situation in a few words → the AI generates a **route**: the ideal path of what
  will happen, step by step, **skipping the obvious** (entering, greeting: he already knows
  that). E.g. "Buongiorno, devo stampare un documento" → what they will ask → what to answer.
- The route is **clearly marked and easy to scan** (one main line, step after step).
- At each step there is **one clear main option**, and it can be **expanded** to see other
  possible questions they may ask and other possible answers.
- Every line: **target language first** (big), **Spanish below** (smaller), **with audio**
  (normal and slow), like the rest of the app.
- Goal: **understand what they ask him** and answer something simple, right now.
- The route is **saved** (like today's saved situations) and works offline.

**Later: evaluation with AI**
- At some point he can **evaluate himself**. The evaluation uses AI again and is **based on
  everything he practised** (saved routes, progress), it is **serious**, and it tells him
  **how to do better**.

Starting point: Prepárate (`docs/coach.md`, `api/coach/`, `src/lib/coach/`,
`src/components/coach/`, routes under `src/app/preparar/`).

## 2. Grammar as a reference to read, not Duolingo games (2026-10-12)

→ Designed with Hernán on 2026-10-12: docs/grammar.md, plans/014-gramatica.md.

**What he does NOT want**: Duolingo-style games, the same mini-exercises again and again,
grammar hidden inside games where you never get to *see* the verb.

**What he wants**
- An **interactive grammar section that is easy to browse**: e.g. a grid of **verb tiles**
  ("verbo rey": essere, avere, fare, andare...). Tap one → **the full conjugation** with the
  translation of every form (and audio). Same idea for other topics (articles, prepositions,
  pronouns...).
- **Reading counts**: he can read a card aloud / go through it; at the end it is marked
  **"leído"**, and the app **counts how many times** he has read each one.
- **Link to exercises**: depending on what he has read (and how often), the exercises start to
  include that grammar (e.g. which form of the verb, which article goes with which word), so the
  grammar is understood in use. Learn **well**, not just play.
- Everything **quick and accessible**: if he wants to see a verb, he sees it and its
  conjugations right away, then moves on.

Today: grammar cards inside lessons (`GrammarTip`, `gram.<slug>` items in each level's grammar
unit, docs/content-guide.md).

## 3. "Modo deporte": audio-only situations to listen to while running or cycling (2026-10-13)

**What he wants**
- Describe a situation (e.g. "ir a un supermercado en Italia") and get **only audio**: a guided
  walk through the whole situation, to play and go out running, cycling or walking without
  looking at the phone.
- The audio tours the situation step by step: greeting people, looking for certain fruit,
  asking for a product, the checkout, paying... whatever the situation needs.
- Each step: a **Spanish narrator explains** what you want to do ("Para preguntar si tienen
  este tipo de harina, puedes decir:"), then the **target-language line** (e.g. Italian),
  with examples and variants ("o, si quieres preguntar por otra cosa…").
- **Saved situations** form a library: put on "modo deporte", press play, go out.

**Things to settle in the design session**
- Audio while the phone is locked (iOS PWA): likely needs one continuous audio file per
  situation (stitched mp3) and lock-screen / headphone controls (Media Session), not a chain of
  short clips driven by JS. Spike it on the iPhone first.
- Step structure and pacing: narration → line → pause to repeat aloud → line again (slow?) →
  meaning? Repetitions and pause length as settings.
- Built-in episodes from existing content (no AI cost, `npm run audio`) and/or custom ones
  generated with AI (Prepárate backend, Spanish narrator voice + target voices, cost per episode).
- Relation to Prepárate "Modo rápido" (section 1): the same route could have a "Escuchar en
  modo deporte" button.

Starting point: `src/lib/audio/`, "Escuchar todo" in `src/components/stories/StoryReader.tsx`,
Prepárate (`docs/coach.md`, `api/coach/`, generated audio in `src/lib/audio/generated.ts`).
