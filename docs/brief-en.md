# Product note — English pack (`content/en/`)

Decided with Hernán on 2026-10-06 (plan 008; B2 and C1 added 2026-10-07 for plan 009). `docs/brief.md` still holds every app-wide decision
and stays untouched; this note only says how the **English** pack differs. Every English content
task reads both, plus docs/content-guide.md for the format.

## Learner and goal
- Same learner (native Spanish speaker, Spain Spanish UI with "tú"); he already knows the basics
  of English. No trip: English for **everyday life, travel and work/technology** (he is a
  programmer), mixed at every level and getting more demanding level by level.
- **The pack is split by CEFR level**: A2, B1, B2, C1. The learner picks his level with a
  selector (Ruta, Perfil); Ruta shows only that level's units; the placement test suggests a level.
  **Plan 008 built A2 and B1; plan 009 builds B2 and C1** with the same structure (the pack
  declares only the levels that have content).
- Oral first, like Italian and French: audio on every item, short phrases, grammar only where it
  helps to speak.

## Volume and format (per level)
Same format as Italian and French (docs/content-guide.md) and **the full French volume per level**:
**~420 phrases, ~320 vocabulary words, ~80 Q&A, 10 units + a grammar unit, ~50 lessons (8–30
items each), ~10 grammar cards, 12 dialogues, 12 stories**. Placement: 16 questions for the whole
pack, 4 per level (plan 008 shipped 6 A2 + 6 B1; plan 009 rewrites it for the four levels).

## Levels (generic schema, plan 008 T90/T91)
- `pack.json` `levels` = the pack's CEFR levels in order (`["A2", "B1"]` for now). A pack without
  `levels` (Italian, French) works exactly as today: no selector.
- Every unit, dialogue and story of a levelled pack has `level`; placement questions too. A
  phrase/vocab/Q&A's level is its unit's level (derived, not stored).
- The learner's level per language lives on the device in `lang-lern:level:<lang>`
  (`{ v: 1, level }`); missing = the placement suggestion, else the pack's first level.

## Units (order, id, situation)

### A2 — everyday life, travel, first contacts

| Order | Unit id | Spanish title (guide) | Situation |
| --- | --- | --- | --- |
| 10 | `a2-hello` | Saludos, small talk básico y "¿puedes repetir?" | `saludos`, `no-entiendo` |
| 12 | `a2-numbers` | Números, hora, fechas (formato EE. UU.), precios y propinas | `numeros` |
| 20 | `a2-about-me` | Presentarte: origen, trabajo (programador), idiomas, familia | `presentarse` |
| 22 | `a2-daily` | Casa, rutina, tiempo libre y el tiempo | `casa` |
| 30 | `a2-airport` | Aeropuerto y vuelos: facturar, control, embarque | `viajes` |
| 32 | `a2-hotel` | Hotel y alojamiento: check-in, pedir cosas, pequeños problemas | `alojamiento` |
| 40 | `a2-food` | Comer y beber: cafetería, restaurante, pedir, la cuenta y la propina | `comida` |
| 42 | `a2-shopping` | Compras: supermercado, ropa, pagar, devolver | `compras` |
| 50 | `a2-city` | Por la ciudad: metro, bus, taxi/Uber, direcciones | `ciudad` |
| 52 | `a2-health` | Salud: farmacia, médico, emergencias (911) | `salud` |
| 90 | `a2-grammar` | Gramática A2 (cards, recognition first) | `gramatica` |

### B1 — social life, work and technology, solving problems

