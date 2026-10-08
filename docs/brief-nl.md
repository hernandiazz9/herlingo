# Product note — Dutch pack (`content/nl/`)

Decided with Hernán on 2026-10-08 (plan 011). `docs/brief.md` still holds every app-wide decision
and stays untouched; this note only says how the **Dutch** pack differs. Every Dutch content task
reads both, plus docs/content-guide.md for the format and docs/brief-en.md for the levelled pack
model. `content/en/` A2 and B1 are the models for file format, conventions and quality (not for
content). This note is the single source for ids, orders, file names, situations, cast and voices:
content tasks never invent their own; if something is missing, report it instead of improvising.

## Learner and goal
- Same learner (native Spain Spanish speaker, UI in Spain Spanish with "tú"). He wants to **live
  and work in the Netherlands**: the content follows daily life there, guided by the
  inburgeringsexamen themes (gemeente, BSN, DigiD, huisarts, huur, werk, KNM topics) **without
  simulating the exam** (no exam formats, no "examenvraag").
- Base city **Utrecht**, with scenes in **Amsterdam, Rotterdam and Den Haag**.
- **Two levels**, `levels: ["A2", "B1"]`, built in parallel; the learner picks a level per
  language, like English. A2 = arriving and settling in; B1 = work and deeper life.
- Oral first, like every pack: audio on every item, short phrases, grammar only where it helps to
  speak.

## Volume and format (per level)
Same format as English (docs/content-guide.md), **the full English volume per level**:
**~450 phrases, ~330 vocabulary words, ~90 Q&A, 10 units + a grammar unit, ~50 lessons (8–30
items each, ~5 per unit), ~11 grammar cards, 12 dialogues, 12 stories**. Per unit, as a guide:
~45 phrases, ~33 vocab, ~9 Q&A. Placement: **12 questions** for the pack, 6 `A2` + 6 `B1`.

## Pack (`content/nl/pack.json`, edited only by T135)
`lang: "nl"`, `name: "Neerlandés"`, `nativeName: "Nederlands"`, `speechLocale: "nl-NL"`, 🇳🇱,
`levels: ["A2", "B1"]`, `formalRegister: "u"`, `articles: ["de", "het"]`, voices (checked in
`edge-tts --list-voices` on 2026-10-08) `nl-NL-FennaNeural` (female, default = narrator),
`nl-NL-MaartenNeural` (male), `nl-NL-ColetteNeural` (female); `numberWords` 0–100, hundreds and
`duizend`; `equivalents` `'t` = het, `m'n` = mijn, `z'n` = zijn (spoken spellings match the full
form; still never build an exercise whose only difference is one of them). Content tasks that need
a pack change (a new situation, an equivalent) report it instead of editing the file.

**Situations** (phrasebook order, shared by both levels): `saludos` 👋 Saludos y cortesía ·
`no-entiendo` ❓ Cuando no entiendes · `numeros` 🔢 Números, hora y fechas · `presentarse` 🙂
Presentarte · `casa` 🏠 Casa, rutina y tiempo libre · `tramites` 🏛️ Gemeente y trámites ·
`vivienda` 🔑 Vivienda · `dinero` 🏦 Banco, dinero e impuestos · `compras` 🛒 Compras y
supermercado · `comida` 🧀 Comer y beber · `transporte` 🚲 Bici y transporte · `salud` 💊 Salud ·
`social` 🗣️ Vecinos y vida social · `trabajo` 💼 Trabajo · `comunicacion` 📧 Email y llamadas ·
`familia` 🎒 Familia y escuela · `cultura` 🌷 Cultura y costumbres · `opiniones` 💬 Opiniones y
noticias · `gramatica` 📘 Gramática. There is no `viajes`: trains and arrival use `transporte`.

## Units (order, id, file, situation)
Order ranges: **A2 10–99, B1 110–199, grammar unit at x90**. Unit file =
`content/nl/units/<order>-<unit-id>.json`. Inside a level, the first two units come first because
the rest use them. Every unit and its dialogues/stories carry `level`.

### A2 — arriving and settling in

