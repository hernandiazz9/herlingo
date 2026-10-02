-- Smoke tests for the Liga migrations (run by scripts/db/check.ts on a throwaway database).
-- Each passed check prints `NOTICE: ok: …`; the first failure raises and stops psql.
-- Callers are simulated like PostgREST does: `set role authenticated|anon` + the JWT `sub`.

set client_min_messages = notice;

create schema smoke;
grant usage on schema smoke to anon, authenticated;

create function smoke.ok(cond boolean, what text) returns void
language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

-- Error message of a statement (null when it succeeds).
create function smoke.err(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;

-- SQLSTATE of a statement (null when it succeeds).
create function smoke.state(stmt text) returns text
language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

create function smoke.u(n integer) returns uuid
language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

create function smoke.e(n integer) returns uuid
language sql immutable as $$ select ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- "Signs in" as a user (null = no JWT).
create function smoke.login(n integer) returns void
language sql as $$ select set_config('request.jwt.claim.sub', coalesce(smoke.u(n)::text, ''), false) $$;

create function smoke.ev(id uuid, amount jsonb, earned timestamptz, lang text default 'it', source text default 'lesson')
returns jsonb
language sql stable as $$
  select jsonb_build_object('id', id, 'lang', lang, 'amount', amount, 'source', source, 'earned_at', earned)
$$;

grant execute on all functions in schema smoke to anon, authenticated;

-- Users 1–5: named players; 101–160: bulk players for the top-50 check.
insert into auth.users (id) select smoke.u(n) from generate_series(1, 5) n;
insert into auth.users (id) select smoke.u(n) from generate_series(101, 160) n;

-- =============================================================================================
-- 1. Structure: RLS everywhere, no direct table access, RPCs locked down

select smoke.ok((select count(*) from pg_tables where schemaname = 'league') > 0, 'league schema has tables');

select smoke.ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('league', 'public') and c.relkind in ('r', 'p') and not c.relrowsecurity
), 'every table in league/public has RLS enabled');

select smoke.ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace, unnest(array['anon', 'authenticated']) as r(role)
  where n.nspname in ('league', 'public') and c.relkind in ('r', 'p', 'v', 'm')
    and has_table_privilege(r.role, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
), 'anon/authenticated hold no table privileges in league/public');

select smoke.ok(not has_schema_privilege('authenticated', 'league', 'USAGE')
  and not has_schema_privilege('anon', 'league', 'USAGE'), 'league schema is not usable by API roles');

select smoke.ok(not exists (
  select 1 from unnest(array[
    'public.league_set_profile(text, text)', 'public.league_record_xp(jsonb, jsonb)',
    'public.league_create_group(text)', 'public.league_join_group(text)', 'public.league_leave_group()',
    'public.league_leaderboard(text, text)', 'public.league_last_week_podium(text, text)',
    'public.league_me(text)', 'public.league_delete_me()']) as f(sig)
  where to_regprocedure(f.sig) is null
), 'every RPC of the contract exists');

select smoke.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'league\_%'
    and (not p.prosecdef
      or not coalesce('search_path=""' = any(p.proconfig), false)
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or not has_function_privilege('authenticated', p.oid, 'EXECUTE'))
), 'RPCs: security definer, empty search_path, authenticated only');

select smoke.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'league'
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
), 'internal league.* functions are not executable by API roles');

-- Direct access attempts, as each API role.
set role authenticated;
select smoke.login(1);
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'league' loop
    perform smoke.ok(smoke.state(format('select * from league.%I', t.tablename)) = '42501', format('authenticated: select league.%s denied', t.tablename));
    perform smoke.ok(smoke.state(format('insert into league.%I default values', t.tablename)) = '42501', format('authenticated: insert league.%s denied', t.tablename));
    perform smoke.ok(smoke.state(format('update league.%I set ctid = ctid', t.tablename)) is not null, format('authenticated: update league.%s denied', t.tablename));
    perform smoke.ok(smoke.state(format('delete from league.%I', t.tablename)) = '42501', format('authenticated: delete league.%s denied', t.tablename));
  end loop;
end $$;
select smoke.ok(smoke.state($q$insert into league.xp_events (id, user_id, lang, amount, source, earned_at)
  values (gen_random_uuid(), smoke.u(1), 'it', 50, 'lesson', now())$q$) = '42501', 'authenticated: forged XP insert denied');
