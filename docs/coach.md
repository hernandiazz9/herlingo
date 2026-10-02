# Prepárate — AI situation coach

The learner describes a real situation in Spanish ("pedir un granizado en Catania") and Claude
writes a preparation pack: guide, key phrases and a scripted role-play for the dialogue simulator.
Packs are saved on the device, so practising them again is free and works offline.

## Decision record

- **2026-10-01, Hernán:** docs/brief.md says "static export, no server runtime, no API keys". That
  still holds for the whole app **except Prepárate**, which gets one small backend: Vercel
  functions in `api/` that hold the secrets (Anthropic key, Upstash token), check access codes,
  enforce spending limits and keep a cost ledger. The site stays `output: "export"` in `out/`;
  every other section keeps working offline. Only generating needs internet.
- Model: `claude-sonnet-5-5`. Monthly cap 5 USD (owner-editable), 10 generations per day per
  code, 3 refinements per pack, description ≤ 500 characters.

## Architecture

```
out/                 static export (unchanged), served by Vercel as before
api/coach/*.ts       one Vercel function per endpoint (Web-standard `export default { fetch }`)
api/_lib/            shared server modules; the leading "_" keeps them from becoming routes
  model.ts           model id + price table (the only place for both)
  schema.ts          zod schemas: pack, learner profile, requests, interview (the only pack schema)
  claude.ts          the only Claude call: structured output, cached system prompt, fallbacks
  generators.ts      pack / interview generators (fake or real); prompts
  fake.ts            fake-mode fixtures and the silent mp3
  access.ts          x-coach-code check
  ledger.ts, store.ts  spend ledger and limits (Upstash Redis or in-memory)
  languages.ts       language metadata from content/<lang>/pack.json (voices, locale)
  config.ts, http.ts env, JSON responses, error handling
scripts/coach/dev.ts local server: app + /api on one origin (npm run dev:coach / start:coach)
```

- `src/` never imports zod at runtime, `@anthropic-ai/sdk`, `@upstash/redis` or anything under
  `api/`: an ESLint `no-restricted-imports` rule fails `npm run lint` otherwise. The client gets
  plain TypeScript types written from the schema below.
- Language-agnostic: the prompts get the language name, locale and voices from
  `content/<lang>/pack.json` (bundled into the functions with `includeFiles` in vercel.json).
  Fake-mode fixtures are test data keyed by language (placeholders for a language without one).