| Order | Unit id (file) | Spanish title (guide) | Situation(s) | Topics | Grammar focus |
| --- | --- | --- | --- | --- | --- |
| 10 | `nl-a2-hello` (`10-nl-a2-hello.json`) | Saludos, cortesía, je/u y "no entiendo" | `saludos`, `no-entiendo` | hallo/hoi/goedemorgen, dag/doei/tot ziens, alsjeblieft/alstublieft, dank je/dank u, sorry/pardon, "Wat zegt u?", "Kunt u dat herhalen?", "Kunt u langzamer praten?", "Spreekt u Engels?", "Ik spreek een beetje Nederlands", "Hoe zeg je … in het Nederlands?" | je vs u; questions with inversion (Spreekt u…?) |
| 12 | `nl-a2-numbers` (`12-nl-a2-numbers.json`) | Números, hora, fechas, precios, teléfono y código postal | `numeros` | 0–1000 (eenentwintig: units first), euros and cents (twee euro vijftig), the time incl. **half drie = 2:30** and kwart over/voor, days, months, dates (8 oktober), phone numbers (06-…), postcode (3512 AB), huisnummer | numbers order (eenentwintig), om + time, op + day |
| 20 | `nl-a2-about-me` (`20-nl-a2-about-me.json`) | Presentarte: origen, trabajo, idiomas, familia, por qué estás aquí | `presentarse` | name, from Spain (Ik kom uit Spanje), live in Utrecht, programmer, languages, family, "Ik woon hier sinds…", "Ik ben net verhuisd", hobbies | present tense of zijn/hebben/wonen/werken; V2 |
| 22 | `nl-a2-gemeente` (`22-nl-a2-gemeente.json`) | La gemeente: empadronarte, BSN, DigiD, citas y documentos | `tramites` | een afspraak maken, inschrijven (register your address), de balie, het nummertje, paspoort/ID-kaart, huurcontract, BSN, DigiD (aanvragen, activeringscode by post), formulieren, "Welke documenten moet ik meenemen?" | modals (moeten, kunnen, mogen) with infinitive at the end |
| 30 | `nl-a2-housing` (`30-nl-a2-housing.json`) | Buscar casa y mudarte: habitación, piso, contrato, facturas | `vivienda`, `casa` | kamer/appartement/studio, huur (kale huur, servicekosten), borg, de verhuurder, makelaar, bezichtiging, gemeubileerd, energie/water/internet, rooms and furniture, simple breakdowns (de verwarming doet het niet) | de/het for home words; er is/er zijn |
| 32 | `nl-a2-bank` (`32-nl-a2-bank.json`) | Banco y dinero: cuenta, pinnen, iDEAL, Tikkie | `dinero` | een rekening openen, de bankpas, pinnen (pay by card) and "Alleen pinnen", contant, iDEAL, Tikkie/betaalverzoek, overmaken, IBAN, saldo, "Mijn pas is geblokkeerd" | separable verbs (overmaken: ik maak het over) |
| 40 | `nl-a2-shopping` (`40-nl-a2-shopping.json`) | Supermercado, mercado, panadería y cafetería | `compras`, `comida` | Albert Heijn / Jumbo, de bonuskaart, statiegeld, "Wilt u de bon?", tas, kaas (jong/belegen/oud), de markt, the bakery, broodje, koffie verkeerd, appeltaart, "Wat mag het zijn?", "Ik wil graag…", afrekenen | ik wil graag / ik neem; plural -en/-s |
| 42 | `nl-a2-transport` (`42-nl-a2-transport.json`) | Bici y transporte: fiets, tren, tranvía, OV, direcciones | `transporte` | de fiets (kopen, slot, lekke band, fietsenstalling), fietspad, voorrang, NS train, inchecken/uitchecken, OV-chipkaart and OVpay, spoor, vertraging, overstappen, tram/bus, asking the way (rechtdoor, linksaf, tweede straat rechts) | separable verbs (instappen, uitchecken); imperative |
| 50 | `nl-a2-huisarts` (`50-nl-a2-huisarts.json`) | Salud: huisarts, assistente, farmacia, urgencias | `salud` | inschrijven bij een huisarts, de doktersassistente, een afspraak, "Ik heb pijn in…", koorts, verkouden, griep, de apotheek, recept, paracetamol, huisartsenpost (out of hours), 112 | ik heb… / ik ben…; body parts with de/het |
| 52 | `nl-a2-neighbours` (`52-nl-a2-neighbours.json`) | Vecinos, small talk, el tiempo, ocio y cumpleaños | `social`, `casa` | introduce yourself to the neighbours, het weer (regen, wind, lekker weertje), weekend, free time, sport, a birthday at home (gefeliciteerd, also to the family: "Gefeliciteerd met je zus!"), uitnodigen, afspreken, "Zullen we koffie drinken?" | perfect tense (intro) for "what did you do this weekend?" |
| 90 | `nl-a2-grammar` (`90-nl-a2-grammar.json`) | Gramática A2 (cards, recognition first) | `gramatica` | the cards below | — |

