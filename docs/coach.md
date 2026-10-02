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
  tts.ts             neural voice: edge-tts through `msedge-tts` (see "Voice (TTS)")
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

`{ text (1–300 chars, trimmed), voice }` → `200 audio/mpeg` (`Cache-Control: private,
max-age=31536000, immutable`: a line never changes, the client caches it by voice + text).
`voice` must be one of the `voices` of a content pack, else 400; packs carry the two to use in
`pack.voices`. The mp3 is read by that Microsoft neural voice (see "Voice (TTS)"); if the voice
service fails → 503 `tts_unavailable` and the client falls back to the device voice
(`speechSynthesis`). Fake mode: a ~0.26 s silent mp3, no network. Requires the code; does not
count as a generation and costs nothing.

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

## Client (`src/lib/coach/`)

Framework-free modules exported from `@/lib/coach`; React hooks in `@/lib/coach/use-coach`. The
types (`CoachPack`, `CoachUsage`, `CoachAssessment`, `LearnerContext`, `InterviewQuestion`…) are
written by hand from the schemas above; `COACH_LIMITS` mirrors the server's `LIMITS`. Change one
side, change the other.

| Module | Contents |
| --- | --- |
| `api.ts` | `generatePack(lang, description)`, `refinePack(previous, instruction)`, `interviewStep(lang, history)`, `fetchUsage()`, `updateMonthlyCap(capUsd)`, `checkAccessCode(code)`, `fetchSpeech(text, voice)`; `CoachApiError`, `toCoachApiError(e)` |
| `access.ts` | the access code on the device (`getAccessCode`, `setAccessCode`, `clearAccessCode`) |
| `packs.ts` | "Mis situaciones": `getSavedPacks`, `getSavedPack`, `savePack`, `replacePack`, `deletePack`, `pruneCoachAudio` |
| `profile.ts` | "Sobre mí" + interview results (`setAbout`, `saveAssessment`, `clearAssessments`) and `buildLearnerContext(lang)` |
| `usage.ts` | last usage summary seen (`getStoredUsage`), `formatUsd(3.2)` → "3,20 $" |
| `audio.ts` | generated playables: `packLine(pack, text, speaker)`, `packPlayables`, `questionPlayable`, `cachePackAudio`, `coachVoices` |
| `parse.ts`, `store.ts` | hand-written shape checks; storage keys and the change event |

- **Requests** go to `/api/coach/<endpoint>/` on the same origin with the stored code in
  `x-coach-code`, `cache: "no-store"` and a 75 s timeout. `generatePack`, `refinePack` and
  `interviewStep` add `profile: buildLearnerContext(lang)` themselves (progress numbers from
  `@/lib/progress`: lessons done/total, words learned, XP, placement test date and lessons it
  marked; the latest assessment; the "Sobre mí" notes). Responses are shape-checked; nothing is
  saved automatically: call `savePack` / `replacePack` / `saveAssessment`.
- **Errors**: every call rejects with a `CoachApiError` (`kind`, `status`, `code`, `message`).
  `message` is Spain Spanish, the server's own when it sent one: show it as is.

  | `kind` | When | UI |
  | --- | --- | --- |
  | `offline` | `navigator.onLine` false, server unreachable, or timeout | offline message; saved packs still work |
  | `unauthorized` | 401 or no code stored (`code: "no_code"`) | the stored code is forgotten on a 401, so `useCoachAccess().code` turns null: show the code screen |
  | `limit` | 429 (`daily_limit`, `budget`, `refine_limit`); `refinePack` also refuses a 4th refinement without a request | show the message, disable the action |
  | `failed` | 502: Claude could not produce a valid answer | "try again" |
  | `aborted` | the caller's `AbortSignal` fired | show nothing |
  | `other` | 400, 403, 5xx, 404 (no backend: "Prepárate no está disponible en este servidor."), invalid response | show the message |

