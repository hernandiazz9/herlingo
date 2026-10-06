# Speech input (the learner speaking)

Recognition uses the browser Web Speech API only (no MediaRecorder, no getUserMedia, no server
transcription). It is optional: feature-detect with `canRecognize()` and keep self-evaluation, so a
lesson is never impossible without a microphone (docs/brief.md). Audio output is `@/lib/audio`.

## Engine (`src/lib/speech/`)

`src/lib/speech/` is the only code in `src/` that touches `SpeechRecognition` /
`webkitSpeechRecognition` (in `platform.ts`). Everything is imported from `@/lib/speech`.

| File | Contents |
| --- | --- |
| `session.ts` | `createListenSession()`, `cancelListening()`, `LISTEN_TIMINGS`, state types. |
| `messages.ts` | `ListenErrorKind`, `LISTEN_ERROR_MESSAGES` (the one Spanish message table), `listenErrorMessage()`. |
| `log.ts` | Diagnostics log: `readSpeechLog()`, `clearSpeechLog()`, `subscribeSpeechLog()`, `SPEECH_LOG_KEY`. |
| `platform.ts` | `canRecognize()`, `isStandalone()`, `browserFamily()`, the recognizer constructor. |
| `recognition.ts` | Legacy `listenOnce(locale, timeoutMs?)`, a thin wrapper over a session (deprecated). |
| `pause.ts` | "No puedo hablar ahora" pause. |

```ts
const session = createListenSession({ locale: "it-IT", mode: "phrase" });
const off = session.subscribe((s) => render(s)); // every change; s.interim = live text
session.start();   // from a tap (iOS asks for the mic the first time)
session.finish();  // stop and KEEP what was heard
session.cancel();  // stop and discard (settles as error "aborted")
const end = await session.result; // never rejects: { status: "done", result } | { status: "error", error }
```

Options: `locale` (required), `mode: "phrase" | "long"` (default `"phrase"`), and optional
overrides `silenceMs`, `maxMs`, `noSpeechMs`, `startTimeoutMs`, `endGraceMs`, `continuous`
(default false for `phrase`, true for `long`), `maxAlternatives` (default 5). `interimResults` is
always on. `session.timings` holds the effective values; `session.state` the current state.

### States

| Status | When |
| --- | --- |
| `idle` | Created, `start()` not called. |
| `starting` | `start()` called, the mic is not open yet. |
| `listening` | `onstart` / `onaudiostart` fired. `listeningAt` (epoch ms) is set: count down to `maxMs` from it. |
| `hearing` | `onspeechstart` or the first result. |
| `processing` | `finish()`, silence or the cap: `stop()` was called, waiting for the final result. |
| `done` | `result: { transcript, alternatives[], durationMs }`. `transcript` is never empty. |
| `error` | `error: { kind, message }`. |

Every state carries `interim` (all results so far joined, best alternative) and `listeningAt`.
The transcript joins **every** result (not only `results[0]`); `alternatives` are the distinct
full transcripts built from alternative 0, 1, 2… of each result, best first. When no result was
final yet, the interim text counts as the transcript.

`finish()` before `listening` behaves like `cancel()`. Only one session is live at a time:
starting a new one cancels the old (`cancelListening()` cancels whatever is live). The page going
to the background (`visibilitychange` → hidden) cancels the session.

### Timings

| | `phrase` | `long` |
| --- | --- | --- |
| `silenceMs`: silence after the last result that ends the session | 1500 | 2500 |
| `maxMs`: hard cap from `listening` | 10 000 | 45 000 |
| `noSpeechMs`: no speech since `listening` → error `no-speech` | 4000 | 4000 |
| `startTimeoutMs`: `starting` never reaches `listening` → error `start-timeout` | 5000 | 5000 |
| `endGraceMs`: after `stop()`, wait for `onend`, then `abort()` and settle with what was heard | 1500 | 1500 |

Silence is timed from the last `onresult` (Safari does not reliably fire `onspeechend`, so it is
ignored). If `onspeechstart` fires but no words arrive, the session stops after
`max(silenceMs, noSpeechMs)` and ends as `no-speech`. Every path settles: timers, `onend`, errors,
`finish()`, `cancel()`, hiding the page.

### Error kinds

| Kind | From |
| --- | --- |
| `unsupported` | No recognizer in this browser (e.g. Chrome on iPhone). |
| `not-allowed` | `not-allowed` or `service-not-allowed` (common in standalone PWAs on iOS; Siri & Dictation off). |
| `no-speech` | Nothing heard within `noSpeechMs`, the browser's `no-speech`, or the session ended empty. |
| `audio-capture` | No microphone, or another app is using it. |
| `network` | The recognition service could not be reached. |
| `start-timeout` | The mic never opened within `startTimeoutMs`. |
| `aborted` | `cancel()`, a newer session, or the page hidden. Screens show nothing for it. |
| `other` | Anything else (`language-not-supported`, `start()` throwing…). |

Each kind has one Spanish message with a concrete fix in `LISTEN_ERROR_MESSAGES`. An error that
arrives after words were heard settles as `done` with those words. The browser's own `aborted`
error is ignored (the timers or `onend` settle the session).

The legacy `listenOnce()` maps `audio-capture` and `start-timeout` to `other` and returns
`transcripts` = `alternatives` (so `transcripts[0]` is the full best transcript). A `timeoutMs`
becomes `maxMs`; above 10 s it uses the `long` mode.

## Mic UI (`src/components/speech/`)

The one mic UI over the engine; screens never create sessions themselves. Import from
`@/components/speech`.

