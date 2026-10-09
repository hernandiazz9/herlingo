# Product note — Spanish (Argentina) pack (`content/es/`)

Decided with Hernán on 2026-10-09 (plan 012). `docs/brief.md` still holds every app-wide decision
and stays untouched; this note only says how the **Argentine Spanish** pack differs. Every content
task of this pack reads both, plus docs/content-guide.md (format, "Gloss languages") and the
Russian pack (`content/ru/`) as the format model. This note is the single source for ids, orders,
file names, situations, cast and voices.

## Learner and goal
- **A Russian speaker starting Spanish from zero**: a tourist or a newcomer ("релокант") in
  Argentina. Goal: survive and have fun in everyday life: greet, get around, eat and drink, buy,
  make plans with friends, ask for help.
- **Glosses and notes in Russian** (`glossLangs: ["ru"]`); later the same pack and audio get `es`
  (Spain Spanish, monolingual) and `en` glosses (separate plan). Learning screens are in Russian
  when the gloss is Russian (plan 012 T150); menus and Perfil stay Spain Spanish.
- **A1 mini, one course**: no `levels`, no placement test (onboarding goes straight to unit 10).
  Small on purpose (about 800 mp3) to keep the deploy light.
- **Fun and light**: short lessons, humour, pictures, a recurring cast. Oral first like every
  pack: audio on every item, short phrases (≤ 8 words when possible), grammar only where it helps
  to speak.

## Pack (`content/es/pack.json`, done in T151)
`lang: "es"`, `name: "Español (Argentina)"`, `nativeName: "Español rioplatense"`,
`speechLocale: "es-AR"`, emoji 🇦🇷, `formalRegister: "usted"` (register badge "Trato de vos" /
"Trato de usted"), no `levels`, `glossLangs: ["ru"]`, `articles: ["el", "la", "los", "las"]`
(vocab `article`; `los`/`las` only for plural-only nouns), `numberWords` 0–100, hundreds and
`mil` as Spanish words (`cien`, `veintiuno`, `treinta y uno`), no `equivalents`.
Voices (checked in `edge-tts --list-voices` on 2026-10-09): `es-AR-ElenaNeural` (default),
`es-AR-TomasNeural`, `es-UY-MateoNeural`, `es-UY-ValentinaNeural` (Uruguay is rioplatense too).
Content tasks never edit pack.json: they report the change they need.

**Situations** (phrasebook order; `title` is a gloss map `{ "ru": … }` because the pack has no
`es` gloss; the Spain-Spanish title is given here for when `es` is added):

| id | emoji | Spain Spanish | ru |
| --- | --- | --- | --- |
| `saludos` | 👋 | Saludos y cortesía | Приветствия и вежливость |
| `no-entiendo` | ❓ | Cuando no entiendes | Когда не понимаешь |
| `presentarse` | 🙂 | Presentarte | Знакомство |
| `transporte` | 🚌 | Colectivo, subte y remís | Транспорт |
| `ciudad` | 🏙️ | Por la ciudad | По городу |
| `comida` | 🥟 | Comer y beber | Еда и напитки |
| `numeros` | 🔢 | Números, precios y hora | Числа, цены и время |
| `compras` | 🛒 | Compras y plata | Покупки и деньги |
| `planes` | 🎉 | Gente y planes | Люди и планы |
| `salud` | 💊 | Ayuda y salud | Помощь и здоровье |
| `gramatica` | 📘 | Gramática | Грамматика |

## Units (order, id, situation, topics, Córdoba share)

Córdoba is **mixed in from unit 1**, about **one third of the scenes of every unit** (Córdoba
capital, the sierras, Villa Carlos Paz); Buenos Aires for the rest. Never a "Córdoba unit" at the
end.

