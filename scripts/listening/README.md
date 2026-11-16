# Listening library (batch script)

English listening episodes for running and walking, written in bulk by Claude Opus 5.5 and
voiced with edge-tts. Standalone: nothing in the app uses it yet (docs/ideas.md §5, «Biblioteca»).
All content is generic: fictional speakers, never anyone's real experience.

```bash
npx tsx scripts/listening/run.ts status
npx tsx scripts/listening/run.ts topics                 # topic plan: 120 ideas per topic
npx tsx scripts/listening/run.ts write --count 3 --direct   # pilot (full price, no waiting)
npx tsx scripts/listening/run.ts auto --telegram-config <file>   # batches until the cap
```

Options and commands: the header of `run.ts`. Needs `ANTHROPIC_API_KEY` (environment or
`--env`, default `./.env.local`; only that name is read), ffmpeg and internet.

## Output (`listening-out/`, git-ignored)

| Path | What |
| --- | --- |
| `state.json` | Topic plan (`topics`), batches, cost ledger (one entry per billed response: tokens from `usage`, cost in micro-USD), Telegram log. |
| `scripts/<topic>-<nnn>.json` | One episode (format `herlingo-listening/1`, below). Kept for the app import. |
| `mp3/<topic>-<nnn>-<slug>.mp3` | The episode, 64 kbps mono, ID3 title / album / track. |
| `clips/` | TTS cache (hash of voice + speed + text); safe to delete. |

## Money

Prices from `api/_lib/model.ts`; Message Batches bill half. A request is only sent if its worst
case (every input token at the cache-write price, output at `max_tokens`) fits in
cap − spent − reserved; a submitted batch reserves its worst case until it is collected. So the
cap (`--cap`, 20 USD by default, fixed on a folder's first run) is never exceeded, and `auto`
goes on with smaller batches until not even one request fits.

## Episode format (`herlingo-listening/1`)

Close to Modo deporte's `SportEpisode` (docs/sport.md "Episode model"), all in English:

- `id`, `topic` (`interview` | `work` | `story`), `number`, `title`, `description`, `level`,
  `register`, `intro`, `outro`, `brief` (the idea it was written from).
- `cast`: `{ id, name, role, gender, main }`; `voices`: edge-tts voice per cast id plus
  `narrator` (`en-GB-SoniaNeural`; main speakers `en-AU-NatashaNeural` /
  `en-AU-WilliamMultilingualNeural`; extras other English accents).
- `parts[].steps[]`: `{ speaker (cast id), intro, line: { text, meaning }, focus, variants:
  [{ cue, text, meaning }], tip }`. `meaning` takes the place of `es` (a plain-English
  paraphrase, gloss language `en`); `focus` lines play normal → slow (−30 %) → normal like
  learner lines, the others once like a conversation.
- `generation` (model, mode, batch, effort, usage, cost), `stats` (steps, focus, words,
  warnings), `audio` (`file`, `seconds`).

Play order (`compileEpisode` in `episode.ts`): narrator title + intro; per part its title, then
each step (intro, line; focus: slow, normal, "In other words: …", the variant once, "Tip: …");
then "And now, all of it again…" and every line once more without narrator; outro; "End of the
episode.".