### B1 — work and deeper life

| Order | Unit id (file) | Spanish title (guide) | Situation(s) | Topics | Grammar focus |
| --- | --- | --- | --- | --- | --- |
| 110 | `nl-b1-job-search` (`110-nl-b1-job-search.json`) | Buscar trabajo: vacantes, CV, carta, recruiters | `trabajo`, `comunicacion` | de vacature, solliciteren, het cv, de motivatiebrief, LinkedIn, recruiter call, uitzendbureau, werkvergunning/kennismigrant (recognition), "Ik reageer op de vacature…", formal email openings (Geachte…, Met vriendelijke groet) | subordinate clauses with dat/omdat (verb last) |
| 112 | `nl-b1-interview` (`112-nl-b1-interview.json`) | Entrevista de trabajo: experiencia, puntos fuertes, contrato y salario | `trabajo` | sollicitatiegesprek, ervaring, sterke/zwakke punten, "Waarom wilt u hier werken?", het salaris (bruto/netto per maand), vast contract / tijdelijk contract, proeftijd, vakantiegeld, dertigprocentregeling (recognition) | perfect vs imperfect for experience |
| 120 | `nl-b1-workplace` (`120-nl-b1-workplace.json`) | En el trabajo: primeros días, compañeros, comida, email y Teams | `trabajo`, `comunicacion` | de eerste werkdag, collega's, the lunch (boterham, kantine), koffie halen voor elkaar, Dutch directness, email/Teams/chat, thuiswerken, werkplek reserveren, "Heb je even?" | reflexive verbs (zich voorstellen, zich aanmelden) |
| 122 | `nl-b1-meetings` (`122-nl-b1-meetings.json`) | Reuniones y acuerdos: opinar, proponer, ziekmelden | `trabajo` | het overleg, de agenda, de stand-up, opinion and (dis)agreement (Ik ben het (niet) met je eens), proposals, afspraken maken, actiepunten, deadline, calling in sick (zich ziekmelden, beter melden) | conjunctions maar/want/dus vs omdat; zou for polite proposals |
| 130 | `nl-b1-renting` (`130-nl-b1-renting.json`) | Problemas con el alquiler: averías, humedad, fianza, subidas | `vivienda` | onderhoud and reparatie melden, schimmel, lekkage, the cv-ketel, de huurcommissie, huurverhoging, borg terugkrijgen, de VvE, geluidsoverlast, opzeggen (notice), huurtoeslag (recognition) | passive with worden (wordt gerepareerd) |
| 132 | `nl-b1-health` (`132-nl-b1-health.json`) | El sistema sanitario: seguro, eigen risico, especialista, dentista | `salud` | de zorgverzekering (basisverzekering, aanvullend), het eigen risico, de verwijzing (huisarts → specialist), het ziekenhuis, de tandarts (not in the basic insurance), de fysiotherapeut, de praktijkondersteuner, mental health (POH-GGZ, recognition), "Wordt dat vergoed?" | om … te + infinitive |
| 140 | `nl-b1-school` (`140-nl-b1-school.json`) | Escuela y cuidado infantil: guardería, basisschool, tutorías | `familia` | de kinderopvang/het kinderdagverblijf, de bso, de basisschool (groep 1–8), de juf/meester, het oudergesprek, het consultatiebureau, kinderopvangtoeslag, ziek melden van je kind, schoolreisje, playdate (speelafspraak) | relative clauses with die/dat |
| 142 | `nl-b1-taxes` (`142-nl-b1-taxes.json`) | Impuestos y papeles: Belastingdienst, toeslagen, nómina, cartas | `dinero` | de Belastingdienst, de aangifte inkomstenbelasting (voor 1 mei), de loonstrook, toeslagen (zorgtoeslag, huurtoeslag), de BelastingTelefoon, a letter you do not understand, betalingsregeling, automatische incasso, aanmaning, boete, DigiD to log in | er (place, er + number, er + preposition) |
| 150 | `nl-b1-culture` (`150-nl-b1-culture.json`) | Cultura y normas (temas KNM): directness, agenda, fiestas, convivencia | `cultura`, `social` | directness and doe normaal, the agenda culture (afspreken weken vooruit), Koningsdag, Sinterklaas, Bevrijdingsdag/4 en 5 mei, gelijkheid (equal treatment), afval scheiden, buren and geluid, verjaardag in the circle, polderen, water and dikes, the royal family and the government (recognition only) | adjective -e ending (een mooi huis / het mooie huis) |
| 152 | `nl-b1-opinions` (`152-nl-b1-opinions.json`) | Opinión y noticias: debatir, reaccionar, la actualidad | `opiniones` | giving and asking opinions (Ik vind dat…, Volgens mij…), agreeing/disagreeing politely, nuance (Aan de ene kant… aan de andere kant), the news (het nieuws, NOS), woningnood, klimaat and the weather, de Tweede Kamer, verkiezingen, stemmen, reacting to news | comparatives and superlatives; future with gaan/zullen |
| 190 | `nl-b1-grammar` (`190-nl-b1-grammar.json`) | Gramática B1 (cards) | `gramatica` | the cards below | — |

