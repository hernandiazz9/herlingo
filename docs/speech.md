# Speech input (the learner speaking)

Recognition uses the browser Web Speech API only (no MediaRecorder, no getUserMedia, no server
transcription). It is optional: feature-detect with `canRecognize()` and keep self-evaluation, so a
lesson is never impossible without a microphone (docs/brief.md). Audio output is `@/lib/audio`.

## Engine (`src/lib/speech/`)

`src/lib/speech/` is the only code in `src/` that touches `SpeechRecognition` /
`webkitSpeechRecognition` (in `platform.ts`). ESLint enforces it: outside `src/lib/speech/`,
`no-restricted-globals` and `no-restricted-syntax` reject any identifier or string starting with
`SpeechRecognition` / `webkitSpeechRecognition` (globals, `window.…`, `"…" in window`, DOM types).
Screens use `useListen` from `@/components/speech`; framework-free code uses `createListenSession`.
Everything else is imported from `@/lib/speech`.

| File | Contents |
| --- | --- |
| `session.ts` | `createListenSession()`, `cancelListening()`, `LISTEN_TIMINGS`, state types. |
| `messages.ts` | `ListenErrorKind`, `LISTEN_ERROR_MESSAGES` (the one Spanish message table), `listenErrorMessage()`. |
| `log.ts` | Diagnostics log: `readSpeechLog()`, `clearSpeechLog()`, `subscribeSpeechLog()`, `SPEECH_LOG_KEY`. |
| `platform.ts` | `canRecognize()`, `isStandalone()`, `browserFamily()`, the recognizer constructor. |
| `score.ts` | `scoreHeard()`, `bestOption()`, `SPEECH_PASS_THRESHOLD` (see "Scoring"). |
| `pause.ts` | "No puedo hablar ahora": speaking exercises off for `SPEAKING_PAUSE_MINUTES` (15) on this device (existing key `lang_lern:speaking-paused-until`). |

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
| `<WordFeedback words lang? heard? />` | The expected phrase word by word from `scoreHeard(...).words` (ok / missing / wrong) + "He entendido: «…»". Lessons and dialogues. |

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

## Scoring (`src/lib/speech/score.ts`)

One scoring for lessons and dialogues (it replaced the old Levenshtein ≥ 0.7 `scoreSpeech` and the
dialogue Dice ≥ 0.6 match).

- `scoreHeard(alternatives, expected | expected[], numberWords?)` → `SpeechScore`
  `{ words, score, passed, heard, expected, extra }`: the best result over every alternative heard
  and every accepted text. Each expected word (as written, punctuation kept) is `ok`, `missing`
  (nothing heard in its place) or `wrong` (`heard` = what was said instead).
- `bestOption(options, alternatives, numberWords?)` → `{ index, result }`: the dialogue option said;
  `index` = -1 when even the best one does not pass, `result` is still its word feedback.
- Word-level alignment with `normalizeAnswer` from `src/lib/exercises/normalize.ts`: case,
  punctuation and accents ignored, apostrophes split words ("dov'è" = "dov è"). Digits on both sides
  are written out with the pack's `meta.numberWords` ("40" heard = "quaranta").
- Words written together or apart match ("buon giorno" = "buongiorno", "dove" = "dov'è").
- A one-letter slip in a word of 5+ letters counts as `ok` (usually the recogniser's spelling).
- Score = `ok` words / (expected words + 0.5 × extra words heard), in [0, 1].
- **`SPEECH_PASS_THRESHOLD` = 0.7**, the only threshold: 3 of 4 words right passes, 2 of 3 does
  not; a one- or two-word phrase must be fully right.

## Screens

| Screen | Mode, locale | Behaviour |
| --- | --- | --- |
| Lesson "Dilo en voz alta" (`SpeakExercise`) | `phrase`, pack `speechLocale` | `<SpeakPanel>`; `scoreHeard` on the result. Only scored attempts count as tries (2); a miss shows "Casi. Te queda un intento." + `<WordFeedback>` + Reintentar / Escuchar la frase. Errors show the engine message + Reintentar and never switch to self mode; "Prefiero evaluarme yo" is always offered, self mode offers "Usar el micrófono". No recognizer → starts in self mode. |
| Lesson dictation (`DictationExercise`) | `phrase`, pack `speechLocale` | Small `<MicButton>` + `<LiveTranscript>` by the textarea: read-only with the live text while the mic is open, then the final transcript (digits spelled) replaces the answer and stays editable. Comprobar / Enter disabled while listening; mic hidden once answered. |
| Dialogue turn (`DialoguePlayer`) | `phrase`, pack `speechLocale` | `<SpeakPanel>` under the options ("O dilo en voz alta"); `bestOption` picks the option. A miss shows what was heard and `<WordFeedback>` of the closest option; tapping an option resets the mic first. |
| Prepárate situation (`SituationForm`) | `long`, `es-ES` | "Dictar en español": text appended to what is typed, cut at the field limit, editable. Submit / "No lo sé" cancel an open session. |
| Prepárate level interview (`LevelInterview`) | `long`, `es-ES` or the pack locale | Same as the situation, per answer ("Dictar en <idioma>"). |
| Probar micrófono (`/microfono/`) | `phrase`, pack locale and `es-ES` | Below. |

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

## Hand checks (iPhone)

Para Hernán, en su iPhone. Hazlas dos veces: con la **app instalada** (pantalla de inicio) y en
**Safari**. Si algo falla, abre Perfil → Probar micrófono → "Copiar registro" y pégalo en el chat.

- [ ] **Probar micrófono** (Perfil): dice si hay reconocimiento y si es app instalada o Safari; las
      dos pruebas (idioma del curso y español) muestran cada paso (Abriendo el micrófono…, Habla
      ahora, Te escucho…, Un momento…) con sus tiempos; el registro lista los intentos.
- [ ] **Dilo en voz alta** (lección): dila bien → aprobada; dila mal → palabras marcadas, "He
      entendido: «…»", Reintentar y Escuchar la frase funcionan; "Prefiero evaluarme yo" sigue ahí.
- [ ] **Dictado** (lección): el texto aparece mientras hablas, luego queda en el campo y se puede
      editar; Comprobar no se activa mientras escucha.
- [ ] **Diálogo**: di una opción → la elige; di otra cosa → "He oído «…»" y la opción más cercana
      palabra por palabra; tocar una opción sigue funcionando.
- [ ] **Prepárate, situación**: "Dictar en español" añade el texto al que ya había escrito; se edita.
- [ ] **Prepárate, entrevista de nivel**: igual en cada respuesta, en español y en el idioma del curso.
- [ ] **Permiso denegado**: deniega el micrófono (Ajustes → Safari → Micrófono, o al preguntar) →
      mensaje claro de cómo permitirlo + Reintentar; la lección sigue (evaluarte tú).
- [ ] **Modo avión**: el mensaje dice que no hay conexión (o lo que pase, anótalo); nada se cuelga.
- [ ] **Quedarte callado**: toca el micro y no digas nada → a los ~4 s "No te oigo" + Reintentar.
- [ ] **Pausa larga**: habla, calla ~2 s (frase) o ~3 s (Prepárate) → termina solo con lo dicho.
- [ ] **Terminar antes**: toca el micro otra vez mientras hablas → se queda lo dicho.
- [ ] **Cancelar**: toca "Cancelar" → no se guarda nada y vuelve al estado inicial.
- [ ] **Límite**: habla sin parar → se corta a los 10 s (frase) o 45 s (Prepárate); la cuenta atrás se ve.
- [ ] **Tema claro y oscuro**: el botón, la cuenta atrás y las palabras marcadas se leen bien en los dos.
