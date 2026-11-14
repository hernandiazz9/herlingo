# Mi entrevista — AI mock interviewer by voice

Decided with Hernán on 2026-11-14 (plan 017). He prepares job interviews in English with a private
deck of cards: a question, its variants and his **model answer**, sentence by sentence. Mi
entrevista turns the deck into practice by voice: Natasha (an Australian voice) asks, he answers
aloud, Claude corrects against his own model answer and, in a mock interview, a hiring manager
asks follow-ups. Owner only; the deck never touches the repo or the build.

This document is the contract of plan 017 and is kept current by each task. Built so far: the
deck (schema, text store, `GET`/`PUT /api/coach/deck/`, `npm run deck:push`, the fake deck; T206);
the two models, Haiku 5.5 in the price table, Mi entrevista's budget and counters, the `mock`
block of `/usage/` (T207); the interviewer, corrector and report schemas, prompts, normalizers,
fakes and generators (T208); `POST /api/coach/interviewer/`, `POST /api/coach/feedback/` and the
two interview voices in `/api/coach/tts/` (T209). Everything else below is the contract its task
builds.

## Decisions

| Topic | Decision |
| --- | --- |
| Listening | Browser speech recognition (`src/lib/speech/`, locale `en-AU`) in a new `answer` mode for 30 s – 3 min answers; the transcript is shown live. Fallback always present: a textarea (keyboard dictation or typing). Pronunciation is only *inferred* from the transcript ("posible"), never measured. T205 checks it on the iPhone before the speaking UI is built. |
| Modes | **Practise a card** (question → answer → correction at once → «Repregúntame» / «Otra vez») and **Simulacro** (5–8 questions, 0–2 follow-ups each, correction at the end, like a real interview). «Exigente» is a switch of the simulacro. No questions outside the deck (without a model answer the corrector cannot tell what is true). |
| Content | Private deck: `npm run deck:push` reads the cards file (`contenido.json`, kept outside the repo), maps it to `InterviewDeck` and uploads it with the owner's code to Upstash; the app downloads it with the code and keeps it on the device (offline). Never in git, never in the build. Re-run the script after editing cards; no deploy needed. |
| Models | Two roles. **Interviewer** (decides the follow-up, one short line): `COACH_INTERVIEWER_MODEL`, default `claude-haiku-5-5`. **Corrector** (feedback per answer and the simulacro report): `COACH_FEEDBACK_MODEL`, default `claude-sonnet-5-5`. Both `effort: "low"`. The evals (T210) say whether Haiku is enough for correcting too; Hernán picks (T211). |
| Budget | Mi entrevista has its **own monthly cap, 10 USD** (`COACH_MOCK_MONTHLY_CAP_USD`, owner-editable), separate from Prepárate's 5 USD; **60 answers a day** (`COACH_MOCK_DAILY_LIMIT`; an answer's feedback and a report take one each), interviewer turns ≤ 2 × that. Estimate: ≈ 0.01 USD per corrected answer on Sonnet 5.5, ≈ 0.0005 per interviewer turn on Haiku 5.5, a full simulacro ≈ 0.10–0.15 USD, 30 answers a day ≈ 9 USD a month. |
| Feedback | The cards panel's schema (score 1–5, summary, mistakes said → better + why, inferred pronunciation, content, improved version, next step) **plus two fields**: `invented` (claims not in his model answer: the most serious finding) and `fluency` (fillers and cut-off sentences seen by Claude; words per minute computed on the device). Same meaning as the panel's keys, so both can be compared. |
| Attempts | On the device (they travel in the Perfil backup and the cloud save, his own account). «Exportar intentos» writes a JSON file. After each correction «¿Te sirvió?» 👍/👎 and «Tu nota» 1–5 are stored with the attempt (quality signal for later). |
| Evals | **Seeded cases only** for now: ≥ 20 answers written with known defects (labels by construction), frozen, run against both models per role with deterministic checks first and Claude Opus 5.5 as judge only where a rule cannot decide. Local, outside `verify`, ≤ 1 USD a run. |
| Modo deporte | Free episodes from the deck, one per block, all English: Natasha asks → a gap to answer aloud while running → William reads the model answer sentence by sentence → "Key phrases." and the card's phrases. Same player (locked screen, offline). |

Defaults (not asked; say so if you disagree): `/entrevista/` under Jugar with a «🎤 Mi entrevista»
card for the owner in any active language; 5 XP per corrected answer, source `"interview"`, at
most 12 answers a day give XP; in the simulacro the answer is sent as said (no editing), in a card
it is editable before «Corregir»; follow-ups only ask about things the model answer contains (he
is never pushed to invent).

