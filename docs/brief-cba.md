# Product note — Cordobés pack (`content/cba/`)

Decided with Hernán on 2026-10-09 (plan 013). `docs/brief.md` still holds every app-wide decision
and stays untouched; this note only says how the **Cordobés** pack differs. Every content task of
this pack reads both, plus **docs/cordobes-lexico.md** (the source of truth: words, meanings, Spain
equivalents, register, confidence), docs/content-guide.md (format) and `content/es/` (the format
model for an es-AR pack: copy format and quality, never content). This note is the single source
for ids, orders, file names, situations, cast and voices.

## Learner and goal
- **A speaker of Spain Spanish** (Madrid-style: tú, vosotros, "vale", "coger el bus") going to
  Córdoba, Argentina: friends, a trip, a partner's family. Knows Spanish perfectly; needs **only
  what differs**: words, voseo, the tonada, register, false friends, culture.
- **No basics.** No "hola", "gracias", numbers or colours unless the Córdoba form differs
  ("chau", "¿cómo andás?", "buen día"). Every item earns its place by being different from Spain
  or by being a trap.
- **Understand first, then use.** Everything the lexicon has with confidence alta/media is taught
  for understanding, including vulgar and offensive words, always with a register warning. What
  the learner should say himself is taught for production; what would sound like mockery or a
  class stereotype from a Spaniard is recognition only (docs/cordobes-lexico.md §7.1).
- Glosses and notes in **Spain Spanish** (`es`, the default: no `glossLangs`). Same language as
  the target: the app shows "Equivalente en España" instead of "Ver en español" and does not offer
  Prepárate for this pack (`glossIsTargetLanguage()` in `src/lib/content/gloss.ts`, generic).

## Pack (`content/cba/pack.json`, done in T156)
`lang: "cba"`, `name: "Cordobés"`, `nativeName: "Cordobés"`, `speechLocale: "es-AR"` (speech
recognition and the device-voice fallback; there is no es-AR-Córdoba locale), emoji 🧉 (🇦🇷 is
the Argentine-Spanish pack's), `formalRegister: "usted"` (badges "Trato de vos" / "Trato de
usted"), no `levels`, no `glossLangs` (= `["es"]`), no placement, `articles: ["el", "la", "los",
"las"]`, `numberWords` as in `content/es/pack.json`. Voices = the same four as `content/es/`:
`es-AR-ElenaNeural` (default), `es-AR-TomasNeural`, `es-UY-MateoNeural`, `es-UY-ValentinaNeural`.
Content tasks never edit pack.json: they report the change they need.

**Situations** (phrasebook order; `title` is a plain Spain-Spanish string):

| id | emoji | title |
| --- | --- | --- |
| `saludos` | 👋 | Saludos y trato |
| `gente` | 🧑‍🤝‍🧑 | Gente y apodos |
| `comida` | 🥪 | Comer y beber |
| `salir` | 🎶 | Salir, cuarteto y fútbol |
| `plata` | 💸 | Plata y laburo |
| `lugares` | 🏞️ | Lugares, transporte y sierras |
| `salud` | 🤒 | Cuerpo y salud |
| `emociones` | 😮 | Emociones y muletillas |
| `falsos-amigos` | ⚠️ | Falsos amigos con España |
| `insultos` | 🤬 | Insultos y tacos |
| `tonada` | 🗣️ | Tonada y gramática |

## Units

Files `content/cba/units/<order>-<unit-id>.json`. Sections refer to docs/cordobes-lexico.md; "rows"
= alta + media rows of that table (baja rows skipped, see "Confidence"). Expressions of §5 go to
the unit of their topic (numbers = the `#` column).

