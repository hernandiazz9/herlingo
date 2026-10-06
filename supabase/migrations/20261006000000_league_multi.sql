-- Liga, multi-language (docs/league.md, decision record 2026-10-06):
--   * weekly XP = sum over every language (the week is unchanged: Monday 00:00 Europe/Madrid);
--     `lang` is still recorded on every event and stat;
--   * daily cap = 2500 XP per player per Madrid day across all languages;
--   * a player can be in up to 10 groups at once (`too_many_groups`), plus the general table;
--   * leaderboard streak = max of the player's per-language stats;
--   * new RPCs for the multi-group client: league_status(), league_ranking(scope, code),
--     league_podium(scope, code), league_leave_group(code);
--   * the old RPCs keep their signatures and keep answering for installed app versions:
--     summed XP, "the group" = the earliest joined one.
-- Applied on top of 20261001000000_league.sql (never edited).

-- ---------------------------------------------------------------------------------------------
-- Rules

create function league.max_groups() returns integer language sql immutable set search_path = '' as $$ select 10 $$;

-- ---------------------------------------------------------------------------------------------
-- Members: one row per (user, group) instead of one per user.

alter table league.members drop constraint members_pkey;
alter table league.members add primary key (user_id, group_id);
-- Several joins in one transaction still get distinct times (earliest group = first joined).
alter table league.members alter column joined_at set default clock_timestamp();
comment on table league.members is 'Group membership: a player is in up to league.max_groups() groups.';

-- ---------------------------------------------------------------------------------------------
-- XP events: rankings and the daily cap no longer filter by language.

drop index league.xp_events_lang_earned_idx;
drop index league.xp_events_user_lang_earned_idx;
create index xp_events_earned_idx on league.xp_events (earned_at) include (user_id, amount);
create index xp_events_user_earned_idx on league.xp_events (user_id, earned_at) include (amount);

-- ---------------------------------------------------------------------------------------------
-- Internal helpers

-- Group id for a code typed by a user (case-insensitive, spaces ignored); null when unknown.
create function league.group_by_code(p_code text) returns uuid
language sql stable set search_path = ''
as $$
  select g.id from league.groups g where g.code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))
$$;

-- The group a player joined first (what the old one-group RPCs call "the group").
create function league.first_group(uid uuid) returns uuid
language sql stable set search_path = ''
as $$
  select m.group_id from league.members m where m.user_id = uid order by m.joined_at, m.group_id limit 1
$$;

-- Leaves one group; deletes it when it becomes empty. true = was a member.
create function league.leave_one(uid uuid, gid uuid) returns boolean
language plpgsql set search_path = ''
as $$
begin
  delete from league.members m where m.user_id = uid and m.group_id = gid;
  if not found then return false; end if;
  delete from league.groups gr
  where gr.id = gid and not exists (select 1 from league.members m where m.group_id = gid);
  return true;
end $$;

-- Leaves every group of the player (league_delete_me), deleting the ones that become empty.
create or replace function league.leave(uid uuid) returns boolean
language plpgsql set search_path = ''
as $$
declare v_groups uuid[];
begin
  with gone as (delete from league.members m where m.user_id = uid returning m.group_id)
  select array_agg(gone.group_id) into v_groups from gone;
  if v_groups is null then return false; end if;
  delete from league.groups gr
  where gr.id = any (v_groups) and not exists (select 1 from league.members m where m.group_id = gr.id);
  return true;
end $$;

-- Serialises membership changes of one player (so the group limit cannot be raced).
create function league.lock_member(uid uuid) returns void
language sql set search_path = ''
as $$ select pg_advisory_xact_lock(hashtextextended('league-groups:' || uid::text, 0)) $$;

