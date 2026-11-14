# Plan 017 — "Mi entrevista": an AI interviewer that asks in English, listens, corrects and follows up

Status: active
Created: 2026-11-14
Base branch: plan-017-mi-entrevista
Goal: Hernán practises job interviews in English by voice. An interviewer with an Australian-English voice (edge-tts `en-AU-NatashaNeural`) asks one of his prepared interview cards; he answers aloud (browser speech recognition, `en-AU`, editable text or keyboard dictation as the fallback); Claude corrects the answer (mistakes, anything he claimed that is not in his model answer, fluency, a better version read by `en-AU-WilliamMultilingualNeural`) and, in a mock interview, follows up ("tell me more", "what was the result?") like a real interviewer, with the report at the end. Two modes: practise one card, and a mock interview of 5–8 questions with an optional tough tone. The cards are his own (written in the HDDev centre, `aprender/ingles/contenido.json`): they reach the app as a **private deck** stored on the server under the owner's code, never in git or the public build. Two model roles: a fast interviewer (Haiku 5.5) and a careful corrector (Sonnet 5.5), each with its own counters and a separate monthly budget; seeded evals measure correction quality, cost and latency per model before the UI is built. Modo deporte gets free, English-only episodes from the deck (question → time to answer aloud → model answer). Phase gate: T205 proves on his iPhone that a 2-minute spoken answer gets transcribed before any speaking UI (T213+). Save tokens: one agent at a time, no code reviews, no visual checks by agents (Hernán checks on his iPhone).
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-11-14 11:36Z 💻
- Writer: me (💻 desktop session; plan checkout ../herlingo-entrevista)
- Branch: plan-017-mi-entrevista · checkout /Users/heralc/Desktop/HDDev/herlingo-entrevista
- Next step: integrate T204, then launch T206
- Gotchas: public repo: no card text, answer, transcript or personal fact in code, fixtures, docs, commits or logs; `/api/coach/interview/` is the level interview (this feature: `deck`, `interviewer`, `feedback`, `mock`); agents run in the plan checkout without `isolation` (in HDDev it would branch the centre repo), one at a time, no commits: the writer verifies and commits; no `.env.local` there (fake mode)
- Needs Hernán: T205 iPhone check · OK to spend ≈ 1 USD on the first eval run (T210) · model choice per role (T211) · Anthropic console spend limit ≥ 15 USD before T216

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, this plan's **Design** section (the contract until T206 copies it into `docs/mock-interview.md`; from then on that doc is the contract and tasks keep it current), docs/coach.md ("API", "Claude calls and prompt design", "Limits and ledger", "POST /api/coach/tts/"), docs/speech.md, and docs/sport.md for T215. docs/brief.md is app-wide; do not edit it. Do not edit `plans/`.
- **Static export stays.** The backend is only `api/` (Vercel functions, relative `.js` imports). `src/` never imports `api/`, `@anthropic-ai/sdk`, `@upstash/redis` or runtime zod (ESLint enforces it). No secrets in code; `.env.example` holds names only.
- **Privacy (public repo).** The deck lives only in Upstash (owner's code) and on Hernán's device. Never commit, print or log card text, transcripts, feedback or facts about the learner: fake fixtures use an invented generic persona; `[coach]` logs carry ids, counts, ms and tokens only; eval inputs and outputs go to git-ignored `evals/**/private/`; committed eval results are numbers only. No learner profile is hard-coded in a prompt.
- **Never lose on-device data.** New keys only: `lang-lern:mock-interview:deck`, `lang-lern:mock-interview:attempts`, `lang-lern:mock-interview:reports` (each `{ v: 1, … }`, tolerant parsing). No existing key renamed, reshaped or dropped (the speech log may gain one optional field, old entries still parse); no `localStorage.clear()`. Attempts are deleted only by an explicit action.
- **Existing features behave exactly as today.** `PACK_SYSTEM`, `INTERVIEW_SYSTEM`, `ROUTE_SYSTEM`, `EPISODE_SYSTEM` stay byte-identical (prompt cache). Prepárate's budget, counters and messages are unchanged (its budget check only stops counting Mi entrevista's spend). The `phrase` and `long` listening modes keep their timings and behaviour. `compileEpisode` output for dialogue, route and AI episodes is unchanged.
- **Owner only.** `/api/coach/deck/`, `/api/coach/interviewer/` and `/api/coach/feedback/` answer 403 to any code that is not the owner; the UI shows Mi entrevista only to the owner.
- **UI**: Spain Spanish with "tú" (copy in Design); the interviewer and model-answer lines in English with `lang="en"`; design tokens only, both themes, `pressable` + `-ledge`, `PageHeader`, targets ≥ 44 px; audio only through `speak()` inside the tap handler; the mic only through `useListen` / `createListenSession`.
- **Verification**: `npm run verify` → exit 0 for every task. API checks in fake mode: `PORT=3107 COACH_FAKE=1 npm run dev:coach` (no key; dev codes `dev-owner` / `dev-guest`) + `curl`; stop the server afterwards. Pure logic: a throwaway `npx tsx` check (not committed). **No browser, no screenshots, no visual checks** (Hernán does them). Anything that calls the real API (T210, T216) needs Hernán's OK first.
- Final message ≤ 15 lines.

## Design (contract)

### Decisions (Hernán, 2026-11-14)