| Order | Unit id | Title (ru guide) | Situations | Topics | Córdoba (~⅓) |
| --- | --- | --- | --- | --- | --- |
| 10 | `es-a1-hola` | Привет, че! | `saludos`, `presentarse`, `no-entiendo` | hola / chau / buen día, ¿todo bien?, che, vos sos / yo soy, me llamo, soy de Rusia, ¿de dónde sos?, gracias / de nada / perdón / permiso, no entiendo, ¿cómo?, más despacio, ¿cómo se dice…?, dale, beso de saludo | Flor introduces herself on a video call from Córdoba: "¿qué hacé'?" and the tonada (notes) |
| 20 | `es-a1-moverse` | Колективо, субте и ремис | `transporte`, `ciudad` | colectivo, subte, tarjeta SUBE, cargar la SUBE, parada, ¿dónde queda…?, a dos cuadras, doblar / seguir derecho, remís / taxi, ¿cuánto sale?, bajarse, terminal, pasaje | Terminal de Córdoba, bus to Villa Carlos Paz, remís in Córdoba capital, the Cañada |
| 30 | `es-a1-comer` | Медиалуны, мате и асадо | `comida` | café con leche y medialunas, facturas, panadería, mate (cebar, la ronda, "gracias" = no more), empanadas, asado / parrilla, choripán, milanesa, la cuenta, birra, agua con o sin gas, ¿me traés…?, está riquísimo | fernet con coca, lomito cordobés, alfajor de Córdoba, a parrilla in the sierras |
| 40 | `es-a1-comprar` | Киоско и деньги | `compras`, `numeros` | numbers 0–1000 as words, pesos, plata, ¿cuánto es?, efectivo / tarjeta / transferencia, kiosco (alfajor, agua, chicle), almacén / súper, feria, talle, ¿tenés cambio?, muy caro, ¿me hacés un descuento? | feria artesanal in Carlos Paz, a kiosco in barrio Güemes |
| 50 | `es-a1-planes` | Люди и планы | `planes`, `presentarse`, `numeros` | ¿qué hacés?, ¿vamos a…?, ¿a qué hora?, days of the week, la hora, boliche, previa, juntarse, finde, family (mi viejo, mi vieja, hermanos), novio / novia, laburo, ¿qué onda?, re lindo, me gusta / no me gusta, ir a + infinitive | cuarteto night in Córdoba, weekend in the sierras, "¿qué hacé'?" again |
| 60 | `es-a1-ayuda` | Помощь и здоровье | `salud`, `no-entiendo` | farmacia, me duele…, tengo fiebre, guardia, médico / médica (usted), ¿me puede ayudar?, perdí el celular, policía, emergencias (911, SAME 107), ¿habla inglés?, ¿me lo puede escribir?, sol / protector solar | sunburn and a pharmacy in Carlos Paz, getting lost on a walk in the sierras |
| 90 | `es-a1-gramatica` | Грамматика A1 | `gramatica` | the cards below | examples may use Córdoba scenes |

Ids: lesson `es-a1-hola.l.saludar`, phrase `es-a1-hola.che`, vocab `es-a1-comer.v.medialuna`,
Q&A `es-a1-hola.qa.nombre`. Units 4–6 (T153) **reuse earlier items by id** (lessons may list
items of earlier units) instead of repeating the same text with a new id.

**Grammar cards** (unit 90, `gram.es-a1-<slug>`, ~8, recognition first, Russian `title`,
`summary`, `points`, short tables, Spanish examples with `ru`):

1. `gram.es-a1-articulos` — el / la / los / las, un / una: Russian has no articles, Spanish
   needs them; gender of nouns (-o / -a and exceptions: el día, la mano).
2. `gram.es-a1-ser-estar` — ser (who / what / from where: soy ruso, soy de Moscú) vs estar
   (where / how: estoy en Córdoba, estoy cansado). Both are "быть".
3. `gram.es-a1-vos` — the vos present: vos hablás, comés, vivís; sos, tenés, podés, querés;
   imperatives mirá, vení, decime. "Tú" only in its one note (below).
4. `gram.es-a1-usted` — usted for strangers in formal scenes (doctor, bank, police, office):
   usted habla, ¿me puede…?, disculpe; the Russian вы maps to it, but Argentines use vos far more.
5. `gram.es-a1-plurales` — plurals -s / -es (medialunas, colectivos, celulares) and agreement
   (las facturas ricas); ustedes = вы (plural) for everybody (no vosotros in Argentina).
6. `gram.es-a1-gustar` — me gusta el mate / me gustan las empanadas; ¿te gusta? / ¿le gusta?
   (works like "мне нравится").
7. `gram.es-a1-ir-a` — voy a + infinitive for plans: vamos a comer, voy a ir a Córdoba.
8. `gram.es-a1-preguntas` — ¿qué?, ¿dónde?, ¿cuánto?, ¿cómo?, ¿cuándo?, ¿quién?; accent marks
   on question words; intonation alone makes a question (¿Tenés cambio?).