| Order | Unit id | Spanish title (guide) | Situation |
| --- | --- | --- | --- |
| 110 | `b1-friends` | Hacer amigos: conversación, gustos y opiniones | `social` |
| 112 | `b1-plans` | Planes e invitaciones: quedar, cambiar, cancelar, llamar | `social` |
| 120 | `b1-office` | Primeros días en el trabajo: equipo, oficina, rutinas | `trabajo` |
| 122 | `b1-calls` | Email, chat, llamadas y videollamadas | `comunicacion` |
| 130 | `b1-interview` | Entrevista de trabajo: experiencia, habilidades, preguntas | `trabajo` |
| 132 | `b1-tech` | Tecnología: ordenador, apps, explicar un problema, soporte | `tecnologia` |
| 140 | `b1-trips` | Problemas de viaje: retrasos, equipaje perdido, reclamar, cambiar vuelo | `viajes` |
| 142 | `b1-renting` | Vivienda: alquilar, facturas, averías, vecinos | `vivienda` |
| 150 | `b1-money` | Banco y dinero: cuenta, pagos, devoluciones y quejas | `dinero` |
| 152 | `b1-stories` | Contar lo que pasó: experiencias, anécdotas, sentimientos | `social` |
| 190 | `b1-grammar` | Gramática B1 (cards) | `gramatica` |

### B2 — work in depth, opinions, independent life

| Order | Unit id | Spanish title (guide) | Situation |
| --- | --- | --- | --- |
| 210 | `b2-meetings` | Reuniones: proponer, interrumpir con educación, acordar, resumir | `trabajo` |
| 212 | `b2-opinions` | Opiniones y debate: estar de acuerdo, matizar, argumentar | `opiniones` |
| 220 | `b2-tech-talk` | Hablar de tecnología: arquitectura, pros y contras, code review | `tecnologia` |
| 222 | `b2-projects` | Proyectos: plazos, riesgos, prioridades, dar y pedir feedback | `trabajo` |
| 230 | `b2-news` | Noticias y actualidad: contar, comentar, reaccionar | `opiniones` |
| 232 | `b2-wellbeing` | Salud y bienestar: hábitos, deporte, estrés, el médico de cabecera | `salud` |
| 240 | `b2-travel` | Viajar por tu cuenta: planificar, alquilar coche, imprevistos, recomendar | `viajes` |
| 242 | `b2-paperwork` | Trámites y servicios: seguros, contratos, reclamaciones formales | `dinero` |
| 250 | `b2-relationships` | Relaciones: sentimientos, malentendidos, resolver conflictos | `social` |
| 252 | `b2-culture` | Cultura: series, cine, libros, música, humor | `cultura` |
| 290 | `b2-grammar` | Gramática B2 (cards) | `gramatica` |

### C1 — leading, persuading, nuance

| Order | Unit id | Spanish title (guide) | Situation |
| --- | --- | --- | --- |
| 310 | `c1-negotiation` | Negociar: salario, condiciones, clientes y proveedores | `trabajo` |
| 312 | `c1-presenting` | Presentar y hablar en público: demos, charlas, preguntas difíciles | `trabajo` |
| 320 | `c1-leading` | Liderar: feedback difícil, 1:1, delegar, motivar | `trabajo` |
| 322 | `c1-tech-decisions` | Decisiones técnicas: incidentes, postmortems, convencer al equipo | `tecnologia` |
| 330 | `c1-nuance` | Matices: suavizar, ironía, cortesía indirecta, leer entre líneas | `opiniones` |
| 332 | `c1-idioms` | Expresiones y phrasal verbs avanzados | `social` |
| 340 | `c1-networking` | Networking: conferencias, eventos, presentarte con soltura | `social` |
| 342 | `c1-problems` | Resolver problemas complejos: quejas formales, burocracia, reclamar con firmeza | `dinero` |
| 350 | `c1-society` | Debatir sobre la sociedad: teletrabajo, IA, ciudades, medio ambiente | `opiniones` |
| 352 | `c1-storytelling` | Contar historias con gracia: anécdotas, ritmo, humor | `cultura` |
| 390 | `c1-grammar` | Gramática C1 (cards) | `gramatica` |

Order ranges for English: A2 10–99, B1 110–199, B2 210–299, C1 310–399 (grammar unit at x90).
Inside a level, the first two units come first because the rest use them.