| Topic | Decision |
| --- | --- |
| Listening | Browser speech recognition (`src/lib/speech/`, locale `en-AU`) in a new `answer` mode for 30 s – 3 min answers; the transcript is shown live. Fallback always present: a textarea (keyboard dictation or typing). Pronunciation is only *inferred* from the transcript ("posible"), never measured. T205 checks it on the iPhone before the speaking UI is built. |
| Modes | **Practise a card** (question → answer → correction at once → «Repregúntame» / «Otra vez») and **Simulacro** (5–8 questions, 0–2 follow-ups each, correction at the end, like a real interview). «Exigente» is a switch of the simulacro. No questions outside the deck (without a model answer the corrector cannot tell what is true). |
| Content | Private deck: `npm run deck:push` reads the centre's `contenido.json`, maps it to `InterviewDeck` and uploads it with the owner's code to Upstash; the app downloads it with the code and keeps it on the device (offline). Never in git, never in the build. Re-run the script after editing cards; no deploy needed. |
| Models | Two roles. **Interviewer** (decides the follow-up, one short line): `COACH_INTERVIEWER_MODEL`, default `claude-haiku-5-5`. **Corrector** (feedback per answer and the simulacro report): `COACH_FEEDBACK_MODEL`, default `claude-sonnet-5-5`. Both `effort: "low"`. The evals (T210) say whether Haiku is enough for correcting too; Hernán picks (T211). |
| Budget | Mi entrevista has its **own monthly cap, 10 USD** (`COACH_MOCK_MONTHLY_CAP_USD`, owner-editable), separate from Prepárate's 5 USD; **60 answers a day** (`COACH_MOCK_DAILY_LIMIT`; an answer's feedback and a report take one each), interviewer turns ≤ 2 × that. Estimate: ≈ 0.01 USD per corrected answer on Sonnet 5.5, ≈ 0.0005 per interviewer turn on Haiku 5.5, a full simulacro ≈ 0.10–0.15 USD, 30 answers a day ≈ 9 USD a month. |
| Feedback | The HDDev panel's schema (score 1–5, summary, mistakes said → better + why, inferred pronunciation, content, improved version, next step) **plus two fields**: `invented` (claims not in his model answer: the most serious finding) and `fluency` (fillers and cut-off sentences seen by Claude; words per minute computed on the device). Same meaning as the panel's keys, so both can be compared. |
| Attempts | On the device (they travel in the Perfil backup and the cloud save, his own account). «Exportar intentos» writes a JSON file. After each correction «¿Te sirvió?» 👍/👎 and «Tu nota» 1–5 are stored with the attempt (quality signal for later). |
| Evals | **Seeded cases only** for now: ≥ 20 answers written with known defects (labels by construction), frozen, run against both models per role with deterministic checks first and Claude Opus 5.5 as judge only where a rule cannot decide. Local, outside `verify`, ≤ 1 USD a run. |
| Modo deporte | Free episodes from the deck, one per block, all English: Natasha asks → a gap to answer aloud while running → William reads the model answer sentence by sentence → "Key phrases." and the card's phrases. Same player (locked screen, offline). |

Defaults (not asked; say so if you disagree): `/entrevista/` under Jugar with a «🎤 Mi entrevista» card for the owner in any active language; 5 XP per corrected answer, source `"interview"`, at most 12 answers a day give XP; in the simulacro the answer is sent as said (no editing), in a card it is editable before «Corregir»; follow-ups only ask about things the model answer contains (he is never pushed to invent).

### Flow of one question

1. The app speaks the line with Natasha (live TTS, cached on the device). Card mode shows the text; simulacro hides it behind «Ver texto» (listening practice). A card rotates its `question` and `variants`.
2. «Responder» opens the mic (`answer` mode): live text, a timer against the card's `seconds`, «He terminado». «Me he bloqueado» shows the card's anchors (keywords) and marks the attempt `stuck` (no penalty). «Repetir la pregunta» replays the line.
3. Card: the transcript stays editable → «Corregir» → `POST /api/coach/feedback/` → the feedback view. «Repregúntame» → `POST /api/coach/interviewer/` → Natasha asks the follow-up → same steps.
4. Simulacro: on «He terminado» (or 5 s of silence) Natasha says a short acknowledgement at once ("Thank you.", cached clip) while `POST /api/coach/interviewer/` decides: a follow-up (≤ 2 per question) or the next question. Each answer's feedback is requested in the background; at the end `POST /api/coach/feedback/` (`kind: "report"`) and the report screen (overall + each answer).

### Deck (`InterviewDeck`, zod in `api/_lib/schema.ts`)

```ts
type InterviewDeck = {
  version: 1; generated: string;            // ISO date from the source file
  learner?: string;                          // ≤ 600 chars, optional neutral description for the prompts; absent → "a Spanish-speaking professional, B2 English"
  blocks: { id: string; title: string; intro?: string }[];               // ≤ 20
  cards: {                                                                // ≤ 200
    id: string; block: string; title: string;
    question: string; variants: string[];                                 // ≤ 5; English, each ≤ 300
    answer: { en: string; es: string }[];                                 // 1–20 sentences, each ≤ 300 (TTS limit)
    anchors: string[]; phrases: { en: string; es: string; note?: string }[];  // ≤ 8 / ≤ 10
    tip?: string; pending?: string | null; seconds?: number;              // seconds 10–300
  }[];
};
```