-- Adds the player to a group, enforcing the group limit. Joining a group you are in is a no-op.
create function league.join(uid uuid, gid uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  perform league.lock_member(uid);
  if exists (select 1 from league.members m where m.user_id = uid and m.group_id = gid) then return; end if;
  if (select count(*) from league.members m where m.user_id = uid) >= league.max_groups() then
    perform league.fail('too_many_groups');
  end if;
  insert into league.members (user_id, group_id) values (uid, gid);
end $$;

-- Ranking of one week window, XP summed over every language: top 50 by XP plus the caller's row.
-- Group scope = every member of p_group (0 XP included; empty when p_group is null); global
-- scope = everyone with XP in the window, plus the caller. `streak` = the best current streak
-- among the player's per-language stats. `rank` is shared on ties; rows come in display order.
create function league.ranking(p_scope text, p_uid uuid, p_group uuid, p_from timestamptz, p_to timestamptz)
returns table (rank integer, nickname text, emoji text, weekly_xp integer, streak integer, is_me boolean)
language sql stable set search_path = ''
as $$
  with xp as (
    select e.user_id, sum(e.amount)::integer as xp
    from league.xp_events e
    where e.earned_at >= p_from and e.earned_at < p_to
      and (p_scope <> 'group'
        or e.user_id in (select m.user_id from league.members m where m.group_id = p_group))
    group by e.user_id
  ),
  pool as (
    select p.user_id, p.nickname, p.emoji, coalesce(x.xp, 0) as xp
    from league.profiles p
    left join xp x on x.user_id = p.user_id
    where case
      when p_scope = 'group' then p.user_id in (select m.user_id from league.members m where m.group_id = p_group)
      else coalesce(x.xp, 0) > 0 or p.user_id = p_uid
    end
  ),
  ranked as (
    select pool.*,
      rank() over (order by pool.xp desc) as rnk,
      row_number() over (order by pool.xp desc, lower(pool.nickname), pool.user_id) as pos
    from pool
  )
  select r.rnk::integer, r.nickname, r.emoji, r.xp,
    coalesce((select max(s.streak_count) from league.stats s where s.user_id = r.user_id), 0)::integer,
    r.user_id = p_uid
  from ranked r
  where r.pos <= 50 or r.user_id = p_uid
  order by r.pos
$$;

-- Group of a scope/code pair for the new RPCs: null for global; the group for scope 'group',
-- which the caller must belong to.
create function league.scope_group(p_scope text, p_code text, p_uid uuid) returns uuid
language plpgsql stable set search_path = ''
as $$
declare v_group uuid;
begin
  if league.check_scope(p_scope) = 'global' then return null; end if;
  v_group := league.group_by_code(p_code);
  if v_group is null then perform league.fail('group_not_found'); end if;
  if not exists (select 1 from league.members m where m.user_id = p_uid and m.group_id = v_group) then
    perform league.fail('not_in_group');
  end if;
  return v_group;
end $$;

-- Replaced by league.ranking (every caller is redefined below).
drop function league.board(text, text, uuid, timestamptz, timestamptz);

revoke all on all functions in schema league from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Changed RPCs (same signatures)

-- Daily cap across languages; otherwise unchanged (docs/league.md).
create or replace function public.league_record_xp(events jsonb, stats jsonb default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_profile league.profiles := league.require_profile();
  v_uid uuid := v_profile.user_id;
  v_events jsonb := coalesce(events, '[]'::jsonb);
  v_stats jsonb := stats;
  v_now timestamptz := now();
  e jsonb;
  v_raw_id text;
  v_id uuid;
  v_lang text;
  v_amount numeric;
  v_source text;
  v_at timestamptz;
  v_day date;
  v_used integer;
  v_take integer;
  v_status text;
  v_inserted uuid;
  v_results jsonb := '[]'::jsonb;
  v_added integer := 0;
begin
  if jsonb_typeof(v_events) <> 'array' then perform league.fail('events_invalid'); end if;
  if jsonb_array_length(v_events) > league.max_batch() then perform league.fail('too_many_events'); end if;

  -- One batch per user at a time, so the daily cap cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('league:' || v_uid::text, 0));

  if v_stats is not null and jsonb_typeof(v_stats) <> 'null' then
    begin
      if jsonb_typeof(v_stats) <> 'object' then raise exception 'bad'; end if;
      insert into league.stats as s (user_id, lang, total_xp, streak_count, streak_best, updated_at)
      values (
        v_uid,
        league.check_lang(v_stats ->> 'lang'),
        (v_stats ->> 'total_xp')::integer,
        coalesce((v_stats ->> 'streak_count')::integer, 0),
        coalesce((v_stats ->> 'streak_best')::integer, 0),
        v_now)
      on conflict (user_id, lang) do update set
        total_xp = excluded.total_xp,
        streak_count = excluded.streak_count,
        streak_best = excluded.streak_best,
        updated_at = excluded.updated_at;
    exception when others then
      perform league.fail('stats_invalid');
    end;
  end if;

  for e in select value from jsonb_array_elements(v_events)
  loop
    v_status := null;
    v_take := 0;
    v_id := null;
    v_raw_id := case when jsonb_typeof(e) = 'object' then e ->> 'id' end;
    begin
      v_id := v_raw_id::uuid;
      v_lang := e ->> 'lang';
      v_source := e ->> 'source';
      v_amount := case when jsonb_typeof(e -> 'amount') = 'number' then (e ->> 'amount')::numeric end;
      v_at := (e ->> 'earned_at')::timestamptz;
      if v_id is null or v_at is null
         or v_lang is null or v_lang !~ '^[a-z]{2,3}$'
         or v_source is null or v_source !~ '^[a-z][a-z_-]{0,19}$'
         or v_amount is null or v_amount <> trunc(v_amount) or v_amount <= 0 then
        v_status := 'invalid';
      end if;
    exception when others then
      v_status := 'invalid';
    end;

    if v_status is null and v_amount > league.max_event_xp() then v_status := 'too_big'; end if;
    if v_status is null and v_at > v_now + interval '5 minutes' then v_status := 'future'; end if;
    if v_status is null and v_at < v_now - interval '8 days' then v_status := 'too_old'; end if;
    if v_status is null and v_at < v_profile.created_at - interval '5 minutes' then v_status := 'before_join'; end if;
    if v_status is null and exists (select 1 from league.xp_events x where x.id = v_id) then
      v_status := 'duplicate';
    end if;

    if v_status is null then
      -- Every language counts towards the same daily cap.
      v_day := (v_at at time zone 'Europe/Madrid')::date;
      select coalesce(sum(x.amount), 0)::integer into v_used
      from league.xp_events x
      where x.user_id = v_uid
        and x.earned_at >= (v_day::timestamp at time zone 'Europe/Madrid')
        and x.earned_at < ((v_day + 1)::timestamp at time zone 'Europe/Madrid');
      v_take := greatest(0, least(v_amount::integer, league.daily_cap_xp() - v_used));
      v_inserted := null;
      insert into league.xp_events (id, user_id, lang, amount, source, earned_at)
      values (v_id, v_uid, v_lang, v_take, v_source, v_at)
      on conflict (id) do nothing
      returning id into v_inserted;
      if v_inserted is null then
        v_status := 'duplicate';
        v_take := 0;
      else
        v_status := case when v_take = v_amount then 'accepted' else 'capped' end;
        v_added := v_added + v_take;
      end if;
    end if;

    v_results := v_results || jsonb_build_object(
      'id', coalesce(v_id::text, v_raw_id),
      'status', v_status,
      'amount', case when v_status in ('accepted', 'capped') then v_take else 0 end);
  end loop;

  return jsonb_build_object('results', v_results, 'xp_added', v_added);
end $$;

-- Creates a group and puts the caller in it (up to league.max_groups() groups).
create or replace function public.league_create_group(name text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (league.require_profile()).user_id;
  v_name text := league.clean(name);
  v_code text;
  v_group uuid;
  i integer;
begin
  if char_length(v_name) not between 1 and 30 or v_name ~ '[[:cntrl:]]' then
    perform league.fail('group_name_invalid');
  end if;
  if league.is_blocked(v_name) then perform league.fail('group_name_blocked'); end if;
  perform league.lock_member(v_uid);
  if (select count(*) from league.members m where m.user_id = v_uid) >= league.max_groups() then
    perform league.fail('too_many_groups');
  end if;
  for i in 1..20 loop
    v_code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1), '')
      from generate_series(1, 6)
    );
    insert into league.groups (code, name) values (v_code, v_name)
    on conflict (code) do nothing
    returning id into v_group;
    exit when v_group is not null;
  end loop;
  if v_group is null then perform league.fail('try_again'); end if;
  perform league.join(v_uid, v_group);
  return league.group_json(v_group);