## Privacy (public repo)

- The deck lives only in Upstash (under the owner's code) and on the owner's device. Never commit,
  print or log card text, transcripts, feedback or facts about the learner.
- Fake mode uses an invented, generic persona (`fakeDeck()` in `api/_lib/fake.ts`).
- `[coach]` logs carry ids, counts, ms and tokens only. `npm run deck:push` prints counts only.
- Eval inputs and outputs go to git-ignored `evals/**/private/`; committed eval results are
  numbers only. No learner profile is hard-coded in a prompt.

## Flow of a question

1. The app speaks the line with Natasha (live TTS, cached on the device). Card mode shows the
   text; simulacro hides it behind «Ver texto» (listening practice). A card rotates its
   `question` and `variants`.
2. «Responder» opens the mic (`answer` mode): live text, a timer against the card's `seconds`,
   «He terminado». «Me he bloqueado» shows the card's anchors (keywords) and marks the attempt
   `stuck` (no penalty). «Repetir la pregunta» replays the line.
3. Card: the transcript stays editable → «Corregir» → `POST /api/coach/feedback/` → the feedback
   view. «Repregúntame» → `POST /api/coach/interviewer/` → Natasha asks the follow-up → same steps.
4. Simulacro: on «He terminado» (or 5 s of silence) Natasha says a short acknowledgement at once
   ("Thank you.", cached clip) while `POST /api/coach/interviewer/` decides: a follow-up (≤ 2 per
   question) or the next question. Each answer's feedback is requested in the background; at the
   end `POST /api/coach/feedback/` (`kind: "report"`) and the report screen (overall + each
   answer).

## Deck (`InterviewDeck`, zod in `api/_lib/schema.ts`)

```ts
type InterviewDeck = {
  version: 1;
  generated: string;                         // ISO date from the source file (≤ 40)
  learner?: string;                          // ≤ 600, optional neutral description for the prompts; absent → "a Spanish-speaking professional, B2 English"
  blocks: { id: string; title: string; intro?: string }[];               // 1–20; title ≤ 80, intro ≤ 400
  cards: {                                                                // 1–200
    id: string; block: string; title: string;                             // title ≤ 80
    question: string; variants: string[];                                 // ≤ 5; English, each ≤ 300
    answer: { en: string; es: string }[];                                 // 1–20 sentences, each ≤ 300 (TTS limit)
    anchors: string[];                                                    // ≤ 8, each ≤ 80
    phrases: { en: string; es: string; note?: string }[];                 // ≤ 10; en/es ≤ 300, note ≤ 300
    tip?: string;                                                         // ≤ 600
    pending?: string | null;                                              // ≤ 600
    seconds?: number;                                                     // integer, 10–300
  }[];
};
```

- Ids (blocks and cards): 1–64 characters, letters, digits, `-` and `_`. Block ids and card ids
  are unique; every card's `block` is one of the blocks. Limits in `DECK_LIMITS`.
- A card with `pending` (part of the model answer is unconfirmed) is shown with «Falta un dato»
  and the corrector is told that part of the model answer is unconfirmed.
- The client gets a plain TypeScript copy of this type (src/ never imports zod).

### `npm run deck:push`

```bash
npm run deck:push -- <path/to/contenido.json>                  # upload to https://herlingo.vercel.app
npm run deck:push -- <path> --url=http://localhost:3000        # another origin (npm run dev:coach)
npm run deck:push -- <path> --dry                              # map + validate, nothing uploaded
```

`scripts/mock-interview/push-deck.ts`: reads the cards file (a relative path is taken from where
the command was typed), maps it, validates it with the server's `InterviewDeck`, and `PUT`s it to
`<origin>/api/coach/deck/` with the owner's code: the `COACH_OWNER` entry of `COACH_ACCESS_CODES`,
from the environment or `.env.local` (to reach production they must be the production values).
`--dry` needs no code. It prints counts only (blocks, cards, pending, KB, skipped, trimmed), never
card text, the code or the deck; a validation error prints paths into the deck and zod's message.
401 / 403 add a hint about the code.

Mapping from `contenido.json` (Spanish keys): `bloques→blocks (titulo→title, intro)`,
`tarjetas→cards`, `bloque→block`, `pregunta→question`, `variantes→variants`, `respuesta→answer`,
`anclas→anchors`, `frases→phrases (nota→note)`, `consejo→tip`, `pendiente→pending`,
`segundos→seconds`, `titulo→title`, `generado→generated`; `fuente` is dropped. Empty strings
and `null` become absent (`pending: null`). What the interview cannot use is left out and counted
(T206, 2026-11-14):

- **Cards without a question** (phrase or vocabulary cards) and **cards without a model answer
  yet** are skipped: there is nothing to ask, or nothing to correct against.
- **Blocks left without cards** are dropped.
- **Lists over the limits** (phrases > 10, anchors > 8, variants > 5) keep their first items. The
  model answer is never cut: more than 20 sentences fails validation.

### Storage and fake deck

One JSON string per owner: Upstash `langlern:coach:mock:deck:<name>` = `{ updatedAt, deck }`
(`api/_lib/deck.ts`; the `Store` has `getText` / `setText`, raw strings without the Upstash
client's JSON parsing; the in-memory store keeps them in a map). A stored deck that no longer
parses is logged (path and message only) and answered as `no_deck`. Fake mode (`COACH_FAKE=1`, or
no key in local dev) starts with `fakeDeck()`: an invented QA analyst at a made-up company, 2
blocks × 3 cards, one `pending` card per block; a `PUT` replaces it until the server restarts.

## API

All owner only: any other code → 403 `forbidden` "Mi entrevista es solo para la cuenta del dueño.".
Checks in order: code (401) → owner (403) → body (400) → the role's model (`interviewerModel()` /
`feedbackModel()` in `api/_lib/config.ts`: an id missing from `PRICES` → 503 `not_configured` "Mi
entrevista no está configurada todavía.") → deck/card → Mi entrevista budget (`assertMockBudget()`)
→ its daily counter (`reserveMockAnswer()` / `reserveMockTurn()`) → Claude (`generateStructured({
model })`) → bill (`recordCall(caller, "turn" | "answer" | "report", …)`) → refund only if nothing
was billed (as Prepárate). Errors and 502
messages as docs/coach.md, with the mock budget message "Se ha agotado el presupuesto de Mi
entrevista de este mes." and the daily one "Has llegado al límite de respuestas de hoy. Vuelve
mañana.".

Built (T209): `api/coach/interviewer.ts` and `api/coach/feedback.ts` do code → owner → body → model
→ deck and card, then `runMockCall(caller, kind, model, call)` (`api/_lib/ledger.ts`) does the rest:
budget → counter (`turn` → interviewer turns; `answer`, `report` → answers) → the generator with an
`onUsage` that bills → the slot back only when nothing was billed. Deck and card errors:

- No deck uploaded → 404 `no_deck` (the message of `GET /deck/`).
- A `cardId` the stored deck does not have (the device's deck is older than the server's) → 400
  `bad_request` "Esa tarjeta ya no existe. Toca «Actualizar tarjetas».".

Every **real** call (not fake mode) logs one line, never text: `[coach] mock <turn|answer|report>
<ok|failed> <ms> ms, <output> output tokens (<input> input, <cache read> cache read, <cache write>
cache write), model <id>`; `ms` runs until Claude's response (or the failure), `input` counts the
whole prompt (cached tokens included), the model is the one that answered (else the one asked).

### `GET /api/coach/deck/` and `PUT /api/coach/deck/` (built, T206)

- `GET` → `200 { deck: InterviewDeck, updatedAt }` · none uploaded → 404 `no_deck` "Todavía no hay
  tarjetas. Súbelas con npm run deck:push.".
- `PUT`, body = `InterviewDeck` → `200 { updatedAt, blocks, cards }` (counts). Over 512 KB
  (`DECK_LIMITS.bytes`, checked on `Content-Length` and on the bytes read) → 400 `bad_request`
  "Las tarjetas ocupan demasiado (máximo 512 KB).". Invalid JSON or deck → 400 `bad_request` "La
  petición no es válida (cards.3.block)." (the first issue's path).
- No Claude call, no counter. `api/coach/deck.ts`; helpers `assertOwner`, `loadDeck`, `saveDeck`,
  `readDeckBody` in `api/_lib/deck.ts` (the other Mi entrevista endpoints reuse `assertOwner` and
  `loadDeck`).

### `POST /api/coach/interviewer/` (built, T209)

`{ cardId, tone: "friendly"|"tough", asked: string, history: { asked, answer }[] (≤ 3, this
question only), answer: string (1–3000), seconds, followUpsLeft: 0–2 }` → `200 { next:
InterviewerTurn, usage }`. `followUpsLeft: 0` → `move_on` with a canned acknowledgement
(`cannedMoveOn()` in `api/_lib/generators.ts`: "Okay, let's move on."), no Claude call, no
counter: after the deck and card checks it answers at once, even with the budget or the turns
used up, with `usage` `{ costUsd: 0, model: null, latencyMs: 0, tokens: 0s, … }` (`noMockCall()`).

Body limits: `cardId` 1–64; `asked` and each `history[].asked` 1–300 after trimming (a spoken
line); `answer` 1–3000 after trimming; `history[].answer` 0–3000 (an empty one reads "(empty)");
`seconds` 0–3600 (0 = not measured); `followUpsLeft` an integer 0–2. Billed as `turn`.

### `POST /api/coach/feedback/` (built, T209)

- `{ kind: "answer", cardId, asked, isFollowUp, answer (1–3000), seconds, stuck }` → `200 {
  feedback: AnswerFeedback, usage }`. Billed as `answer`.
- `{ kind: "report", tone, answers: { cardId, asked, score, summary, invented[], mistakes (≤ 3)
  }[] (1–24) }` → `200 { report: MockReport, usage }`. `invented` = the claims (`claim`) of that
  answer's feedback. Billed as `report`; it takes one of the day's answers, like an answer.

Body limits: `kind` picks the shape (anything else → 400 "(kind)"); `asked` 1–300 after trimming,
`answer` 1–3000 after trimming, `seconds` 0–3600, `isFollowUp` and `stuck` booleans. Report
answers: `score` an integer 1–5, `summary` 1–500, `invented` ≤ 4 (each 1–300), `mistakes` ≤ 3
(`said`, `better`, `why` 1–300 each), the same limits as `AnswerFeedback`. Every `cardId` of a
report must be in the stored deck (one unknown → 400).

The server reads the card (model answer, anchors, pending) from the stored deck by `cardId`
(unknown → 400): the client never sends the "facts". `usage` = `{ costUsd, model, latencyMs,
tokens, today: { used, limit }, remainingUsd }` for all three calls:

- `model`: the model that answered (the role's, or a server-side fallback); `null` when no call
  was made (the canned move-on).
- `latencyMs`: from the request to Claude until its response (not the whole endpoint).
- `tokens`: `{ input, output, cacheWrite, cacheRead }` of the call.
- `today`: the caller's **answers + reports** today, the same figure as `/usage/` `mock.today`,
  also in an interviewer response (turns have their own, larger counter, never shown).
- `remainingUsd`: what is left of Mi entrevista's budget this month (not Prepárate's).

### Voices (built, T209)

`/api/coach/tts/` also accepts the two interview voices, like the narrator voices: `MOCK_VOICES` in
`api/_lib/languages.ts` = `{ interviewer: "en-AU-NatashaNeural", answer:
"en-AU-WilliamMultilingualNeural" }` (Natasha asks, William reads the model answers), mirrored on
the client (T212). Same rules as every line: ≤ 300 characters, the code's daily voice lines, any
code (only the deck is owner only). Any other voice that no pack declares → 400.

## Schemas

```ts
type InterviewerTurn = { kind: "followup" | "move_on"; line?: string /* followup: English, ≤ 200 chars, ≤ 25 words */; ack: string /* English, ≤ 80 */ };
type AnswerFeedback = {
  score: 1 | 2 | 3 | 4 | 5;                         // panel `nota`
  summary: string;                                   // `resumen`, Spanish, 1–2 sentences
  mistakes: { said: string; better: string; why: string }[];   // `errores` (dijo/mejor/por_que), ≤ 6, most important first
  pronunciation: string[];                           // `pronunciacion`, Spanish, ≤ 4, "possible" issues from the transcript
  content: string;                                   // `contenido`, Spanish: did he answer, structure (STAR), what is missing
  invented: { claim: string; why: string }[];       // NEW: claims not in the model answer, ≤ 4
  fluency: { fillers: string[]; note: string };      // NEW: ≤ 5 fillers/cut-offs seen, Spanish note ≤ 200
  improved: string;                                  // `version`, English, ≤ 1200, his content and length, no new facts
  next: string;                                      // `siguiente`, Spanish, one thing to practise
};
type MockReport = { score: 1|2|3|4|5; summary: string; strengths: string[]; weakPoints: string[]; invented: string[]; next: string }; // Spanish, lists 2–4 (invented ≤ 4)
```

Words per minute = words / seconds × 60, computed on the device and stored with the attempt (not
asked from Claude).

Built (T208): zod `InterviewerTurn`, `AnswerFeedback`, `MockReport` and `MockTone` in
`api/_lib/schema.ts`, sizes in `MOCK_LIMITS`. Structured outputs enforce none of the lengths and
counts (they travel as descriptions, in plain words, and the prompts repeat them), so the server's
zod check decides:

| Field | Limit |
| --- | --- |
| `InterviewerTurn.line` | 1–200 characters and ≤ 25 words; required with `followup` |
| `InterviewerTurn.ack` | 1–80 characters (the prompt asks ≤ 8 words) |
| `score` (feedback, report) | integer 1–5 |
| `mistakes` (`said`, `better`, `why` ≤ 300 each) | ≤ 6 |
| `pronunciation` (each ≤ 200) | ≤ 4 |
| `invented` (`claim`, `why` ≤ 300 each) | ≤ 4 |
| `fluency.fillers` (each ≤ 80), `fluency.note` | ≤ 5; note ≤ 200 (may be empty) |
| `summary`, `content`, `next` (feedback) | 1–500, 1–800, 1–400 |
| `improved` | 1–1200 (the prompt asks ≤ 170 words) |
| report `invented` / `strengths` / `weakPoints` (each ≤ 300 / 200 / 200) | ≤ 4 each (the prompt asks 2–4 strengths and weak points) |
| report `summary`, `next` | 1–600, 1–400 |

The feedback object lists the analysis first (`invented`, `mistakes`, `pronunciation`, `fluency`,
`content`) and `score`, `summary`, `improved`, `next` last, so the score is written after the
findings; the report likewise (`invented`, `strengths`, `weakPoints`, then `score`, `summary`,
`next`). Key order does not matter to the client.

**Normalizers** (`api/_lib/normalize.ts`, before the zod check, like the pack's; the log line
carries paths and counts only): `normalizeFeedback` trims each list to its maximum, clamps `score`
to 1–5 and cuts an `improved` over 1200 characters after its last sentence that fits;
`normalizeReport` trims its lists to 4 and clamps `score`; `normalizeInterviewerTurn` drops a
`line` sent with `move_on`. The interviewer's line is never cut: over 200 characters or 25 words
it fails (502, billed).

## Prompts (`api/_lib/prompts.ts`, English, byte-stable)

- `FEEDBACK_SYSTEM`: an interview coach for a Spanish-speaking learner (described in
  `<learner>`); the answer came through speech-to-text: ignore punctuation and case; a word that
  looks mis-transcribed may be a pronunciation issue, not grammar; the model answer is the
  **only** source of facts: every claim outside it goes to `invented`; `improved` keeps his
  content and roughly his length, uses contractions, sounds clear and modest to an Australian
  interviewer, adds no facts; behavioural questions judged on STAR; learner-facing fields in
  Spain Spanish. `REPORT_SYSTEM` for the report.
- `INTERVIEWER_SYSTEM`: a hiring manager; `tone` in the user turn (friendly | tough: shorter,
  more direct, asks for specifics and results); one follow-up only when the answer misses
  something the **model answer contains** (result, numbers he can defend, his own role, the
  why), otherwise `move_on`; never asks for facts outside the model answer; natural spoken
  Australian English, ≤ 25 words.
- User turns: `<learner>`, `<card>` (title, question asked, model answer, anchors, pending
  note), `<history>`, `<answer>` (+ seconds and target seconds); learner text is data, `<` → `‹`
  like the other prompts.
- `generateStructured` has an optional `model` (default `COACH_MODEL`; built, T207); the
  fallback beta and `fallbacks: "default"` are sent only when `supportsFallback(model)`
  (`api/_lib/model.ts`: Sonnet 5.5, Opus 5.5, Opus 5, Fable 5.1, Fable 5.2; never Haiku 5.5, which
  has no server-side fallback). `max_tokens`: turn 1500, answer 4000, report 3000.
- `PACK_SYSTEM`, `INTERVIEW_SYSTEM`, `ROUTE_SYSTEM`, `EPISODE_SYSTEM` stay byte-identical (prompt
  cache).

Built (T208). `INTERVIEWER_SYSTEM` (~700 tokens), `FEEDBACK_SYSTEM` (~1.4k) and `REPORT_SYSTEM`
(~600), each cached like the others (both models cache prefixes from 512 tokens). The corrector
keeps the cards panel's correction rules and the meaning of its keys; the panel's description of
its learner was not copied: who the learner is comes only from the deck's `learner` line (else
`DEFAULT_MOCK_LEARNER`, "a Spanish-speaking professional, B2 English"), in the user turn. Rules
beyond the list above:

- **Interviewer.** A non-answer (empty, in Spanish, about something else) gets one follow-up that
  asks the main point again, more simply. Never asks about the card's unconfirmed part or for
  something already said; after two follow-ups on a question, always `move_on`. `ack`: a neutral
  spoken reaction, never a verdict. `tough`: shorter, direct, specifics and results, still polite.
- **Corrector.** `invented` = claims about the learner's own experience that the model answer does
  not support (a new employer, role, tool, number, date, result or event, a changed figure, a
  stronger claim); paraphrases, opinions, motivation and courtesy are not. Any specific detail for
  the card's unconfirmed part is invented. **An answer with any invented claim scores 3 at most.**
  Score scale: 5 natural, clear, correct, answers well · 4 a few mistakes that do not get in the way
  · 3 several mistakes or a clear content gap · 2 hard to follow, very short or mostly beside the
  question · 1 no real answer. Possible transcription slips go to `pronunciation`, never to
  `mistakes`; fillers may be missing from a transcript, so none proves nothing; words per minute are
  never estimated. A follow-up answer is judged against the follow-up; «Me he bloqueado» does not
  lower the score. `improved` keeps the learner's content, order and roughly their length (≤ 170
  words), keeps the unconfirmed part vague and drops invented claims; for an answer with nothing
  usable it is a short answer built only from the model answer. English: `said`, `better`,
  `claim`, `fillers`, `improved`; everything else Spain Spanish with "tú", English inside «»,
  gender-neutral unless `<learner>` says otherwise.
