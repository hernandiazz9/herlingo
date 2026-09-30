@AGENTS.md

# lang_lern — personal language trainer (Italian first)

Mobile-first, offline-capable Next.js PWA for Hernán to learn spoken Italian before a trip to
Sicily. **Read `docs/brief.md` before any task**: it holds every product decision.

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Setup in a fresh checkout. |
| `npm run dev` | Dev server (http://localhost:3000). |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules). |
| `npm run typecheck` | `next typegen` (route types, `LayoutProps`/`PageProps`) + `tsc --noEmit`. |
| `npm run build` | Static export to `out/` (`output: "export"`, `trailingSlash: true`). |
| `npm run content:check` | Validate every pack in `content/` (schema, ids, references). Exit 1 on errors. |
| `npm run content:build` | Validate + write `src/lib/content/generated/packs.json` (git-ignored). Runs automatically before dev, typecheck and build; re-run it after editing content while `dev` is running. |
| `npm run verify` | lint → content:check → typecheck → build. Must exit 0 before a task is done. |

**There are no automated tests in the MVP** (speed over tests). Verification is `npm run verify`;
check UI changes by hand with `npm run dev` or by serving `out/` with any static server.

## Folder layout

```
src/app/               Routes (App Router). One folder per section: / (ruta), repaso, frasario, dialogos, perfil.
                       layout.tsx = app shell (centred mobile column + bottom TabBar); globals.css = design tokens.
src/components/ui/     Base components: Button, IconButton, Card, ProgressBar (import from "@/components/ui").
src/components/shell/  App shell pieces: TabBar, PageHeader, ComingSoon placeholder, ThemeToggle, ThemeSync.
src/components/icons.tsx  Inline SVG icons (no icon library).
src/lib/               Framework-free logic. navigation.ts = the tab list (single source of truth).
                       theme/ = light/dark choice (localStorage), inline pre-paint script, theme-color.
src/lib/content/       Content contract: schema.ts (zod, source JSON), types.ts (runtime types), index.ts (loader).
src/lib/audio/         speak() / stop(): the only way to play target-language audio.
content/<lang>/        Learning content per language: pack.json, units/, dialogues/, extras/. Only `it` exists.
                       Format, ids, order ranges and quality rules: docs/content-guide.md.
                       Code never hard-codes content.
scripts/               Node scripts (content tools, audio generation...).
public/                Static assets (later: audio under public/audio/<lang>/, PWA manifest and icons).
docs/                  brief.md (product decisions; do not edit) and other docs.
plans/                 Orchestrator plans. Never edit.
```

## Conventions

- **UI copy is Spain Spanish using "tú"** ("Toca para escuchar", "¡Genial!"). Accessible names
  (`aria-label`, IconButton `label`) too.
- **Language-agnostic code.** Nothing in `src/` is specific to Italian: all learning content lives
  under `content/<lang>/`. Adding a language means adding content, not changing code.
- **Static export only.** No server runtime, API routes, `cookies()`/`headers()`, or runtime env
  secrets. Progress lives on the device (localStorage).
- **Design tokens** are CSS variables in `src/app/globals.css` (`--lemon`, `--sea`, `--terracotta`,
  neutrals, `--success`, `--error`, each with `-deep`/`-soft`/`-ledge` variants, plus `--on-accent`,
  `--on-lemon`, `--shadow`) exposed to Tailwind as `bg-sea`, `text-ink`, `border-line`,
  `text-on-accent`, `rounded-card`, `rounded-button`...
- **Light and dark themes.** Every colour token has a dark value (system setting by default, or the
  Sistema/Claro/Oscuro choice on /perfil, stored on the device as `data-theme` on `<html>`).
  **UI code uses tokens only, never hard-coded colours** (no hex/rgb, no `text-white`/`bg-black`,
  no `dark:` variants), so both themes work. Token roles: `-deep` = strong text/emphasis readable on
  surfaces and `-soft` backgrounds (lighter in dark); `-ledge` = the darker press ledge; text on a
  filled accent uses `text-on-accent` (sea/terracotta/success/error) or `text-on-lemon`. Check new
  UI in both themes.
- **Press animation:** add the `pressable` class and set `[--ledge:var(--sea-ledge)]` (a `-ledge` token).
  Respect `prefers-reduced-motion`.
- **Mobile shell:** the app is a column capped at `--column-width` (480px), centred on desktop. The
  tab bar is fixed to the bottom and pads with `env(safe-area-inset-bottom)` (`viewport-fit=cover`).
  Pages render inside `<main>`; start each with `<PageHeader title=… />`.
- **Tabs:** add or rename sections only in `src/lib/navigation.ts` (`TABS`); TabBar and page
  headings read from it.
- **If tests are added later, they never hard-code content ids or counts**: derive expectations
  from the source (import `TABS`, the content loader, etc.).
- **Content** is read only through `@/lib/content` (`getPack()`, `getAllLessons()`, `getLesson()`,
  `getLessonItems()`, `getItem()`, `getDialogue()`, `getSituation()`, `listPlayables()`), never
  by importing `content/` JSON. Synchronous; works in server and client components. The app
  never imports zod (only `scripts/content.ts` does).
- **Audio** goes through `@/lib/audio`: `speak(playable | text, { slow })`, `stop()`, `canSpeak()`.
  Every playable (phrase, vocab, Q&A question and replies, dialogue turns and options, grammar
  examples, placement `audio`) has `text`, `audioKey` and `voice`: pass it as is. Today it uses
  `speechSynthesis` in the pack's `speechLocale`; mp3 (`public/audio/<lang>/<audioKey>.mp3`)
  plugs in behind the same API.
- **Audio** must start from a user gesture (iOS): call `speak()` directly in the handler. Speech recognition is optional: feature-detect
  and fall back to self-evaluation.
- TypeScript strict; import from `@/…` (maps to `src/`).