end $$;

-- Joins the group with that code; no need to leave other groups (up to league.max_groups()).
create or replace function public.league_join_group(code text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (league.require_profile()).user_id;
  v_group uuid := league.group_by_code(code);
begin
  if v_group is null then perform league.fail('group_not_found'); end if;
  perform league.join(v_uid, v_group);
  return league.group_json(v_group);
end $$;

-- Old: league_leave_group() left "the" group. Now one function with an optional code:
-- with a code, leaves that group; without (old app versions), leaves the earliest joined group.
-- true = left, false = not a member / in no group / unknown code.
drop function public.league_leave_group();
create function public.league_leave_group(code text default null) returns boolean
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := league.require_uid();
  v_group uuid;
begin
  perform league.lock_member(v_uid);
  v_group := case when code is null then league.first_group(v_uid) else league.group_by_code(code) end;
  if v_group is null then return false; end if;
  return league.leave_one(v_uid, v_group);
end $$;

-- Old RPC: weekly ranking, XP summed over every language (`lang` is only validated).
-- Group scope = the earliest joined group.
create or replace function public.league_leaderboard(lang text, scope text default 'global')
returns table (rank integer, nickname text, emoji text, weekly_xp integer, streak integer, is_me boolean)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := league.require_uid();
  v_lang text := league.check_lang(lang);
  v_scope text := league.check_scope(scope);
begin
  return query
    select * from league.ranking(v_scope, v_uid, league.first_group(v_uid), league.week_start(now()), league.week_end(now()));
end $$;

-- Old RPC: last week's top 3, summed over every language; group = the earliest joined group.
create or replace function public.league_last_week_podium(lang text, scope text default 'global')
returns table (rank integer, nickname text, emoji text, weekly_xp integer, streak integer, is_me boolean)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := league.require_uid();
  v_lang text := league.check_lang(lang);
  v_scope text := league.check_scope(scope);
  v_end timestamptz := league.week_start(now());
  v_start timestamptz := league.week_start(v_end - interval '1 day');
begin
  return query
    select b.* from league.ranking(v_scope, v_uid, league.first_group(v_uid), v_start, v_end) b
    where b.weekly_xp > 0
    limit 3;
end $$;

-- Old RPC: same shape as before; `stats` is still the one of `lang`, weekly XP is summed over
-- every language, `group` is the earliest joined group.
create or replace function public.league_me(lang text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := league.require_uid();
  v_lang text := league.check_lang(lang);
  v_now timestamptz := now();
  v_start timestamptz := league.week_start(v_now);
  v_end timestamptz := league.week_end(v_now);
  p league.profiles;
  s league.stats;
  v_group uuid;
  v_xp integer;
  v_rank_global integer;
  v_rank_group integer;
begin
  select * into p from league.profiles where user_id = v_uid;
  if not found then
    return jsonb_build_object(
      'profile', null, 'stats', null, 'group', null,
      'week', jsonb_build_object('start', v_start, 'end', v_end),
      'weekly_xp', 0, 'rank', jsonb_build_object('global', null, 'group', null));
  end if;
  select * into s from league.stats where user_id = v_uid and lang = v_lang;
  v_group := league.first_group(v_uid);
  select coalesce(sum(x.amount), 0)::integer into v_xp
  from league.xp_events x
  where x.user_id = v_uid and x.earned_at >= v_start and x.earned_at < v_end;
  select b.rank into v_rank_global from league.ranking('global', v_uid, null, v_start, v_end) b where b.is_me;
  if v_group is not null then
    select b.rank into v_rank_group from league.ranking('group', v_uid, v_group, v_start, v_end) b where b.is_me;
  end if;
  return jsonb_build_object(
    'profile', jsonb_build_object('nickname', p.nickname, 'emoji', p.emoji, 'joined_at', p.created_at),
    'stats', case when s.user_id is null then null else jsonb_build_object(
      'total_xp', s.total_xp, 'streak_count', s.streak_count, 'streak_best', s.streak_best,
      'updated_at', s.updated_at) end,
    'group', case when v_group is null then null else league.group_json(v_group) end,
    'week', jsonb_build_object('start', v_start, 'end', v_end),
    'weekly_xp', v_xp,
    'rank', jsonb_build_object('global', v_rank_global, 'group', v_rank_group));
end $$;

-- ---------------------------------------------------------------------------------------------
-- New RPCs (multi-group client). Contract: docs/league.md.

-- Everything the Liga screen needs about the caller, across languages and groups.
create function public.league_status() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := league.require_uid();
  v_now timestamptz := now();
  v_start timestamptz := league.week_start(v_now);
  v_end timestamptz := league.week_end(v_now);
  v_week jsonb := jsonb_build_object('start', v_start, 'end', v_end);
  p league.profiles;
  v_xp integer;
  v_rank integer;
  v_stats jsonb;
  v_streak integer;
  v_groups jsonb;
begin
  select * into p from league.profiles where user_id = v_uid;
  if not found then
    return jsonb_build_object(
      'profile', null, 'stats', '[]'::jsonb, 'streak', 0, 'groups', '[]'::jsonb,
      'max_groups', league.max_groups(), 'week', v_week, 'weekly_xp', 0,
      'rank', jsonb_build_object('global', null));
  end if;

  select coalesce(sum(x.amount), 0)::integer into v_xp
  from league.xp_events x
  where x.user_id = v_uid and x.earned_at >= v_start and x.earned_at < v_end;

  select b.rank into v_rank from league.ranking('global', v_uid, null, v_start, v_end) b where b.is_me;

  select coalesce(jsonb_agg(jsonb_build_object(
           'lang', s.lang, 'total_xp', s.total_xp, 'streak_count', s.streak_count,
           'streak_best', s.streak_best, 'updated_at', s.updated_at) order by s.lang), '[]'::jsonb),
         coalesce(max(s.streak_count), 0)
    into v_stats, v_streak
  from league.stats s where s.user_id = v_uid;

  -- My groups (earliest joined first) with member count and my rank in each this week.
  with mine as (
    select m.group_id, m.joined_at from league.members m where m.user_id = v_uid
  ),
  peers as (
    select m.group_id, m.user_id from league.members m join mine on mine.group_id = m.group_id
  ),
  wk as (
    select x.user_id, sum(x.amount)::integer as xp
    from league.xp_events x
    where x.earned_at >= v_start and x.earned_at < v_end
      and x.user_id in (select peers.user_id from peers)
    group by x.user_id
  ),
  ranked as (
    select peers.group_id, peers.user_id,
      rank() over (partition by peers.group_id order by coalesce(wk.xp, 0) desc) as rnk,
      count(*) over (partition by peers.group_id) as members
    from peers left join wk on wk.user_id = peers.user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', g.code, 'name', g.name, 'members', r.members, 'joined_at', mine.joined_at,
           'rank', r.rnk) order by mine.joined_at, g.id), '[]'::jsonb)
    into v_groups
  from ranked r
  join mine on mine.group_id = r.group_id
  join league.groups g on g.id = r.group_id
  where r.user_id = v_uid;

  return jsonb_build_object(
    'profile', jsonb_build_object('nickname', p.nickname, 'emoji', p.emoji, 'joined_at', p.created_at),
    'stats', v_stats,
    'streak', v_streak,
    'groups', v_groups,
    'max_groups', league.max_groups(),
    'week', v_week,
    'weekly_xp', v_xp,
    'rank', jsonb_build_object('global', v_rank));