Mapping from `contenido.json` (Spanish keys): `bloques→blocks (titulo→title)`, `tarjetas→cards`, `pregunta→question`, `variantes→variants`, `respuesta→answer`, `anclas→anchors`, `frases→phrases (nota→note)`, `consejo→tip`, `pendiente→pending`, `segundos→seconds`, `titulo→title`; `fuente` is dropped. A card with `pending` is shown with «Falta un dato» and the corrector is told that part of the model answer is unconfirmed.

### API (all owner only; non-owner → 403 `forbidden` "Mi entrevista es solo para la cuenta del dueño.")

- `GET /api/coach/deck/` → `200 { deck, updatedAt }` · none uploaded → 404 `no_deck` ("Todavía no hay tarjetas. Súbelas con npm run deck:push."). `PUT /api/coach/deck/` body = `InterviewDeck` (≤ 512 KB) → `200 { updatedAt, blocks, cards }`. Stored as one JSON string in Upstash `langlern:coach:mock:deck:<owner>` (the `Store` gains `getText`/`setText`). Fake mode: the memory store starts with a fake deck (invented persona, 2 blocks × 3 cards).
- `POST /api/coach/interviewer/` `{ cardId, tone: "friendly"|"tough", asked: string, history: { asked, answer }[] (≤ 3, this question only), answer: string (1–3000), seconds, followUpsLeft: 0–2 }` → `200 { next: InterviewerTurn, usage }`. `followUpsLeft: 0` → `move_on` with a canned acknowledgement, no Claude call, no counter.
- `POST /api/coach/feedback/` `{ kind: "answer", cardId, asked, isFollowUp, answer (1–3000), seconds, stuck }` → `200 { feedback: AnswerFeedback, usage }` · `{ kind: "report", tone, answers: { cardId, asked, score, summary, invented[], mistakes (≤ 3) }[] (1–24) }` → `200 { report: MockReport, usage }`.
- The server reads the card (model answer, anchors, pending) from the stored deck by `cardId` (unknown → 400): the client never sends the "facts". `usage` = `{ costUsd, model, latencyMs, tokens, today: { used, limit }, remainingUsd }`.
- Checks in order: code → owner → body → deck/card → Mi entrevista budget → its daily counter → Claude → bill → refund only if nothing was billed (as Prepárate). Errors and 502 messages as docs/coach.md, with the mock budget message "Se ha agotado el presupuesto de Mi entrevista de este mes." and the daily one "Has llegado al límite de respuestas de hoy. Vuelve mañana.".
- `/api/coach/tts/` also accepts the two interview voices (`MOCK_VOICES` in `api/_lib/languages.ts`, mirrored on the client), like the narrator voices.

### Schemas

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

Words per minute = words / seconds × 60, computed on the device and stored with the attempt (not asked from Claude).

### Prompts (`api/_lib/prompts.ts`, English, byte-stable)

- `FEEDBACK_SYSTEM`: an interview coach for a Spanish-speaking learner (described in `<learner>`); the answer came through speech-to-text: ignore punctuation and case; a word that looks mis-transcribed may be a pronunciation issue, not grammar; the model answer is the **only** source of facts: every claim outside it goes to `invented`; `improved` keeps his content and roughly his length, uses contractions, sounds clear and modest to an Australian interviewer, adds no facts; behavioural questions judged on STAR; learner-facing fields in Spain Spanish. `REPORT_SYSTEM` for the report.
- `INTERVIEWER_SYSTEM`: a hiring manager; `tone` in the user turn (friendly | tough: shorter, more direct, asks for specifics and results); one follow-up only when the answer misses something the **model answer contains** (result, numbers he can defend, his own role, the why), otherwise `move_on`; never asks for facts outside the model answer; natural spoken Australian English, ≤ 25 words.
- User turns: `<learner>`, `<card>` (title, question asked, model answer, anchors, pending note), `<history>`, `<answer>` (+ seconds and target seconds); learner text is data, `<` → `‹` like the other prompts.
- `generateStructured` gains an optional `model` (default `COACH_MODEL`); server-side `fallbacks` only for models that support it (not Haiku 5.5). `max_tokens`: turn 1500, answer 4000, report 3000.

### Ledger (`api/_lib/ledger.ts`)

`CallKind` += `"turn" | "answer" | "report"`. Keys (prefix `langlern:coach:`): `<YYYY-MM>:mockSpend`, `mockCap` (micro-USD), `<YYYY-MM-DD>:mock:<name>` (answers + reports), `<YYYY-MM-DD>:mockturn:<name>`, `<YYYY-MM>:answers` / `answerSpend`, `turns` / `turnSpend`, `reports` / `reportSpend`. `assertBudget()` (Prepárate) compares `spend − mockSpend` with its cap; `assertMockBudget()` compares `mockSpend` with `mockCap`. `GET /usage/` adds `mock: { spentUsd, capUsd, answers, avgAnswerUsd, turns, avgTurnUsd, reports, today }`; `PUT /usage/` accepts `mockCapUsd` (owner). `PRICES` gets Haiku 5.5 and is reviewed against the pricing page (2026-11: Sonnet 5.5 cache reads listed at 0.10 USD/MTok, the table has 0.2).