- **Report.** Built only from the corrections (no model answers in its prompt): invented claims
  only as listed there, weak points are patterns across answers (repeated invented claims first),
  the score is usually close to the average and lower when invented claims or one serious problem
  repeat; `tough` holds the answers to that standard.

User turns (`interviewerUserPrompt`, `feedbackUserPrompt`, `reportUserPrompt`; every quoted text
`<` → `‹`, deck text included):

- `<learner>` · `<card>`: `Title:`, `Main question:`, `Model answer:` (the English sentences,
  numbered), `Key points:` (anchors), `Unconfirmed:` (the `pending` note, when set), `Target
  length: about N seconds.` (when set) · interviewer only: `<history>` (earlier exchanges on this
  question, or "none") · `<question>` (what was asked) · `<answer>` (or "(empty)") and `Time
  spoken: N seconds (target about M seconds).` ("not measured" for 0) · then the interviewer's
  `<tone>` and the count of follow-ups already asked, or the corrector's notes (follow-up, stuck) and
  "Correct this answer.".
- Report: `<learner>`, `<tone>`, `<answers>` (per answer: card title, asked, score, summary, its
  mistakes `said → better (why)`, its invented claims), "Write the report of this mock
  interview.".

Inputs (`api/_lib/prompts.ts`): `TurnInput { learner?, card, tone, asked, history, answer,
seconds }`, `FeedbackInput { learner?, card, asked, isFollowUp, answer, seconds, stuck }`,
`ReportInput { learner?, tone, answers: { card, asked, score, summary, invented: string[],
mistakes }[] }`: the request body with the card looked up by `cardId` and the deck's `learner`.