## Cast and voices
Recurring in units, dialogues and stories from unit 10:

| Character | Who | Voice |
| --- | --- | --- |
| **Iván** (Иван) | The learner protagonist: 29, from Yekaterinburg, a programmer who works remotely and has just moved to Buenos Aires; learning Spanish from zero, curious, makes Russian-speaker mistakes the others correct kindly. | `es-UY-MateoNeural` (his lines in stories; dialogue learner options get Mateo automatically) |
| **Martín** | The porteño friend: 31, lives in Palermo, his flatmate-then-friend, works at a bike shop, mate and football, says "che", "boludo" (friendly, explained in a note) and "re". | `es-AR-TomasNeural` |
| **Flor** (Florencia) | The cordobesa friend: 27, from Córdoba capital (barrio Güemes), studies design in Buenos Aires and goes home often; tonada, "¿qué hacé'?", fernet con coca, cuarteto; takes Iván to Córdoba, the sierras and Carlos Paz. | `es-AR-ElenaNeural` |
| **Narrator** (stories) | — | `es-UY-ValentinaNeural`: every story sets `"voice": "es-UY-ValentinaNeural"` |
| Secondary characters | Doña Marta (Flor's grandmother in Villa Carlos Paz, usted with strangers), Don Julio (kiosquero in Buenos Aires), the pharmacist, the bus driver, waiters | In stories: the es-AR voice of their gender when Martín or Flor (same voice) does not speak in that story, otherwise reported speech by the narrator. In dialogues: Elena (women) or Tomás (men). |

**Dialogue voice rule:** native turns use only `es-AR-ElenaNeural` and `es-AR-TomasNeural`, and
**every dialogue uses both** (e.g. Flor or Martín is there with the waiter / pharmacist), so the
learner's options are always voiced by the first unused pack voice, `es-UY-MateoNeural` = Iván.
A dialogue with only one es-AR native voice would voice the options with the other es-AR voice:
avoid it. Avatars: `fluent:` people icons per name (`Martín`, `Flor`, roles).

Items in units: default voice (Elena); a Q&A question or a phrase may use Tomás for variety.
Never Mateo or Valentina on unit items (keep them for Iván and the narrator).

## Register rules
- **Vos is the default** (`register: "tu"`, shown as "vos"): vos tenés, sos, podés, querés,
  vení, mirá, decime, ¿me pasás…? Friends, peers, young shop staff, most cafés and kioscos.
- **Usted in formal scenes** (`register: "usted"`): doctor, pharmacist with an older client,
  bank, police, office, an older stranger (Doña Marta's generation). ¿Me puede ayudar?,
  disculpe, ¿usted es…?
- `neutral` only when the phrase has no verb or pronoun marking (¡Buen día!, Un café, por favor).
- **"Tú" appears only in one note** (unit 10, on the vos phrase): it is understood but hardly used
  in Argentina; never in a phrase, option or reply. No vosotros: ustedes for every "вы" plural.
- Q&A replies and dialogue options match the register of the question / scene.

## Argentine lexicon (use these, not the Spain words)
che, dale, re (re lindo, re caro), bárbaro, genial, copado, ¿qué onda?, ¿todo bien?, buen día,
chau, colectivo / bondi, subte, SUBE, remís, parada, cuadra, pasaje, laburo / laburar, plata,
guita (note only), pesos, kiosco, almacén, chino (small supermarket, note), facturas,
medialunas, alfajor, mate, termo, yerba, bombilla, asado, parrilla, choripán, milanesa,
empanadas, birra, fernet, previa, boliche, finde, juntarse, celular, departamento / depto,
pileta, remera, campera, zapatillas, frutilla, palta, manteca, durazno, auto, manejar, ¿cuánto
sale?, ¿me cobrás?, boludo (friendly between friends, note only, never with strangers), mina /
pibe (note), joda (fun, note), bancar (¿me bancás un toque?), un toque, al toque.
Spain words to avoid: coger (never; a strong vulgarity in Argentina: note once in unit 20 next to
"tomar el colectivo"), autobús, metro, zumo, coche, móvil, vale, vosotros, tío.

**Pronunciation tips** (phrase `explanation`, in Russian): rioplatense ll / y = "ш" / "ж"
(calle → "каше", yo → "шо"); s before a consonant often softens to "х" (¿cómo estás? →
"эстах"); stress marks matter (papá / papa, está / esta); b and v sound the same; the vos
stress is on the last syllable (tenés, podés); r / rr rolled; h silent; no vowel reduction like
in Russian: every o is "о".

## Córdoba rules
- About one third of scenes in every unit, dialogue and story set (see tables); Córdoba capital,
  the sierras, Villa Carlos Paz.
- Flor is cordobesa from unit 10. Cordobés features **explained in notes** (Russian):
  the **tonada** (the stretched syllable before the stressed one, "Cór-dooo-ba"), dropping the
  final s (**"¿qué hacé'?"** = ¿qué hacés?; learners write and say the full form, the clipped
  one is taught to recognise), the cordobés humour, **fernet con coca**, **cuarteto** (La Mona
  Jiménez, Rodrigo), lomitos, the sierras and the Carlos Paz summer.
- **"Culiado"**: only in one note (unit 50) as a very strong cordobés regionalism that friends
  use among themselves (it can be friendly or an insult): understand it, never use it. Never in a
  phrase, vocab item, option, reply, story line or formal scene.
- Phrase text is standard rioplatense spelling even for Flor ("¿Qué hacés?"); the clipped form
  appears only in notes, or in a story line quoted in Flor's voice with an apostrophe when the
  note explains it.

## Dialogues (6) and stories (6)
Files `content/es/dialogues/a1-NN-<slug>.json` and `content/es/stories/a1-NN-<slug>.json`
(NN = order). Dialogues: 6–8 turns, ≥ 3 learner turns, 3 options each with Russian `feedback`,
distractors from the Russian-speaker mistakes below, never differing only by punctuation or
accents. Stories: 60–90 words, present tense (ir a + infinitive allowed), 3–4 questions,
keywords reusing unit items by id.

| Order | Dialogue id | Unit | Where | Scene | Register |
| --- | --- | --- | --- | --- | --- |
| 1 | `dlg.es-a1-hola-che` | `es-a1-hola` | Buenos Aires | Iván meets Martín and Flor at the flat in Palermo: names, origin, "no entiendo" | `tu` |
| 2 | `dlg.es-a1-pasaje-carlos-paz` | `es-a1-moverse` | **Córdoba** | Terminal de Córdoba: buying a ticket to Villa Carlos Paz (ticket clerk + Flor) | `usted` |
| 3 | `dlg.es-a1-medialunas` | `es-a1-comer` | Buenos Aires | Café with Martín: café con leche, medialunas, the bill | `tu` |
| 4 | `dlg.es-a1-kiosco` | `es-a1-comprar` | Buenos Aires | Don Julio's kiosco: charging the SUBE, an alfajor, paying by transfer (Martín there) | `tu` |
| 5 | `dlg.es-a1-cuarteto` | `es-a1-planes` | **Córdoba** | Planning a cuarteto night with Flor and her cousin: time, place, "¿qué hacé'?" | `tu` |
| 6 | `dlg.es-a1-farmacia` | `es-a1-ayuda` | Buenos Aires | Pharmacy: a sore throat and fever, the pharmacist (usted), Martín helps | `usted` |

| Order | Story id | File | Where | Plot |
| --- | --- | --- | --- | --- |
| 1 | `story.es-a1-llegada` | `a1-01-llegada.json` | Buenos Aires | Iván lands at Ezeiza; Martín waits with a mate; first "che" and "dale" |
| 2 | `story.es-a1-la-tonada` | `a1-02-la-tonada.json` | **Córdoba** | Iván visits Flor in Córdoba capital: the tonada, "¿qué hacé'?", the Cañada and a fernet con coca |
| 3 | `story.es-a1-el-subte` | `a1-03-el-subte.json` | Buenos Aires | The SUBE card is empty; a kind stranger, the colectivo instead, he gets off too late |
| 4 | `story.es-a1-asado` | `a1-04-asado.json` | Buenos Aires | Sunday asado at Martín's parents' house: the ronda of mate, "gracias" means no more |
| 5 | `story.es-a1-carlos-paz` | `a1-05-carlos-paz.json` | **Villa Carlos Paz / sierras** | A weekend with Flor's grandmother Doña Marta: the lake, the cuckoo clock, too much sun |
| 6 | `story.es-a1-ya-hablo` | `a1-06-ya-hablo.json` | Buenos Aires | Three months later Iván orders, jokes and says "re" like a porteño; plans to go back to Córdoba |

Story inline key words: `story-es-<slug>`.

## Typical Russian-speaker mistakes (use for distractors and feedback)
- **Articles** missing or wrong (*Quiero café* vs Quiero un café; *el leche*).
- **Gender agreement** (*la problema*, *el agua fría* vs *el agua frío*, *medialunas rico*).
- **Ser / estar** (*soy en Córdoba*, *estoy ruso*, *estoy cansado* vs *soy cansado*).
- **Stress and written accents** (tenés / tenes, está / esta, papá / papa), stress on the wrong
  syllable in vos forms (*ténes*).
- **Spelling**: b / v (*vien*, *bamos*), ll / y (*yamo*, *caye*), h dropped or added, ñ.
- **Usted vs vos** mixed in one sentence (*¿Usted tenés…?*), vos with the doctor, usted with a friend.
- **Tú forms** in Argentina (*tú tienes*), vosotros (*¿Vosotros queréis…?*).
- **False friends**: *constipado* (= stuffy nose, not запор), *embarazada* (= pregnant),
  *magazine* (магазин = negocio / tienda), *familia* vs фамилия (= apellido),
  *simpático* (= friendly) vs *симпатичный* (= good-looking), *carta* (= letter / menu, not a map).
- **Calques** from Russian: dropping the verb "to be" (*Yo ruso*, *Mi nombre Iván*), overusing
  yo / vos where the verb already says who.
- **Spain Spanish** forms picked up online (coger el autobús, vale, zumo, móvil).

## Russian glosses and notes style
- `ru` translations: natural, current Russian a young Muscovite would say, not word for word
  (*¡Dale!* → «Давай!» / «Окей!», *¿Todo bien?* → «Как дела? Всё норм?»). Put the calque in
  `literal` (map `{ "ru": … }`) when it helps.
- Notes and explanations: Cyrillic, short (one sentence, two at most), friendly, a bit of humour,
  "ты" to the learner. No transliteration of Spanish into Cyrillic except in pronunciation tips
  for a sound ("ш"). Spanish words inside a note in «guillemets».
- Every gloss field carries exactly `ru` (sibling `ru` / `questionRu` / `titleRu`, or a
  `{ "ru": … }` map for notes, titles, descriptions, prompts, feedback; never a plain string).

## Tone
Fun and warm: Iván's small disasters (empty SUBE, "gracias" ends his mate ronda, too much sun in
Carlos Paz), Martín's football and mate, Flor's Córdoba pride and jokes about porteños. Light
humour in notes and feedback; never mocking Russians or Argentines, no politics.

## Volume (A1 mini)
Total **~180 phrases, ~150 vocab** (a `fluent:` picture where an icon fits), **~40 Q&A**,
**8 grammar cards**, about 25 lessons (6–15 items each), 6 dialogues, 6 stories, no placement.

| Unit | Phrases | Vocab | Q&A | Lessons |
| --- | --- | --- | --- | --- |
| 10 `es-a1-hola` | 32 | 22 | 8 | 4 |
| 20 `es-a1-moverse` | 30 | 26 | 7 | 4 |
| 30 `es-a1-comer` | 32 | 30 | 7 | 4 |
| 40 `es-a1-comprar` | 30 | 28 | 6 | 4 |
| 50 `es-a1-planes` | 28 | 22 | 6 | 4 |
| 60 `es-a1-ayuda` | 28 | 22 | 6 | 4 |
| 90 `es-a1-gramatica` | — | — | — | 1 (8 cards) |
| **Total** | **180** | **150** | **40** | **25** |

T152 writes units 10–30 and 90 (about half); T153 writes 40–60; T154 dialogues and stories;
T155 audio and pictures. Numbers always as words in target text ("cien pesos", "el sesenta").

## Audio and pictures
- Neural mp3 with edge-tts (voices above), generated on the Mac with `npm run audio` (T155);
  `speechSynthesis` `es-AR` as fallback. Speech recognition locale `es-AR`.
- Pictures per docs/content-guide.md ("Pictures"): Fluent icons for concrete vocab (mate,
  empanada, colectivo…), avatars for dialogue speakers.
- Prepárate stays hidden for this pack (no `es` glosses yet). Liga needs nothing.