### Device (`src/lib/mock-interview/`)

- `lang-lern:mock-interview:deck` `{ v: 1, deck, updatedAt, fetchedAt }`: fetched on opening the screen when online; a failed fetch keeps the stored deck.
- `lang-lern:mock-interview:attempts` `{ v: 1, attempts }`, newest first: `{ id, at, mode: "card"|"mock", sessionId?, cardId, asked, isFollowUp, transcript, seconds, words, wpm, stuck, feedback?, feedbackError?, rating?: { useful?: boolean; myScore?: 1–5 }, model?, costUsd? }`. From 400 attempts the screen suggests exporting; nothing is dropped automatically.
- `lang-lern:mock-interview:reports` `{ v: 1, reports }`: `{ id, at, tone, cardIds, report, costUsd }`.
- Per-card state is derived (attempts, last score, best, «Dominada» = last two scores ≥ 4), never stored.

### Listening (`answer` mode, `src/lib/speech/`)

`LISTEN_TIMINGS.answer` = silence 5 s, cap 180 s, no speech 8 s, start 5 s, end grace 1.5 s, continuous. If the browser ends the session on its own before the cap and before `finish()`, the engine starts a continuation session and appends its text (≤ 5 continuations); a continuation that cannot start settles as `done` with what was heard and `continued: "failed"` (the UI then offers «Seguir hablando»). The log entry gets an optional `continuations` count.

### Modo deporte (deck episodes, T215)

One episode per deck block, id `deck:<blockId>`, shown in `/deporte/` under «Mi entrevista» when a deck is stored. Per card (one chapter): Natasha reads the question → silence of `clamp(seconds, 15, 90)` s (30 s without `seconds`) to answer aloud → William reads the model answer sentence by sentence (400 ms gaps) → Natasha: "Key phrases." → William reads each phrase's English. No Spanish, no AI cost; clips via `/api/coach/tts/` (the whole deck ≈ 500 voice lines the first time, inside the 2000/day limit). A separate deck compiler produces the same segments/chapters the player joins; nothing changes for the other sources.

### Evals (T210, `scripts/evals/mock-interview/`)

- **Cases** (`eval:mock:seed`, once, frozen in `evals/mock-interview/private/cases.json` with a snapshot of the deck): ≥ 20 answers to real cards, ≥ 2 of each kind, labels by construction: `clean` (control) · `grammar` (2–3 injected mistakes, listed) · `invented` (one claim outside the model answer, listed) · `off_topic` · `too_short` · `spanish_mix` · `stt_noise` (no punctuation, homophones: must not be reported as grammar).
- **Feedback checks** (deterministic first): valid schema 100 % · `invented` recall on `invented` cases **100 %** (blocking) · invented false positives on `clean` ≤ 10 % · injected-mistake recall ≥ 80 % · score inside the case's range ≥ 80 % · `stt_noise` not flagged as grammar ≥ 80 % · `improved` adds no number or proper noun absent from model answer + transcript 100 %. Judge (Opus 5.5, 1–5) only for "improved keeps his content".
- **Interviewer checks**: line ≤ 25 words 100 % · follow-up on `too_short` ≥ 90 % · `move_on` on `clean` ≥ 70 % · judge: the follow-up is answerable from the model answer ≥ 90 % (score ≥ 4).
- **Matrix**: corrector × {Sonnet 5.5, Haiku 5.5}, interviewer × {Haiku 5.5, Sonnet 5.5}, same production prompts and schemas. Per model: the checks vs thresholds, cost per call (mean, p95), latency (p50, p95), tokens, total cost of the run. `--max-usd` (default 1) stops the run; `--dry` runs on fake outputs at 0 cost.
- **Rule**: per role, the cheapest model that meets every threshold becomes the default (T211). Results: private details git-ignored; numbers only in `docs/mock-interview.md` "Evals".

### UI copy (Spain Spanish, tú)

Jugar card «🎤 Mi entrevista» · "Practica tus respuestas de entrevista en inglés." · «Practicar» · «Simulacro» · «Exigente» · «Saltar las dominadas» · «Responder» · «He terminado» · «Me he bloqueado» · «Repetir la pregunta» · «Ver texto» · «Corregir» · "Claude está corrigiendo…" · «Repregúntame» · «Otra vez» · «Ver la respuesta modelo» · «Inventado» · «Pronunciación (posible)» · «Fluidez: N palabras por minuto» · «Tu respuesta, mejor dicha» · «Para la próxima» · «¿Te sirvió?» · «Tu nota» · «Actualizar tarjetas» · «Exportar intentos» · «Falta un dato» · «Dominada» · «Seguir hablando» · "Sin micrófono: escribe o usa el dictado del teclado."

## Tasks