end $$;

-- This week's ranking: the general table or one of the caller's groups (by code).
create function public.league_ranking(scope text default 'global', code text default null)
returns table (rank integer, nickname text, emoji text, weekly_xp integer, streak integer, is_me boolean)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := league.require_uid();
  v_group uuid := league.scope_group(scope, code, v_uid);
begin
  return query
    select * from league.ranking(scope, v_uid, v_group, league.week_start(now()), league.week_end(now()));
end $$;

-- Last week's top 3 (players with XP only) of the general table or one of the caller's groups.
create function public.league_podium(scope text default 'global', code text default null)
returns table (rank integer, nickname text, emoji text, weekly_xp integer, streak integer, is_me boolean)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := league.require_uid();
  v_group uuid := league.scope_group(scope, code, v_uid);
  v_end timestamptz := league.week_start(now());
  v_start timestamptz := league.week_start(v_end - interval '1 day');
begin
  return query
    select b.* from league.ranking(scope, v_uid, v_group, v_start, v_end) b
    where b.weekly_xp > 0
    limit 3;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Privileges: signed-in users only (Supabase's default grants open new public functions to anon).

revoke all on function
  public.league_record_xp(jsonb, jsonb),
  public.league_create_group(text),
  public.league_join_group(text),
  public.league_leave_group(text),
  public.league_leaderboard(text, text),
  public.league_last_week_podium(text, text),
  public.league_me(text),
  public.league_status(),
  public.league_ranking(text, text),
  public.league_podium(text, text)
from public, anon;
grant execute on function
  public.league_record_xp(jsonb, jsonb),
  public.league_create_group(text),
  public.league_join_group(text),
  public.league_leave_group(text),
  public.league_leaderboard(text, text),
  public.league_last_week_podium(text, text),
  public.league_me(text),
  public.league_status(),
  public.league_ranking(text, text),
  public.league_podium(text, text)
to authenticated;
