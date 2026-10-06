# Plan 007 — Voice: reliable, visible speech recognition

Status: done
Created: 2026-10-06
Base branch: plan-007-dictado-voz (worktree .claude/worktrees/plan-007, from main @ a5f51c1)
Goal: Make speaking to the app useful. Today the learner speaks and "nothing happens", doesn't know what is going on, or waits a long time: no live text, "Te escucho…" before the mic is really open, timeouts that only ask the recognizer to stop (can hang forever on iOS), four duplicated implementations, two scoring methods, errors that look like silence. This batch builds one robust speech engine on the browser Web Speech API (no server transcription), one shared mic UI with real states and live text, one scoring with word-by-word feedback, moves every screen onto them, and adds a "Probar micrófono" diagnostics screen.
Test command: npm run verify
Worktree setup: npm ci

## Now
- Updated: 2026-10-06 💻
- Writer: orchestrator (desktop)
- Branch: plan-007-dictado-voz (from main @ a5f51c1)
- Next step: all tasks done. Hernán: hand checks on iPhone (docs/speech.md), then merge plan-007-dictado-voz into main and deploy
- Needs Hernán: -

## Shared contract (all tasks read this)

- Read first: CLAUDE.md, docs/brief.md (lines on speech: feature-detect, fall back to self-evaluation, never make a lesson impossible without a mic), docs/content-guide.md (`numberWords`). UI copy is Spain Spanish with "tú"; code, comments and docs in English. Tokens only for colours, both themes, `pressable`, `prefers-reduced-motion`.
- **Engine (Hernán): browser Web Speech API only**, done well. No MediaRecorder, no getUserMedia, no server transcription, no new env vars or API keys. A second getUserMedia stream breaks recognition on iOS, so no level meter (orchestrator).
- **One engine module: `src/lib/speech/`** (framework-free) owns every `SpeechRecognition`/`webkitSpeechRecognition` use. After this plan nothing else in `src/` touches those globals (T84 adds an ESLint `no-restricted-globals`/syntax rule for it). Built in T76. Shape (names may be refined by T76, then documented in docs/speech.md and kept):
  - `createListenSession(options)` → a session object with `start()`, `finish()` (stop and KEEP what was heard), `cancel()` (discard), `subscribe(listener)`, and `state`. Options: `locale`, `mode: "phrase" | "long"`, optional overrides for `silenceMs`, `maxMs`, `noSpeechMs`, `continuous`.
  - States: `idle` → `starting` (start() called, mic not open yet) → `listening` (`onaudiostart`/`onstart` fired) → `hearing` (`onspeechstart` or first interim result) → `processing` (finish requested or silence detected; waiting for final result) → `done` `{ transcript, alternatives[], durationMs }` or `error` `{ kind, message }`. Every update carries the live `interim` text (interimResults = true).
  - Timing (Hernán, "según pantalla"): `phrase` = auto-stop after ~1.5 s of silence after speech, hard cap 10 s; `long` = ~2.5 s silence, cap 45 s. If no speech within ~4 s of `listening`, end with error kind `no-speech` ("No te oigo"). Silence is detected from the time of the last result event (Safari does not reliably fire `onspeechend`).
  - **Never hangs**: every path settles. After `finish()`/silence/cap, if `onend` has not fired within ~1.5 s, call `abort()` and settle with what was heard (interim counts as transcript when no final arrived). A `starting` that never reaches `listening` within ~5 s settles as error `start-timeout`. Only one session live at a time (starting a new one cancels the old). `visibilitychange` to hidden cancels cleanly. The full transcript joins every result (not only `results[0]`).
  - Error kinds: `unsupported`, `not-allowed` (incl. `service-not-allowed`), `no-speech`, `audio-capture` (no mic / in use), `network`, `start-timeout`, `aborted`, `other`. Each has one Spanish message with a concrete fix (e.g. not-allowed → how to allow the mic in iPhone Ajustes for Safari / the installed app). Messages live in one table in `src/lib/speech/`.
  - **Diagnostics log**: every session appends one entry (time, locale, mode, timings per state, end reason, error kind, transcript length, standalone or browser, user agent family) to on-device localStorage key `lang-lern:speech-log` (new key, last 50 entries, versioned `{ v: 1, entries }`, tolerant parsing; never touches other keys). No transcript text stored.