**Situations** (`content/en/pack.json`, phrasebook order, shared by every level): `saludos` 👋
Saludos y cortesía · `no-entiendo` ❓ Cuando no entiendes · `numeros` 🔢 Números, hora y fechas ·
`presentarse` 🙂 Presentarte · `casa` 🏠 Casa, rutina y tiempo libre · `viajes` ✈️ Viajes ·
`alojamiento` 🏨 Alojamiento · `comida` 🍔 Comer y beber · `compras` 🛒 Compras · `ciudad` 🚕 Por
la ciudad · `salud` 💊 Salud y emergencias · `social` 🗣️ Vida social · `trabajo` 💼 Trabajo ·
`comunicacion` 📧 Email y llamadas · `tecnologia` 💻 Tecnología · `vivienda` 🔑 Vivienda · `dinero`
🏦 Banco y dinero · `opiniones` 💬 Opiniones y debate (B2+) · `cultura` 🎬 Cultura y ocio (B2+) ·
`gramatica` 📘 Gramática.

**Grammar cards** (`gram.en-<level>-<slug>`):
- A2: present simple vs present continuous; past simple (regular, irregular, -ed sounds);
  questions and negatives with do/does/did; going to / will; can / could / would like;
  there is / there are; countable and uncountable (some/any, much/many, a lot of); comparatives
  and superlatives; prepositions of time and place (in/on/at); present perfect intro (ever/never).
- B1: present perfect vs past simple (for/since, just/already/yet); past continuous; first and
  second conditional; should / must / have to; used to; passive (intro); relative clauses
  (who/which/that); reported speech basics; gerund vs infinitive; common phrasal verbs at work.
