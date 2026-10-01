/**
 * `npm run league:local [-- --reset]`: the local fake Supabase for trying Liga without a real
 * project (docs/league.md → "Try it locally"). Creates (or with --reset recreates) the database
 * `lang_lern_league_local` on the local Postgres and serves http://localhost:54321.
 */
import { ANON_KEY, DB, ensureDatabase, LOCAL_URL, PORT, wantsReset } from "./shared";
import { createLeagueServer } from "./server";

async function main() {
  await ensureDatabase(wantsReset());

  const server = createLeagueServer();
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") console.error(`✗ port ${PORT} is busy: is league:local already running?`);
    else console.error(`✗ ${error.message}`);
    process.exit(1);
  });
  server.listen(PORT, () => {
    console.log(`
Local fake Supabase on ${LOCAL_URL} (database ${DB}). Ctrl+C to stop.

Put these two lines in .env.local (or prefix them to the command) and restart npm run dev:
NEXT_PUBLIC_SUPABASE_URL=${LOCAL_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}

Fake players: npm run league:seed. Magic links are printed here instead of emailed.
`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