**Grammar cards** go in the grammar unit's own `grammar` array, id `gram.nl-<level>-<slug>`:
- **A2 (11)**: `gram.nl-a2-de-het` (de/het and een; diminutives and plurals take de/het rules) ·
  `gram.nl-a2-pronouns` (ik/jij-je/u/hij/zij-ze/wij-we/jullie/zij-ze, possessives mijn/jouw-je/uw/
  zijn/haar/ons-onze) · `gram.nl-a2-present` (stem + t, no -t after inverted jij: "Woon jij…?";
  zijn and hebben) · `gram.nl-a2-word-order` (V2: Morgen ga ik…) · `gram.nl-a2-questions` (W-words
  and yes/no inversion) · `gram.nl-a2-niet-geen` · `gram.nl-a2-plural` (-en/-s) ·
  `gram.nl-a2-separable-verbs` (opbellen: ik bel je op; ik wil je opbellen) · `gram.nl-a2-modals`
  (kunnen, willen, moeten, mogen + infinitive at the end) · `gram.nl-a2-diminutives` (-je, -tje,
  -pje, -etje, always het) · `gram.nl-a2-perfect` (hebben/zijn + ge-…-d/t, 't kofschip).
- **B1 (12)**: `gram.nl-b1-imperfect` (ik werkte / ik ging) · `gram.nl-b1-perfect-zijn`
  (zijn with movement and change: ik ben verhuisd) · `gram.nl-b1-adjective-ending` ·
  `gram.nl-b1-subordinate-clauses` (dat, omdat, als, toen, terwijl: verb last; maar/want/dus keep
  normal order) · `gram.nl-b1-er` · `gram.nl-b1-relative-clauses` (die/dat, waar + preposition) ·
  `gram.nl-b1-om-te` · `gram.nl-b1-reflexive` (zich) · `gram.nl-b1-comparatives` (groter dan, het
  grootst, liever/meest) · `gram.nl-b1-future` (gaan + infinitive, zullen) ·
  `gram.nl-b1-zou` (polite requests and hypotheses: Zou u…? Ik zou…) · `gram.nl-b1-passive`
  (worden / is + participle, intro).

## Register
- `formalRegister: "u"`. **`u`** = polite *u* to one person: the gemeente, the huisarts and
  doctors, the apotheek staff, a job interview, the landlord's agency (makelaar/verhuurder),
  the bank, the Belastingdienst, older strangers, the school's administration. **`tu`** = *je/jij*:
  colleagues (including your manager), neighbours, friends, children, recruiters, and most
  café/shop/market staff (in the Netherlands they usually say *je* to adults under ~50; use `tu`
  when the line uses je). **`neutral`** = no pronoun or verb form marks it ("Twee broodjes kaas,
  alsjeblieft." is `tu`; "Goedemorgen!" is `neutral`).
- *alsjeblieft* / *dank je* go with `tu`, *alstublieft* / *dank u* with `u`. Note that
  alsjeblieft/alstublieft also means "here you are" when handing something over (explain in
  `notes`).
- Q&A replies and dialogue options match the item's register; a wrong option may be wrong *because*
  it mixes je and u (feedback says so). The dialogue badge says "Trato de usted (u)" / "Trato de
  tú".

## Dutch language rules
- **Standard Dutch of the Netherlands (nl-NL)**, natural and current, as people speak it in
  Utrecht; no Flemish forms (no *ge/gij*, *goesting*, *dikwijls* only in recognition). Short
  phrases: **≤ 12 words at A2, ≤ 15 at B1** when possible. Formats: €2,50 (comma decimals, read
  "twee euro vijftig"), 24-hour time in writing (14:30) and spoken "half drie", dates "8 oktober",
  postcode "3512 AB", phone "06-12345678". Numbers in exercise text **as words**.
- **Spelling**: current official spelling (Groene Boekje), with its diacritics: *één* (one, to
  tell it from *een* "a"), *ideeën*, *zeeën*, *geïnteresseerd*, *café*, *reünie*. Typed answers
  without the diacritics (`een` for `één`, `ideeen`) are accepted with the "cuidado con el
  acento" note (generic normalization); never build an exercise whose answer differs from a
  distractor only by diacritics or punctuation.
- **Articles (de/het)**: every noun in vocab has `article` `de` or `het` (`pack.json`
  `articles`); plural-only nouns and uncountable mass nouns still get their article (*het water*,
  *de hersenen*). No `gender` field. Vocab `plural` given when the noun has one. Diminutives are
  always *het* (*het huisje*, *het biertje*); the plural article is always *de*. Rules of thumb in
  `notes` only when they help (-je/-ment/-um → het, people and -heid/-ing → de); otherwise just
  learn it.
- **Separable verbs** (opbellen, meenemen, afspreken, inchecken, overmaken, opzeggen): the
  infinitive in vocab, and every phrase that splits one has a `notes` line ("*bel … op* = opbellen:
  la partícula va al final"). **V2 word order** and **verb last in subordinate clauses** explained
  in `notes` where a phrase shows them (Morgen **ga** ik… / …omdat ik ziek **ben**).
- **Diminutives** (biertje, broodje, momentje, even een vraagje) explained in `notes`: they are
  everyday Dutch and often make a request softer, not "small".
- **Softeners and idioms**: *even*, *maar*, *hoor*, *toch*, *gezellig*, *lekker*, *doe normaal*,
  *dat klopt*, *prima*, *jammer* explained in `notes` the first time a unit uses them; idioms only
  when common.
- **Pronunciation tips** (phrase `explanation`, one per phrase) for a Spanish speaker: *g/ch* is a
  throaty sound close to the Spanish *j* (in Utrecht/the north, harder than in the south);
  *ui* (huis), *eu* (neus), *ij/ei* (both "ei"), *oe* = "u", *u* (rounded "i"), *aa/a*,
  *ee/e*, *oo/o* (long vs short vowels change the word: man/maan); *sch* = s + g (Scheveningen);
  *w* between "v" and "u"; *v* often sounds like "f", *z* like "s" in the north; final -en often
  sounds "-e" (lopen → "lope"); final *d* sounds "t" (hond → "hont"); *r* varies (rolled or
  throaty, both fine); stress usually on the first syllable, never on the prefix of an inseparable
  verb (betalen, vergeten) but on the particle of a separable one (OPbellen).
- **Typical Spanish-speaker mistakes** used as distractors and wrong options (always plausible,
  feedback explains in one sentence): de/het swaps (*de huis*); V2 broken (*Morgen ik ga…*); verb
  not at the end in subordinate clauses (*omdat ik ben ziek*); the separable particle left
  attached (*Ik opbel je*); *niet* vs *geen* (*Ik heb niet een fiets*); false friends (*de
  winkel* is a shop not a window; *de kamer* = room; *bellen* = to phone; *raar* = strange (not
  rare); *eventueel* = possibly; *actueel* = current; *sympathiek* ≈ simpático but *aardig* is the
  everyday word; *de kast* = cupboard; *de bank* = sofa and bank; *slim* = clever); "I am 30 years"
  (*Ik ben dertig* / *dertig jaar oud*, never *Ik heb dertig jaar*); *half drie* read as 3:30;
  *ik heb honger* fine but *ik heb koud* wrong (*ik heb het koud*); hebben vs zijn in the perfect
  (*ik heb verhuisd*); je/u mixed in one sentence; Spanish word order for adjectives (*een huis
  groot*); missing -t (*hij woon*) or extra -t after inverted jij (*Woont jij…?*).
- **Numbers**: `numberWords` 0–100 (units first: *eenentwintig*, *tweeëntwintig*), hundreds,
  *duizend*; prices *drie euro vijftig*; years *tweeduizend zesentwintig*; times *kwart over
  negen*, *half tien* (= 9:30), *tien voor half tien* (9:20).

## Ids
Ids are **unique across every pack** (`content:check` rejects collisions). Dutch ids start with
`nl-<level>-`:
- unit `nl-a2-gemeente`; lesson `nl-a2-gemeente.l.<slug>` (`nl-a2-gemeente.l.inschrijven`);
  phrase / vocab `nl-a2-gemeente.<slug>` (`nl-a2-gemeente.bsn`); Q&A `nl-a2-gemeente.qa.<slug>`;
- grammar `gram.nl-a2-<slug>` / `gram.nl-b1-<slug>` (list above);
- dialogue `dlg.nl-a2-<slug>` / `dlg.nl-b1-<slug>` (list below);
- story `story.nl-a2-<slug>` / `story.nl-b1-<slug>`; story inline key word `story-nl-<slug>`;
- placement `placement.nl-a2-<slug>` / `placement.nl-b1-<slug>` in `content/nl/extras/placement.json`.
Slugs are lower-case ASCII joined by `-` (Dutch words fine: `bonuskaart`, `lekke-band`). Later
units reuse earlier Dutch items **by id, any level** (a B1 lesson may list `nl-a2-hello.dank-u`)
instead of duplicating text with a new id.

## Cast and voices
Narrator and default voice: **nl-NL-FennaNeural**. Every **male** character speaks with
**nl-NL-MaartenNeural**, every **female** character with **nl-NL-ColetteNeural**. Pack voices
are only three, so: **a story quotes at most one man and one woman** (other characters' words go
in reported speech by the narrator), and **a dialogue has at most two native voices**; the
learner's options get the pack voice no native turn of that dialogue uses (automatic, see
docs/content-guide.md "Audio"). The learner in dialogues is Hernán himself (prompts in Spanish,
"tú").

**Stories cast** (Utrecht, recurring in both levels):
- **Diego Martín** (33, from Zaragoza, backend developer) moves to Utrecht for a job and learns
  Dutch like you — Maarten.
- **Femke de Vries** (30, his upstairs neighbour, nurse at the UMC Utrecht, cycles everywhere,
  direct and warm) — Colette.
- **Ria Bakker** (71, retired primary-school teacher on the ground floor, knows the whole street,
  makes appeltaart) — Colette.
- B1 adds **Sanne Visser** (36, Diego's team lead at a Utrecht scale-up) — Colette; **Joost
  Mulder** (41, Rotterdam-born colleague, very direct, Feyenoord fan) — Maarten; Diego's partner
  **Lucía** (32, graphic designer) and their daughter **Martina** (6), who join him in B1 — Lucía
  Colette; Martina is never quoted (reported speech only).
- Dialogue natives are unnamed roles or one-off names chosen per dialogue (not the story cast):
  a male native → Maarten, a female native → Colette, Fenna only for a second female in the same
  dialogue (then the learner gets Maarten).

## Dialogues (12 per level)
6–10 turns, ≥ 3 learner turns, 3 options each, Spanish feedback, `avatars` with a Fluent icon
per native speaker when one fits. File `content/nl/dialogues/<level>-<slug>.json`, id
`dlg.nl-<level>-<slug>`, `unit` = the unit it belongs with.

| Order | Id | Topic | Unit | Register | Native(s) |
| --- | --- | --- | --- | --- | --- |
| 1 | `dlg.nl-a2-gemeente-registration` | Empadronarte en la balie de la gemeente (BSN) | `nl-a2-gemeente` | `u` | baliemedewerker (m) |
| 2 | `dlg.nl-a2-gemeente-call` | Llamar a la gemeente para pedir cita y preguntar por DigiD | `nl-a2-gemeente` | `u` | medewerker (f) |
| 3 | `dlg.nl-a2-room-viewing` | Visitar una habitación con la agencia | `nl-a2-housing` | `u` | makelaar (f) |
| 4 | `dlg.nl-a2-bank-account` | Abrir una cuenta en el banco | `nl-a2-bank` | `u` | bankmedewerker (m) |
| 5 | `dlg.nl-a2-supermarket` | Caja del supermercado: bonuskaart, bolsa, pinnen | `nl-a2-shopping` | `tu` | caissière (f) |
| 6 | `dlg.nl-a2-cafe` | Pedir en una cafetería: koffie, broodje, appeltaart | `nl-a2-shopping` | `tu` | barista (m) |
| 7 | `dlg.nl-a2-market` | Puesto de queso en el mercado: probar, pedir, pagar | `nl-a2-shopping` | `tu` | kaasboer (m) |
| 8 | `dlg.nl-a2-train-ticket` | NS: billete, andén y retraso en Utrecht Centraal | `nl-a2-transport` | `u` | NS-medewerker (f) |
| 9 | `dlg.nl-a2-bike-repair` | En el fietsenmaker: rueda pinchada | `nl-a2-transport` | `tu` | fietsenmaker (m) |
| 10 | `dlg.nl-a2-huisarts-call` | Llamar a la doktersassistente para una cita | `nl-a2-huisarts` | `u` | doktersassistente (f) |
| 11 | `dlg.nl-a2-pharmacy` | En la apotheek | `nl-a2-huisarts` | `u` | apotheker (m) |
| 12 | `dlg.nl-a2-new-neighbour` | Presentarte a la vecina e invitación a un cumpleaños | `nl-a2-neighbours` | `tu` | buurvrouw (f) |
| 101 | `dlg.nl-b1-recruiter-call` | Llamada de una recruiter por una vacante | `nl-b1-job-search` | `tu` | recruiter (f) |
| 102 | `dlg.nl-b1-job-interview` | Entrevista de trabajo | `nl-b1-interview` | `u` | manager (m) |
| 103 | `dlg.nl-b1-first-day` | Primer día: presentaciones, almuerzo, Teams | `nl-b1-workplace` | `tu` | collega (f) |
| 104 | `dlg.nl-b1-team-meeting` | Reunión de equipo: opinar y acordar | `nl-b1-meetings` | `tu` | teamleider (m) |
| 105 | `dlg.nl-b1-sick-call` | Llamar para darte de baja (ziekmelden) | `nl-b1-meetings` | `tu` | leidinggevende (f) |
| 106 | `dlg.nl-b1-repair-request` | Avisar de humedad y una avería a la agencia | `nl-b1-renting` | `u` | medewerker verhuurder (m) |
| 107 | `dlg.nl-b1-deposit` | Recuperar la fianza al dejar el piso | `nl-b1-renting` | `u` | verhuurder (f) |
| 108 | `dlg.nl-b1-referral` | En el huisarts: pedir una derivación al especialista | `nl-b1-health` | `u` | huisarts (m) |
| 109 | `dlg.nl-b1-insurance-call` | Llamar a la aseguradora: eigen risico y lo que cubre | `nl-b1-health` | `u` | zorgverzekeraar (f) |
| 110 | `dlg.nl-b1-parent-meeting` | Tutoría con la maestra (oudergesprek) | `nl-b1-school` | `u` | juf (f) |
| 111 | `dlg.nl-b1-tax-call` | BelastingTelefoon: una carta que no entiendes | `nl-b1-taxes` | `u` | medewerker (m) |
| 112 | `dlg.nl-b1-birthday-debate` | Cumpleaños en círculo: opinar sobre la vivienda y las noticias | `nl-b1-opinions` | `tu` | oom (m) |

## Stories (12 per level)
File `content/nl/stories/<level>-NN-<slug>.json`, id `story.nl-<level>-<slug>`, `order` A2 1–12,
B1 101–112, `level` set. **80–150 words** (`content:check` range for A2 and B1). A2: present tense,
perfect tense in the last three (10–12); B1: mixed tenses (perfect and imperfect). Same cast and
voice rules as above; key words reuse unit items by id where they exist.

| Order | File | Id | Plot | Situation |
| --- | --- | --- | --- | --- |
| 1 | `a2-01-welkom-in-utrecht.json` | `story.nl-a2-welkom-in-utrecht` | Diego lands at Schiphol, takes the train to Utrecht Centraal, checks in and out with his card | `transporte` |
| 2 | `a2-02-een-kamer-in-lombok.json` | `story.nl-a2-een-kamer-in-lombok` | His first room in the Lombok neighbourhood; meets Femke on the narrow stairs | `vivienda` |
| 3 | `a2-03-naar-de-gemeente.json` | `story.nl-a2-naar-de-gemeente` | Registration at the gemeente, the BSN, the DigiD letter | `tramites` |
| 4 | `a2-04-mijn-eerste-fiets.json` | `story.nl-a2-mijn-eerste-fiets` | A second-hand bike, two locks, the first ride in the rain | `transporte` |
| 5 | `a2-05-de-bonuskaart.json` | `story.nl-a2-de-bonuskaart` | Albert Heijn: bonuskaart, statiegeld, "alleen pinnen" | `compras` |
| 6 | `a2-06-een-bankrekening.json` | `story.nl-a2-een-bankrekening` | Opening a bank account; Femke sends him a Tikkie for pizza | `dinero` |
| 7 | `a2-07-de-buurvrouw.json` | `story.nl-a2-de-buurvrouw` | Ria Bakker, coffee and appeltaart, the rules of the street | `social` |
| 8 | `a2-08-regen-regen-regen.json` | `story.nl-a2-regen-regen-regen` | Weather, daily routine, a lazy weekend at home | `casa` |
| 9 | `a2-09-een-dag-in-amsterdam.json` | `story.nl-a2-een-dag-in-amsterdam` | Day trip with Femke: canals, a museum, the last train | `transporte` |
| 10 | `a2-10-bij-de-huisarts.json` | `story.nl-a2-bij-de-huisarts` | (perfect) Diego got the flu: the huisarts, the apotheek | `salud` |
| 11 | `a2-11-de-verjaardag-van-femke.json` | `story.nl-a2-de-verjaardag-van-femke` | (perfect) Femke's birthday: the circle, congratulating everyone | `social` |
| 12 | `a2-12-drie-maanden-later.json` | `story.nl-a2-drie-maanden-later` | (perfect) Three months in: what he has learned, a call home | `presentarse` |
| 101 | `b1-01-de-vacature.json` | `story.nl-b1-de-vacature` | Diego's contract ends; he searches vacatures and writes a motivatiebrief | `trabajo` |
| 102 | `b1-02-het-sollicitatiegesprek.json` | `story.nl-b1-het-sollicitatiegesprek` | The interview at Sanne's scale-up, salary and proeftijd | `trabajo` |
| 103 | `b1-03-de-eerste-werkdag.json` | `story.nl-b1-de-eerste-werkdag` | First day: boterhammen at lunch, Teams, meeting Joost | `trabajo` |
| 104 | `b1-04-joost-zegt-het-gewoon.json` | `story.nl-b1-joost-zegt-het-gewoon` | A meeting where Joost is very direct; Diego learns not to take it personally | `trabajo` |
| 105 | `b1-05-schimmel-in-de-badkamer.json` | `story.nl-b1-schimmel-in-de-badkamer` | A bigger flat for the family, then mould and a landlord who does not answer | `vivienda` |
| 106 | `b1-06-naar-de-basisschool.json` | `story.nl-b1-naar-de-basisschool` | Lucía and Martina arrive; school, bso and the juf | `familia` |
| 107 | `b1-07-het-eigen-risico.json` | `story.nl-b1-het-eigen-risico` | A specialist visit and the surprise bill: eigen risico explained | `salud` |
| 108 | `b1-08-een-brief-van-de-belastingdienst.json` | `story.nl-b1-een-brief-van-de-belastingdienst` | A letter about zorgtoeslag; Ria helps with the aangifte | `dinero` |
| 109 | `b1-09-koningsdag.json` | `story.nl-b1-koningsdag` | Orange everywhere, the vrijmarkt, Martina sells her toys | `cultura` |
| 110 | `b1-10-een-weekend-in-rotterdam.json` | `story.nl-b1-een-weekend-in-rotterdam` | Joost shows them his city: the port, architecture, his direct mother | `cultura` |
| 111 | `b1-11-een-dag-in-den-haag.json` | `story.nl-b1-een-dag-in-den-haag` | Den Haag: the Tweede Kamer, the beach at Scheveningen, a debate on woningnood | `opiniones` |
| 112 | `b1-12-een-jaar-in-nederland.json` | `story.nl-b1-een-jaar-in-nederland` | One year later: what changed, what Diego still finds strange, what comes next | `presentarse` |

## Placement
`content/nl/extras/placement.json`, 12 questions, ids `placement.nl-a2-<slug>` (6, `level: "A2"`)
and `placement.nl-b1-<slug>` (6, `level: "B1"`), testing what each level's units teach (de/het,
V2, separable verbs, half drie, je/u; subordinate clauses, perfect vs imperfect, er, om te,
reading a short letter from the gemeente or the Belastingdienst).

## Audio and pictures
- Neural mp3 with edge-tts **nl-NL** voices (Fenna first, Maarten, Colette), generated on the
  Mac with `npm run audio` by the audio task only (content tasks never run it).
  `speechSynthesis` `nl-NL` as fallback. Speech recognition locale `nl-NL`.
- Pictures follow docs/content-guide.md ("Pictures"): Fluent icons for concrete vocab **only when
  one fits and exists** (e.g. `fluent:bicycle`, `fluent:cheese-wedge`, `fluent:house`), avatars
  for dialogue speakers. `npm run images` is run by the audio/pictures task only.
- Prepárate (AI) and Liga need nothing for Dutch: they already work per language; the dialogue
  and Prepárate badges show "Trato de usted (u)" / "Trato de usted" for `u`.
