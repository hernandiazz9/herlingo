# Italian content review (T09)

Native-teacher review of everything in `content/it/` (except `extras/placement.json`, written in
parallel by T07), done on 2026-09-30. Every unit, extras file and dialogue was read item by item:
Italian grammar, articles and gender, naturalness, register (Lei / tu), Sicilian place and
transport names, facts and prices, and the Spain-Spanish translations (with "tú").

Overall the content was already in good shape: natural, current spoken Italian, honest registers,
plausible distractors. No id was renamed or deleted; every fix is in place.

## Totals after the review

`content:check`: 10 units, 53 lessons, 475 phrases, 332 vocab, 87 Q&A, 7 grammar cards,
28 Sicilian expressions, 13 dialogues. Targets (~380 phrases, ~280 vocab, 10 dialogues) are met
even without the duplicates listed below. No sample content remains (files, ids or audio).

## Fixes by category (34)

| Category | Count | What changed |
| --- | --- | --- |
| Facts and prices | 8 | Prestia e Comandè airport bus: "sette euro" → "sei euro e cinquanta" (€6.50 on board, €6 online). Palermo–Cefalù return: "dodici euro e venti" → "quattordici euro e venti" (regional fare ~€7.10 each way). Validators: "sul binario" → "in stazione" (dialogue turn + feedback, `move-treno.obliteratrice` and `move-treno.devo-convalidare` notes): they are in the station, by the platforms or in the hall, not always on the platform. Airport note: "Trinacria Express" (old brand, no longer used) → regional train from Punta Raisi station. `emer.ibuprofene` note: an unhelpful price claim → "sold without prescription in low doses". |
| Italian grammar and register | 4 | `move-strada.vai-sempre-dritto`: "e poi giri" (reads as the Lei imperative) → "e poi gira", consistent tu. `dlg.food-granita` n5: "tranquillo" → "stia tranquillo" (the waiter speaks Lei). Register fixed: `move-strada.qa.oggi-e-chiuso` neutral → lei ("Guardi"); `talk-chiacchiere.possiamo-darci-del-tu` tu → neutral (same as `gram.darci-del-tu`: you ask it while still on Lei). |
| Spanish translations | 6 | "la maquinita" → "la máquina"; "¿Me puede llamar a un taxi?" → "¿Me puede pedir un taxi?"; "el scooter" → "el escúter"; "Pero tutéame, ¡venga!" → "¡Venga, tuteémonos!" (it is "diamoci", both); "Hago Palermo, Cefalù…" → "Mi ruta: …" (calque moved to `literal`); strike hours "de dieciocho a veintiuna" → "de 18 a 21". |
| Usage notes | 2 | `food.latte`: coffee with milk is "caffellatte", not "latte macchiato". `sic.sabbinidica`: now says it is mostly heard in villages, with elders. |
| Consistency and typography | 14 | Vocab `plural` is always the bare word (11 items had an article: "gli autobus" → "autobus"…). "..." → "…" in 3 texts. |

Docs: `docs/content-guide.md` lesson size (8–30 items, not 6–12), audio file naming (hash of
voice + text + manifest, not `<audioKey>.mp3`), bare `plural`, sample pack gone; the `Playable`
comment in `src/lib/content/types.ts` now describes the manifest too.

## Checked and left as is

- **"112" and "101" in TTS**: the mp3 for "Chiami il 112!" has the same length as "Chiami il
  centododici!" (13.7 kB vs 13.5 kB; "uno uno due" gives 11.2 kB), and "il 101" is byte-length
  identical to "il centouno": edge-tts reads them as numbers, as Italians say them.
