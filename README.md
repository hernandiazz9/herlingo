# Herlingo

Personal, mobile-first language trainer (Italian first, for a trip to Sicily). A Next.js app
exported as static files, installable on the iPhone and usable offline: lesson path, spaced
repetition review, pocket phrasebook and dialogue simulator, with neural audio.

Product decisions live in [docs/brief.md](docs/brief.md); content format in
[docs/content-guide.md](docs/content-guide.md); conventions for contributors (and AI agents) in
[CLAUDE.md](CLAUDE.md).

Requirements: Node 20.19+ and npm. Python 3 only to regenerate audio.

## Run it locally

```bash
npm ci          # once, and after pulling dependency changes
npm run dev     # http://localhost:3000, live reload (no offline mode in dev)
```

To try the real thing (static export + offline service worker):

```bash
npm run build   # writes out/, then out/sw.js and out/manifest.webmanifest
npm start       # serves out/ at http://localhost:4173 (PORT=4000 npm start to change it)
```

Offline audio: the service worker keeps the audio of the **active language only** (one cache
per language, `lang-lern-audio-<lang>`, filled in the background after the first load or a
language switch; switching drops the other language's audio once the new one is complete). The
rest of the app is precached as before. Details: `scripts/pwa/sw.template.js`.

Before committing: `npm run verify` (lint, content check, typecheck, build) must exit 0.

## Open it on the phone over the LAN

1. Mac and iPhone on the same wifi.
2. `npm run build && npm start`. It prints a line like `on your wifi: http://192.168.1.23:4173`.
3. Open that address on the iPhone (Chrome or Safari).

Over plain `http://` on a LAN address the browser does not allow a service worker, so this is for
trying the UI and audio only: offline mode and a proper install need the HTTPS deploy (below).
If the Mac asks whether Node may accept incoming connections, allow it. (`npm run dev -- -H 0.0.0.0`
works too, on port 3000.)

## Regenerate the audio

After adding or changing any Italian line in `content/`:

```bash
npm run audio                            # needs internet; first run creates .venv with edge-tts
npm run content:check -- --strict-audio  # must exit 0: every line has its mp3
git add public/audio && git commit -m "Regenerate audio"
```

Only new or changed lines are generated; unused mp3s are deleted.

## Edit the persona ("about me")

Your answers to "where are you from / what do you do / where are you going" are in
[content/it/units/32-persona-sobre-mi.json](content/it/units/32-persona-sobre-mi.json) (the
current name, city, job and route are placeholders to check). Some dialogues reuse them:
`content/it/dialogues/talk-*.json`.

1. Change the Italian `text` and its Spanish `es` of the lines you want. Keep every `id` as it is
   (progress and lessons point to them).
2. `npm run content:check` → exit 0.
3. Regenerate the audio (above), commit, and deploy again.

## Deploy to Vercel

Vercel builds from source with the settings in `vercel.json` (static site from `out/`, plus
Prepárate's functions in `api/coach/`, see below).
The first time, from the repo folder:

```bash
npx vercel@latest login          # opens the browser to sign in (or create the free account)
npx vercel@latest link           # "Set up and deploy?" yes; pick your account; new project; accept defaults
npx vercel@latest --prod --archive=tgz  # builds on Vercel and prints the https://… production URL
```

Every update afterwards (after `npm run verify` passes and you have committed):

```bash
npx vercel@latest --prod --archive=tgz
```

`--archive=tgz` is required: the committed audio puts the repo over Vercel's limit of 15000 files
per upload, so the CLI must send it as one archive.

The installed app notices the new version the next time you open it and shows
"Hay una versión nueva de la app" → **Actualizar**.

### Prepárate (AI coach) environment variables

The site itself needs no variables. Prepárate's functions in `api/coach/` (deployed next to `out/`
with the settings in `vercel.json`) need these in Vercel → Project → Settings → Environment
Variables (Production), then a new deploy:

| Name | Required |
| --- | --- |
| `ANTHROPIC_API_KEY` | yes |
| `UPSTASH_REDIS_REST_URL` | yes |
| `UPSTASH_REDIS_REST_TOKEN` | yes |
| `COACH_ACCESS_CODES` | yes |
| `COACH_OWNER` | yes |
| `COACH_MONTHLY_CAP_USD`, `COACH_DAILY_LIMIT`, `COACH_TIMEZONE` | no |

Where each value comes from (Anthropic key and spend limit, Upstash database, access codes) and
how to check the deploy: [docs/coach.md → Setup steps](docs/coach.md#setup-steps-hernán). Without
them the rest of the app works as before; Prepárate answers "not configured".

Optional: connect the GitHub repo in the Vercel dashboard (Project → Settings → Git) to deploy on
every push to `main` instead of running the command.

## Install it on the iPhone

Open the production `https://…vercel.app` URL, then:

- **Chrome** (iOS 16.4+): Share button (next to the address bar) → **Añadir a pantalla de inicio** → **Añadir**.
- **Safari**: Share button (or `···` first) → **Añadir a pantalla de inicio** → keep "Abrir como app web" on → **Añadir**.

Then open it once from the home-screen icon with wifi and wait until Perfil → Instalar en el
iPhone says "Lista para usar sin conexión" (it downloads every page and all the audio, ~25 MB).
The microphone exercises work best in Safari (Chrome on iPhone usually has no speech recognition,
so they fall back to self-evaluation). The installed app keeps its own progress, separate from the
browser tab: install it before you start.

The same guide is in the app: Perfil → **Instalar en el iPhone** (`/instalar/`).