### Generators (`api/_lib/generators.ts`, built T208)

`generateTurn(input, model, onUsage)`, `generateFeedback(input, model, onUsage)`,
`generateReport(input, model, onUsage)`: the endpoint passes its role's model
(`interviewerModel()` / `feedbackModel()`, resolved before the deck, for the 503 order). Real:
`generateStructured({ model, effort: "low", maxTokens })` with 1500 / 4000 / 3000, the role's
system prompt, schema and normalizer. Fake: bills that model with plausible cached-prompt usage
(`FAKE_TURN_USAGE` ≈ 0.0004 USD on Haiku 5.5, `FAKE_ANSWER_USAGE` ≈ 0.012 and `FAKE_REPORT_USAGE`
≈ 0.011 on Sonnet 5.5) and returns fixtures for the fake deck (`api/_lib/fake.ts`): the first answer
to a question gets that card's follow-up when it has fewer words than the model answer, otherwise
`move_on`; feedback has two typical Spanish-speaker mistakes, a possible pronunciation issue, two
fillers, the model answer as `improved`, an invented claim on two cards (score 3) and score 2 under
15 words; the report averages the scores and lists the answers' invented claims. Other decks'
cards get the same fixtures with a generic follow-up.

## Ledger (`api/_lib/ledger.ts`)