## T204 — Listening `answer` mode and a «Respuesta larga» test on Probar micrófono
- Status: running (attempt 1 · 💻 · agent a3a8ec0ea5a338539 · since 11:36Z)
- Depends on: none
- Where: any
- Goal: The speech engine can take a 30 s – 3 min spoken answer, continuing when the browser stops on its own, and Hernán can test it on his iPhone before anything else is built.
- Context: Design "Listening"; docs/speech.md (engine, timings, iOS notes, `/microfono/`); `src/lib/speech/{session,log,platform}.ts`, `src/components/speech/*`, the Probar micrófono screen.
- Scope: may touch `src/lib/speech/**` (additive), `src/components/speech/**` (additive), the `/microfono/` screen, docs/speech.md / must not touch `api/`, other screens, the `phrase`/`long` timings.
- Done when:
  - `LISTEN_TIMINGS.answer` per Design; continuation sessions per Design (≤ 5, text appended with a space, `continued: "failed"` when a restart cannot start); `phrase` and `long` behave as before.
  - Log entries get an optional `continuations` (old entries still parse).
  - `/microfono/` gains a third card «Respuesta larga (inglés, en-AU)»: 3-minute countdown, live text, at the end words, seconds, words per minute and continuations.
  - A throwaway `npx tsx` check with a fake recognizer: a session ended by the browser at 60 s continues and returns both parts; one whose restart throws settles `done` with `continued: "failed"`.
  - docs/speech.md updated (mode, continuation, screen).
  - `npm run verify` → exit 0.
- Outcome:

## T205 — iPhone check: does a 2-minute English answer get transcribed? (Hernán, by hand)
- Status: pending
- Depends on: T204
- Where: pc (Hernán on his iPhone; a deployed build with his OK)
- Goal: Gate for the speaking UI (T213, T214): know whether the mic path works on his phone or the keyboard-dictation path must lead.
- Context: docs/speech.md "iOS notes" (`service-not-allowed` in installed apps; no recognizer in Chrome on iPhone).
- Scope: none (no code).
- Done when:
  - On «Respuesta larga», in the installed app and in Safari: read a 90-second text aloud (e.g. a long model answer from his panel) and then answer freely for ~2 minutes; note where it stops, whether continuations happen, rough accuracy, and paste «Copiar registro».
  - Result written here: mic works (≥ 90 s, continuations OK) → T213 as designed; it does not → decide with Hernán (textarea + keyboard dictation first, mic second) before T213.
- Outcome:

## T206 — Private deck: schema, text store, `GET`/`PUT /api/coach/deck/`, push script, fake deck
- Status: pending
- Depends on: none
- Where: any
- Goal: Hernán's cards reach the server under his owner code and nothing personal touches the repo.
- Context: Design "Deck", "API", "Privacy"; `api/_lib/{schema,store,config,fake,access,http}.ts`, `api/coach/usage.ts` (owner check pattern), `scripts/coach/dev.ts`, `.env.example`.
- Scope: may touch `api/_lib/{schema,store,config,fake}.ts`, `api/_lib/deck.ts` (new), `api/coach/deck.ts` (new), `scripts/mock-interview/push-deck.ts` (new), `package.json` (script `deck:push`), `.gitignore` (`evals/**/private/`), `.env.example`, `docs/mock-interview.md` (new: this plan's Design, in the docs' style), docs/coach.md (API table and links) / must not touch `src/`, prompts, `content/`.
- Done when:
  - `InterviewDeck` (zod) per Design; `Store.getText`/`setText` on Upstash and memory.
  - `GET` owner → 200, guest → 403, none → 404 `no_deck`; `PUT` owner only, > 512 KB or invalid → 400; fake mode starts with the fake deck (invented persona, 2 blocks × 3 cards).
  - `npm run deck:push -- <path> [--url=<origin>] [--dry]`: maps `contenido.json` per Design, validates, uploads with the owner code taken from `.env.local` (`COACH_ACCESS_CODES` + `COACH_OWNER`), prints counts only (blocks, cards, pending), never card text; default URL `https://herlingo.vercel.app`; `--dry` validates without uploading.
  - Fake curl: owner GET/PUT 200, `dev-guest` 403, no code 401, bad body 400; `--dry` on Hernán's real file passes (path outside the repo; counts only in the output).
  - `git grep` finds no card text; `docs/mock-interview.md` exists.
  - `npm run verify` → exit 0.
- Outcome:

