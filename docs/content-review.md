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