| Order | Unit id | Title | Situation(s) | Draws from (alta+media rows) | Phrases | Vocab | Q&A | Lessons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | `cba-saludos` | ¿Qué lo qué? Saludos y trato | `saludos` | §4.1 Saludos y trato (31), §3.1 Tratamiento (vos/ustedes, standard voseo), §3.6 che / dale / bueno / listo / ¿viste? / mirá (~8), §5 greetings and replies (#1–#10, ~10) | 30 | 20 | 8 | 4 |
| 20 | `cba-gente` | El Nico, la Cami y el negro | `gente` | §4.2 Personas y apodos (62), §3.3 article before names, §3.8 negro/nero/guaso, §3.9 car'e…, §5 people expressions (~6) | 30 | 38 | 7 | 4 |
| 30 | `cba-comida` | Fernet, lomito y criollos | `comida` | §4.4 Comida y bebida (66), §6 Fernet con coca + Comida, §5 food and drink (#81 70/30 and others, ~6) | 30 | 40 | 8 | 4 |
| 40 | `cba-salir` | El baile, la previa y el clásico | `salir` | §4.5 Salir y fiesta (40), §6 Cuarteto + Fútbol (Belgrano, Talleres, Instituto), §5 party expressions (~8) | 28 | 28 | 7 | 4 |
| 50 | `cba-plata` | Plata, laburo y verbos de la calle | `plata` | §4.6 Dinero y trabajo (32), §4.10 Verbos coloquiales: the work / money / everyday-action half (~20 of 42), §3.2 saber = soler, recién, pretérito simple, §5 (~5) | 26 | 30 | 7 | 4 |
| 60 | `cba-lugares` | Del centro a las sierras | `lugares`, `salud` | §4.7 Transporte, lugares y ciudad (43), §4.8 Cuerpo y salud (23), §6 La Docta, Cosquín, Villa Carlos Paz, la siesta, §7.2 sierras words, §5 (~5) | 28 | 36 | 7 | 4 |
| 70 | `cba-emociones` | ¡Qué abuso! Emociones y muletillas | `emociones` | §4.9 Emociones y estados (32), §4.11 Muletillas y comodines (30), §3.5 Intensificadores (14), §3.4 aumentativos (calorón, -ononón), §4.10 the rest (~22), §5 (~20) | 42 | 30 | 8 | 5 |
| 80 | `cba-trampas` | Coger, concha, culiado: trampas e insultos | `falsos-amigos`, `insultos` | §4.12 Falsos amigos (41), §4.3 Insultos y piropos (29), §3.7 culiado in its four degrees, §5 vulgar expressions (#80 and others, ~10) | 36 | 28 | 8 | 4 |
| 90 | `cba-tonada` | Tonada y gramática | `tonada` | §2 Fonética y tonada (18), §3.1, §3.3, §3.4, §3.5 | — | — | — | 1 (8 cards) |
| | **Total** | | | | **250** | **250** | **60** | **38** |

Phrase totals **include `expressions`** (recognition-only items, see "Register"): aim for about 40
expressions across units 10–80. T157 writes units 10–40 and 90 (~118 phrases, ~126 vocab, ~30 Q&A,
8 cards); T158 writes 50–80 and must cover every alta/media row and expression that fits a unit.
A word that appears in two sections lives in the first unit that lists it; later units **reuse it
by id** in their lessons instead of repeating the text with a new id. No two items with the same
normalized text.

**Ids**: lesson `cba-saludos.l.<slug>`, phrase `cba-saludos.<slug>`, vocab
`cba-comida.v.<slug>`, Q&A `cba-saludos.qa.<slug>`, expression `cba-trampas.x.<slug>`, grammar
`gram.cba-<slug>`, dialogue `dlg.cba-<slug>`, story `story.cba-<slug>`, inline story key word
`story-cba-<slug>`.

**Grammar cards** (unit 90, `gram.cba-<slug>`, recognition first, short tables, examples with `es`
= the Spain form):

1. `gram.cba-tonada` — the stretched syllable before the stressed one (ca-pii-tal, ¿qué ha-cee'?),
   the early pitch peak; capital vs Traslasierra (first syllable) vs the east; don't imitate it on
   purpose, understand it (§2.1, §7.1).
2. `gram.cba-s-final` — aspirated / dropped -s ("¿qué hacé'?", "lo' chico'", "vamo'"), seseo,
   ll/y = [ʒ] (not the porteño [ʃ]); popular layer: poio, Taiere, coletivo, dotor, jue (§2.2).
3. `gram.cba-voseo` — vos tenés / sos / querés / vení / decime, ustedes for every plural (no
   vosotros, no os: os quiero → los quiero); popular tenís / querís / ¿qué cobrai? and "ite" only to
   recognise (§3.1).
4. `gram.cba-usted` — usted with older people, the doctor, the police, a formal boss (more than in
   Spain, where tú reaches almost everyone); vos with any peer, even a stranger your age; ustedes
   is both "vosotros" and "ustedes".
5. `gram.cba-preterito` — fui / comí for "he ido / he comido" (hoy fui al centro); voy a + inf.;
   recién; saber = soler ("sabía tener un puestito") (§3.2).
6. `gram.cba-articulo-nombre` — la Cami, el Nico, la Yesi: normal and affectionate in Córdoba,
   rural or Catalan-sounding in Spain (§3.3).
7. `gram.cba-aumentativos` — -azo / -aza, -ón / -ona, -azón and the triple -ononón (asadazo,
   calorón, friazón, calorononón), diminutive -ito (never -illo), muy mucho, maomeno (§3.4).
8. `gram.cba-intensificadores` — re- / recontra-, mal, alto/a, una banda, a full, zarpado, ni en
   pedo / ni a palos / ni ahí / ni bosta / ni tronco 'e bola, with the Spain equivalent of each
   (§3.5).

## Cast and voices

Recurring in units, dialogues and stories:

| Character | Who | Voice |
| --- | --- | --- |
| **Álex** (Alejandro) | The learner protagonist: 30, from Madrid (Lavapiés), a graphic designer who works remotely; spends three months in Córdoba with his girlfriend Cami. Says "vale", "tío", "coger el bus" at first; Cami and Nico correct him with jokes. | `es-UY-MateoNeural` (his lines in stories; dialogue learner options get Mateo automatically) |
| **Cami** (Camila) | His girlfriend: 29, cordobesa from barrio Güemes, met Álex in Madrid; architect, proud of Córdoba, translates cordobés to Spain Spanish with patience and teasing. | `es-AR-ElenaNeural` |
| **el Nico** (Nicolás) | Cami's cousin: 32, from barrio Alberdi, plumber, Belgrano fan ("pirata"), cuartetero, says "¿qué lo qué?", "nero", "culiao" with friends; adopts Álex. | `es-AR-TomasNeural` |
| **Narrator** (stories) | — | `es-UY-ValentinaNeural`: every story sets `"voice": "es-UY-ValentinaNeural"` |
| Secondary characters | **la Yesi** (Nico's girlfriend, Talleres fan), **Doña Chela** (Cami's grandmother in Cosquín: usted with strangers, old-fashioned cordobés), **Don Rubén** (lomitero near La Cañada), the remisero, the kiosquero, the boss at a café | In dialogues: Elena (women) or Tomás (men). In stories: the es-AR voice of their gender when Cami or Nico (same voice) does not speak in that story, otherwise reported speech by the narrator. |

**Dialogue voice rule** (as in `content/es`): native turns use only `es-AR-ElenaNeural` and
`es-AR-TomasNeural`, and **every dialogue uses both**, so the learner's options are voiced by
`es-UY-MateoNeural` = Álex. There is no Spain voice in the pack (decided: the four es pack voices),
so Álex's Spain-Spanish options sound rioplatense; the feedback says how they come across.
Avatars: `fluent:` people icons per name.

Unit items: default voice (Elena); a phrase or Q&A question may use Tomás for variety (male
speakers, Nico's lines). Never Mateo or Valentina on unit items. T161 may change how the voices
sound (tonada), not which voices exist.

## Comparison style (every item)
- **Gloss `es` = the Spain equivalent**, what a madrileño would say in the same situation, not a
  dictionary definition: "¿Qué hacés?" → "¿Qué pasa? / ¿Qué tal?"; "Tomate el cole" → "Coge el
  bus"; vocab "la frutilla" → "la fresa". Several equivalents separated by " / ".
- **Never a gloss identical to the text** (normalized: no case, accents or punctuation). When Spain
  says the same words, say what changes: "¿Todo bien?" → "¿Qué tal? (igual que en España, pero
  aquí es el saludo de siempre)"; voseo → the tú form ("Vení" → "Ven"). When Spain has no word
  (fernet, cuarteto, criollo), the gloss is a 2–5-word description ("el criollo" → "el bollo
  hojaldrado salado").
- **Distinct glosses**: within a unit no two items share the same gloss (exercises never offer two
  options with the same gloss, so a repeated "¿Qué tal?" would leave fewer distractors); vary the
  wording or add the nuance ("¿Qué tal? (juvenil)").
- **Notes** (1–2 sentences, Spain Spanish, "tú"): what it means, when cordobeses say it, how a
  Spaniard would say it, and the trap if there is one ("En España «coger» es inocente; aquí es
  follar: di «tomar» o «agarrar»"). Phrase `explanation` (≤ ~200 characters): when to say it +
  one pronunciation tip in Spain terms ("la ll suena como la j francesa, no como la sh porteña").
- `literal` only when it helps ("car'e poio" → "cara de pollo").

## Register
- **Vos is the default** (`register: "tu"`, shown "Trato de vos"): friends, peers, family,
  young staff, most kioscos and bars. **Usted** (`register: "usted"`) with older people (Doña
  Chela's generation), the doctor, police, a bank, a formal boss. `neutral` only when nothing in the
  phrase marks the person. Never tú, vosotros or os in a phrase, reply or option (only in notes,
  glosses and wrong options' feedback, as the Spain side). Ustedes for every plural.
- **Register tag at the start of the note** for anything not neutral: `Coloquial.`, `Vulgar.` or
  `Ofensivo.`, then with whom it is fine and with whom not ("Vulgar. Entre amigos, sí; con la
  familia de tu pareja, ni se te ocurra."). A plain coloquial word everyone uses (dale, laburo)
  needs no tag.
- Where each one is acceptable:
  - **Coloquial**: any informal scene, units, dialogues, stories.
  - **Vulgar**: notes, units 40 / 70 / 80, informal scenes among friends (the stadium, the
    baile, Nico's lines); never in a formal scene, never addressed to Doña Chela or staff.
  - **Ofensivo** (insults, "negro" as a slur, slurs of §4.3): **recognition only** = `expressions`
    (or a note), only in unit 80 and the stadium story; never said by Álex, never in a correct
    option, never in a formal scene.
- **"Culiado"**: taught in unit 80 in its four degrees (§3.7), one expression per degree, best
  Spain equivalent "cabrón"; the note says Álex should not start it (only answer when a cordobés
  friend uses it with him). It may appear in Nico's lines in dialogues 1, 7 and stories 4, 5.
- **Recognition only** (§7.1) = `expressions` (`variety`: "Cordobés popular", "Vulgar",
  "Ofensivo" or "Italianismo del este"; `standard`: the standard rioplatense form): popular voseo
  (tenís, querís, ¿qué cobrai?, ite), popular phonetics (jue, agora, los vamo'), vulgar and
  offensive words, short-lived youth slang. Expressions get listening and reading exercises only.

## Spelling
- Phrase, vocab and Q&A **text in standard spelling** ("¿Qué hacés?", "pollo", "Talleres") so
  search, matching and speech scoring work.
- The **dropped -s with an apostrophe** ("¿Qué hacé'?", "vamo'", "nos vemo'") and other popular
  spellings ("car'e poio", "pa'") **only in dialogue native lines, story lines in a character's
  voice and expressions**, and only where the lexicon documents that form. Never in the learner's
  options (Álex writes standard forms) or in Q&A.
- Numbers as words in target text ("setenta treinta" in speech; "70/30" only in notes).

## Confidence
- Use rows and expressions with confidence **alta** or **media**. Skip **baja** (and the §7.3
  doubtful items: bobina, arroiar, choncaco, pecho frío, echar moco, noventa dos diez, más agachada
  que tero de quinta, yerbeado); if one helps a note, write it with "(dudoso)".
- §6 cultural facts marked "verify" (cuarteto names and dates, the Nina case) stay out of items;
  use only the facts given without caveats.

## Dialogues (8) and stories (8)

Files `content/cba/dialogues/NN-<slug>.json` and `content/cba/stories/NN-<slug>.json` (NN = order).
Dialogues: about 9 turns, ≥ 3 learner turns, 3 options each: the cordobés answer (`correct`), a
Spain-Spanish answer that is understood but sounds foreign (`acceptable`, feedback says why:
"vale", "tío", "vosotros", "guay"), and a trap (`wrong`: a false friend like "coger", the wrong
register, an insult misread as friendly). Stories: 90–130 words, `level: "B1"`, present and
pretérito simple, 3–4 questions, 4–6 gaps, 8–10 keywords reusing unit items by id.

| Order | Dialogue id | Unit | Where | Scene | Register |
| --- | --- | --- | --- | --- | --- |
| 1 | `dlg.cba-que-lo-que` | `cba-saludos` | Barrio Güemes (a bar on the Paseo de las Artes) | Cami introduces Álex to Nico: "¿qué lo qué?", "¿cómo andás?", "acá andamo'", vos vs tú | `tu` |
| 2 | `dlg.cba-domingo-alberdi` | `cba-gente` | Barrio Alberdi, Nico's parents' house | Sunday family lunch: "la Cami", "el Negro", nicknames, car'e…, who is who | `tu` |
| 3 | `dlg.cba-lomito` | `cba-comida` | A lomitería near La Cañada | Ordering a lomito completo and a fernet 70/30 from Don Rubén, with Cami | `tu` |
| 4 | `dlg.cba-el-baile` | `cba-salir` | A cuarteto dance | Nico and la Yesi teach Álex the ronda; the previa, "¿bailás?", la Mona | `tu` |
| 5 | `dlg.cba-laburo` | `cba-plata` | A café in Nueva Córdoba | Álex asks for a part-time job; the owner (usted), Cami helps; plata, laburo, changas | `usted` |
| 6 | `dlg.cba-remis-carlos-paz` | `cba-lugares` | Terminal de Córdoba → Villa Carlos Paz | A remisero (usted) and Cami: price, the lake, the theatre season, "a la siesta" | `usted` |
| 7 | `dlg.cba-clasico` | `cba-emociones` | The stadium (Belgrano – Talleres) | Nico and la Yesi on opposite sides; ¡qué abuso!, ni en pedo, culiao (degrees 1–3, Nico's lines) | `tu` |
| 8 | `dlg.cba-feria-cosquin` | `cba-trampas` | The craft fair at the Cosquín folklore festival (January) | Buying a remera and a campera; false-friend traps: coger, pijo, bombacha, vale | `tu` |

| Order | Story id | File | Where | Plot |
| --- | --- | --- | --- | --- |
| 1 | `story.cba-llegada` | `01-llegada.json` | Córdoba airport → barrio Güemes | Álex lands; Cami and Nico wait; the first "¿qué hacé'?" and he answers what he's doing |
| 2 | `story.cba-la-canada` | `02-la-canada.json` | La Cañada and the centro | A walk with Cami: the tonada, la Docta, the Manzana Jesuítica, "la Cami" and "el Nico" |
| 3 | `story.cba-domingo-alberdi` | `03-domingo-alberdi.json` | Barrio Alberdi | Asado at Nico's parents': negro/negra as affection, car'e… nicknames, Álex gets one |
| 4 | `story.cba-clasico` | `04-clasico.json` | The stadium | Belgrano – Talleres with Nico: chants, the referee, culiado from friendly to insult |
| 5 | `story.cba-el-baile` | `05-el-baile.json` | A cuarteto dance | Previa with fernet, the ronda, the tunga-tunga, Álex learns to say "¡qué abuso!" |
| 6 | `story.cba-carlos-paz` | `06-carlos-paz.json` | Villa Carlos Paz | Summer weekend: lake San Roque, the cuckoo clock, the theatre, a calorononón |
| 7 | `story.cba-sierras` | `07-sierras.json` | The sierras (Valle de Punilla) | A hike: mate with peperina, friazón at night, Álex says "coger" and everyone laughs |
| 8 | `story.cba-cosquin` | `08-cosquin.json` | Cosquín | The folklore festival with Doña Chela (usted); three months later Álex sounds almost cordobés |

## Tone
Warm and funny: Álex's Spain-Spanish disasters ("coger", "vale", "tío", "vosotros"), Cami's
pride in Córdoba and patience, Nico's jokes and football passion. Cordobés humour is part of the
culture: jokes are with the cordobeses, never about them; never mock the tonada or class ("negro
cuartetero" is explained as a slur, not used as a joke). No politics.

## Audio and pictures
- Neural mp3 with edge-tts (voices above), `npm run audio` (T162; T161 may add a cordobés-sounding
  synthesis option); `speechSynthesis` `es-AR` as fallback. Speech recognition locale `es-AR`.
- Pictures per docs/content-guide.md ("Pictures"): Fluent icons for concrete vocab (mate,
  sándwich, colectivo…), avatars for dialogue speakers.
- Prepárate is not offered for this pack (target and gloss are both Spanish). Liga needs nothing.
