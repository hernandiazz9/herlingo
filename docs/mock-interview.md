# Mi entrevista — AI mock interviewer by voice

Decided with Hernán on 2026-11-14 (plan 017). He prepares job interviews in English with a private
deck of cards: a question, its variants and his **model answer**, sentence by sentence. Mi
entrevista turns the deck into practice by voice: Natasha (an Australian voice) asks, he answers
aloud, Claude corrects against his own model answer and, in a mock interview, a hiring manager
asks follow-ups. Owner only; the deck never touches the repo or the build.

This document is the contract of plan 017 and is kept current by each task. Built so far: the
deck (schema, text store, `GET`/`PUT /api/coach/deck/`, `npm run deck:push`, the fake deck; T206).
Everything else below is the contract its task builds.

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
Checks in order: code (401) → owner (403) → body (400) → deck/card → Mi entrevista budget → its
daily counter → Claude → bill → refund only if nothing was billed (as Prepárate). Errors and 502
messages as docs/coach.md, with the mock budget message "Se ha agotado el presupuesto de Mi
entrevista de este mes." and the daily one "Has llegado al límite de respuestas de hoy. Vuelve
mañana.".

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

### `POST /api/coach/interviewer/`

`{ cardId, tone: "friendly"|"tough", asked: string, history: { asked, answer }[] (≤ 3, this
question only), answer: string (1–3000), seconds, followUpsLeft: 0–2 }` → `200 { next:
InterviewerTurn, usage }`. `followUpsLeft: 0` → `move_on` with a canned acknowledgement, no
Claude call, no counter.

### `POST /api/coach/feedback/`

- `{ kind: "answer", cardId, asked, isFollowUp, answer (1–3000), seconds, stuck }` → `200 {
  feedback: AnswerFeedback, usage }`.
- `{ kind: "report", tone, answers: { cardId, asked, score, summary, invented[], mistakes (≤ 3)
  }[] (1–24) }` → `200 { report: MockReport, usage }`.

The server reads the card (model answer, anchors, pending) from the stored deck by `cardId`
(unknown → 400): the client never sends the "facts". `usage` = `{ costUsd, model, latencyMs,
tokens, today: { used, limit }, remainingUsd }`.

### Voices

`/api/coach/tts/` also accepts the two interview voices (`MOCK_VOICES` in
`api/_lib/languages.ts`, mirrored on the client), like the narrator voices.

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
- `generateStructured` gains an optional `model` (default `COACH_MODEL`); server-side
  `fallbacks` only for models that support it (not Haiku 5.5). `max_tokens`: turn 1500, answer
  4000, report 3000.
- `PACK_SYSTEM`, `INTERVIEW_SYSTEM`, `ROUTE_SYSTEM`, `EPISODE_SYSTEM` stay byte-identical (prompt
  cache).

## Ledger (`api/_lib/ledger.ts`)

`CallKind` += `"turn" | "answer" | "report"`. Keys (prefix `langlern:coach:`):

| Key | Value |
| --- | --- |
| `mock:deck:<name>` | the deck, one JSON string `{ updatedAt, deck }` (not a counter; built in T206) |
| `<YYYY-MM>:mockSpend` | Mi entrevista's spend this month (micro-USD) |
| `mockCap` | its monthly cap (micro-USD) |
| `<YYYY-MM-DD>:mock:<name>` | answers + reports today by a code |
| `<YYYY-MM-DD>:mockturn:<name>` | interviewer turns today by a code |
| `<YYYY-MM>:answers` / `answerSpend`, `turns` / `turnSpend`, `reports` / `reportSpend` | counts and cost this month (for the averages) |

`assertBudget()` (Prepárate) compares `spend − mockSpend` with its cap; `assertMockBudget()`
compares `mockSpend` with `mockCap`. `GET /usage/` adds `mock: { spentUsd, capUsd, answers,
avgAnswerUsd, turns, avgTurnUsd, reports, today }`; `PUT /usage/` accepts `mockCapUsd` (owner).
`PRICES` gets Haiku 5.5 and is reviewed against the pricing page (2026-11: Sonnet 5.5 cache reads
listed at 0.10 USD/MTok, the table has 0.2). Prepárate's budget, counters and messages are
otherwise unchanged.

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