- B2: third conditional; wish / if only; modals of deduction (must have, can't have, might have);
  the passive in all tenses and have/get something done; reported speech (tenses, questions,
  reporting verbs); defining vs non-defining relative clauses; future continuous and future
  perfect; linking words of contrast (although, despite, however, whereas); gerund vs infinitive
  with a change of meaning (stop, remember, try); phrasal verbs with two particles.
- C1: inversion for emphasis (Never have I…, Not only…); cleft sentences (What I need is…, It was
  … that…); mixed conditionals; advanced modals (needn't have, would rather, had better);
  formal subjunctive (I suggest that he be…); participle clauses; emphatic do; hedging and
  softening (It seems that…, I'd tend to…); ellipsis and substitution (so/not, do so); discourse
  markers (that said, by and large, on the whole).

## Language rules
- **American English (en-US)**, natural and current, US spelling (color, apartment, check),
  US formats (dates "October 6th", 10/6; $; a.m./p.m.; °F and miles for recognition only).
  Short phrases: ≤ 12 words at A2, ≤ 15 at B1, ≤ 18 at B2, ≤ 22 at C1 when possible.
- **Contractions as people speak** (I'm, don't, it's, I'd like). Answer matching treats a
  contraction and its full form as equal through `pack.json` `equivalents` (T110); still avoid
  exercises whose only difference is a contraction.
- **Register** (`formalRegister: "formal"`): English has no tú/usted, so most items are
  `neutral`; `formal` marks polite or formal wording (Could you…, Would you mind…, I would like…,
  formal emails, interviews, staff in a formal setting); `tu` marks casual wording with friends
  (Hey, What's up?, Sounds good!, wanna is never written). Q&A replies and dialogue options match
  it. The dialogue badge says "Registro formal" / "Registro informal".
- Never slang a learner would misuse; idioms only when common, explained in `notes`. Phrasal
  verbs (B1+) explained in `notes` with their meaning. B2 and C1 add common idioms, collocations
  and register shifts (formal written vs spoken), always explained in `notes`.
- **Pronunciation tips** (phrase `explanation`) for a Spanish speaker: `th` (think/this), short
  vs long vowels (ship/sheep, full/fool), the schwa and weak forms (to, a, can), -ed endings
  (/t/ /d/ /ɪd/), final consonants and plurals, no extra "e" before s+consonant (Spain, school),
  word stress, linking ("check it out"), the American `r` and flap t (water, better).
- Vocab: countable singular nouns carry `article` `a` or `an` (`pack.json` `articles: ["a",
  "an"]`), so the learner hears and sees "an apple", "a ticket"; uncountable and plural-only nouns
  have no article; no `gender`. `es` with its Spanish article.
- **Numbers**: `numberWords` 0–100, hundreds and thousand (twenty-one with a hyphen);
  unit `a2-numbers` teaches dates, prices ($3.50 = "three fifty"), phone numbers ("oh") and years.

## Ids
Ids are **unique across every pack**. English ids start with the level: unit `a2-airport`,
lesson `a2-airport.l.check-in`, phrase `a2-airport.window-seat`, Q&A `a2-airport.qa.purpose`,
grammar `gram.en-a2-past-simple`, dialogue `dlg.en-a2-hotel`, placement
`placement.en-a2-<slug>`, story `story.en-a2-<slug>`, story inline word `story-en-<slug>`.
`npm run content:check` rejects a collision with any other pack.

## Dialogues and stories
- **Dialogues (12 per level)**, 6–10 turns, ≥ 3 learner turns, 3 options each, Spanish feedback.
  - A2: airport check-in, passport control, hotel check-in, coffee shop order, restaurant and
    tip, supermarket checkout, returning clothes, asking the way / subway, small talk with a
    rideshare driver, pharmacy, meeting a neighbour, phone call to book a table.
  - B1: first day at the office, daily stand-up, job interview, video call with a client and a
    bad connection, explaining a bug to IT support, lost-luggage desk, rebooking a delayed flight,
    apartment viewing with a landlord, calling to fix the internet, opening a bank account, a
    party (making friends), rescheduling plans with a friend.
  - B2: sprint planning, disagreeing in a code review, negotiating a deadline, a follow-up with
    the doctor, a car rental problem, an insurance claim, debating with a friend, getting the
    deposit back from a landlord, planning a trip with a travel agent, a job offer call, a
    conflict with a roommate, discussing the news over dinner.
  - C1: salary negotiation, Q&A after a conference talk, giving difficult feedback, an incident
    call, pitching to a client, networking at an event, a formal complaint by phone, mediating a
    conflict between colleagues, interviewing a candidate, a meeting with investors, banter at a
    dinner party, presenting to executives.
- **Stories (12 per level)**, present tense mostly at A2 (past simple in the last ones), mixed
  tenses at B1, 80–150 words (`content:check` range), recurring cast in **Chicago**: **Maya**
  (28, software developer at a startup in the Loop), her roommate **Jordan** (barista and
  musician), their neighbour **Mrs. Carter** (retired teacher), and **Pablo**, a Spanish friend
  from Valencia who is learning English like you. A2 follows Pablo's visit (arrival, the
  neighbourhood, food, shopping, getting around, a cold); B1 follows him back in Chicago working
  at Maya's startup (office, calls, an interview, a flat, a trip that goes wrong, a party).
  B2 (orders 201–212, 100–200 words): Pablo's second year: he leads a small project at the
  startup, Jordan's band goes on a short tour, Mrs. Carter writes a memoir, a road trip, a
  misunderstanding between friends, a health scare. C1 (orders 301–312, 120–250 words): the
  startup is about to be acquired, Pablo speaks at a conference, Maya has to make a hard call,
  Jordan signs a record deal, Mrs. Carter's book launch, and Pablo decides what comes next.
  Story length is checked per level (T111).

## Audio and pictures
- Neural mp3 with edge-tts **en-US** voices (`en-US-AvaNeural`, `en-US-AndrewNeural`,
  `en-US-EmmaNeural`, `en-US-BrianNeural`), generated on the Mac with `npm run audio`;
  `speechSynthesis` `en-US` as fallback. Speech recognition locale `en-US`.
- Pictures follow docs/content-guide.md ("Pictures"): Fluent icons for concrete vocab, avatars for
  dialogue speakers.
- Prepárate (AI) and Liga need nothing for English: they already work per language.