| Export | What it is |
| --- | --- |
| `useListen({ locale, mode?, onResult?, onError?, ...timing overrides })` | One mic per screen. Returns `ListenControls`: `supported`, `status`, `active`, `interim`, `listeningAt`, `result`, `error`, `mode`, `timings`, `start()`, `finish()`, `cancel()`, `toggle()`, `reset()`. |
| `<MicButton listen size? idleLabel? disabled? />` | `size="lg"` (default): 96px round button with a countdown ring; `size="sm"`: 44px pill with text ("Dictar" → "Terminar · 38 s") for a text field. |
| `<LiveTranscript listen lang? idleHint? showResult? errorActions? align? />` | State line (`role="status"`, aria-live), live text, countdown bar + seconds, "Cancelar", and on error the engine message + "Reintentar" (+ `errorActions`). |
| `<SpeakPanel listen lang? idleLabel? showResult? errorActions? disabled? />` | `MicButton` + `LiveTranscript`, centred: for "say this phrase" screens. |
| `useListenRemaining(listen)` | Ms left before the cap while listening (null otherwise). |

Behaviour:

- Tap the mic → `start()` (call it in the tap handler: iOS needs the gesture). It stops by itself
  on silence; tapping again → `finish()` keeps what was said; "Cancelar" → `cancel()` discards.
  `start()` stops any playing audio first. Unmounting cancels the open session.
- `onResult(result)` gets `{ transcript, alternatives, durationMs }` once (never empty);
  `onError(error)` gets every error except `aborted` (cancel, a newer session, page hidden), which
  just returns to idle. Callbacks and options are read when the session starts/settles, so inline
  functions are fine.
- After an error the state stays `error` (message + "Reintentar") until `start()` or `reset()`;
  after words it stays `done` (`result`) until the next `start()`/`reset()`.
- Copy: starting "Abriendo el micrófono…", listening "Habla ahora", hearing "Te escucho…" + live
  text, processing "Un momento…". No sounds (the mic would capture them).
- Every component renders nothing when `supported` is false: the screen keeps its own fallback
  (self-evaluation, typing). Tokens only; pulses and the ring transition stop with
  `prefers-reduced-motion`; touch targets are at least 44px.

Usage per screen:

```tsx
// Lesson phrase (SpeakExercise): score in onResult (scoreHeard), feedback rendered by the screen.
const listen = useListen({ locale: meta.speechLocale, onResult: (r) => check(r.alternatives) });
<SpeakPanel listen={listen} lang={lang} errorActions={<SelfEvalLink />} />
// Dialogue turn (DialoguePlayer): same, onResult → bestOption(options, r.alternatives).
// Dictation into a textarea (DictationExercise): onResult: (r) => setAnswer(r.transcript)
<MicButton listen={listen} size="sm" /> <LiveTranscript listen={listen} lang={lang} align="start" />
// Prepárate (long Spanish answer appended): mode "long", locale "es-ES",
// onResult: (r) => setText((t) => (t.trim() ? `${t.trimEnd()} ${r.transcript}` : r.transcript))
```

## Diagnostics log: `lang-lern:speech-log`

Every started session appends one entry on settle. localStorage, `{ v: 1, entries: [...] }`,
oldest first, last 50 kept. Tolerant parsing: unreadable JSON or malformed entries are dropped.
Only this key is ever written or removed (`clearSpeechLog()`). No transcript text is stored.

```jsonc
{
  "at": "2026-10-06T09:12:03.120Z",   // start() time
  "locale": "it-IT",
  "mode": "phrase",
  "timings": { "listening": 420, "hearing": 1310, "processing": 3900, "end": 4210 }, // ms since start(); absent = not reached
  "reason": "silence",  // silence | finish | cap | ended | end-timeout | no-speech | start-timeout | cancel | replaced | hidden | error
  "outcome": "done",    // done | error
  "error": "not-allowed", // only on error: the ListenErrorKind
  "code": "service-not-allowed", // raw browser error code, when there was one
  "chars": 18,          // length of the transcript (0 on error)
  "alternatives": 3,
  "standalone": true,   // installed app vs browser tab
  "browser": "ios-safari" // ios-safari | ios-chrome | ios-other | android-chrome | android-other | edge | chrome | safari | firefox | other
}
```

## iOS notes

- `onspeechend` is unreliable and `onend` may never fire: hence silence from results and the
  end grace + `abort()`.
- `service-not-allowed` is common in the installed app: the mic must be allowed for Safari and
  Siri & Dictation must be on (Ajustes). The message for `not-allowed` says so.
- A second `getUserMedia` stream breaks recognition, so there is no level meter.
- Start from a user gesture; stop any playing audio first (the mic would capture it).

## Probar micrófono (`/microfono/`)

Diagnostics screen under Perfil (`NESTED` id `microphone`, linked from /perfil). Shows whether
recognition exists, installed app vs browser tab and the browser family; one try card for the
active pack's `speechLocale` and one for `es-ES` (`useListen` phrase mode + `<SpeakPanel>`), with
the steps lit live and, once settled, the per-state timings and end reason of that session's log
entry; the last 15 log entries in plain Spanish (newest first); "Copiar registro" (clipboard JSON
`{ key, copiedAt, supported, standalone, browser, entries }`, with a read-only textarea fallback
when the clipboard fails); "Borrar registro" (confirm, then `clearSpeechLog()`: only
`lang-lern:speech-log`); iPhone tips. The log is read live through `subscribeSpeechLog`.