Built (T207). `CallKind` += `"turn" | "answer" | "report"` (`MockCallKind`). Keys (prefix
`langlern:coach:`):

| Key | Value |
| --- | --- |
| `mock:deck:<name>` | the deck, one JSON string `{ updatedAt, deck }` (not a counter; built in T206) |
| `<YYYY-MM>:mockSpend` | Mi entrevista's spend this month (micro-USD); also added to `<YYYY-MM>:spend`, never to `<YYYY-MM>:spend:<name>` (Prepárate's per code) |
| `mockCap` | its monthly cap (micro-USD; default `COACH_MOCK_MONTHLY_CAP_USD` or 10) |
| `<YYYY-MM-DD>:mock:<name>` | answers + reports today by a code (limit `COACH_MOCK_DAILY_LIMIT`, 60; expires after 2 days) |
| `<YYYY-MM-DD>:mockturn:<name>` | interviewer turns today by a code (limit 2 × the above; expires after 2 days) |
| `<YYYY-MM>:answers` / `answerSpend`, `turns` / `turnSpend`, `reports` / `reportSpend` | calls billed this month and their cost (for the averages; a failed attempt counts, since it was paid) |

- **Budgets.** `assertBudget()` (Prepárate) compares `spend − mockSpend` with `cap`;
  `assertMockBudget()` compares `mockSpend` with `mockCap` → 429 `budget` "Se ha agotado el
  presupuesto de Mi entrevista de este mes.". Neither feature's spend blocks the other.
  `recordCall()` writes `mockSpend` before `spend`, so Prepárate never counts a Mi entrevista call,
  not even for a moment. Same overshoot as Prepárate (read, then act; docs/coach.md "Budget
  overshoot").
- **Daily counters.** `reserveMockAnswer(caller)` (an answer's feedback or a report) and
  `reserveMockTurn(caller)` (`mockTurnsPerDay()` = 2 × `mockDailyLimit()`), each over its limit →
  429 `daily_limit` "Has llegado al límite de respuestas de hoy. Vuelve mañana."; each returns a
  refund, used only when nothing was billed. A call with `followUpsLeft: 0` takes no turn.
- **`GET /usage/`.** The top-level `spentUsd`, `remainingUsd` and `mineUsd` are Prepárate's (Mi
  entrevista left out), so its panel and its budget agree; `tokens` stays every call's. The owner
  also gets `mock: { spentUsd, capUsd, remainingUsd, answers, avgAnswerUsd, turns, avgTurnUsd,
  reports, avgReportUsd, today: { used, limit } }` (`today` = answers + reports); any other code
  gets no `mock`.
- **`PUT /usage/`** (owner only, else 403) takes `{ capUsd?, mockCapUsd? }`, 0–1000 each, at least
  one (else 400 "La petición no es válida (capUsd)."), and returns the same summary.
- **Prices.** `PRICES` reviewed against the pricing page on 2026-11-14: Haiku 5.5 added (0.10
  input, 0.50 output, 0.125 cache write, 0.01 cache read USD/MTok; a request whose prompt is over
  100 000 tokens pays 0.50 / 2.50 / 0.625 / 0.05), Sonnet 5.5 cache reads corrected to 0.10 (was
  0.2). `COACH_INTERVIEWER_MODEL` / `COACH_FEEDBACK_MODEL` must be in `PRICES` (503 otherwise).
- Prepárate's budget, counters and messages are otherwise unchanged.

## Device (`src/lib/mock-interview/`)

New keys only, each `{ v: 1, … }` with tolerant parsing; nothing existing is renamed, reshaped or
dropped.

- `lang-lern:mock-interview:deck` `{ v: 1, deck, updatedAt, fetchedAt }`: fetched on opening the
  screen when online; a failed fetch keeps the stored deck.
- `lang-lern:mock-interview:attempts` `{ v: 1, attempts }`, newest first: `{ id, at, mode:
  "card"|"mock", sessionId?, cardId, asked, isFollowUp, transcript, seconds, words, wpm, stuck,
  feedback?, feedbackError?, rating?: { useful?: boolean; myScore?: 1–5 }, model?, costUsd? }`.
  From 400 attempts the screen suggests exporting; nothing is dropped automatically (attempts are
  deleted only by an explicit action).
- `lang-lern:mock-interview:reports` `{ v: 1, reports }`: `{ id, at, tone, cardIds, report,
  costUsd }`.
- Per-card state is derived (attempts, last score, best, «Dominada» = last two scores ≥ 4), never
  stored.

## Listening (`answer` mode, `src/lib/speech/`)

`LISTEN_TIMINGS.answer` = silence 5 s, cap 180 s, no speech 8 s, start 5 s, end grace 1.5 s,
continuous. If the browser ends the session on its own before the cap and before `finish()`, the
engine starts a continuation session and appends its text (≤ 5 continuations); a continuation
that cannot start settles as `done` with what was heard and `continued: "failed"` (the UI then
offers «Seguir hablando»). The log entry gets an optional `continuations` count. The `phrase` and
`long` modes keep their timings and behaviour.

## Modo deporte (deck episodes, T215)

One episode per deck block, id `deck:<blockId>`, shown in `/deporte/` under «Mi entrevista» when
a deck is stored. Per card (one chapter): Natasha reads the question → silence of
`clamp(seconds, 15, 90)` s (30 s without `seconds`) to answer aloud → William reads the model
answer sentence by sentence (400 ms gaps) → Natasha: "Key phrases." → William reads each
phrase's English. No Spanish, no AI cost; clips via `/api/coach/tts/` (the whole deck ≈ 500
voice lines the first time, inside the 2000/day limit). A separate deck compiler produces the
same segments/chapters the player joins; `compileEpisode` output for dialogue, route and AI
episodes is unchanged.