select smoke.ok(smoke.state($q$select league.week_start(now())$q$) = '42501', 'authenticated: internal function call denied');
reset role;

set role anon;
select smoke.login(null);
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'league' loop
    perform smoke.ok(smoke.state(format('insert into league.%I default values', t.tablename)) = '42501', format('anon: insert league.%s denied', t.tablename));
    perform smoke.ok(smoke.state(format('delete from league.%I', t.tablename)) = '42501', format('anon: delete league.%s denied', t.tablename));
  end loop;
end $$;
select smoke.ok(smoke.state($q$select public.league_me('it')$q$) = '42501', 'anon: league_me not executable');
select smoke.ok(smoke.state($q$select public.league_record_xp('[]')$q$) = '42501', 'anon: league_record_xp not executable');
reset role;

-- =============================================================================================
-- 2. Profiles

set role authenticated;

select smoke.login(null);
select smoke.ok(smoke.err($q$select public.league_me('it')$q$) = 'not_authenticated', 'no JWT → not_authenticated');

select smoke.login(5);
select smoke.ok(public.league_me('it') -> 'profile' = 'null'::jsonb, 'no profile → league_me.profile is null');
select smoke.ok(smoke.err($q$select public.league_record_xp('[]')$q$) = 'no_profile', 'record_xp without profile → no_profile');
select smoke.ok(smoke.err($q$select public.league_create_group('X')$q$) = 'no_profile', 'create_group without profile → no_profile');
select smoke.ok(smoke.err($q$select public.league_join_group('ABCDEF')$q$) = 'no_profile', 'join_group without profile → no_profile');

