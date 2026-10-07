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
    'public.league_create_group(text)', 'public.league_join_group(text)', 'public.league_leave_group(text)',
    'public.league_leaderboard(text, text)', 'public.league_last_week_podium(text, text)',
    'public.league_me(text)', 'public.league_delete_me()',
    'public.league_status()', 'public.league_ranking(text, text)', 'public.league_podium(text, text)',
    'public.league_save_head()', 'public.league_save_get()', 'public.league_save_put(jsonb, bigint)',
    'public.league_save_delete()']) as f(sig)
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
select smoke.ok(public.league_me('it') #>> '{group,code}' = current_setting('smoke.code1'), 'league_me shows the group');
select smoke.ok(public.league_status() #>> '{groups,0,code}' = current_setting('smoke.code1')
  and (public.league_status() #>> '{groups,0,members}')::int = 1
  and (public.league_status() #>> '{groups,0,rank}')::int = 1, 'league_status lists the group (members, my rank)');

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
select smoke.ok((public.league_join_group(current_setting('smoke.code2')) ->> 'members')::int = 2, 'join a second group without leaving the first');
select smoke.ok((select string_agg(g ->> 'code', ',') from jsonb_array_elements(public.league_status() -> 'groups') g)
  = current_setting('smoke.code1') || ',' || current_setting('smoke.code2'), 'league_status: groups, earliest joined first');
select smoke.ok(public.league_me('it') #>> '{group,code}' = current_setting('smoke.code1'), 'old league_me: the group = the earliest joined');
select smoke.ok(public.league_leave_group(lower(current_setting('smoke.code1'))), 'leave one group by code');
select smoke.ok((select string_agg(g ->> 'code', ',') from jsonb_array_elements(public.league_status() -> 'groups') g)
  = current_setting('smoke.code2'), 'the other group is kept');
select smoke.ok(public.league_me('it') #>> '{group,code}' = current_setting('smoke.code2'), 'old league_me: next group after leaving');
select smoke.ok(not public.league_leave_group(current_setting('smoke.code1')), 'leave a group I am not in → false');
select smoke.ok(not public.league_leave_group('ZZZZZZ'), 'leave an unknown code → false');
select smoke.ok((public.league_join_group(current_setting('smoke.code1')) ->> 'members')::int = 2, 'rejoin group 1');
select smoke.ok(public.league_leave_group(), 'old league_leave_group() leaves the earliest joined group');
select smoke.ok((select string_agg(g ->> 'code', ',') from jsonb_array_elements(public.league_status() -> 'groups') g)
  = current_setting('smoke.code1'), 'back in group 1 only');
select smoke.ok(not public.league_leave_group(current_setting('smoke.code2')), 'not in group 2 any more');
select smoke.ok(smoke.err(format('select * from public.league_ranking(%L, %L)', 'group', current_setting('smoke.code2'))) = 'not_in_group', 'ranking of a group I am not in → not_in_group');
select smoke.ok(smoke.err($q$select * from public.league_ranking('group', 'ZZZZZZ')$q$) = 'group_not_found', 'ranking of an unknown code → group_not_found');
select smoke.ok(smoke.err($q$select * from public.league_podium('group')$q$) = 'group_not_found', 'group podium without code → group_not_found');
select smoke.ok(smoke.err($q$select * from public.league_ranking('friends')$q$) = 'scope_invalid', 'new RPCs: bad scope rejected');

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
       set_config('smoke.max_batch', league.max_batch()::text, false),
       set_config('smoke.max_groups', league.max_groups()::text, false);

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
  r := public.league_record_xp(jsonb_build_array(smoke.ev(smoke.e(202), '5', n, 'fr')));
  perform smoke.ok(r #>> '{results,0,status}' = 'capped' and (r ->> 'xp_added')::int = 0, 'daily cap is across languages (fr after a full it day gets 0)');
  r := public.league_record_xp(jsonb_build_array(smoke.ev(smoke.e(203), to_jsonb(m), day_start - interval '1 hour', 'fr')));
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
select smoke.ok(public.league_status() -> 'profile' = 'null'::jsonb and public.league_status() -> 'groups' = '[]'::jsonb
  and public.league_status() #> '{rank,global}' = 'null'::jsonb, 'league_status without profile');
select smoke.ok((select count(*) from public.league_ranking('global')) = 50, 'league_ranking without profile: top 50 only');

select smoke.login(1);
select smoke.ok((select count(*) from public.league_leaderboard('it', 'group')) = 2, 'group: every member, 0 XP included');
select smoke.ok((select b.is_me and b.rank = 1 from public.league_leaderboard('it', 'group') b limit 1), 'group: ranked by weekly XP');
select smoke.ok((select b.weekly_xp = 0 and not b.is_me from public.league_leaderboard('it', 'group') b offset 1 limit 1), 'group: member without XP last');
select smoke.ok((select b.streak from public.league_leaderboard('it', 'group') b where b.is_me) = 3, 'board shows the streak from stats');
select smoke.ok((public.league_me('it') #>> '{rank,group}')::int = 1, 'league_me.rank.group');
select smoke.ok((select count(*) from (
    select * from public.league_leaderboard('es', 'global') except all select * from public.league_leaderboard('it', 'global')) t) = 0
  and (select count(*) from public.league_leaderboard('es', 'global')) = (select count(*) from public.league_leaderboard('it', 'global')), 'old leaderboard: same summed ranking whatever the lang');
select smoke.ok((select count(*) from (
    select * from public.league_ranking('global') except all select * from public.league_leaderboard('it', 'global')) t) = 0
  and (select count(*) from public.league_ranking('global')) = (select count(*) from public.league_leaderboard('it', 'global')),
  'league_ranking(global) = old leaderboard');
select smoke.ok((select count(*) from (
    select * from public.league_ranking('group', current_setting('smoke.code1')) except all select * from public.league_leaderboard('it', 'group')) t) = 0
  and (select count(*) from public.league_ranking('group', current_setting('smoke.code1'))) = 2, 'league_ranking(group, code) = old group leaderboard');

-- Weekly XP is summed over every language; streak = max over the per-language stats.
do $$
declare
  st jsonb := public.league_status();
  before_xp int := (st ->> 'weekly_xp')::int;
  before_me int := (public.league_me('it') ->> 'weekly_xp')::int;
  r jsonb;
begin
  perform smoke.ok(before_xp = before_me, 'league_status.weekly_xp = old league_me.weekly_xp');
  r := public.league_record_xp(jsonb_build_array(smoke.ev(smoke.e(40), '13', now(), 'fr')),
    '{"lang": "fr", "total_xp": 13, "streak_count": 7, "streak_best": 7}');
  perform smoke.ok((r ->> 'xp_added')::int = 13, 'fr event accepted');
  st := public.league_status();
  perform smoke.ok((st ->> 'weekly_xp')::int = before_xp + 13, 'weekly XP sums it + fr');
  perform smoke.ok((public.league_me('it') ->> 'weekly_xp')::int = before_me + 13, 'old league_me(it): summed weekly XP');
  perform smoke.ok((select b.weekly_xp from public.league_ranking('global') b where b.is_me) = before_xp + 13, 'global ranking row sums it + fr');
  perform smoke.ok((select b.weekly_xp from public.league_ranking('group', current_setting('smoke.code1')) b where b.is_me) = before_xp + 13, 'group ranking row sums it + fr');
  perform smoke.ok((st ->> 'streak')::int = 7 and (select b.streak from public.league_ranking('global') b where b.is_me) = 7
    and (select b.streak from public.league_leaderboard('it', 'group') b where b.is_me) = 7, 'streak = max over the per-language stats');
  perform smoke.ok(public.league_me('it') #>> '{stats,streak_count}' = '3', 'old league_me(it) still returns the it stats');
  perform smoke.ok(jsonb_array_length(st -> 'stats') = 2 and st #>> '{stats,0,lang}' = 'fr', 'league_status lists the stats per language');
  perform smoke.ok((st #>> '{rank,global}')::int = (select b.rank from public.league_ranking('global') b where b.is_me), 'league_status.rank.global matches the ranking');
  perform smoke.ok((st #>> '{groups,0,rank}')::int = (select b.rank from public.league_ranking('group', current_setting('smoke.code1')) b where b.is_me), 'league_status group rank matches the group ranking');
  perform smoke.ok((st ->> 'max_groups')::int = current_setting('smoke.max_groups')::int, 'league_status.max_groups');
end $$;
select smoke.ok(smoke.err($q$select * from public.league_leaderboard('it', 'friends')$q$) = 'scope_invalid', 'bad scope rejected');
select smoke.ok(smoke.err($q$select * from public.league_leaderboard('Italian', 'global')$q$) = 'lang_invalid', 'bad lang rejected');

select smoke.login(3);
select smoke.ok(public.league_me('it') -> 'group' = 'null'::jsonb and public.league_me('it') #> '{rank,group}' = 'null'::jsonb, 'league_me without group');
reset role;

-- =============================================================================================
-- 7. Last week's podium

-- Last week's XP goes in directly (record_xp would reject most of it as before joining).
insert into league.xp_events (id, user_id, lang, amount, source, earned_at)
select gen_random_uuid(), smoke.u(v.n), v.lang, v.xp, 'lesson',
       league.week_start(league.week_start(now()) - interval '1 day') + interval '1 hour'
from (values (2, 'it', 3000), (3, 'it', 1500), (3, 'fr', 500), (101, 'fr', 1000), (102, 'it', 500)) v(n, lang, xp);

set role authenticated;
select smoke.login(3);
select smoke.ok((select string_agg(b.nickname || ':' || b.weekly_xp, ',' order by b.rank) from public.league_last_week_podium('it', 'global') b)
  = 'Giulia:3000,Turi:2000,Jugador101:1000', 'global podium: last week top 3, it + fr summed');
select smoke.ok((select b.is_me from public.league_last_week_podium('it', 'global') b where b.nickname = 'Turi'), 'podium marks my row');
select smoke.login(1);
select smoke.ok((select string_agg(b.nickname || ':' || b.weekly_xp, ',' order by b.rank) from public.league_last_week_podium('it', 'group') b)
  = 'Giulia:3000,Hernán:7', 'group podium: only members with XP, last week only');
select smoke.ok((select string_agg(b.nickname || ':' || b.weekly_xp, ',' order by b.rank) from public.league_last_week_podium('es', 'group') b)
  = 'Giulia:3000,Hernán:7', 'old podium: summed, whatever the lang');
select smoke.ok((select string_agg(b.nickname || ':' || b.weekly_xp, ',' order by b.rank) from public.league_podium('group', current_setting('smoke.code1')) b)
  = 'Giulia:3000,Hernán:7', 'league_podium(group, code)');
select smoke.ok((select string_agg(b.nickname || ':' || b.weekly_xp, ',' order by b.rank) from public.league_podium() b)
  = 'Giulia:3000,Turi:2000,Jugador101:1000', 'league_podium(global)');
reset role;

-- =============================================================================================
-- 7b. Up to max_groups groups per player

set role authenticated;
select smoke.login(151);
do $$
declare g jsonb := public.league_create_group('Extra');
begin
  perform set_config('smoke.code_extra', g ->> 'code', false);
end $$;
select smoke.login(150);
do $$
declare
  k int := current_setting('smoke.max_groups')::int;
  i int;
  g jsonb;
  st jsonb;
begin
  for i in 1..k loop
    g := public.league_create_group('Gruppo ' || i);
    if i = 1 then perform set_config('smoke.code_g1', g ->> 'code', false); end if;
    if i = 2 then perform set_config('smoke.code_g2', g ->> 'code', false); end if;
  end loop;
  st := public.league_status();
  perform smoke.ok(jsonb_array_length(st -> 'groups') = k, format('in %s groups at once', k));
  perform smoke.ok(st #>> '{groups,0,code}' = current_setting('smoke.code_g1'), 'groups listed in joining order');
  perform smoke.ok(smoke.err($q$select public.league_create_group('Uno di troppo')$q$) = 'too_many_groups', 'create beyond the limit → too_many_groups');
  perform smoke.ok(smoke.err(format('select public.league_join_group(%L)', current_setting('smoke.code_extra'))) = 'too_many_groups', 'join beyond the limit → too_many_groups');
  perform smoke.ok((public.league_join_group(current_setting('smoke.code_g2')) ->> 'members')::int = 1, 'rejoining a group I am in is still fine at the limit');
  perform smoke.ok(public.league_leave_group(current_setting('smoke.code_g2')), 'leave one group');
  perform smoke.ok((public.league_join_group(current_setting('smoke.code_extra')) ->> 'members')::int = 2, 'room for another group after leaving one');
  perform smoke.ok(smoke.err($q$select public.league_create_group('Uno di troppo')$q$) = 'too_many_groups', 'full again');
  perform smoke.ok(public.league_me('it') #>> '{group,code}' = current_setting('smoke.code_g1'), 'old league_me: earliest of many groups');
  perform smoke.ok(smoke.err($q$select public.league_create_group('Otro')$q$) = 'too_many_groups', 'old already_in_group is gone, too_many_groups instead');
end $$;
select smoke.ok(public.league_delete_me(), 'delete_me with many groups');
reset role;
select smoke.ok(not exists (select 1 from league.members where user_id = smoke.u(150)), 'delete_me removes every membership');
select smoke.ok((select count(*) from league.groups where name like 'Gruppo %') = 0, 'groups left empty by delete_me are deleted');
select smoke.ok((select count(*) from league.members m join league.groups g on g.id = m.group_id
  where g.code = current_setting('smoke.code_extra')) = 1, 'shared group kept with its other member');
select smoke.ok(position('league.lock_member' in pg_get_functiondef('league.join(uuid, uuid)'::regprocedure)) > 0, 'joins serialised per user (group limit cannot be raced)');

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

-- =============================================================================================
-- 9. Cloud save (league.saves + league_save_*)

-- Users 6 and 7: no Liga profile needed (the save belongs to the auth user).
insert into auth.users (id) select smoke.u(n) from generate_series(6, 7) n;

create function smoke.blob(note text) returns jsonb
language sql immutable as $$
  select jsonb_build_object('app', 'lang-lern', 'format', 1, 'exportedAt', '2026-10-08T10:00:00Z',
    'data', jsonb_build_object('lang-lern:progress:it', note))
$$;
grant execute on function smoke.blob(text) to anon, authenticated;

select smoke.ok(position('league.saves' in pg_get_functiondef('public.league_delete_me()'::regprocedure)) > 0,
  'league_delete_me re-created to delete the save');

set role authenticated;
select smoke.login(6);
select smoke.ok(public.league_save_head() is null, 'no save yet: head is null');
select smoke.ok(public.league_save_get() is null, 'no save yet: get is null');
select smoke.ok(public.league_save_put(smoke.blob('x'), 0) ->> 'status' = 'conflict', 'base rev given but no copy → conflict');
select smoke.ok(public.league_save_head() is null, 'conflict wrote nothing');
do $$
declare r jsonb;
begin
  r := public.league_save_put(smoke.blob('first'), null);
  perform smoke.ok(r ->> 'status' = 'ok' and (r ->> 'rev')::bigint = 1, 'put with null base → ok rev 1');
  perform smoke.ok((r ->> 'size')::int = octet_length(smoke.blob('first')::text) and r ? 'updated_at', 'put returns size and updated_at');
  r := public.league_save_put(smoke.blob('second'), 1);
  perform smoke.ok(r ->> 'status' = 'ok' and (r ->> 'rev')::bigint = 2, 'put base 1 → ok rev 2');
  r := public.league_save_put(smoke.blob('stale'), 1);
  perform smoke.ok(r ->> 'status' = 'conflict' and (r ->> 'rev')::bigint = 2, 'stale base → conflict with the stored head');
  perform smoke.ok(not r ? 'data', 'conflict carries no data');
  r := public.league_save_put(smoke.blob('again'), null);
  perform smoke.ok(r ->> 'status' = 'conflict' and (r ->> 'rev')::bigint = 2, 'null base when a copy exists → conflict');
  r := public.league_save_get();
  perform smoke.ok((r ->> 'rev')::bigint = 2 and r -> 'data' = smoke.blob('second'), 'data unchanged after conflicts');
  r := public.league_save_head();
  perform smoke.ok((r ->> 'rev')::bigint = 2 and not r ? 'data' and r ? 'size' and r ? 'updated_at', 'head: rev, size, updated_at, no data');
end $$;

-- Invalid and too large blobs (the limit comes from the migration).
reset role;
select set_config('smoke.save_max', league.save_max_bytes()::text, false),
       set_config('smoke.save_writes', league.save_max_writes_per_hour()::text, false);
set role authenticated;
select smoke.login(6);
select smoke.ok(smoke.err($q$select public.league_save_put(null, 2)$q$) = 'save_invalid', 'null blob → save_invalid');
select smoke.ok(smoke.err($q$select public.league_save_put('[1]', 2)$q$) = 'save_invalid', 'array blob → save_invalid');
select smoke.ok(smoke.err($q$select public.league_save_put(smoke.blob('x') || '{"app": "other"}', 2)$q$) = 'save_invalid', 'wrong app → save_invalid');
select smoke.ok(smoke.err($q$select public.league_save_put(smoke.blob('x') - 'app', 2)$q$) = 'save_invalid', 'missing app → save_invalid');
select smoke.ok(smoke.err($q$select public.league_save_put(smoke.blob('x') || '{"format": 1.5}', 2)$q$) = 'save_invalid', 'non-integer format → save_invalid');
select smoke.ok(smoke.err($q$select public.league_save_put(smoke.blob('x') || '{"format": "1"}', 2)$q$) = 'save_invalid', 'string format → save_invalid');
select smoke.ok(smoke.err($q$select public.league_save_put(smoke.blob('x') || '{"data": []}', 2)$q$) = 'save_invalid', 'data not an object → save_invalid');
select smoke.ok(smoke.err($q$select public.league_save_put(smoke.blob(repeat('a', current_setting('smoke.save_max')::int)), 2)$q$) = 'save_too_large', 'blob over the size cap → save_too_large');
select smoke.ok(public.league_save_put(smoke.blob(repeat('a', current_setting('smoke.save_max')::int - 200)), 2) ->> 'status' = 'ok', 'blob just under the cap → ok');
select smoke.ok((public.league_save_head() ->> 'rev')::bigint = 3, 'rejected puts did not bump rev');

-- User 7 cannot see (or touch) user 6's save.
select smoke.login(7);
select smoke.ok(public.league_save_head() is null and public.league_save_get() is null, 'another user sees no save');
select smoke.ok(public.league_save_put(smoke.blob('mine'), null) ->> 'rev' = '1', 'another user has their own rev 1');
select public.league_save_delete();
select smoke.ok(public.league_save_head() is null, 'save_delete removes my copy');
select public.league_save_delete();
select smoke.ok(true, 'save_delete with no copy is a no-op');
select smoke.login(6);
select smoke.ok((public.league_save_head() ->> 'rev')::bigint = 3, 'the other user''s delete left my save alone');
select smoke.login(null);
select smoke.ok(smoke.err($q$select public.league_save_head()$q$) = 'not_authenticated', 'no JWT → not_authenticated');
reset role;

set role anon;
select smoke.login(6);
select smoke.ok(smoke.state($q$select public.league_save_get()$q$) = '42501', 'anon: league_save_get not executable');
select smoke.ok(smoke.state($q$select public.league_save_head()$q$) = '42501', 'anon: league_save_head not executable');
select smoke.ok(smoke.state($q$select public.league_save_put(smoke.blob('x'), 3)$q$) = '42501', 'anon: league_save_put not executable');
select smoke.ok(smoke.state($q$select public.league_save_delete()$q$) = '42501', 'anon: league_save_delete not executable');
reset role;

-- Rate limit: N writes per hour per user, then save_rate_limited; a window an hour old resets it.
update league.saves set window_start = now(), window_writes = 0 where user_id = smoke.u(6);
set role authenticated;
select smoke.login(6);
do $$
declare
  n int := current_setting('smoke.save_writes')::int;
  rev bigint := (public.league_save_head() ->> 'rev')::bigint;
  i int;
  r jsonb;
begin
  for i in 1..n loop
    r := public.league_save_put(smoke.blob('w' || i), rev);
    rev := (r ->> 'rev')::bigint;
  end loop;
  perform smoke.ok(r ->> 'status' = 'ok' and rev = 3 + n, format('%s writes in an hour are fine', n));
  perform smoke.ok(smoke.err(format('select public.league_save_put(smoke.blob(%L), %s)', 'over', rev)) = 'save_rate_limited', 'one more → save_rate_limited');
  perform smoke.ok((public.league_save_get() ->> 'rev')::bigint = rev and public.league_save_get() -> 'data' = smoke.blob('w' || n), 'rate-limited put wrote nothing');
  perform smoke.ok(public.league_save_put(smoke.blob('stale'), rev - 1) ->> 'status' = 'conflict', 'conflict still answered while rate limited');
end $$;
reset role;
update league.saves set window_start = now() - interval '61 minutes' where user_id = smoke.u(6);
set role authenticated;
select smoke.login(6);
select smoke.ok(public.league_save_put(smoke.blob('later'), (public.league_save_head() ->> 'rev')::bigint) ->> 'status' = 'ok', 'writes allowed again after an hour');
reset role;
select smoke.ok((select window_writes from league.saves where user_id = smoke.u(6)) = 1, 'new window counts from 1');

-- league_delete_me removes the save (no Liga profile needed).
set role authenticated;
select smoke.login(6);
select smoke.ok(not public.league_delete_me(), 'delete_me without a profile → false');
select smoke.ok(public.league_save_head() is null, 'delete_me removes the save');
select smoke.login(7);
select smoke.ok(public.league_save_put(smoke.blob('keep'), null) ->> 'status' = 'ok', 'user 7 saves again');
reset role;
select smoke.ok(not exists (select 1 from league.saves where user_id = smoke.u(6)), 'no save row left after delete_me');

-- Deleting the auth user cascades to the save.
delete from auth.users where id = smoke.u(7);
select smoke.ok(not exists (select 1 from league.saves where user_id = smoke.u(7)), 'auth user deletion cascades to the save');