- **Sicilian**: `sic.sabbinidica` (greeting asking an elder's blessing, answer "Santu e riccu")
  and `sic.babbiare` ("Sto babbiando!" = I'm joking, very common in the Italian spoken in Sicily)
  are correct; spelling varies ("sabbenedica", "sa' binidica").
- Strike guaranteed hours (6–9 and 18–21 on weekdays), Trenitalia digital check-in, Alibus
  (Catania airport), AMAT line 101 to Palermo Centrale, via Maqueda → Teatro Massimo in piazza
  Verdi, Taormina bus terminus near Porta Messina, Interbus Catania–Siracusa/Taormina.

## Remaining doubts

- **Prices are indicative.** Palermo–Cefalù €7.10 comes from resellers (Trainline, Omio, Kombo);
  trenitalia.com does not list it. The generic phrase `move-treno.sono-sei-euro-e-dieci` ("Sono sei
  euro e dieci") was kept as a price example, not tied to Cefalù. Unverified but plausible:
  Interbus Catania–Taormina return €8.50, taxi Catania station → Duomo €12–15, coperto €2.
- **Season**: the market dialogue sells oranges and the granita list includes "gelsi"; in mid
  October Sicilian oranges are only just starting and mulberry granita may be off the menu.
- **35 duplicated texts** with two ids (e.g. "Sei di qui?", "Posso pagare con la carta?", vocab
  "il bagno", "lo zaino"): they share one mp3, but the phrasebook and review show them twice.
  Ids cannot be deleted in this task; merging them needs a decision (and lesson references
  changed) later.
- The persona (Madrid, programmer, solo trip by train and bus) is the generic one in
  `units/32-persona-sobre-mi.json`, meant to be edited by Hernán.

# Stories and explanations review (T21)

Native-teacher review, done on 2026-09-30, of the 12 Historias (`content/it/stories/`, every
sentence, translation, key word, question and gap) and of the phrase `explanation`s added by T15
and T16 (all 475 checked mechanically for length, "tú" and Spain Spanish, respelling scheme; about
80 read in full, spread over every unit). Checked: Italian naturalness and register, A1–A2 level,
voices (narrator Elsa, Hernán Diego, women Isabella, other men the narrator), the trip narrative
(Palermo 3 nights → Cefalù → Agrigento → Catania → Siracusa → flight home from Catania) and the
persona, facts, and the Spain-Spanish translations with "tú". A second reviewer (subagent) read
the same stories independently; its findings are merged below. No id was renamed or deleted.

Overall the stories were already good: natural, current Italian at A1–A2, consistent persona and
recurring character (Chiara), exactly one right option per question. Word counts stay within
80–150 (`content:check`: 0 warnings).

## Story fixes by category (17)

| Category | Count | What changed |
| --- | --- | --- |
| Italian register and grammar | 2 | `story.giornata-a-cefalu` s6 "poi giri a sinistra" → "poi gira" (the girl uses tu; same fix as T09 in `move-strada.vai-sempre-dritto`). `story.ultimo-giorno` s5 the B&B host "torna presto" → "torni presto" (staff use Lei, like the Palermo host). |
| Naturalness and narrative logic | 2 | `story.valle-dei-templi` s10 "Anche Chiara… va a Siracusa" (Hernán had only said Catania) → "Tra qualche giorno Chiara va a Siracusa, come lui." `story.pullman-per-agrigento` s11 "dura due ore e passa" (reads as "more than two hours", against q4) → "dura due ore, tra colline…". |
| Facts and season | 2 | `story.in-treno-per-cefalu` Palermo–Cefalù single "sei euro e dieci" → "sette euro e dieci" (s3 and q1), matching the €7.10 fare / €14.20 return used since T09. `story.pescheria-di-catania` "un chilo di arance" → "un chilo d'uva" (s11, q4, and the callback option in `story.ultimo-giorno` q1): Sicilian oranges are not in season in mid October, grapes are. |
| Voice | 1 | `story.pescheria-di-catania` s6, the fishmonger's shout, had Hernán's voice (Diego) → narrator. |
| Brief (Sicilian = recognition only) | 1 | `story.pescheria-di-catania` s5: Hernán no longer says "Mizzica!"; a man next to him does, so Hernán hears it instead of producing it. |
| Spanish translations | 4 | "te ponen una multa" → "le ponen" (the lady speaks usted); "En el chiringuito de playa coge una sombrilla" → "En la playa de pago alquila…" (a lido is a pay beach, not a beach bar); "Por la noche… mira la puesta de sol" → "Al atardecer…"; "en la via Maqueda" → "en la Via Maqueda". |
| Gap distractors | 5 | Absurd or ill-formed chips replaced by plausible wrong ones: ritardo `binario/biglietto` → `anticipo/sosta`; granita alla `valigia/farmacia` → `fragola/pesca`; con la `cipolla/carne` → `cannella/granella`; crema `pistacchio/limone` (not a valid form) → `solare/idratante`; il `museo/negozio` parte in orario → `treno/traghetto`. |

## Explanation fixes by category (28)

| Category | Count | What changed |
| --- | --- | --- |
| Pronunciation tip wrong | 4 | `surv.buonasera` one stress, not two: "buo-na-SE-ra". `move-treno.sono-sei-euro-e-dieci` "euro" has two syllables (EU-ro), not three. `talk-chiacchiere.parli-inglese` and `move-treno.posso-usare-lo-stesso-biglietto` respelled the s as "z" (a Spaniard reads /θ/) → "in-GLE-se", "u-SA-re" (and in Sicily that s is voiceless anyway). |
| Vowel claims wrong | 4 | "fermare" and "solo" have a closed vowel, not an open one: `move-bus.si-ferma-a`, `move-strada.si-fermi-qui`, `talk-chiacchiere.quanto-ti-fermi`, `talk-chiacchiere.sei-da-solo` now give the stress instead ("Acento en «fer»: FER-ma"). |
| Spanish | 1 | `gram.darci-del-tu` "proponer tutearos a alguien" (ungrammatical) → "proponerle a alguien de confianza que os tuteéis". |
| Respelling scheme | 19 | "dj" → "dy" ("DJOR-no" → "DYOR-no", "OD-dji" → "OD-dyi"…), the scheme the other explanations use; a Spaniard may read "j" as a jota. |

The rest of the sample was right: usage notes match the register and situation, stress positions
are correct (bi-LLET-to, ca-TA-nia, far-ma-CHI-a, che-fa-LÙ…), no explanation is missing or longer
than 200 characters, and the Spanish is Spain Spanish with "tú".

Docs: `docs/content-guide.md` no longer mentions the deleted `stories/sample-story.json`.

Audio: `npm run audio` generated 363 mp3 (353 for the new stories and inline key words, 10 for the
fixed lines) and pruned 9; `content:check -- --strict-audio` passes.

## Remaining doubts

- **Duplicate key word**: `story-ritorno-chiave` (story 12) repeats "la chiave" already defined as
  `story-palermo-chiave` (story 2). It shares the mp3 but shows twice in review; removing it means
  deleting an id, left for a later decision like the 35 duplicates listed above.
- **Season** (trip in mid October): many Cefalù lidi close at the end of September and the
  swordfish season is mostly over; story 5 (lido, swimming) and story 9 (pesce spada) were kept as
  plausible. Sea urchins are in season.
- **Bus operators**: Palermo–Agrigento is run mainly by Cuffaro and Camilleri; story 6 keeps
  AST (on strike) and SAIS (running), the operators named in the brief. Prices (bus, granita
  €4.50, pharmacy €12, olives €8/kg) are plausible fiction.