- **Storage** (localStorage, versioned `{ v: 1, … }`, tolerant parsing: a corrupt value or an
  invalid pack is dropped, never thrown; one change event `lang-lern:coach-change`):

  | Key | Value |
  | --- | --- |
  | `lang-lern:coach:access` | `{ v, code }` (all languages) |
  | `lang-lern:coach:usage` | `{ v, at, usage }`: last `GET /usage/`, patched by each generation's `usage`; forgotten with the code |
  | `lang-lern:coach:packs:<lang>` | `{ v, packs }`: saved packs, newest first, unique ids |
  | `lang-lern:coach:profile:<lang>` | `{ v, about, assessments }`: notes (≤ 1000) and the last 5 assessments with their date, newest first |

- **Hooks** (`useSyncExternalStore` on the raw value, like `useProgress`; empty on the server and
  during hydration):

  | Hook | Returns |
  | --- | --- |
  | `useCoachAccess()` | `{ code, hasCode, verify(code), clear() }`: `verify` checks the code (`GET /usage/`) and stores it when valid |
  | `useSavedPacks(lang)` | `{ packs, get(id), save(pack), replace(pack), remove(id) }` |
  | `useLearnerProfile(lang)` | `{ profile: { about, assessments }, latest, setAbout, saveAssessment, clearAssessments }` |
  | `useCoachUsage({ refreshOnMount = true })` | `{ usage, updatedAt, loading, error, refresh(), setCap(capUsd) }`: the stored summary, refreshed on mount when a code is stored |

### Generated audio

Generated lines play through `speak()` from `@/lib/audio`, like content audio, and still start
from a user gesture. A generated playable is a plain `Playable` whose `audioKey` is
`gen:<64-bit hash of voice + text>` (`generatedPlayable(text, voice)` in
`src/lib/audio/generated.ts`; the coach helpers pick the voice: `pack.voices.native` for key
phrases and native turns, `pack.voices.learner` for learner options, the pack language's first
voice for interview lines). `speak()` then:

1. plays the object URL kept in memory (synchronously, inside the gesture), else
2. reads the mp3 from Cache Storage `lang-lern-coach-audio` (entries `/coach-audio/<hash>.mp3`,
   never requested over the network), else
3. fetches it once from `POST /api/coach/tts/` (skipped offline or without a code) and caches it,
4. and falls back to `speechSynthesis` in the pack's `speechLocale` on any failure (no mp3, TTS
   503/400/401, playback error). Cases 2–4 start after an async step on the audio element that
   the first tap unlocked (iOS), like the existing fallback.

`savePack` and `replacePack` download every line of the pack in the background
(`cachePackAudio`, 3 at a time, deduplicated with taps in flight), so a saved pack plays offline.
`replacePack` and `deletePack` delete cached mp3s no saved pack uses any more. Cache Storage only
exists in secure contexts (https, localhost): over plain http on a LAN address nothing is cached
and each line is fetched again per session. After testing in fake mode (silent mp3s), clear the
site data or call `clearGeneratedAudio()` from `@/lib/audio` before testing real voices on the
same origin.

### Service worker

`out/sw.js` (scripts/pwa/sw.template.js) returns early for every `/api/` request, so the
backend is never cached or intercepted, and its `activate` step keeps the caches in `KEEP`
(`scripts/pwa/build.ts` injects `GENERATED_AUDIO_CACHE` from `src/lib/audio/generated.ts`): the
coach audio survives every app update.

## Claude calls