- **One mic UI: `src/components/speech/`** (built in T77): a `useListen(options)` hook over the engine and a `<MicButton>` + `<LiveTranscript>` (or one composed `<SpeakPanel>`). Interaction (Hernán): tap once to start, it stops by itself on silence, tap again to finish and keep what was said; a separate small "Cancelar" discards. Visible states with aria-live copy: starting "Abriendo el micrófono…", listening "Habla ahora", hearing = live text appearing, processing "Un momento…", plus a visible countdown/progress to the cap. No sounds (the mic would capture them). Errors show the engine message and a "Reintentar" button.
- **One scoring: `src/lib/speech/score.ts`** (built in T78) replaces Levenshtein ≥0.7 (`scoreSpeech`) and the dialogue Dice ≥0.6 `bestMatch`. Word-level alignment of expected vs heard over all alternatives (normalisation from `src/lib/exercises/normalize.ts`, accents/case/punctuation ignored, `numberWords` applied), returning per-word status (`ok` / `missing` / `wrong`), an overall score and a pass flag, and a `bestOption(options, heard)` for dialogue turns. One threshold constant, documented.
- **Feedback in "Dilo en voz alta" (Hernán: palabra por palabra)**: after speaking, show the expected phrase with each word marked ok/missing/wrong (tokens: success/error soft+deep, plus a non-colour cue such as underline or icon for accessibility), "He entendido: «…»", and buttons Reintentar and Escuchar la frase. Dialogues use the same word feedback when a spoken turn misses.
- **Errors in lessons (Hernán)**: a concrete message + Reintentar; the mic stays available; self-evaluation ("Prefiero evaluarme yo") stays as an option. One error never switches permanently to self-evaluation. Unsupported recognition still starts in self mode (brief.md).
- **Prepárate**: description and level-interview answers use `mode: "long"`, es-ES for Spanish answers, as today; text is appended to what is already typed, and stays editable.
- **"Probar micrófono" (T83)**: a screen under Perfil (route `/perfil/microfono/` or `/microfono/` registered in `NESTED` under Perfil in `src/lib/navigation.ts`), linked from /perfil. It shows support (API present, standalone vs Safari), lets the learner try the active pack's `speechLocale` and es-ES with the shared UI showing each state and its timing, lists the last attempts from the diagnostics log in plain Spanish, a "Copiar registro" button (clipboard, JSON) and "Borrar registro" (removes only `lang-lern:speech-log`). Includes short iPhone tips (allow the mic, Siri & Dictation must be on, check Ajustes).
- **Never lose on-device data**: no existing `lang-lern:*` key changes name or shape. The only new key is `lang-lern:speech-log`.
- **No new dependencies.** No automated tests (MVP). Each task's Done when is `npm run verify` plus its own checks; by-hand checks on an iPhone go to the plan's "Hand checks" list at the end for Hernán.
- Docs: T76 creates `docs/speech.md` (engine contract, states, timings, error kinds, log format, iOS notes); later tasks update their section. CLAUDE.md is edited only in T84.

## Tasks