## Evals (T210, `scripts/evals/mock-interview/`)

- **Cases** (`eval:mock:seed`, once, frozen in `evals/mock-interview/private/cases.json` with a
  snapshot of the deck): ≥ 20 answers to real cards, ≥ 2 of each kind, labels by construction:
  `clean` (control) · `grammar` (2–3 injected mistakes, listed) · `invented` (one claim outside
  the model answer, listed) · `off_topic` · `too_short` · `spanish_mix` · `stt_noise` (no
  punctuation, homophones: must not be reported as grammar).
- **Feedback checks** (deterministic first): valid schema 100 % · `invented` recall on
  `invented` cases **100 %** (blocking) · invented false positives on `clean` ≤ 10 % ·
  injected-mistake recall ≥ 80 % · score inside the case's range ≥ 80 % · `stt_noise` not
  flagged as grammar ≥ 80 % · `improved` adds no number or proper noun absent from model answer
  + transcript 100 %. Judge (Opus 5.5, 1–5) only for "improved keeps his content".
- **Interviewer checks**: line ≤ 25 words 100 % · follow-up on `too_short` ≥ 90 % · `move_on` on
  `clean` ≥ 70 % · judge: the follow-up is answerable from the model answer ≥ 90 % (score ≥ 4).
- **Matrix**: corrector × {Sonnet 5.5, Haiku 5.5}, interviewer × {Haiku 5.5, Sonnet 5.5}, same
  production prompts and schemas. Per model: the checks vs thresholds, cost of each call (mean,
  p95), latency (p50, p95), tokens, total cost of the run. `--max-usd` (default 1) stops the
  run; `--dry` runs on fake outputs at 0 cost.
