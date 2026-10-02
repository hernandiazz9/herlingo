/**
 * `npm run league:seed [-- --reset]`: fills the local fake Supabase (`lang_lern_league_local`) with
 * 15 clearly fake players ("Bot …") with XP this week and last week in every content language, and
 * a group (code PRUEBA) with 5 of them. Idempotent: does nothing when the bots exist; --reset deletes
 * the bots and the PRUEBA group (its real members leave it too) and seeds again.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { contentLangs, DB, ensureDatabase, mustRun, wantsReset } from "./shared";

const GROUP = { code: "PRUEBA", name: "Amici di prova" };
const GROUP_SIZE = 5;
const BOTS = [
  "Bot Gino", "Bot Marta", "Bot Salvo", "Bot Lucia", "Bot Pippo", "Bot Rosa", "Bot Tano", "Bot Agata",
  "Bot Nino", "Bot Carla", "Bot Turi", "Bot Elena", "Bot Mimmo", "Bot Sara", "Bot Ciccio",
];
const EMOJIS = ["🍋", "🍕", "🐬", "🦊", "🐱", "🍦", "🌋", "⛵", "🐙", "☕", "🐢", "🦉", "🐝", "🌞", "🫒"];
const SOURCES = ["lesson", "review", "game", "story"];
const DAY_MS = 86_400_000;

/** Deterministic (mulberry32) so every seed gives the same kind of ranking. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Bot {
  id: string;
  nickname: string;
  emoji: string;
}

interface Event {
  id: string;
  user_id: string;
  lang: string;
  amount: number;
  source: string;
  earned_at: string;
}

interface Stat {
  user_id: string;
  lang: string;
  total_xp: number;
  streak_count: number;
  streak_best: number;
}

function dollarQuote(value: unknown): string {
  const tag = `$seed_${randomBytes(6).toString("hex")}$`;
  return `${tag}${JSON.stringify(value)}${tag}`;
}

async function main() {
  const reset = wantsReset();
  await ensureDatabase(false);

  if (reset) {
    await mustRun(
      DB,
      "remove bots",
      `begin;
delete from league.groups where code = :'code';
delete from auth.users where id in (select user_id from local_auth.seed_users);
commit;`,
      { code: GROUP.code },
    );
    console.log("• removed the bots and the PRUEBA group");
  } else {
    const count = Number((await mustRun(DB, "count bots", "select count(*) from local_auth.seed_users;")).trim());
    if (count > 0) {
      console.log(`${count} bots already seeded (group code ${GROUP.code}). Use --reset to reseed.`);
      return;
    }
  }

  const weekStart = Date.parse((await mustRun(DB, "week start", "select to_json(league.week_start(now()))#>>'{}';")).trim());
  const now = Date.now();
  const from = weekStart - 7 * DAY_MS;
  const joined = new Date(from - DAY_MS).toISOString();
  const langs = contentLangs();
  const random = rng(42);

  const bots: Bot[] = BOTS.map((nickname, i) => ({ id: randomUUID(), nickname, emoji: EMOJIS[i % EMOJIS.length] }));
  const events: Event[] = [];
  const stats: Stat[] = [];
  for (const [i, bot] of bots.entries()) {
    const keen = 0.25 + 0.7 * random();
    for (const lang of langs) {
      let earned = 0;
      for (let day = from; day < now; day += DAY_MS) {
        if (random() > keen) continue;
        const sessions = 1 + Math.floor(random() * 4);
        for (let s = 0; s < sessions; s++) {
          const at = day + Math.floor(random() * DAY_MS);
          if (at >= now) continue;
          const amount = 10 + Math.floor(random() * 51);
          earned += amount;
          events.push({
            id: randomUUID(),
            user_id: bot.id,
            lang,
            amount,
            source: SOURCES[Math.floor(random() * SOURCES.length)],
            earned_at: new Date(at).toISOString(),
          });
        }
      }
      const best = 3 + Math.floor(random() * 40);
      stats.push({
        user_id: bot.id,
        lang,
        total_xp: earned + Math.floor(random() * 5000),
        streak_count: i % 4 === 3 ? 0 : 1 + Math.floor(random() * best),
        streak_best: best,
      });
    }
  }

  await mustRun(
    DB,
    "insert bots",
    `begin;
insert into auth.users (id, is_anonymous)
  select b.id, true from jsonb_to_recordset(${dollarQuote(bots)}::jsonb) as b(id uuid);
insert into local_auth.seed_users (user_id)
  select b.id from jsonb_to_recordset(${dollarQuote(bots)}::jsonb) as b(id uuid);
insert into league.profiles (user_id, nickname, emoji, created_at, updated_at)
  select b.id, b.nickname, b.emoji, :'joined'::timestamptz, :'joined'::timestamptz
  from jsonb_to_recordset(${dollarQuote(bots)}::jsonb) as b(id uuid, nickname text, emoji text);
insert into league.stats (user_id, lang, total_xp, streak_count, streak_best)
  select * from jsonb_to_recordset(${dollarQuote(stats)}::jsonb)
    as s(user_id uuid, lang text, total_xp integer, streak_count integer, streak_best integer);
insert into league.xp_events (id, user_id, lang, amount, source, earned_at)
  select * from jsonb_to_recordset(${dollarQuote(events)}::jsonb)
    as e(id uuid, user_id uuid, lang text, amount integer, source text, earned_at timestamptz);
insert into league.groups (code, name) values (:'code', :'name');
insert into league.members (user_id, group_id)
  select b.id, g.id from jsonb_to_recordset(${dollarQuote(bots.slice(0, GROUP_SIZE))}::jsonb) as b(id uuid),
    league.groups g where g.code = :'code';
commit;`,
    { joined, code: GROUP.code, name: GROUP.name },
  );

  console.log(`✓ ${bots.length} bots, ${events.length} XP events (${langs.join(", ")}), this week and last week.`);
  console.log(`✓ group "${GROUP.name}" with ${bots.slice(0, GROUP_SIZE).map((b) => b.nickname).join(", ")}`);
  console.log(`  join code: ${GROUP.code}  ·  link: http://localhost:3000/liga/unirse/?codigo=${GROUP.code}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