## T207 — Two models, Haiku in the price table, Mi entrevista budget and counters
- Status: pending
- Depends on: T206
- Where: any
- Goal: The ledger can pay for two model roles out of a separate monthly budget, with their own daily counters, without changing Prepárate.
- Context: Design "Ledger", "Prompts" (the `model` option); docs/coach.md "The call", "Limits and ledger"; `api/_lib/{model,claude,ledger,config,store}.ts`, `api/coach/usage.ts`; the pricing page linked at the top of `model.ts` (the claude-api skill's model table, 2026-11-03: Haiku 5.5 0.10 / 0.50 USD per MTok; Sonnet 5.5 cache reads 0.10; Haiku 5.5 has no server-side fallback).
- Scope: may touch `api/_lib/{model,claude,ledger,config,store}.ts`, `api/coach/usage.ts`, `.env.example`, docs/coach.md, docs/mock-interview.md / must not touch the prompts, the other endpoints' behaviour.
- Done when:
  - `PRICES` reviewed against the pricing page (review date updated), Haiku 5.5 added; `generateStructured({ model })` with fallbacks only where supported; `COACH_INTERVIEWER_MODEL` / `COACH_FEEDBACK_MODEL` (defaults per Design) must be in `PRICES`, else 503 `not_configured`.
  - Mock budget and counters per Design; `assertBudget()` = `spend − mockSpend` vs cap; refunds as today; `GET /usage/` `mock` block; `PUT /usage/` `mockCapUsd` (owner only).
  - Throwaway `npx tsx` check on the memory store: mock spend does not block Prepárate and vice versa; the 61st answer → 429; usage numbers add up.
  - `npm run verify` → exit 0.
- Outcome:

## T208 — Interviewer and corrector: prompts, schemas, fakes, generators
- Status: pending
- Depends on: T207
- Where: any
- Goal: Server modules that turn a card + an answer into a validated follow-up decision, feedback or report (fake or real Claude), no endpoints yet.
- Context: Design "Schemas", "Prompts"; the HDDev panel's correction prompt (the panel's `promptCorreccion`, summarised in Design, is the starting point; its learner description must not be copied); models in `api/_lib/{schema,normalize,prompts,fake,generators}.ts` (routes, episodes).
- Scope: may touch `api/_lib/{schema,normalize,prompts,fake,generators}.ts`, docs/mock-interview.md / must not touch `src/`, `api/coach/`, the bytes of the four existing system prompts.
- Done when:
  - `InterviewerTurn`, `AnswerFeedback`, `MockReport` (zod, limits + plain-words descriptions), normalizers that trim overflows and log paths and counts only.
  - `INTERVIEWER_SYSTEM`, `FEEDBACK_SYSTEM`, `REPORT_SYSTEM` + user-turn builders per Design (escaping, `<learner>` from the deck or the neutral line).
  - `generateTurn`, `generateFeedback`, `generateReport`: fake → fixtures for the fake deck with realistic usage; real → `generateStructured` with the role's model, `effort: "low"`, the Design's `max_tokens`.
  - Throwaway `npx tsx` check: fakes pass the schemas; an overflowing feedback is trimmed and passes; a follow-up line over 200 chars fails.
  - `git diff` shows the existing system prompts unchanged.
  - `npm run verify` → exit 0.
- Outcome:

## T209 — `POST /api/coach/interviewer/`, `POST /api/coach/feedback/` and the interview voices
- Status: pending
- Depends on: T208
- Where: any
- Goal: The endpoints, owner only, reading the card from the stored deck, billed to Mi entrevista's budget.
- Context: Design "API"; `api/coach/{route,episode,usage,tts}.ts`, `api/_lib/{ledger,http,languages,tts}.ts`.
- Scope: may touch `api/coach/{interviewer,feedback}.ts` (new), `api/coach/tts.ts`, `api/_lib/{languages,ledger,http}.ts`, `scripts/coach/dev.ts` (only if routes are listed by hand), `.env.example`, docs/coach.md, docs/mock-interview.md / must not touch `src/`, prompts.
- Done when:
  - Both endpoints per Design (checks order, bodies, owner 403, unknown card 400, `followUpsLeft: 0` without Claude, usage with model, cost and latency); one `[coach] mock <turn|answer|report> <ok|failed> <ms> ms, <tokens>, model <id>` line per real call.
  - `/api/coach/tts/` accepts `MOCK_VOICES` (`en-AU-NatashaNeural`, `en-AU-WilliamMultilingualNeural`); other voices unchanged.
  - Fake curl: turn / answer / report 200; `dev-guest` 403; `COACH_MOCK_DAILY_LIMIT=2` → the 3rd answer 429; unknown card 400; tts with Natasha 200, an unknown voice 400.
  - `npm run verify` → exit 0.
- Outcome:

## T210 — Evals: seeded cases, runner, first measurement (Hernán's OK: ≈ 1 USD)
- Status: pending
- Depends on: T208
- Where: pc (real key in `.env.local`, Hernán's real deck file, his OK to spend)
- Goal: Measure correction and follow-up quality, cost and latency for Sonnet 5.5 and Haiku 5.5 before any UI.
- Context: Design "Evals"; `api/_lib/{prompts,schema,generators,claude,model}.ts` (the runner imports the production prompts and schemas; relative `.js` imports work under `tsx`).
- Scope: may touch `scripts/evals/mock-interview/**` (new), `package.json` (`eval:mock`, `eval:mock:seed`), `.gitignore`, docs/mock-interview.md "Evals" / must not touch `api/` (imports only), `src/`.
- Done when:
  - `eval:mock:seed -- --deck=<contenido.json>`: deck snapshot + ≥ 20 frozen cases (≥ 2 per kind, labels by construction, generated with Opus 5.5; cost printed) in `evals/mock-interview/private/`; `--reseed` only on purpose.
  - `eval:mock`: the matrix and checks per Design; per-model table vs thresholds, cost (mean, p95), latency (p50, p95), tokens, run total; `--max-usd` (default 1) and `--dry` (0 cost, works without a key); run JSON in the private folder.
  - `--dry` passes in any checkout; the first real run (with Hernán's OK) is summarised, numbers only, in docs/mock-interview.md "Evals" and as a line in this plan's Decisions.
  - `npm run verify` → exit 0.
- Outcome:

## T211 — Default model per role from the eval numbers (Hernán decides)
- Status: pending
- Depends on: T210
- Where: pc
- Goal: Pick the interviewer and corrector models with data (rule in Design "Evals"); change the defaults only if the numbers say so.
- Context: T210's table.
- Scope: may touch `api/_lib/config.ts` (the two defaults), `.env.example`, docs/mock-interview.md / must not touch the rest.
- Done when:
  - Hernán's choice recorded in Decisions and docs/mock-interview.md with its numbers; defaults match it.
  - `npm run verify` → exit 0.
- Outcome:

## T212 — Client: deck sync, storage, API calls, attempts, export
- Status: pending
- Depends on: T209
- Where: any
- Goal: `src/lib/mock-interview/` holds everything the screens need, with tolerant storage and no change to existing keys.
- Context: Design "Device", "API"; models: `src/lib/coach/{api,types,parse,usage,routes}.ts`, `src/lib/sport/episodes.ts`, `src/lib/backup/{index,file}.ts` (save a file; `isCloudSaveKey`), `src/lib/audio/generated.ts` (`generatedPlayable`), `src/lib/coach/audio.ts` (`COACH_NARRATORS`, the client mirror of server voices).
- Scope: may touch `src/lib/mock-interview/**` (new), `src/lib/coach/{api,types,parse,usage}.ts` (additive), `src/lib/audio/**` (additive: the voices mirror only if it belongs there), docs/mock-interview.md / must not touch `api/`, screens, existing stored shapes.
- Done when:
  - Types mirroring Design; `fetchDeck`/`useDeck` (keeps the stored deck on failure or offline); `takeTurn`, `getFeedback`, `getReport` with `CoachApiError`; attempts and reports stores + hooks; `rateAttempt`; derived per-card stats; `wordsPerMinute`; `exportAttempts()` (a JSON file through the backup's save step); `mockPlayable(text, "interviewer"|"model")`; the usage parser accepts `mock` as optional.
  - The new keys are in the Perfil backup and the cloud save (checked against `isCloudSaveKey`); corrupt values are dropped, never thrown.
  - `npm run verify` → exit 0.
- Outcome:

## T213 — `/entrevista/`: the deck, practise a card, feedback view
- Status: pending
- Depends on: T212, T205 (its outcome sets the mic/keyboard layout)
- Where: any
- Goal: Hernán opens Mi entrevista, picks a card, hears Natasha, answers aloud, and gets his correction with the better version read by William.
- Context: Design "Flow", "UI copy", Defaults; models: `/rapido/` and `/deporte/` (`src/components/quick/*`, `src/components/sport/*`: `?ruta=`/`?ep=` in place, `AccessCard`, offline notice), `src/lib/navigation.ts` (`NESTED`), `src/components/shell/QuickFab.tsx` (`hiddenOn`), `src/components/game/GameView.tsx` (the Jugar cards), `@/components/speech`, `src/lib/progress` (`recordActivity`, `XpSource`), `XpToast`.
- Scope: may touch `src/app/entrevista/**` (new), `src/components/mock-interview/**` (new), `src/lib/navigation.ts` (one `NESTED` entry), `src/components/shell/QuickFab.tsx`, `src/components/game/GameView.tsx` (the card only), `src/lib/progress/index.ts` (`"interview"` in `XpSource`), the XP toast (source icon), CLAUDE.md (folder layout lines), docs/mock-interview.md / must not touch `api/`, `src/lib/coach/**` storage.
- Done when:
  - NESTED `mockInterview` (`/entrevista/`, "Entrevista", "Mi entrevista", parent `play`); the Jugar card only for the owner (cached usage `isOwner` or a stored deck), any active language; ⚡ hidden on `/entrevista/`.
  - The deck screen: blocks with their cards (title, attempts, last score, «Dominada», «Falta un dato»), «Actualizar tarjetas», «Exportar intentos», no-code → `AccessCard`, offline notice, no deck → the 404 message.
  - `?tarjeta=<id>` opens a card in place: the flow per Design (question with Natasha, variants rotated, `answer`-mode mic or the textarea per T205, timer, «Me he bloqueado» → anchors, editable transcript, «Corregir», the feedback view with every Design field, «¿Te sirvió?» + «Tu nota», «Repregúntame», «Otra vez», «Ver la respuesta modelo» sentence by sentence with 🔊).
  - 5 XP per corrected answer, source `"interview"` (🎤 in the toast), at most 12 a day.
  - `npm run verify` → exit 0.
- Outcome:

## T214 — Simulacro: 5–8 questions, follow-ups, report
- Status: pending
- Depends on: T213
- Where: any
- Goal: A real-feeling interview: Natasha asks, follows up when an answer misses something, and the corrections come at the end.
- Context: Design "Flow" step 4, "UI copy"; T213's components; `src/components/coach/AiUsagePanel.tsx`.
- Scope: may touch `src/components/mock-interview/**`, `src/lib/mock-interview/**`, `src/components/coach/AiUsagePanel.tsx` (one «Mi entrevista» row for the owner), docs/mock-interview.md / must not touch `api/`.
- Done when:
  - Setup: 5–8 questions, block filter, «Exigente», «Saltar las dominadas».
  - The flow per Design: text hidden behind «Ver texto», instant acknowledgement clip while the turn is decided, ≤ 2 follow-ups per question, «Repetir la pregunta», «Me he bloqueado», no editing; feedback per answer in the background with one retry; the report (overall + each answer, «Escuchar» on improved versions) saved to reports; leaving mid-way keeps the answered attempts.
  - Daily-limit, budget and offline messages as the server sends them; the usage row shows spend/cap, answers and average cost.
  - `npm run verify` → exit 0.
- Outcome:

## T215 — Modo deporte: one free episode per deck block
- Status: pending
- Depends on: T212
- Where: any
- Goal: Hernán runs with his interview in his ears: question, time to answer aloud, model answer, key phrases, with the screen locked.
- Context: Design "Modo deporte"; docs/sport.md (episode model, compiler, player, offline); `src/lib/sport/{compile,prepare,player,types}.ts`, `src/components/sport/*`.
- Scope: may touch `src/lib/sport/**` (a deck compiler; nothing changes for the other sources), `src/components/sport/**` (the «Mi entrevista» section), docs/sport.md / must not touch `api/`, stored shapes.
- Done when:
  - `deck:<blockId>` episodes per Design, shown only with a stored deck; same preparation, missing-clip handling, offline, lock screen, «Escuchar seguidos» and XP as the other free episodes.
  - Throwaway `npx tsx` check: a fake-deck block compiles; segment counts and an estimated duration printed; the existing sources compile to the same output as before.
  - `npm run verify` → exit 0.
- Outcome:

## T216 — iPhone check and real numbers (Hernán, by hand)
- Status: pending
- Depends on: T214, T215
- Where: pc (Hernán on his iPhone; deployed build with his OK; real deck pushed with `npm run deck:push`; Anthropic console spend limit ≥ 15 USD)
- Goal: Hernán uses it for real; latency, cost and quality are measured; findings become fix tasks.
- Context: Design (budget estimates), T210's numbers.
- Scope: none (no code), except recording numbers in docs/mock-interview.md.
- Done when:
  - Three cards practised and one full simulacro (friendly and tough); the follow-ups feel natural and never ask for something he cannot say truthfully; a deck episode plays locked while running.
  - From the responses' `usage`: interviewer turn ms (target p50 ≤ 3 s), feedback ms (target p50 ≤ 15 s), cost per answer and per simulacro → docs/mock-interview.md "Measured".
- Outcome:

## Review queue

## Visual checks queue

## Decisions
- 2026-11-14 plan: Listening = browser speech recognition (`en-AU`) in a new `answer` mode, editable text, keyboard dictation or typing as the fallback; pronunciation only inferred from the transcript. iPhone check (T205) gates the speaking UI. (Hernán)
- 2026-11-14 plan: Modes = practise a card (correction at once) + simulacro of 5–8 questions with 0–2 follow-ups and the correction at the end; «Exigente» is a simulacro switch; no questions outside the deck. (Hernán)
- 2026-11-14 plan: Content = private deck uploaded by `npm run deck:push` to Upstash under the owner's code, cached on the device; never in git or the public build (the GitHub repo is public). Owner only. (Hernán)
- 2026-11-14 plan: Two model roles — interviewer Haiku 5.5, corrector Sonnet 5.5, configurable per role; own monthly cap 10 USD (Prepárate keeps its 5 USD) and 60 answers a day; the evals decide whether Haiku can also correct. (Hernán)
- 2026-11-14 plan: Feedback = the HDDev panel's schema + `invented` and `fluency` (words per minute computed on the device). (Hernán)
- 2026-11-14 plan: Attempts on the device (backup + cloud save) with «Exportar intentos» and a 👍/👎 + «Tu nota» rating per correction. (Hernán)
- 2026-11-14 plan: Evals with seeded cases only (≥ 20, labels by construction), local, ≤ 1 USD a run; real attempts are not part of the gold set for now. (Hernán)
- 2026-11-14 plan: Modo deporte = free English episodes per deck block: question → gap to answer aloud → model answer → key phrases. (Hernán)
- 2026-11-14 plan: Defaults (not asked): `/entrevista/` under Jugar, owner-only card in any language; 5 XP per corrected answer, ≤ 12 a day; simulacro answers not editable; follow-ups only about what the model answer contains. (plan)
- 2026-11-14 plan: Save tokens: one agent at a time, no code reviews, no visual checks by agents; Hernán checks on his iPhone (T205, T216). (plan, standing rule of plans 015–016)
- 2026-11-14 plan: Work on branch `plan-017-mi-entrevista`; no merge into main, PR, deploy or real API spend without Hernán's explicit OK. (plan)

## Proposals (new scope)
- 2026-11-14 plan: Real pronunciation scores: record the answer and send it to a speech service with pronunciation assessment (e.g. Azure, `en-AU`), measured against the inferred pronunciation of the transcript.
- 2026-11-14 plan: Add Hernán's real attempts with 👍/👎 and «Tu nota» to the gold set once there are ~30 (the panel had none on 2026-11-14).
- 2026-11-14 plan: Stream the interviewer's line (or start TTS on the first sentence) if the measured turn latency feels slow.
- 2026-11-14 plan: Send herlingo attempts back to the HDDev panel (or the panel's to herlingo) so both count the same practice.

## Log
- 2026-11-14 11:25Z 💻 plan written from the design session (8 decisions in two rounds of questions); not approved yet
- 2026-11-14 11:33Z 💻 approved by Hernán ("Sí, apruebo")
- 2026-11-14 11:35Z 💻 resume on 💻 · branch plan-017-mi-entrevista from main @49563803 · plan checkout ../herlingo-entrevista · npm ci
- 2026-11-14 11:36Z 💻 T204 launched · attempt 1 · agent a3a8ec0ea5a338539 (plan checkout, no isolation)