- **Rule**: per role, the cheapest model that meets every threshold becomes the default (T211).
  Private details stay in git-ignored `evals/**/private/`; numbers only here, under "Evals
  results" (none yet).

## UI copy (Spain Spanish, tú)

Jugar card «🎤 Mi entrevista» · "Practica tus respuestas de entrevista en inglés." · «Practicar»
· «Simulacro» · «Exigente» · «Saltar las dominadas» · «Responder» · «He terminado» · «Me he
bloqueado» · «Repetir la pregunta» · «Ver texto» · «Corregir» · "Claude está corrigiendo…" ·
«Repregúntame» · «Otra vez» · «Ver la respuesta modelo» · «Inventado» · «Pronunciación
(posible)» · «Fluidez: N palabras por minuto» · «Tu respuesta, mejor dicha» · «Para la próxima»
· «¿Te sirvió?» · «Tu nota» · «Actualizar tarjetas» · «Exportar intentos» · «Falta un dato» ·
«Dominada» · «Seguir hablando» · "Sin micrófono: escribe o usa el dictado del teclado."

UI rules: the interviewer and model-answer lines in English with `lang="en"`; design tokens only,
both themes, `pressable` + `-ledge`, `PageHeader`, targets ≥ 44 px; audio only through `speak()`
inside the tap handler; the mic only through `useListen` / `createListenSession`.