- `api/` uses relative imports only (Vercel's TypeScript build ignores `paths`).
- The service worker must never cache or intercept `/api/` (handled in `scripts/pwa/`, T45).

## Local development

```bash
npm run dev:coach     # http://localhost:3000: next dev (live reload) + /api/coach/*
npm run start:coach   # http://localhost:4173: built out/ (offline SW) + /api/coach/*  (npm run build first)
```

- Reads `.env.local` (copy `.env.example`). With no `ANTHROPIC_API_KEY`, or `COACH_FAKE=1`,
  every endpoint returns canned data with no network: a fixture pack, a 3-question interview, a
  silent mp3. Fake calls are still counted in the (in-memory) ledger and limits with realistic
  token numbers, so the usage panel and the 429s can be tested.
- With no `COACH_ACCESS_CODES` the dev server uses `dev-owner` (owner, named `hernan`) and
  `dev-guest`.
- No Upstash variables (or fake mode) → in-memory ledger, reset on restart.
- Changes under `api/` need a restart of the dev server (modules are loaded once).
- `PORT` changes the port; `next dev` itself runs on `PORT + 1` behind the proxy.

## API

All endpoints are JSON, require the header `x-coach-code: <code>`, and answer `Cache-Control:
no-store` (except TTS audio). Canonical URLs end with `/` (the site uses `trailingSlash`, so
Vercel 308-redirects `/api/coach/pack` to `/api/coach/pack/`; the client always calls the
trailing-slash form; the local server accepts both).

Errors: `{ "error": { "code": string, "message": string } }`. `message` is Spain Spanish UI copy:
show it as is.

| Status | `code` | When |
| --- | --- | --- |
| 400 | `bad_request` | Invalid body (too long, unknown language, disallowed voice, refine mismatch) |
| 401 | `unauthorized` | Missing or wrong code → the app asks for the code again |
| 403 | `forbidden` | `PUT /usage/` by a code that is not the owner |
| 405 | `method_not_allowed` | Wrong method |
| 429 | `daily_limit` | "Has llegado al límite de hoy. Vuelve mañana." |
| 429 | `budget` | "Se ha agotado el presupuesto de este mes." |
| 429 | `refine_limit` | "Ya has ajustado esta situación 3 veces." |
| 502 | `generation_failed` | Claude refused, hit `max_tokens`, returned invalid JSON, or API error. Nothing is stored |
| 503 | `not_configured` | No access codes or no Anthropic key in production |
| 503 | `tts_unavailable` | Real TTS not available → the client uses `speechSynthesis` |
| 500 | `internal` | Unexpected |

### `POST /api/coach/pack/`

```jsonc
{
  "lang": "it",                       // a content pack language
  "description": "pedir un granizado en Catania",   // 1–500 chars
  "profile": LearnerProfile,          // optional, see below
  "refine": {                         // optional: "Ajustar" / "Generar otra vez"
    "packId": "…",                    // = previous.id
    "instruction": "más formal",      // ≤ 200 chars; "" = a different version of the same situation
    "previous": Pack                  // the pack as stored on the device
  }
}
```

→ `200 { pack: Pack, usage: { costUsd, tokens: { input, output, cacheWrite, cacheRead },
remainingUsd, today: { used, limit } } }`.

A new pack gets a new `id` and `refinements: 0`; a refinement keeps the `id` and returns
`refinements = previous.refinements + 1` (the device replaces the stored pack). Every call (new
or refinement) takes one of the code's daily generations. The server counts refinements per
`packId` itself (and also trusts a higher `previous.refinements`): the 4th → 429 `refine_limit`.

### `POST /api/coach/interview/`

```jsonc
{ "lang": "it", "profile": LearnerProfile, "history": [ { "question": InterviewQuestion, "answer": "…" } ] }
```

`history` holds the answered questions (≤ 10). → `200 { done: false, question: InterviewQuestion,
turn: n, usage }` or `200 { done: true, assessment: Assessment, usage }`. The first step (empty
history) takes one daily generation; the following steps are only billed. After 10 answers the
server asks for the final assessment. Fake mode: 3 questions, then an A1 assessment.

```ts
type InterviewQuestion = {
  kind: "comprehension" | "reply" | "personal";
  prompt: string;      // Spanish, shown to the learner
  text?: string;       // target-language line to listen to / answer (native voice)
};
type Assessment = {
  level: "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  summary: string; strengths: string[]; weakPoints: string[]; facts: string[];  // Spanish
};
```

### `POST /api/coach/tts/`

`{ text (1–300 chars), voice }` → `200 audio/mpeg` (`Cache-Control: private, max-age=31536000,
immutable`). `voice` must be one of the `voices` of a content pack; packs carry the two to use in
`pack.voices`. Fake mode: a ~0.26 s silent mp3. Real edge-tts: T44 (until then 503
`tts_unavailable`; the client falls back to the device voice). Does not count as a generation.

### `GET /api/coach/usage/` and `PUT /api/coach/usage/`

```jsonc
{
  "month": "2026-10", "spentUsd": 0.29, "capUsd": 5, "remainingUsd": 4.71,
  "tokens": { "input": 14900, "output": 26350, "cacheRead": 22800, "cacheWrite": 0 },
  "packs": 7,                 // new packs this month (refinements excluded)
  "avgPackUsd": 0.029,
  "today": { "used": 10, "limit": 10 },   // the caller's code
  "isOwner": false,
  "mineUsd": 0.29             // spent this month by the caller's code
}
```

`PUT { capUsd: 0–1000 }` sets the monthly cap (owner only, else 403) and returns the same summary.
"Remaining" is cap − spent this month: Anthropic does not report a balance. The panel links to
the Anthropic billing page: https://platform.claude.com/settings/billing

## Pack schema

Validated on the server with zod (`api/_lib/schema.ts`, the only definition). Client types:

```ts
type Pack = {
  id: string;                 // uuid; kept by refinements
  createdAt: string;          // ISO date of this version
  lang: string;
  description: string;        // the learner's words (≤ 500)
  title: string;              // Spanish
  register: "formal" | "informal";
  voices: { native: string; learner: string };   // TTS voices: native turns + key phrases / learner options
  guide: { es: string }[];                        // 3–7 steps
  keyPhrases: { text: string; es: string; note?: string }[];   // 8–12, text in the target language
  dialogue: {
    title: string;
    turns: (                                       // 6–10
      | { id: string; speaker: "native"; name?: string; text: string; es: string }
      | { id: string; speaker: "learner"; prompt: string;          // Spanish: what to express
          options: { text: string; es: string; verdict: "correct" | "acceptable" | "wrong"; feedback: string }[] }  // 2–3
    )[];
  };
  refinements: number;        // 0–3
};
```

Turn ids are `t1…tn`, assigned by the server. `speaker` matches the static dialogues' format.

### Learner context (`profile`)

Built on the device, short, nothing beyond what the learner typed in "Sobre mí":

```ts
type LearnerProfile = {
  progress?: { lessonsDone: number; lessonsTotal: number; wordsLearned: number; xp: number; placement?: string | null };
  assessment?: Assessment & { date?: string };    // latest interview result
  about?: string;                                  // "Sobre mí" notes, ≤ 1000 chars
};
```

## Claude calls

`api/_lib/claude.ts`: `client.beta.messages.create` with `model: COACH_MODEL`, structured output
(`output_config.format` from the zod schema), `effort` low (interview) or medium (pack), the
system prompt as a cached block (byte-stable: per-request data goes in the user turn), and
`fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). The usage of every response is
written to the ledger before anything else, so refused or invalid answers are billed too; then
`stop_reason` `refusal` / `max_tokens` and invalid JSON become 502. Prompts: `generators.ts`
(first version; T43 refines them and measures the cost per pack).

## Limits and ledger

Checked in this order on every generation: access code → body → monthly budget (spent ≥ cap →
429) → daily generations of the code (`incr`; over 10 → refund + 429) → refinements of the pack
→ Claude. A failed generation refunds the daily slot and the refinement.

Money is integer micro-dollars (1 USD = 1 000 000), added with `incrby`. Cost of a call =
`input × input price + output × output price + cache write × write price + cache read × read
price` (per million tokens), using the price of the model that answered (`api/_lib/model.ts`:
source URL and review date at the top; an unknown model is priced at the most expensive entry).
Days and months are counted in `COACH_TIMEZONE` (default Europe/Madrid).

| Key (all prefixed `langlern:coach:`) | Value |
| --- | --- |
| `cap` | monthly cap, micro-USD (default `COACH_MONTHLY_CAP_USD` or 5) |
| `<YYYY-MM>:spend` / `<YYYY-MM>:spend:<name>` | spent this month, total / per code |
| `<YYYY-MM>:tokens:<input\|output\|cacheWrite\|cacheRead>` | tokens this month |
| `<YYYY-MM>:packs` / `<YYYY-MM>:packSpend` | new packs and their cost (for the average) |
| `<YYYY-MM-DD>:gen:<name>` | generations today by a code (expires after 2 days) |
| `refine:<packId>` | refinements of a pack (expires after 180 days) |

Upstash Redis REST when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set and fake
mode is off; otherwise an in-memory map (per process; local dev only). The `langlern:` prefix
lets the database be shared with another project.

## Environment variables

| Name | Required | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | production | Claude API key. Missing in local dev → fake mode; missing in production → 503 |
| `COACH_ACCESS_CODES` | yes | `name:code` pairs, comma-separated (`hernan:…,amigo:…`) |
| `COACH_OWNER` | yes | Name of the owner entry (may change the cap) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | production | Ledger database |
| `COACH_FAKE` | no | `1` = canned data everywhere |
| `COACH_MONTHLY_CAP_USD` | no | Initial cap (default 5) until the owner sets one |
| `COACH_DAILY_LIMIT` | no | Generations per day per code (default 10) |
| `COACH_TIMEZONE` | no | Time zone of days and months (default `Europe/Madrid`) |

Local: `.env.local` (git-ignored; `.env.example` lists the names). Production: Vercel project
settings. Never in the repo or in client code.

## Setup steps (Hernán)

1. **Anthropic:** in https://platform.claude.com create an API key for this project (Settings →
   API keys). Set a monthly **spend limit** in Settings → Limits (for example 10 USD) as a
   safety net above the app's own cap.
2. **Upstash:** create a Redis database at https://console.upstash.com (free plan, region near
   the Vercel functions, e.g. eu-west), or reuse an existing one (every key starts with
   `langlern:`). Copy the **REST URL** and **REST token**.
3. **Access codes:** pick one long random code per person (e.g. `openssl rand -base64 18`), and
   write them as `hernan:<code>,<name>:<code>`. `COACH_OWNER=hernan`.
4. **Vercel:** Project → Settings → Environment Variables (Production, and Preview if wanted):
   `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
   `COACH_ACCESS_CODES`, `COACH_OWNER`. Then deploy again (`npx vercel@latest --prod`): the
   functions in `api/coach/` deploy next to the static `out/` with the settings in vercel.json
   (`functions`: 60 s max duration, `content/*/pack.json` included).
5. On the phone, open Prepárate and enter your code once (stored on the device).
