# Modo deporte — audio-only episodes

Decided with Hernán on 2026-10-13 (interview; plan 016, origin: docs/ideas.md §3). He rides a
bike or runs: he wants to learn a situation **by ear only**, phone locked in the pocket, without
touching it and **without talking back**. An **episode** is an audio guide through one situation
("ir al supermercado"): a Spain-Spanish narrator explains each step and the target-language lines
sound several times. It plays as **one continuous mp3**, so it keeps playing with the screen
locked.

Not «Escuchar todo» (docs/coach.md "Modo rápido"): that reads a short route line → meaning,
chained clip by clip, and stops when the iPhone locks (Hernán, 2026-10-13).

## Decisions

| Topic | Decision |
| --- | --- |
| Sources | (1) **AI**: the learner describes the situation in free text → `POST /api/coach/episode/` writes the script. (2) **Free, no AI**: episodes built on the device from the active pack's **dialogues** ("De la app") and from the learner's **saved Modo rápido routes**, with fixed narration. One model, one compiler, one player for all three. |
| Listening only | No pauses to repeat aloud, no microphone, no taps needed. Short gaps only (below). |
| Length | 8–12 minutes. The AI writes 12–16 steps in 3–5 parts. For a long ride: «Escuchar seguidos» (on each home section with 2 or more episodes) joins the section's **fully downloaded** episodes, in its order, into one file; the others are left out and counted (it never downloads a whole section). |
| Order | By speaker. **Learner lines**: the narrator first says in Spanish what you want to say (the context), then the target line **normal → slow → normal**, then its Spanish meaning. **Native lines**: the narrator announces them ("En la caja te preguntan:"), the target line **twice** at normal speed, then "Significa: …", then the tip if any. |
| Narrator | "Breve + trucos": one short context sentence per step; sometimes a tip (a key word, another form you will hear, a local custom). One Spain-Spanish neural voice: the narrator of gloss language `es` (`es-ES-AlvaroNeural`, `NARRATOR_VOICES` / `COACH_NARRATORS`, already accepted by `/api/coach/tts/`). |
| Variants | 0–2 per step, each with a short narrator cue. Learner variants swap one word or offer another useful answer ("El azúcar:" → "Dov'è lo zucchero?"); native variants are other ways they may say it. Each variant sounds twice, then its meaning. |
| Final scene | At the end: "Y ahora, la escena entera, sin traducción." and every step's main line in order, once, normal speed. |
| Slow | Rendered by the voice itself at rate **−30 %** (`/api/coach/tts/` with `slow: true`), never `playbackRate` (one file has one rate). The "Audio lento" setting does not apply to episodes. |
| Gaps | 400 ms between repetitions of the same line; 1 s between blocks (narrator ↔ target, step ↔ step); 1.5 s before a part title and before the final scene. Constants in one place. |
| Playback | The device joins every clip of the episode **byte by byte** into one mp3 (all lines are edge-tts `audio-24khz-48kbitrate-mono-mp3`) plus pre-encoded silent frames for the gaps, and plays it on the shared, gesture-unlocked `<audio>` element. One chapter per step. Spike 2026-10-13 on the Mac: 2 min joined from real edge-tts clips (narrator, two Italian voices, slow at −30 %) decode with no errors, ~6 KB/s (10 min ≈ 3.6 MB). |
| Lock screen | Media Session: title = episode title, artist "Modo deporte", the app icon; play/pause; **next track = next step, previous track = start of this step** (again within 3 s of its start: the previous step); seek (`seekto`); `setPositionState`. No seek ±15 s (2026-10-13): with those handlers iOS shows ±15 s buttons instead of previous/next track, the steps. |
| Offline | Opening or saving an episode downloads its clips (progress "Preparando el audio… 34/120"); the joined file is rebuilt from cached clips each time (not stored). While the page is hidden (screen locked, app in the background: iOS fails every fetch at once there although scripts still run) preparation pauses: no clip starts, and a clip that failed while hidden is fetched again once the page is visible, without counting as a failure (T199, 2026-10-14: an episode prepared while the phone locked ended with 74 missing clips). A Screen Wake Lock (`keepScreenAwake`, feature-detected, errors ignored, asked again when the page comes back) keeps the screen on while an episode prepares or completes. A clip that cannot be fetched while visible after one retry is left out and counted; the player then retries the missing clips by itself when the page becomes visible or the browser goes back online (only while not playing) and offers «Completar audio» ("Faltan 3 audios. Toca «Completar audio» para descargarlos."; offline "Sin conexión: faltan 3 audios. Se completarán cuando vuelvas a tener internet."). A completed file loads at the start of the step that was current (from the start after the end); one completed while playing waits for the next pause. |
| Access | Screen `/deporte/` (nested section `sport`, title "Modo deporte", parent tab `play`), reached from a card on Jugar and from a «🏃 Modo deporte» button on every saved route. Needs the Prepárate access code (narrator and slow lines come from `/api/coach/tts/`) and `coachAvailable(lang)`; without a code, Prepárate's `AccessCard`. The ⚡ is hidden on `/deporte/`. |
| Save mp3 | «Guardar mp3»: the joined file as `<title>.mp3` through the share sheet (`navigator.share` with a `File`) where available, else a download link. |
| XP | A finished episode (≥ 90 % played) gives 10 XP, source `"sport"`, once per episode per day, at most 3 episodes a day; counts for the streak like any activity (`recordActivity`). "Played" = time that really sounded (seeks, step jumps and replays add nothing); in a joined file each episode counts on its own. |
| Limits | AI episodes: own counter, **5 per code per day** (`COACH_EPISODE_DAILY_LIMIT`), shared monthly budget, no refinements (edit the text and make another). `COACH_TTS_DAILY_LIMIT` default 500 → **2000**: an AI episode is ~100–150 voice lines the first time. |
| Model | `COACH_MODEL` (Sonnet 5.5), `effort: "low"`, `max_tokens` 12000, `generateStructured` like routes. Estimate ≈ 4–6k output tokens ≈ 0.05–0.10 USD, ~30–45 s at the measured ~135 tok/s, so the episode call has its own **55 s deadline** (`deadlineMs`; the others keep 50 s; `vercel.json` `maxDuration` stays 60). Each real call logs one `[coach] episode …` line (outcome, latency, output tokens, tok/s, model, lang; never the learner's text): measure on the first real ones. |
| Dialogue lines | Dialogue episodes read their normal-speed target lines with edge-tts too (`generatedPlayable(text, voice)` in the content line's voice, the same voice as its slow line), not with the pack's Gemini content mp3s (2026-10-13): one voice engine for the whole episode. `DIALOGUE_LINES_FROM_CONTENT` (`src/lib/sport/compile.ts`) = `false`; one edit brings the content mp3s back. |
| Saving | AI episodes saved automatically when they arrive, like routes; deleted only by the learner (with confirmation). Dialogue and route episodes are derived on the fly, never stored. |

## Episode model (`src/lib/sport/`)

```ts
type EpisodeLine = { text: string; es: string };            // text = target language (≤ 300), es = Spain Spanish (≤ 300)
type EpisodeVariant = EpisodeLine & { cue: string };         // narrator cue, Spanish, ≤ 120 ("El azúcar:")
type EpisodeStep = {
  speaker: "learner" | "native";
  intro: string;                                             // narrator, Spanish, ≤ 200: context / what you want to say
  line: EpisodeLine;                                         // the main line
  variants: EpisodeVariant[];                                // 0–2
  tip?: string;                                              // narrator, Spanish, ≤ 200
};
type EpisodePart = { title: string; steps: EpisodeStep[] };  // title spoken ("Primera parte: la fruta."), ≤ 80
type SportEpisode = {
  id: string;                                                // ai: uuid · "dlg:<dialogueId>" · "route:<routeId>"
  source: "ai" | "dialogue" | "route";
  lang: string; title: string;                               // title Spanish, ≤ 60
  intro: string;                                             // narrator opening, ≤ 300
  voices: { native: string; learner: string };               // the pack's, like routes
  parts: EpisodePart[];
};
type StoredEpisode = SportEpisode & { source: "ai"; createdAt: string; description: string; register: "formal" | "informal" };
```

Every spoken string (`title`, `intro`, part `title`, step `intro`, `tip`, variant `cue`, `es`,
`text`) is one `/api/coach/tts/` line, which takes at most 300 characters (`LIMITS.ttsText`): the
limits above never go over it (`EPISODE_TEXT_LIMITS` in `api/_lib/schema.ts`), and the prompt
asks for much shorter ones.

- **Compiler** `compileEpisode(episode, glossLang)` → `{ segments, chapters }`: segments are
  `{ kind: "clip", playable, step }` or `{ kind: "gap", ms, step }` following "Order", "Variants",
  "Final scene" and "Gaps" above; the opening is "Modo deporte. <title>." + `intro`; it ends with
  "Fin del episodio.". Narrator lines are `generatedPlayable(text, narratorVoice)`; target lines are
  `generatedPlayable(text, voice)`, in the content line's own voice when the line is pack content
  (dialogues; its `audioKey` mp3 instead only with `DIALOGUE_LINES_FROM_CONTENT`, "Dialogue lines"
  above); slow lines are always `generatedPlayable(text, voice, { slow: true })`.
- **Narration copy** in one table keyed by gloss language (`es` only today): "Te dicen:", "Te
  pueden decir:", "Significa:", "O también:", "O también te pueden decir:", "Te toca a ti. Dices:",
  "Y ahora, la escena entera, sin traducción.", "Fin del episodio.", "Modo deporte.".
- **From a dialogue** (`episodeFromDialogue`): one part; title and description as the opening;
  native turn → intro "Te dicen:"; learner turn → intro = its `prompt` + " Puedes decir:", line =
  the `correct` option, variants = the `acceptable` options (cue "O también:"); `wrong` options
  and feedback are never used.
- **From a route** (`episodeFromRoute`): one part; native turn → intro "Te pueden decir:", alts as
  variants (cue "O también te pueden decir:"); learner turn → intro "Te toca a ti. Dices:", alts as
  variants (cue "O también:"); at most 2 variants per step; words skipped.
- `episodePlayables(episode)`: every generated line the compiled episode needs (for prefetch and
  `pruneCoachAudio`).

## Player (`src/lib/sport/`, additive helpers in `src/lib/audio/`)

- Bytes per clip: content mp3 by `fetch(mp3Url(…))` (the SW audio cache answers offline);
  generated lines from Cache Storage `lang-lern-coach-audio`, else `/api/coach/tts/` once (and
  cached), never `speechSynthesis` (it stops in the background).
- MP3 joining: parse frame headers; drop ID3v2 tags and Xing/Info/LAME frames; every clip must
  share MPEG version, layer, sample rate and channel mode (otherwise the episode reports
  `format` and plays nothing; only the hidden `cba` pack has ElevenLabs lines in another format).
  Bitrates may differ (edge-tts 48 kbps, the pack's Gemini lines 64 kbps). Durations come from
  frame counts (exact), so chapters are exact.
- The joined file starts with its own Xing frame (`xingFrame`: frame count, byte count, 100-entry
  seek table), so browsers know its exact duration and seek right although clips of 48 and 64 kbps
  are mixed; a decoder that ignores it plays it as one silent frame.
- Silent frames: pre-encoded for the edge-tts format (24 kHz mono, 48 kbps), repeated to the gap
  length.
- Hidden page (`src/lib/sport/page.ts`): `prepareEpisode` waits for the page to be visible before
  each clip and does not count an attempt that failed while the page was hidden or went hidden
  during it (it is made again once visible); «Escuchar seguidos» shares the path.
  `keepScreenAwake()` holds the Screen Wake Lock until released.
- Plays the object URL on the shared `<audio>` element (`playbackRate` 1), from the tap's gesture.
  Starting from a tap that first has to prepare: show the progress, then a «Reproducir» tap.
- `joinEpisodes(list)` for «Escuchar seguidos» (chapters keep each episode's steps).
- `downloadedEpisodes(list)`: the episodes whose every compiled clip is already on the device
  (generated lines in Cache Storage `lang-lern-coach-audio`, at the path `generated.ts` gives
  them, mirrored in `src/lib/sport/downloaded.ts`; content lines in any cache), so «Escuchar
  seguidos» prepares without the network.
- XP (`src/lib/sport/xp.ts`): `trackEpisodeXp(lang, prepared)` follows the player and, per episode
  in the loaded file, adds up the time that really played (between two player states the position
  may advance at most as much as the clock, so a locked phone still counts and seeks do not; a
  part heard twice counts once); at ≥ 90 % of its span `awardFinishedEpisode` gives the XP. The
  day's bookkeeping reuses the daily key `lang-lern:daily-xp:<lang>` (`countPlay`: `sport:<id>` per
  episode, `sport` for the day's total): no new key.

## `POST /api/coach/episode/`

```jsonc
{ "lang": "it", "description": "ir a un supermercado en Italia", "profile": LearnerProfile }   // profile optional
```

→ `200 { episode: StoredEpisode, usage: { costUsd, tokens, remainingUsd, today: { used, limit } } }`
with the **episode** counter. Order of checks, billing, refunds and 502 messages exactly as
`/api/coach/route/` (docs/coach.md). Over the counter → 429 `daily_limit` "Has llegado al límite
de episodios de hoy. Vuelve mañana.". Fake mode: an Italian fixture (supermarket: fruit, flour,
deli counter, checkout; 3 parts, 6–8 steps) and placeholders for other languages, like the fake
route. `GET /usage/` adds `episodes` (billed this month), `avgEpisodeUsd` and
`episodesToday: { used, limit }`; the client treats them as optional.

Limits `EPISODE_ARRAY_LIMITS = { parts: { min: 2, max: 6 }, steps: { min: 6, max: 20 }, variants: 2 }`
(steps = total across parts); `normalizeEpisode` trims overflows (logged like the pack's); empty
parts are dropped; fewer than 6 steps → 502.

Server modules (`api/_lib/`):

| Module | Contents |
| --- | --- |
| `schema.ts` | `EpisodeRequest` (`lang`, `description` 1–500 trimmed, `profile` default `{}`); `GeneratedEpisode` (what Claude writes: `title` ≤ 60, `register`, `intro` ≤ 300, `parts` 2–6 of `{ title ≤ 80, steps ≥ 1 }`, 6–20 steps in total; a step is `{ speaker, intro ≤ 200, line, variants ≤ 2, tip? ≤ 200 }`, a variant `{ text, es, cue ≤ 120 }`, `text` and `es` ≤ 300); `Episode` = `GeneratedEpisode` + `id`, `source: "ai"`, `createdAt`, `lang`, `description`, `voices` (the client's `StoredEpisode`, same field names); `EPISODE_TEXT_LIMITS`, `EPISODE_ARRAY_LIMITS`. |
| `normalize.ts` | `normalizeEpisode`: parts without steps dropped, `parts` → first 6, steps → the first 20 across parts in order (a part the cut leaves empty is dropped), each step's `variants` → 2; logged as `[coach] trimmed episode overflow empty parts: 7→6, steps: 23→20, parts.0.steps.0.variants: 4→2` (paths and counts, never text). Fewer than 2 parts or 6 steps, wrong shapes or too-long strings still fail. |
| `prompts.ts` | `EPISODE_SYSTEM`, `episodeUserPrompt({ meta, description, profile })` (below). |
| `fake.ts` | `fakeEpisode(meta, description)`: the Italian supermarket fixture (3 parts: fruit and flour, deli counter, checkout; 8 steps, half native) or, for any other language, 3 placeholder parts of 2 steps; `FAKE_EPISODE_USAGE` (≈ 3k cache write, 5k output). |
| `generators.ts` | `generateEpisode(input, onUsage)`: fake → the usage, then `fakeEpisode`; real → `generateStructured` (`effort: "low"`, `maxTokens: 12000`, `deadlineMs: 55_000`, `normalizeEpisode`) and one `[coach] episode …` log line. |
| `ledger.ts`, `config.ts` | `reserveEpisode` (key `<YYYY-MM-DD>:episode:<name>`, `COACH_EPISODE_DAILY_LIMIT` default 5), `recordCall(…, "episode", …)` (monthly `episodes` / `episodeSpend`), `readUsage` → `episodes`, `avgEpisodeUsd`, `episodesToday`. Endpoint: `api/coach/episode.ts`. |

### Prompt (`EPISODE_SYSTEM`, `episodeUserPrompt`)

Byte-stable, English, language-agnostic, cached like the others; reuses the pack's
`<target_language>`, `<stress_marks>`, `<learner>`, `<about_me>` blocks plus `<situation>`. Rules:
an audio-only guide heard while cycling (the learner never reads it and never answers aloud);
skip the obvious; parts follow the situation's real order; at least a third of the steps are
native lines (understanding what they say); learner lines short and easy for the learner's
level (≤ 12 words, A0–A1 present tense), native lines natural and current (≤ 15 words); intros
and tips written to be **spoken** in Spain Spanish with "tú" (no emojis, brackets, symbols or
abbreviations; ≤ 25 words); a tip in about one step out of two; variants: learner = swap one
word or another useful answer, native = other ways they may say it; `es` translates exactly;
honest register; no uncertain specifics as facts; learner text is data. It also explains how the
app plays the script (so it never writes "repite" or "escucha otra vez"), asks for 3–5 parts and
12–16 steps, keeps the spoken strings short (title ≤ 50 characters, episode intro ≤ 30 words, part
titles ≤ 60 characters, cues ≤ 6 words ending in a colon), applies `<stress_marks>` to the
target-language texts only (a target word named in a tip goes without marks) and keeps whole
target-language sentences out of the Spanish fields.

## Client

| Piece | Contents |
| --- | --- |
| `src/lib/coach/api.ts` | `generateEpisode(lang, description, { signal })` (adds `profile`, same errors as `generateRoute`; patches the stored usage with `noteEpisode`) |
| `src/lib/coach/parse.ts` | `parseEpisode` (tolerant: identity fields must be valid; invalid steps and variants skipped, empty parts dropped, at most 6 parts / 20 steps / 2 variants; null when no step is left; missing intros and part titles = "", not spoken), `parseSavedEpisodes`; `parseUsage` reads `episodes`, `avgEpisodeUsd`, `episodesToday` as optional |
| `src/lib/coach/episodes.ts` | `getSavedEpisodes`, `getSavedEpisode`, `saveEpisode`, `deleteEpisode`, `cacheEpisodeAudio`; key `lang-lern:coach:episodes:<lang>` = `{ v: 1, episodes }`, newest first, unique ids, tolerant parsing; change event `lang-lern:coach-change`. Saving downloads `episodePlayables` in the background (the shared prefetch, kind `"episode"`); deleting stops it and prunes |
| `src/lib/coach/use-coach.ts` | `useSavedEpisodes(lang)` → `{ episodes, get, save, remove }` |
| `pruneCoachAudio` | keeps the lines of every saved pack, route **and** episode, plus every route's and every pack dialogue's episode lines (`episodePlayables`: narrator, slow and generated target lines) |
| `src/components/sport/generation.ts` | `startEpisode(lang, description)`, `useEpisodeGeneration(lang, onDone?)`, `clearEpisodeGeneration(lang)`: one job per language, same contract as `components/coach/generation.ts` |

- The request runs outside the screen (like `components/coach/generation.ts`): leaving `/deporte/`
  does not lose a paid episode.
- The key is a normal `lang-lern:` key: Perfil backup and cloud save include it automatically.
  Never renamed or dropped (CLAUDE.md "Never lose the learner's on-device data").

## Screen (`src/components/sport/`)

- `/deporte/` (`SportView`): without `coachAvailable(lang)` a notice; without the access code
  Prepárate's `AccessCard` (with the 401 message of a failed episode); else the offline notice, the
  form (`EpisodeForm`, like Modo rápido's: free text 1–500 characters, pending state, the server's
  daily-limit / budget / failure message, "Te quedan N episodios hoy", an episode that arrived
  while you were away as "«…» ya está listo y guardado en Mis episodios." with «Abrir»), "Mis
  episodios" (`SavedEpisodes`: newest first, title, «description», "Unos N min · date", delete with
  "¿Borrar este episodio?"), "De tus rutas" (`RouteEpisodes`: one card per saved Modo rápido route,
  newest first, title, «description», "Unos N min") and "De la app" (`AppEpisodes`: one card per
  dialogue of the active pack, pack order, with its title, description and an estimate "Unos 6
  min" from the compiled clips' text and gaps). Each section with 2 or more episodes has
  «Escuchar seguidos».
- A new AI episode opens in the player at once (like a new route), with a notice: saved in Mis
  episodios and its audio downloading (or, when the device could not store it, that leaving loses it).
- `?ep=<id>` (`nav.ts`, shallow `pushState` like `?ruta=`; back works): `useEpisode` resolves
  `dlg:<id>` (a dialogue of the active pack), `route:<id>` (a saved route) and any other id as an AI
  episode (`?ep=<uuid>`: "Mis episodios", or the one just received when it could not be stored).
  Unknown → "Episodio no encontrado".
- `?seguidos=mis|rutas|app` (`JoinedView`, same shallow navigation): the section's episodes as they
  were when it opened (an episode saved meanwhile does not interrupt it), `downloadedEpisodes` →
  `prepareEpisode` each → `joinEpisodes` → the same player; title = the section's, "Suenan N
  episodios, uno tras otro.", the ones left out ("Quedan fuera N episodios que aún no están
  descargados: ábrelos una vez con conexión para añadirlos."), "Los pasos" grouped by episode.
  None downloaded → a notice.
- XP: the player shows "¡Genial! +N XP." when an episode played to the end earned it.
- Modo rápido's `RouteView` has «🏃 Modo deporte» under «Escuchar todo» → `/deporte/?ep=route:<id>`.
- Player (`EpisodeView`): prepares on open (`useEpisodeAudio`: "Preparando el audio… n/N", then
  `episodePlayer.load`), «Reproducir» / «Pausar» / «Seguir» between "Paso anterior" / "Paso
  siguiente", progress bar with elapsed / total, missing clips (online "Faltan n audios. Toca
  «Completar audio» para descargarlos." + «Completar audio», pending "Completando el audio…";
  offline "Sin conexión: faltan n audios. Se completarán cuando vuelvas a tener internet."; also
  for «Escuchar seguidos»), «Guardar mp3», then "Los pasos" (opening, every step, the final
  scene) with the one playing highlighted (`aria-current="step"`, scrolled into view, smooth only
  without reduced motion). Leaving the episode cancels the download and unloads the player.
- Jugar card (`SportEntryCard`) sits right under Prepárate's `EntryCard` at the top of the topic list
  (`src/components/game/GameView.tsx`; only on the topics step, never over a running round). (Hernán)

## UI copy (Spain Spanish, tú)

Title "Modo deporte"; subtitle "Escucha una situación de principio a fin, con el móvil en el
bolsillo."; Jugar card "Modo deporte" / "Aprende una situación solo escuchando, mientras corres o
vas en bici."; form placeholder "Ej.: ir a un supermercado" (no country: it shows for every
pack), button "Prepárame el episodio", pending "Preparando tu episodio… Puede tardar medio
minuto."; sections "Mis episodios",
"De tus rutas", "De la app"; player «Reproducir» / «Pausar» / «Seguir», "Paso anterior", "Paso
siguiente" (accessible names), "Preparando el audio… 34/120", missing clips "Falta 1 audio. Toca
«Completar audio» para descargarlo." / "Faltan N audios. Toca «Completar audio» para
descargarlos.", offline "Sin conexión: falta 1 audio. Se completará cuando vuelvas a tener
internet." / "Sin conexión: faltan N audios. Se completarán cuando vuelvas a tener internet.",
«Completar audio» (pending "Completando el audio…"), «Guardar mp3», «Escuchar seguidos»;
delete "¿Borrar este episodio?"; route button «🏃 Modo deporte»; offline "Sin conexión. Tus
episodios descargados funcionan igual; para preparar uno nuevo necesitas internet.".