select smoke.login(1);
select smoke.ok(public.league_set_profile('  Hernán  ', '🍋') ->> 'nickname' = 'Hernán', 'create profile (trimmed)');
select smoke.ok(public.league_set_profile('Hernán', '🐢') ->> 'emoji' = '🐢', 'update emoji');
select smoke.ok(public.league_set_profile('HERNÁN', '🐢') ->> 'nickname' = 'HERNÁN', 'own nickname can change case');
select smoke.ok(public.league_set_profile('Hernán', '☕' || chr(65039)) ->> 'emoji' = '☕', 'emoji variation selector stripped');
select smoke.ok(public.league_me('it') #>> '{profile,nickname}' = 'Hernán', 'league_me returns the profile');
select smoke.ok(smoke.err($q$select public.league_set_profile('ab', '🍋')$q$) = 'nickname_invalid', 'nickname < 3 chars rejected');
select smoke.ok(smoke.err($q$select public.league_set_profile(repeat('a', 21), '🍋')$q$) = 'nickname_invalid', 'nickname > 20 chars rejected');
select smoke.ok(smoke.err($q$select public.league_set_profile('abc$', '🍋')$q$) = 'nickname_invalid', 'nickname with symbols rejected');
select smoke.ok(smoke.err($q$select public.league_set_profile('...', '🍋')$q$) = 'nickname_invalid', 'nickname without letters rejected');
select smoke.ok(smoke.err($q$select public.league_set_profile('Hernán', '🤡')$q$) = 'emoji_invalid', 'emoji outside the list rejected');
select smoke.ok(smoke.err($q$select public.league_set_profile('puta', '🍋')$q$) = 'nickname_blocked', 'blocklist: token');
select smoke.ok(smoke.err($q$select public.league_set_profile('P0rc0 Dio', '🍋')$q$) = 'nickname_blocked', 'blocklist: digits folded');
select smoke.ok(smoke.err($q$select public.league_set_profile('xFuckYoux', '🍋')$q$) = 'nickname_blocked', 'blocklist: contains');
select smoke.ok(smoke.err($q$select public.league_set_profile('Gilipó_llas', '🍋')$q$) = 'nickname_blocked', 'blocklist: accents and punctuation ignored');

select smoke.login(3);
select smoke.ok(public.league_set_profile('Disputa', '🦊') ->> 'nickname' = 'Disputa', 'blocklist: token words inside other words are fine');
select smoke.ok(public.league_set_profile('Nazionale', '🦊') ->> 'nickname' = 'Nazionale', 'blocklist: Nazionale is fine');
select smoke.ok(public.league_set_profile('Turi', '🦊') ->> 'nickname' = 'Turi', 'profile 3');

select smoke.login(2);
select smoke.ok(smoke.err($q$select public.league_set_profile('hernán', '🍋')$q$) = 'nickname_taken', 'nickname unique (lower case)');
select smoke.ok(smoke.err($q$select public.league_set_profile('HERNÁN', '🍋')$q$) = 'nickname_taken', 'nickname unique (upper case, accent)');
select smoke.ok(public.league_set_profile('Giulia', '🐬') ->> 'nickname' = 'Giulia', 'profile 2');

select smoke.login(4);
select smoke.ok(public.league_set_profile('Capper', '🐝') ->> 'nickname' = 'Capper', 'profile 4');
reset role;

select smoke.ok((select count(*) from league.profiles) = 4, 'one profile row per player');

-- =============================================================================================
-- 3. Groups

set role authenticated;
select smoke.login(1);
do $$
declare g jsonb := public.league_create_group('  Amici   di Palermo ');
begin
  perform smoke.ok(g ->> 'code' ~ '^[A-HJ-NP-Z2-9]{6}$', 'create group → 6-char code');
  perform smoke.ok(g ->> 'name' = 'Amici di Palermo', 'group name cleaned');
  perform smoke.ok((g ->> 'members')::int = 1, 'creator is the first member');
  perform set_config('smoke.code1', g ->> 'code', false);
end $$;
select smoke.ok(smoke.err($q$select public.league_create_group('Otro')$q$) = 'already_in_group', 'one group per person (create)');
select smoke.ok(public.league_me('it') #>> '{group,code}' = current_setting('smoke.code1'), 'league_me shows the group');

select smoke.login(3);
select smoke.ok(smoke.err($q$select public.league_create_group('   ')$q$) = 'group_name_invalid', 'empty group name rejected');
select smoke.ok(smoke.err($q$select public.league_create_group(repeat('x', 31))$q$) = 'group_name_invalid', 'group name > 30 rejected');
select smoke.ok(smoke.err($q$select public.league_create_group('Cazzo team')$q$) = 'group_name_blocked', 'group name blocklist');
select smoke.ok(smoke.err($q$select public.league_join_group('ZZZZZZ')$q$) = 'group_not_found', 'unknown code → group_not_found');
do $$
declare g jsonb := public.league_create_group('Catania');
begin
  perform set_config('smoke.code2', g ->> 'code', false);
end $$;

select smoke.login(2);
select smoke.ok((public.league_join_group(' ' || lower(current_setting('smoke.code1')) || ' ') ->> 'members')::int = 2, 'join by code (lower case, spaces)');
select smoke.ok((public.league_join_group(current_setting('smoke.code1')) ->> 'members')::int = 2, 'joining own group again is a no-op');
select smoke.ok(smoke.err(format('select public.league_join_group(%L)', current_setting('smoke.code2'))) = 'already_in_group', 'one group per person (join)');
select smoke.ok(public.league_leave_group(), 'leave group');
select smoke.ok(not public.league_leave_group(), 'leave again → false');
select smoke.ok((public.league_join_group(current_setting('smoke.code2')) ->> 'members')::int = 2, 'join another group after leaving');
select smoke.ok(public.league_leave_group(), 'leave second group');
select smoke.ok((public.league_join_group(current_setting('smoke.code1')) ->> 'members')::int = 2, 'back in group 1');

select smoke.login(3);
select smoke.ok(public.league_leave_group(), 'last member leaves');
select smoke.ok(smoke.err(format('select public.league_join_group(%L)', current_setting('smoke.code2'))) = 'group_not_found', 'empty group is deleted');
reset role;

-- =============================================================================================
-- 4. record_xp: validation, duplicates, caps, stats

-- Player 1 joined 9 days ago (so the week-boundary events below are after joining).
update league.profiles set created_at = now() - interval '9 days' where user_id = smoke.u(1);
update league.profiles set created_at = now() - interval '3 days' where user_id = smoke.u(4);
-- Limits come from the migration itself, never hard-coded here.
select set_config('smoke.max_event', league.max_event_xp()::text, false),
       set_config('smoke.daily_cap', league.daily_cap_xp()::text, false),
       set_config('smoke.max_batch', league.max_batch()::text, false);

set role authenticated;
select smoke.login(1);
do $$
declare
  r jsonb;
  st text[];
  n timestamptz := now();
begin
  r := public.league_record_xp(jsonb_build_array(
    smoke.ev(smoke.e(1), '20', n - interval '1 minute'),                  -- 0 accepted
    smoke.ev(smoke.e(1), '20', n - interval '1 minute'),                  -- 1 duplicate (same batch)
    smoke.ev(smoke.e(2), '0', n),                                          -- 2 invalid (0)
    smoke.ev(smoke.e(3), '-5', n),                                         -- 3 invalid (negative)
    smoke.ev(smoke.e(4), '2.5', n),                                        -- 4 invalid (not integer)
    smoke.ev(smoke.e(5), to_jsonb(current_setting('smoke.max_event')::int + 1), n),     -- 5 too_big
    smoke.ev(smoke.e(6), '5', n + interval '10 minutes'),                  -- 6 future
    smoke.ev(smoke.e(7), '3', n + interval '2 minutes'),                   -- 7 accepted (clock skew)
    smoke.ev(smoke.e(8), '5', n - interval '9 days'),                      -- 8 too_old
    jsonb_build_object('id', 'not-a-uuid', 'lang', 'it', 'amount', 5, 'source', 'lesson', 'earned_at', n), -- 9 invalid
    smoke.ev(smoke.e(10), '5', n, 'IT'),                                   -- 10 invalid lang
    smoke.ev(smoke.e(11), '5', n, 'it', 'Lesson!'),                        -- 11 invalid source
    smoke.ev(smoke.e(12), '"10"', n),                                      -- 12 invalid (string amount)
    '"oops"'::jsonb                                                        -- 13 invalid (not an object)
  ));
  st := array(select x ->> 'status' from jsonb_array_elements(r -> 'results') x);
  perform smoke.ok(cardinality(st) = 14, 'one result per event');
  perform smoke.ok(st[1] = 'accepted', 'valid event accepted');
  perform smoke.ok(st[2] = 'duplicate', 'duplicate id in the same batch ignored');
  perform smoke.ok(st[3] = 'invalid' and st[4] = 'invalid' and st[5] = 'invalid', 'amount ≤ 0 or fractional rejected');
  perform smoke.ok(st[6] = 'too_big', 'amount above the per-event cap rejected');
  perform smoke.ok(st[7] = 'future', 'earned_at > now + 5 min rejected');
  perform smoke.ok(st[8] = 'accepted', 'earned_at within 5 min of skew accepted');
  perform smoke.ok(st[9] = 'too_old', 'earned_at older than 8 days rejected');
  perform smoke.ok(st[10] = 'invalid' and r -> 'results' -> 9 ->> 'id' = 'not-a-uuid', 'bad id rejected and echoed');
  perform smoke.ok(st[11] = 'invalid' and st[12] = 'invalid' and st[13] = 'invalid' and st[14] = 'invalid', 'bad lang/source/amount type/shape rejected');
  perform smoke.ok((r ->> 'xp_added')::int = 23, 'xp_added sums the accepted amounts');

  r := public.league_record_xp(jsonb_build_array(smoke.ev(smoke.e(1), '20', n - interval '1 minute')));
  perform smoke.ok(r -> 'results' -> 0 ->> 'status' = 'duplicate' and (r ->> 'xp_added')::int = 0, 'resent event ignored');
end $$;
reset role;

set role authenticated;
select smoke.login(1);
select smoke.ok(smoke.err($q$select public.league_record_xp('{}')$q$) = 'events_invalid', 'events must be an array');
select smoke.ok(smoke.err(format($q$select public.league_record_xp((select jsonb_agg(smoke.ev(gen_random_uuid(), '1', now())) from generate_series(1, %s)))$q$,
  current_setting('smoke.max_batch')::int + 1)) = 'too_many_events', 'batch above the size limit rejected');
select smoke.ok((public.league_record_xp('[]', '{"lang": "it", "total_xp": 1234, "streak_count": 3, "streak_best": 9}') ->> 'xp_added')::int = 0, 'stats only, no events');
select smoke.ok(public.league_me('it') #>> '{stats,total_xp}' = '1234' and public.league_me('it') #>> '{stats,streak_best}' = '9', 'stats stored and returned');
select smoke.ok(smoke.err($q$select public.league_record_xp('[]', '{"lang": "it", "total_xp": -1}')$q$) = 'stats_invalid', 'negative stats rejected');

select smoke.login(2);
select smoke.ok(public.league_record_xp(jsonb_build_array(smoke.ev(smoke.e(20), '5', now() - interval '1 hour'))) #>> '{results,0,status}' = 'before_join', 'XP earned before joining rejected');

-- Daily cap (player 4): fill the Madrid day up to cap - 10, then one full event is clamped and
-- the next one gets nothing; another language and the previous Madrid day have their own cap.
select smoke.login(4);
do $$
declare
  m int := current_setting('smoke.max_event')::int;
  c int := current_setting('smoke.daily_cap')::int;
  k int := c / m;
  n timestamptz := now();
  day_start timestamptz := ((n at time zone 'Europe/Madrid')::date)::timestamp at time zone 'Europe/Madrid';
  batch jsonb;
  r jsonb;
begin
  perform smoke.ok(k + 2 <= current_setting('smoke.max_batch')::int and c % m + 10 < m, 'cap test fits the limits');
  batch := (select jsonb_agg(smoke.ev(smoke.e(100 + i), to_jsonb(m), n) order by i) from generate_series(1, k - 1) i)
    || jsonb_build_array(
      smoke.ev(smoke.e(100 + k), to_jsonb(m - 10), n),
      smoke.ev(smoke.e(200), to_jsonb(m), n),
      smoke.ev(smoke.e(201), '1', n));
  r := public.league_record_xp(batch);
  perform smoke.ok(not exists (select 1 from jsonb_array_elements(r -> 'results') with ordinality x(v, i) where i <= k and v ->> 'status' <> 'accepted'), 'events under the daily cap accepted');
  perform smoke.ok(r -> 'results' -> k ->> 'status' = 'capped' and (r -> 'results' -> k ->> 'amount')::int = c - (k * m - 10), 'event crossing the daily cap clamped');
  perform smoke.ok(r -> 'results' -> (k + 1) ->> 'status' = 'capped' and (r -> 'results' -> (k + 1) ->> 'amount')::int = 0, 'event after the daily cap gets 0');
  perform smoke.ok((r ->> 'xp_added')::int = c, 'day total equals the daily cap');
  r := public.league_record_xp(jsonb_build_array(smoke.ev(smoke.e(201), '1', n)));
  perform smoke.ok(r #>> '{results,0,status}' = 'duplicate', 'a capped event is remembered (duplicate on resend)');
  r := public.league_record_xp(jsonb_build_array(smoke.ev(smoke.e(202), '5', n, 'es')));
  perform smoke.ok(r #>> '{results,0,status}' = 'accepted', 'daily cap is per language');
  r := public.league_record_xp(jsonb_build_array(smoke.ev(smoke.e(203), to_jsonb(m), day_start - interval '1 hour')));
  perform smoke.ok(r #>> '{results,0,status}' = 'accepted' and (r ->> 'xp_added')::int = m, 'daily cap is per Madrid day');
end $$;
reset role;

-- Concurrency safety: the cap is computed under a per-user advisory lock.
select smoke.ok(position('pg_advisory_xact_lock' in pg_get_functiondef('public.league_record_xp(jsonb, jsonb)'::regprocedure)) > 0, 'record_xp serialises batches per user');

-- =============================================================================================
-- 5. Week: Monday 00:00 Europe/Madrid (DST aware)

select smoke.ok(league.week_start('2026-10-05 00:30:00+00') = '2026-10-04 22:00:00+00', 'week_start: Monday 02:30 Madrid → Monday 00:00 CEST');
select smoke.ok(league.week_start('2026-10-04 22:00:00+00') = '2026-10-04 22:00:00+00', 'week_start: exactly Monday 00:00 Madrid');
select smoke.ok(league.week_start('2026-10-04 21:59:59+00') = '2026-09-27 22:00:00+00', 'week_start: Sunday 23:59:59 Madrid is the previous week');
select smoke.ok(league.week_start('2026-11-01 23:00:00+00') = '2026-11-01 23:00:00+00', 'week_start: Monday 00:00 CET (winter)');
select smoke.ok(league.week_start('2026-11-01 22:59:59+00') = '2026-10-25 23:00:00+00', 'week_start: week after the DST change');
select smoke.ok(league.week_end('2026-10-20 12:00:00+00') = '2026-10-25 23:00:00+00', 'week_end: crosses the DST change (169 h week)');
select smoke.ok(league.week_end('2026-10-05 00:30:00+00') = '2026-10-11 22:00:00+00', 'week_end: next Monday 00:00 Madrid');

set role authenticated;
select smoke.login(1);
do $$
declare
  me jsonb := public.league_me('it');
  ws timestamptz := (me #>> '{week,start}')::timestamptz;
  before_xp int := (me ->> 'weekly_xp')::int;
  r jsonb;
begin
  perform smoke.ok(ws = date_trunc('week', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid', 'league_me.week.start is this Monday 00:00 Madrid');
  r := public.league_record_xp(jsonb_build_array(
    smoke.ev(smoke.e(30), '7', ws - interval '1 second'),
    smoke.ev(smoke.e(31), '11', least(ws + interval '1 second', now()))));
  perform smoke.ok((r ->> 'xp_added')::int = 18, 'boundary events accepted');
  perform smoke.ok((public.league_me('it') ->> 'weekly_xp')::int = before_xp + 11, 'weekly XP counts only events from Monday 00:00 Madrid');
end $$;
reset role;

-- =============================================================================================
-- 6. Leaderboards: top 50 + me, group and global

-- 60 bulk players with 1..55 XP each this week (the last ones tie on 55).
do $$
declare i int;
begin
  for i in 101..160 loop
    perform smoke.login(i);
    perform public.league_set_profile('Jugador' || i, '🐟');
    perform public.league_record_xp(jsonb_build_array(smoke.ev(gen_random_uuid(), to_jsonb(least(i - 100, 55)), now())));
  end loop;
end $$;
select set_config('smoke.with_xp', (
  select count(*)::text from (
    select user_id from league.xp_events
    where lang = 'it' and earned_at >= league.week_start(now())
    group by user_id having sum(amount) > 0) t), false);

set role authenticated;
select smoke.login(101); -- 1 XP: outside the top 50
do $$
declare
  rows_ int;
  n int;
begin
  perform smoke.ok(current_setting('smoke.with_xp')::int > 50, 'more than 50 players with XP this week');
  select count(*) into rows_ from public.league_leaderboard('it', 'global');
  perform smoke.ok(rows_ = 51, 'global: top 50 + my row');
  select count(*) into n from public.league_leaderboard('it', 'global') b where b.is_me;
  perform smoke.ok(n = 1, 'global: exactly one row is mine');
  select count(*) into n from (
    select b.weekly_xp, lag(b.weekly_xp) over () as prev_xp, b.rank, lag(b.rank) over () as prev_rank
    from public.league_leaderboard('it', 'global') b) t
  where t.prev_xp < t.weekly_xp or t.prev_rank > t.rank;
  perform smoke.ok(n = 0, 'global: sorted by weekly XP, ranks non-decreasing');
  select count(distinct b.rank) into n from public.league_leaderboard('it', 'global') b where b.weekly_xp = 55;
  perform smoke.ok(n = 1, 'global: ties share the rank');
  perform smoke.ok((select b.nickname from public.league_leaderboard('it', 'global') b limit 1) = 'Capper', 'global: top player first');
  perform smoke.ok((select b.is_me and b.weekly_xp = 1 from public.league_leaderboard('it', 'global') b offset 50 limit 1), 'global: my row comes last');
  perform smoke.ok((public.league_me('it') #>> '{rank,global}')::int = (select b.rank from public.league_leaderboard('it', 'global') b where b.is_me), 'league_me.rank.global matches the board');
end $$;

select smoke.login(2); -- has a profile, 0 XP this week
select smoke.ok((select count(*) from public.league_leaderboard('it', 'global')) = 51, 'global: player with 0 XP still sees own row');
select smoke.ok((select b.weekly_xp from public.league_leaderboard('it', 'global') b where b.is_me) = 0, 'global: own row with 0 XP');

select smoke.login(5); -- no profile
select smoke.ok((select count(*) from public.league_leaderboard('it', 'global')) = 50, 'global without profile: top 50 only');
select smoke.ok((select count(*) from public.league_leaderboard('it', 'group')) = 0, 'group without group: empty');

select smoke.login(1);
select smoke.ok((select count(*) from public.league_leaderboard('it', 'group')) = 2, 'group: every member, 0 XP included');
select smoke.ok((select b.is_me and b.rank = 1 from public.league_leaderboard('it', 'group') b limit 1), 'group: ranked by weekly XP');
select smoke.ok((select b.weekly_xp = 0 and not b.is_me from public.league_leaderboard('it', 'group') b offset 1 limit 1), 'group: member without XP last');
select smoke.ok((select b.streak from public.league_leaderboard('it', 'group') b where b.is_me) = 3, 'board shows the streak from stats');
select smoke.ok((public.league_me('it') #>> '{rank,group}')::int = 1, 'league_me.rank.group');
select smoke.ok((select count(*) from public.league_leaderboard('es', 'global')) = 2, 'rankings are per language (only es players + me)');
select smoke.ok(smoke.err($q$select * from public.league_leaderboard('it', 'friends')$q$) = 'scope_invalid', 'bad scope rejected');
select smoke.ok(smoke.err($q$select * from public.league_leaderboard('Italian', 'global')$q$) = 'lang_invalid', 'bad lang rejected');

select smoke.login(3);
select smoke.ok(public.league_me('it') -> 'group' = 'null'::jsonb and public.league_me('it') #> '{rank,group}' = 'null'::jsonb, 'league_me without group');
reset role;

-- =============================================================================================
-- 7. Last week's podium

-- Last week's XP goes in directly (record_xp would reject most of it as before joining).
insert into league.xp_events (id, user_id, lang, amount, source, earned_at)
select gen_random_uuid(), smoke.u(v.n), 'it', v.xp, 'lesson',
       league.week_start(league.week_start(now()) - interval '1 day') + interval '1 hour'
from (values (2, 3000), (3, 2000), (101, 1000), (102, 500)) v(n, xp);

set role authenticated;
select smoke.login(3);
select smoke.ok((select string_agg(b.nickname || ':' || b.weekly_xp, ',' order by b.rank) from public.league_last_week_podium('it', 'global') b)
  = 'Giulia:3000,Turi:2000,Jugador101:1000', 'global podium: last week top 3');
select smoke.ok((select b.is_me from public.league_last_week_podium('it', 'global') b where b.nickname = 'Turi'), 'podium marks my row');
select smoke.login(1);
select smoke.ok((select string_agg(b.nickname || ':' || b.weekly_xp, ',' order by b.rank) from public.league_last_week_podium('it', 'group') b)
  = 'Giulia:3000,Hernán:7', 'group podium: only members with XP, last week only');
select smoke.ok((select count(*) from public.league_last_week_podium('es', 'global')) = 0, 'podium per language');
reset role;

-- =============================================================================================
-- 8. Delete my data

set role authenticated;
select smoke.login(2);
select smoke.ok(public.league_delete_me(), 'delete_me');
select smoke.ok(public.league_me('it') -> 'profile' = 'null'::jsonb, 'profile gone');
select smoke.ok(not public.league_delete_me(), 'delete_me again → false');
select smoke.login(1);
select smoke.ok((public.league_me('it') #>> '{group,members}')::int = 1, 'deleted player left the group');
reset role;
select smoke.ok(not exists (select 1 from league.profiles where user_id = smoke.u(2))
  and not exists (select 1 from league.members where user_id = smoke.u(2))
  and not exists (select 1 from league.xp_events where user_id = smoke.u(2))
  and not exists (select 1 from league.stats where user_id = smoke.u(2)), 'no rows left for the deleted player');

set role authenticated;
select smoke.login(2);
select smoke.ok(public.league_set_profile('Giulia', '🐬') ->> 'nickname' = 'Giulia', 'nickname free again after delete');
select smoke.login(1);
select smoke.ok(public.league_delete_me(), 'last member deletes their data');
reset role;
select smoke.ok(not exists (select 1 from league.groups where code = current_setting('smoke.code1')), 'their now-empty group is deleted');
select smoke.ok(not exists (select 1 from league.stats where user_id = smoke.u(1)), 'their stats are deleted');

-- Deleting the auth user (dashboard) cascades too.
delete from auth.users where id = smoke.u(4);
select smoke.ok(not exists (select 1 from league.profiles where user_id = smoke.u(4))
  and not exists (select 1 from league.xp_events where user_id = smoke.u(4)), 'auth user deletion cascades');