`api/_lib/claude.ts`: `client.beta.messages.create` with `model: COACH_MODEL`, structured output
(`output_config.format` from the zod schema), `effort` low (interview) or medium (pack), the
system prompt as a cached block (byte-stable: per-request data goes in the user turn), and
`fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). The usage of every response is
written to the ledger before anything else, so refused or invalid answers are billed too; then
`stop_reason` `refusal` / `max_tokens` and invalid JSON become 502. Prompts: `generators.ts`
(first version; T43 refines them and measures the cost per pack).

## Voice (TTS)

`api/_lib/tts.ts` reads a line with Microsoft Edge's read-aloud voices (edge-tts: free, no key,
a WebSocket to `speech.platform.bing.com`), the same service `npm run audio` uses for the static
content.

- **Same voices and settings as `npm run audio`** (`scripts/audio/tts.py`, Python edge-tts
  defaults): output `audio-24khz-48kbitrate-mono-mp3`, rate `+0%`, pitch `+0Hz`, volume `+0%`,
  text escaped the same way (control characters → spaces, `& < >` as entities; the input is
  never read as SSML). The voices are the content pack's: native turns and key phrases use
  `pack.voices.native`, learner options `pack.voices.learner` (different, like the static
  dialogues). The endpoint accepts only voices some `content/<lang>/pack.json` declares.
- One WebSocket per request (no shared state between invocations), 10 s timeout per attempt, 2
  attempts, empty audio counts as a failure. Then 503 `tts_unavailable` (logged as
  `[coach] edge-tts failed`) and the client plays the line with the device voice. Worst case
  ≈ 20 s, inside the functions' 60 s.
- The service is unofficial (no SLA, no key): Microsoft may throttle it or change the handshake.
  If it stops working everywhere, update `msedge-tts` (`npm i msedge-tts@latest`), the same fix
  as bumping `edge-tts` in `scripts/audio/requirements.txt`. The app keeps working meanwhile
  (device voice).
- Locally the real voice needs fake mode off (`ANTHROPIC_API_KEY` set in `.env.local`, no
  `COACH_FAKE`); fake mode answers the silent mp3. In production it needs no env var.

**Package: `msedge-tts`** (MIT, ^2.0.8). Chosen on 2026-10-02 among the Node edge-tts ports:

| Package | Verdict |
| --- | --- |
| `msedge-tts` 2.0.8 | **Chosen.** Actively maintained (7 releases in 2026, last 2026-09-24; ~230 k downloads/month), returns a `Readable` (no temp files in the function), reports a socket closed before `turn.end` as an error instead of a truncated mp3, Sec-MS-GEC token built in. Cost: 39 packages / ~5 MB installed (axios is only used by `getVoices()`, never called), ~1.5 MB bundled; fine for a function |
| `node-edge-tts` 1.2.10 | Smaller (22 packages / 1.7 MB, most of it `yargs` for its CLI) and very popular, but it only writes to a file path (temp file per request), a timeout leaves the socket open, a dropped socket hangs until the timeout; last release 2026-02 |
| `edge-tts-universal`, `@travisvn/edge-tts` | AGPL-3.0 |
| `@andresaya/edge-tts`, `edge-tts` (npm) | GPL-3.0 / CC BY-NC-SA |
| `edge-tts-node` | Stale fork of `msedge-tts` (last release 2024) |

**Verified on 2026-10-02 (cloud session, outbound through the egress proxy):** the service is
reachable (WebSocket upgrade 101). `npm run dev:coach` with fake mode off + curl: 200
`audio/mpeg`, `file` → "MPEG ADTS, layer III, v2, 48 kbps, 24 kHz, Monaural" (the same format as
`public/audio/`), real speech (4.75 s for a 70-character line, ~1–2 s per request, 5 parallel
requests fine, a 300-character line 96 KB); the same three lines as static content files came
out with the same byte length (the service is not byte-for-byte deterministic between runs).
Disallowed voice / 301 characters / blank text → 400; no or wrong code → 401; unknown voice
name, DNS failure and a hung connection → 503 (the hung case after 2 × 10 s), the process stays
healthy. Fake mode with DNS blocked: 200, 4170-byte silent mp3, no lookups. The esbuild bundle
of `api/coach/tts.ts` run with production env (no `COACH_DEV`, no Anthropic key) → 200 mp3.

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