## T76 — Speech engine: one reliable listen session
- Status: done
- Depends on: none
- Goal: Replace the two recognition helpers with the engine in the Shared contract: explicit states, live interim text, silence auto-stop, hard caps, guaranteed settle, error kinds with Spanish messages, diagnostics log. Old `listenOnce` stays exported as a thin wrapper over the new session so current screens keep working until they migrate.
- Context: src/lib/speech/recognition.ts, src/lib/speech/index.ts, src/components/dialogue/recognition.ts (for behaviour to absorb, do not delete it yet), src/components/coach/use-dictation.ts, docs/brief.md speech lines. Web Speech API on iOS Safari: `onspeechend` unreliable, `onend` may never fire, `service-not-allowed` common in standalone PWAs.
- Scope: may touch src/lib/speech/**, docs/speech.md (new) / must not touch src/components/**, content/, api/, CLAUDE.md
- Done when:
  - `npm run verify` → exit 0
  - `grep -rn "webkitSpeechRecognition\|SpeechRecognition" src --include=*.ts --include=*.tsx | grep -v "src/lib/speech/\|src/components/dialogue/recognition.ts"` → no output except existing callers of feature detection that import from @/lib/speech
  - docs/speech.md documents states, timings, error kinds and the `lang-lern:speech-log` format
- Outcome: createListenSession() in src/lib/speech/session.ts + messages.ts, log.ts, platform.ts; docs/speech.md → b21d6fb

## T77 — Shared mic UI: useListen, MicButton, LiveTranscript
- Status: done
- Depends on: T76
- Goal: The one mic UI in the Shared contract, over the engine: tap to start, auto-stop on silence, tap to finish, Cancelar, visible states with Spanish aria-live copy, live text, countdown to the cap, error + Reintentar. Both themes, reduced motion, 44px touch targets.
- Context: Shared contract (mic UI section), src/components/ui (Button, IconButton), src/components/icons.tsx, src/app/globals.css tokens, the current mic buttons in SpeakExercise, DialoguePlayer, SituationForm for look and feel.
- Scope: may touch src/components/speech/** (new), src/components/icons.tsx (new mic icons only), docs/speech.md (UI section) / must not touch the screens that use speech (they migrate in T79–T82), src/lib/speech/** except tiny fixes logged in DECISIONS
- Done when:
  - `npm run verify` → exit 0
  - `grep -rn "#[0-9a-fA-F]\{3,6\}\|text-white\|bg-black\|dark:" src/components/speech` → no output
- Outcome: useListen + MicButton, LiveTranscript, SpeakPanel in src/components/speech/ → 3d8c77f

## T78 — One speech scoring with word-by-word result
- Status: done
- Depends on: none
- Goal: `src/lib/speech/score.ts` per the Shared contract: word alignment over all alternatives, per-word ok/missing/wrong, score + pass, `bestOption()` for dialogue options; one documented threshold. Old `scoreSpeech` and the dialogue `bestMatch` keep working (re-implemented over the new scorer or left until their screens migrate).
- Context: src/lib/speech/index.ts (`scoreSpeech`, `SPEECH_MATCH_THRESHOLD`), src/lib/exercises/normalize.ts, the dialogue `bestMatch` (Dice ≥0.6) in src/components/dialogue/, docs/content-guide.md `numberWords`.
- Scope: may touch src/lib/speech/score.ts (new), src/lib/speech/index.ts (exports only), src/lib/exercises/normalize.ts (additive helpers only) / must not touch src/lib/speech/recognition.ts and the engine files T76 creates, src/components/**
- Done when:
  - `npm run verify` → exit 0
  - a throwaway script (not committed) run with `npx tsx` against real phrases from `@/lib/content` shows sensible per-word results for: exact match, one missing word, digits vs number words, accents dropped; report the cases in the final message
- Outcome: scoreHeard()/bestOption() in src/lib/speech/score.ts, word alignment, SPEECH_PASS_THRESHOLD 0.7 → 434e0f2

## T79 — Lessons "Dilo en voz alta" on the new engine
- Status: done
- Depends on: T76, T77, T78
- Goal: SpeakExercise uses the shared mic UI and scorer: live text while speaking, word-by-word feedback, Reintentar / Escuchar la frase, concrete errors with the mic still available, self-evaluation as an option, never a permanent switch to self mode on one error. Keep the try count / XP behaviour and "No puedo hablar ahora".
- Context: src/components/exercises/SpeakExercise.tsx, Shared contract (feedback, errors), docs/brief.md speech lines, @/lib/audio (speak() from the tap handler).
- Scope: may touch src/components/exercises/SpeakExercise.tsx and small new components under src/components/exercises/ or src/components/speech/ for the word feedback / must not touch other exercises, dialogue, coach, src/lib/speech/** engine (fixes → DECISIONS)
- Done when:
  - `npm run verify` → exit 0
  - `grep -n "listenOnce\|scoreSpeech" src/components/exercises/SpeakExercise.tsx` → no output
- Outcome: SpeakExercise on useListen + SpeakPanel + scoreHeard, new <WordFeedback> in src/components/speech → c2bcd2d

## T80 — Lessons dictation exercise on the new engine
- Status: done
- Depends on: T76, T77
- Goal: DictationExercise uses the shared mic UI (phrase mode, pack `speechLocale`): live text fills the answer as it is heard, stays editable, concrete errors + Reintentar. Checking stays `checkAnswer` with typo tolerance.
- Context: src/components/exercises/DictationExercise.tsx, Shared contract.
- Scope: may touch src/components/exercises/DictationExercise.tsx / must not touch SpeakExercise, dialogue, coach, src/lib/speech/** engine
- Done when:
  - `npm run verify` → exit 0
  - `grep -n "listenOnce" src/components/exercises/DictationExercise.tsx` → no output
- Outcome: DictationExercise on useListen (phrase, speechLocale), live text in a read-only textarea, editable after → 7a9b9bc

## T81 — Dialogues: speak your turn on the new engine
- Status: done
- Depends on: T76, T77, T78
- Goal: DialoguePlayer's learner turn uses the shared mic UI and `bestOption()`: live text, finishing keeps what was said (no more abort discarding speech), errors distinguished from silence, word feedback on a miss, tapping an option always works. Delete src/components/dialogue/recognition.ts.
- Context: src/components/dialogue/DialoguePlayer.tsx (lines ~150-176, ~305-322), src/components/dialogue/recognition.ts, docs/coach.md line ~399 (dialogue options said aloud), Shared contract.
- Scope: may touch src/components/dialogue/** / must not touch exercises, coach screens, src/lib/speech/** engine
- Done when:
  - `npm run verify` → exit 0
  - `test ! -f src/components/dialogue/recognition.ts` → exit 0
- Outcome: DialoguePlayer on useListen + SpeakPanel + bestOption, miss card with WordFeedback, recognition.ts deleted → c1ec2c2

## T82 — Prepárate dictation on the new engine
- Status: done
- Depends on: T76, T77
- Goal: SituationForm and LevelInterview use the shared mic UI in long mode (es-ES or pack locale as today): live text, appended to what is typed, editable, Cancelar, concrete errors. Remove the duplicate `DictateButton` and `use-dictation.ts` if nothing else uses it.
- Context: src/components/coach/SituationForm.tsx, src/components/coach/LevelInterview.tsx (~365-418, `SPANISH_LOCALE`), src/components/coach/use-dictation.ts, docs/coach.md (Client section).
- Scope: may touch src/components/coach/**, docs/coach.md (dictation lines only) / must not touch api/, src/lib/coach/**, exercises, dialogue, src/lib/speech/** engine
- Done when:
  - `npm run verify` → exit 0
  - `grep -rn "listenOnce\|DictateButton" src/components/coach` → no output
- Outcome: SituationForm + LevelInterview on useListen (long), use-dictation.ts and DictateButton removed → 6a1a92a

## T83 — "Probar micrófono" diagnostics screen under Perfil
- Status: done
- Depends on: T76, T77
- Goal: The screen in the Shared contract: support check, try target locale and es-ES with live states and timings, last attempts from `lang-lern:speech-log` in plain Spanish, Copiar registro, Borrar registro, iPhone tips. Linked from /perfil.
- Context: src/lib/navigation.ts (`NESTED`), src/app/perfil/ (how other Perfil links like /liga/ and /instalar/ are done), src/components/shell/PageHeader, Shared contract.
- Scope: may touch src/app/<new route>/**, src/app/perfil/** (one link), src/lib/navigation.ts (NESTED entry), src/components/speech/** (small additions), src/lib/speech/ log read/clear helpers / must not touch other screens, other `lang-lern:*` keys, src/lib/backup/**
- Done when:
  - `npm run verify` → exit 0
  - the new route exists in `out/` after build (`ls out/<route>/index.html`)
- Outcome: /microfono/ (NESTED under Perfil, card after Instalar), live try cards, last 15 log entries, Copiar/Borrar registro → 0bfa3e9

## T84 — Cleanup, guard rail and docs
- Status: done
- Depends on: T79, T80, T81, T82, T83
- Goal: Remove dead speech code (the `listenOnce` wrapper and `scoreSpeech` if unused, old thresholds), add an ESLint rule so only src/lib/speech/ may use SpeechRecognition / webkitSpeechRecognition, finish docs/speech.md, update CLAUDE.md (folder layout + a Speech convention line next to Audio), and write a "Hand checks (iPhone)" list in docs/speech.md for Hernán (installed app and Safari, each screen, permission denied, airplane mode, long silence). Never edit plans/.
- Context: eslint.config.* (existing restricted-imports rule for api/), CLAUDE.md, docs/speech.md, every file touched by T76–T83.
- Scope: may touch eslint config, CLAUDE.md, docs/speech.md, src/lib/speech/** (removals), any src/ file only to remove now-dead imports / must not touch behaviour of the migrated screens, content/, api/, plans/
- Done when:
  - `npm run verify` → exit 0
  - `grep -rn "SpeechRecognition" src --include=*.ts --include=*.tsx | grep -v "^src/lib/speech/"` → no output
  - `grep -rn "listenOnce\|scoreSpeech\|bestMatch" src` → no output
- Outcome: legacy recognition.ts/listenOnce/scoreSpeech/duplicate MicIcon removed, ESLint guard, docs/speech.md complete with Hand checks (iPhone), CLAUDE.md → a2d9580

## Decisions
- 2026-10-06: Engine = browser Web Speech API only, done well; server transcription later only if iPhone still fails (Hernán)
- 2026-10-06: Tap to start, auto-stop on silence, tap again to finish (Hernán)
- 2026-10-06: All four areas in scope: lesson speak, lesson dictation, dialogues, Prepárate (Hernán)
- 2026-10-06: "Probar micrófono" diagnostics screen under Perfil with an on-device log (Hernán)
- 2026-10-06: Timings per screen: phrase 1.5 s silence / 10 s cap, long 2.5 s / 45 s, 4 s no-speech (Hernán)
- 2026-10-06: Word-by-word feedback, one scoring for lessons and dialogues (Hernán)
- 2026-10-06: No self-recording / playback in this plan (Hernán) → Proposals
- 2026-10-06: Errors in lessons: concrete message + Reintentar, never a permanent self-eval switch (Hernán)
- 2026-10-06: No level meter (second mic stream breaks iOS recognition), no start/stop sounds, log keeps 50 entries without transcript text (orchestrator)
- 2026-10-06 T78: threshold 0.7 (3 of 4 words passes, 1–2 word phrases must be fully right); score = ok / (expected + 0.5 × extra words); one-letter slip in 5+ letter words = ok; joined/split words match ("dove" = "dov'è"); levenshtein exported from normalize.ts (agent)
- 2026-10-06 T76: engine files session.ts / messages.ts / log.ts / platform.ts (only platform.ts touches the recognition globals); legacy listenOnce keeps its shape (audio-capture, start-timeout → other; timeoutMs > 10 s → long mode); continuous false for phrase, true for long; speechstart without words → no-speech after max(silenceMs, noSpeechMs); finish() before listening = cancel(); an error after words heard settles as done; browser "aborted" ignored; extra overrides startTimeoutMs/endGraceMs/maxAlternatives; log stores raw browser error code (agent)
- 2026-10-06 T77: added composed <SpeakPanel>; cancel/aborted → idle without message; error/done states persist until start()/reset(); start() stops target audio first; components render nothing when unsupported (screens keep their fallback); "hearing" copy "Te escucho…"; countdown ring on big button, "· N s" on small pill + ProgressBar "Tiempo para hablar"; new MicIcon/MicOffIcon/MicStopIcon in icons.tsx (agent)
- 2026-10-06 orchestrator: duplicate MicIcon in src/components/exercises/shared.tsx and use-dictation.ts retirement → T79/T80 must not edit shared.tsx (parallel), T82 retires use-dictation, T84 removes the shared.tsx MicIcon
- 2026-10-06 T80: textarea read-only with live text while the mic is open, final transcript (spellNumbers) replaces the answer and is editable; Comprobar/Enter disabled while listening; mic UI hidden once answered; old custom notices replaced by engine messages (agent)
- 2026-10-06 orchestrator: T82 launched before T81 so T81 can reuse the word-feedback component T79 creates
- 2026-10-06 T79: only scored results count as tries (MAX_TRIES 2, same XP); errors don't count and never switch to self mode; miss card "Casi. Te queda un intento." + word feedback + Reintentar / Escuchar la frase, stays after answering; "Prefiero evaluarme yo" always shown in mic mode, self mode gets "Usar el micrófono" to go back; missing words struck through, wrong words wavy underline with heard word below, per-word aria labels (agent)
- 2026-10-06 T82: dictated text appended and cut at the field limit; mic disabled at the limit; submit / "No lo sé" cancel an open session; dictation clears an earlier generation error like typing; labels "Dictar en español" / "Dictar en <idioma>" kept; added a "Dictation" bullet to docs/coach.md Client (agent)
- 2026-10-06 T81: SpeakPanel under the options ("O dilo en voz alta" / "Toca y dilo otra vez" after a miss); miss card "He oído «…», que no se parece bastante… La más cercana:" + WordFeedback of the closest option; tapping an option resets the mic first so a tap always works; miss card hidden while the mic is open (agent)
- 2026-10-06 T83: route /microfono/ (top level like /liga/), NESTED "microphone"; try cards in phrase mode show the newest log entry's timings once settled; Copiar registro = JSON {key, copiedAt, supported, standalone, browser, entries} with a textarea fallback; Borrar registro asks inline confirmation; live log hook in src/app/microfono/use-speech-log.ts (agent)
- 2026-10-06 T84: ESLint guard = no-restricted-globals + no-restricted-syntax on identifiers/strings starting with SpeechRecognition/webkitSpeechRecognition, src/** except src/lib/speech/**; docs/speech.md gains Scoring, Screens and Hand checks (iPhone, 14 checks) (agent)

## Proposals (new scope)
- 2026-10-06: "Grabarme": record your voice and play it next to the native audio (separate from recognition) (Hernán, later)
- 2026-10-06: Server transcription fallback (Whisper/Deepgram via a Vercel function) if the iPhone engine is still unreliable after this plan (orchestrator)
- 2026-10-06 T78: put scoring + threshold in docs/speech.md; remove scoreSpeech/SPEECH_MATCH_THRESHOLD/bestMatch after T79/T81 (agent; covered by T84)
- 2026-10-06 T84: unused third MicIcon in src/components/phrasebook/icons.tsx (agent)

## Log
- 2026-10-06 13:45 T76 launched · attempt 1 · agent aed9f2545c1076095
- 2026-10-06 13:45 T78 launched · attempt 1 · agent abd7c09a2e9924704
- 2026-10-06 13:41 T78 done · branch worktree-agent-abd7c09a2e9924704 → 434e0f2
- 2026-10-06 13:42 T76 done · branch worktree-agent-aed9f2545c1076095 → b21d6fb
- 2026-10-06 13:43 T77 launched · attempt 1 · agent a2c08c3ec5a570f6f
- 2026-10-06 13:46 T77 done · branch worktree-agent-a2c08c3ec5a570f6f → 3d8c77f
- 2026-10-06 13:47 T79 launched · attempt 1 · agent a8ab439f1fa452413
- 2026-10-06 13:47 T80 launched · attempt 1 · agent ac77027cde8a91689
- 2026-10-06 13:49 T80 done · branch worktree-agent-ac77027cde8a91689 → 7a9b9bc
- 2026-10-06 13:50 T82 launched · attempt 1 · agent a08696eeef89402db
- 2026-10-06 13:50 T79 done · branch worktree-agent-a8ab439f1fa452413 → c2bcd2d
- 2026-10-06 13:51 T81 launched · attempt 1 · agent a54c724831e21baa1
- 2026-10-06 13:52 T82 done · branch worktree-agent-a08696eeef89402db → 6a1a92a
- 2026-10-06 13:53 T83 launched · attempt 1 · agent af91ad46e4780737f
- 2026-10-06 13:54 T81 done · branch worktree-agent-a54c724831e21baa1 → c1ec2c2
- 2026-10-06 13:59 T83 done · branch worktree-agent-af91ad46e4780737f → 0bfa3e9
- 2026-10-06 13:59 T84 launched · attempt 1 · agent af24839d542e54522
- 2026-10-06 14:03 T84 done · branch worktree-agent-af24839d542e54522 → a2d9580
- 2026-10-06 14:04 plan done · npm run verify pass on plan-007-dictado-voz
