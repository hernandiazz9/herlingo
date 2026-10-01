-- Liga: optional accounts, one group per person and weekly XP rankings (docs/league.md).
--
-- Tables live in the private schema `league` (not exposed by the Data API, no grants to
-- anon/authenticated, RLS enabled with no policies). Clients only call the `public.league_*`
-- RPCs below: `security definer`, empty search_path, executable by `authenticated` only
-- (anonymous Supabase users are `authenticated` too). Errors are raised with SQLSTATE P0001 and
-- a short snake_case token as the message (the client matches `error.message`).
--
-- Week = Monday 00:00 to Monday 00:00 Europe/Madrid. Day (daily cap) = Madrid calendar day.

create schema if not exists league;
revoke all on schema league from public;

-- ---------------------------------------------------------------------------------------------
-- Tables

create table league.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 3 and 20),
  emoji text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_nickname_key on league.profiles (lower(nickname));
comment on table league.profiles is 'Liga profile: the only data other players see (nickname + emoji).';

-- Stats sent by the client (shown, never ranked): totals from the device, per language.
create table league.stats (
  user_id uuid not null references league.profiles (user_id) on delete cascade,
  lang text not null,
  total_xp integer not null default 0 check (total_xp between 0 and 100000000),
  streak_count integer not null default 0 check (streak_count between 0 and 100000),
  streak_best integer not null default 0 check (streak_best between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, lang)
);

create table league.groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);

-- At most one group per person: the primary key is the user.
create table league.members (
  user_id uuid primary key references league.profiles (user_id) on delete cascade,
  group_id uuid not null references league.groups (id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index members_group_id_idx on league.members (group_id);

-- XP events. `id` is generated on the device, so a resent event is ignored. `amount` may be 0
-- when the daily cap swallowed it (kept so the id stays known).
create table league.xp_events (
  id uuid primary key,
  user_id uuid not null references league.profiles (user_id) on delete cascade,
  lang text not null,
  amount integer not null check (amount >= 0),
  source text not null,
  earned_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index xp_events_lang_earned_idx on league.xp_events (lang, earned_at) include (user_id, amount);
create index xp_events_user_lang_earned_idx on league.xp_events (user_id, lang, earned_at);

-- Words that may not appear in nicknames or group names (edit with plain SQL in the dashboard).
-- `token`: a whole word of the name; `contains`: anywhere in the name with spaces/punctuation
-- removed. Matching uses league.fold() (lower case, no accents, 0→o 1→i 3→e 4→a 5→s 7→t).
create table league.blocked_words (
  word text primary key check (word ~ '^[a-z]+$'),
  mode text not null check (mode in ('token', 'contains'))
);

-- Fixed avatar list (docs/league.md lists it; the client keeps the same list).
create table league.emojis (
  emoji text primary key,
  position integer not null unique
);

alter table league.profiles enable row level security;
alter table league.stats enable row level security;
alter table league.groups enable row level security;
alter table league.members enable row level security;
alter table league.xp_events enable row level security;
alter table league.blocked_words enable row level security;
alter table league.emojis enable row level security;
-- No policies on purpose: nothing is readable or writable except through the RPCs below.
revoke all on all tables in schema league from public, anon, authenticated;

insert into league.emojis (emoji, position) values
  ('🍋', 1), ('🍊', 2), ('🍕', 3), ('🍝', 4), ('🍦', 5), ('🥐', 6), ('☕', 7), ('🫒', 8),
  ('🐢', 9), ('🐬', 10), ('🐙', 11), ('🦀', 12), ('🐟', 13), ('🦊', 14), ('🐱', 15), ('🐶', 16),
  ('🐼', 17), ('🦁', 18), ('🐸', 19), ('🦉', 20), ('🐝', 21), ('🌋', 22), ('⛵', 23), ('🌞', 24);

insert into league.blocked_words (word, mode) values
  -- Spanish
  ('puta', 'token'), ('puto', 'token'), ('putas', 'token'), ('putos', 'token'),
  ('hijoputa', 'contains'), ('hijodeputa', 'contains'), ('gilipollas', 'contains'),
  ('maricon', 'contains'), ('subnormal', 'contains'), ('cabron', 'contains'), ('pendejo', 'contains'),
  ('polla', 'token'), ('mierda', 'contains'), ('zorra', 'token'), ('cono', 'token'), ('follar', 'contains'),
  ('culo', 'token'), ('sexo', 'token'), ('nazi', 'token'), ('nazis', 'token'), ('hitler', 'contains'),
  -- Italian
  ('cazzo', 'contains'), ('stronzo', 'contains'), ('stronza', 'contains'), ('puttana', 'contains'),
  ('vaffanculo', 'contains'), ('coglione', 'contains'), ('troia', 'token'), ('merda', 'token'),
  ('porco', 'token'), ('figa', 'token'), ('fottiti', 'contains'), ('frocio', 'contains'),
  -- English
  ('fuck', 'contains'), ('shit', 'contains'), ('bitch', 'contains'), ('cunt', 'contains'),
  ('nigger', 'contains'), ('nigga', 'contains'), ('whore', 'contains'), ('porn', 'contains'),
  ('ass', 'token'), ('sex', 'token'),
  -- Reserved
  ('admin', 'token'), ('administrador', 'contains'), ('moderador', 'contains'), ('langlern', 'contains'), ('supabase', 'contains');

-- ---------------------------------------------------------------------------------------------
-- Rules (numbers documented in docs/league.md; derived from the XP rules in src/lib)

create function league.max_event_xp() returns integer language sql immutable set search_path = '' as $$ select 100 $$;
create function league.daily_cap_xp() returns integer language sql immutable set search_path = '' as $$ select 2500 $$;
create function league.max_batch() returns integer language sql immutable set search_path = '' as $$ select 200 $$;

-- Monday 00:00 Europe/Madrid of the week that contains `ts`.
create function league.week_start(ts timestamptz) returns timestamptz
language sql immutable set search_path = ''
as $$ select date_trunc('week', ts at time zone 'Europe/Madrid') at time zone 'Europe/Madrid' $$;

-- Next Monday 00:00 Europe/Madrid (exclusive end of the week that contains `ts`).
create function league.week_end(ts timestamptz) returns timestamptz
language sql immutable set search_path = ''
as $$ select (date_trunc('week', ts at time zone 'Europe/Madrid') + interval '7 days') at time zone 'Europe/Madrid' $$;

-- Lower case, accents removed, common digit substitutions undone (0→o 1→i 3→e 4→a 5→s 7→t).
create function league.fold(s text) returns text
language sql immutable set search_path = ''
as $$
  select translate(lower(s), 'áàäâãéèëêíìïîóòöôõúùüûñç013457@$', 'aaaaaeeeeiiiiooooouuuuncoieastas')
$$;

create function league.is_blocked(s text) returns boolean
language sql stable set search_path = ''
as $$
  with f as (select league.fold(s) as t)
  select exists (
    select 1
    from league.blocked_words b, f
    where (b.mode = 'contains' and position(b.word in regexp_replace(f.t, '[^a-z]', '', 'g')) > 0)
       or (b.mode = 'token' and b.word in (select x from regexp_split_to_table(f.t, '[^a-z]+') as x))
  )
$$;

-- Trimmed, inner whitespace collapsed.
create function league.clean(s text) returns text
language sql immutable set search_path = ''
as $$ select regexp_replace(btrim(coalesce(s, '')), '\s+', ' ', 'g') $$;

create function league.fail(token text) returns void
language plpgsql set search_path = ''
as $$ begin raise exception using message = token, errcode = 'P0001'; end $$;

create function league.require_uid() returns uuid
language plpgsql stable set search_path = ''
as $$
declare v uuid := auth.uid();
begin
  if v is null then perform league.fail('not_authenticated'); end if;
  return v;
end $$;

create function league.require_profile() returns league.profiles
language plpgsql stable set search_path = ''
as $$
declare p league.profiles;
begin
  select * into p from league.profiles where user_id = league.require_uid();
  if not found then perform league.fail('no_profile'); end if;
  return p;
end $$;

create function league.check_lang(lang text) returns text
language plpgsql immutable set search_path = ''
as $$
begin
  if lang is null or lang !~ '^[a-z]{2,3}$' then perform league.fail('lang_invalid'); end if;
  return lang;
end $$;

create function league.check_scope(scope text) returns text
language plpgsql immutable set search_path = ''
as $$
begin
  if scope is null or scope not in ('group', 'global') then perform league.fail('scope_invalid'); end if;
  return scope;
end $$;

create function league.group_json(g uuid) returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'code', gr.code,
    'name', gr.name,
    'members', (select count(*) from league.members m where m.group_id = gr.id)
  )
  from league.groups gr where gr.id = g
$$;

-- Leaves the caller's group (if any) and deletes the group when it becomes empty.
create function league.leave(uid uuid) returns boolean
language plpgsql set search_path = ''
as $$
declare g uuid;
begin
  delete from league.members where user_id = uid returning group_id into g;
  if g is null then return false; end if;
  delete from league.groups gr
  where gr.id = g and not exists (select 1 from league.members m where m.group_id = g);
  return true;
end $$;

-- Ranking of one week window: top 50 by XP plus the caller's row. Group scope = every member of
-- the caller's group (0 XP included); global scope = everyone with XP in the window, plus the
-- caller. `rank` is shared on ties; rows come in display order.
create function league.board(p_lang text, p_scope text, p_uid uuid, p_from timestamptz, p_to timestamptz)
returns table (rank integer, nickname text, emoji text, weekly_xp integer, streak integer, is_me boolean)
language sql stable set search_path = ''
as $$
  with xp as (
    select e.user_id, sum(e.amount)::integer as xp
    from league.xp_events e
    where e.lang = p_lang and e.earned_at >= p_from and e.earned_at < p_to
    group by e.user_id
  ),
  pool as (
    select p.user_id, p.nickname, p.emoji, coalesce(x.xp, 0) as xp
    from league.profiles p
    left join xp x on x.user_id = p.user_id
    where case
      when p_scope = 'group' then p.user_id in (
        select m.user_id from league.members m
        where m.group_id = (select mm.group_id from league.members mm where mm.user_id = p_uid))
      else coalesce(x.xp, 0) > 0 or p.user_id = p_uid
    end
  ),
  ranked as (
    select pool.*,
      rank() over (order by pool.xp desc) as rnk,
      row_number() over (order by pool.xp desc, lower(pool.nickname), pool.user_id) as pos
    from pool
  )
  select r.rnk::integer, r.nickname, r.emoji, r.xp, coalesce(s.streak_count, 0), r.user_id = p_uid
  from ranked r
  left join league.stats s on s.user_id = r.user_id and s.lang = p_lang
  where r.pos <= 50 or r.user_id = p_uid
  order by r.pos
$$;

revoke all on all functions in schema league from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- RPCs (public, security definer). Contract: docs/league.md.

-- Creates or updates the caller's profile. Returns {nickname, emoji, joined_at}.
create function public.league_set_profile(nickname text, emoji text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := league.require_uid();
  v_nick text := league.clean(nickname);
  v_emoji text := replace(coalesce(emoji, ''), chr(65039), '');
  p league.profiles;
begin
  if char_length(v_nick) not between 3 and 20
     or v_nick !~ '^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòùÇç _.-]+$'
     or v_nick !~ '[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòùÇç]' then
    perform league.fail('nickname_invalid');
  end if;
  if league.is_blocked(v_nick) then perform league.fail('nickname_blocked'); end if;
  if not exists (select 1 from league.emojis e where e.emoji = v_emoji) then
    perform league.fail('emoji_invalid');
  end if;
  if exists (select 1 from league.profiles x where lower(x.nickname) = lower(v_nick) and x.user_id <> v_uid) then
    perform league.fail('nickname_taken');
  end if;
  begin
    insert into league.profiles as t (user_id, nickname, emoji)
    values (v_uid, v_nick, v_emoji)
    on conflict (user_id) do update set nickname = excluded.nickname, emoji = excluded.emoji, updated_at = now()
    returning * into p;
  exception when unique_violation then
    perform league.fail('nickname_taken');
  end;
  return jsonb_build_object('nickname', p.nickname, 'emoji', p.emoji, 'joined_at', p.created_at);
end $$;

-- Records a batch of XP events (and optionally the device stats). See docs/league.md.
create function public.league_record_xp(events jsonb, stats jsonb default null) returns jsonb
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
      v_day := (v_at at time zone 'Europe/Madrid')::date;
      select coalesce(sum(x.amount), 0)::integer into v_used
      from league.xp_events x
      where x.user_id = v_uid and x.lang = v_lang
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

-- Creates a group and puts the caller in it. Returns {code, name, members}.
create function public.league_create_group(name text) returns jsonb
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
  if exists (select 1 from league.members m where m.user_id = v_uid) then
    perform league.fail('already_in_group');
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
  insert into league.members (user_id, group_id) values (v_uid, v_group);
  return league.group_json(v_group);
end $$;

-- Joins the group with that code (case-insensitive, spaces ignored). Joining your own group
-- again is a no-op. Returns {code, name, members}.
create function public.league_join_group(code text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (league.require_profile()).user_id;
  v_code text := upper(regexp_replace(coalesce(code, ''), '\s', '', 'g'));
  v_group uuid;
  v_current uuid;
begin
  select g.id into v_group from league.groups g where g.code = v_code;
  if v_group is null then perform league.fail('group_not_found'); end if;
  select m.group_id into v_current from league.members m where m.user_id = v_uid;
  if v_current is not null and v_current <> v_group then perform league.fail('already_in_group'); end if;
  if v_current is null then
    insert into league.members (user_id, group_id) values (v_uid, v_group);
  end if;
  return league.group_json(v_group);
end $$;

-- Leaves the caller's group. true = left, false = was in no group.
create function public.league_leave_group() returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  return league.leave(league.require_uid());
end $$;

-- Weekly ranking (current week) for a language: top 50 + the caller's row.
create function public.league_leaderboard(lang text, scope text default 'global')
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
    select * from league.board(v_lang, v_scope, v_uid, league.week_start(now()), league.week_end(now()));
end $$;

-- Last week's top 3 (players with XP only).
create function public.league_last_week_podium(lang text, scope text default 'global')
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
    select b.* from league.board(v_lang, v_scope, v_uid, v_start, v_end) b
    where b.weekly_xp > 0
    limit 3;
end $$;

-- Everything the Liga screen needs about the caller (see docs/league.md for the shape).
create function public.league_me(lang text) returns jsonb
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
  select m.group_id into v_group from league.members m where m.user_id = v_uid;
  select coalesce(sum(x.amount), 0)::integer into v_xp
  from league.xp_events x
  where x.user_id = v_uid and x.lang = v_lang and x.earned_at >= v_start and x.earned_at < v_end;
  select b.rank into v_rank_global from league.board(v_lang, 'global', v_uid, v_start, v_end) b where b.is_me;
  if v_group is not null then
    select b.rank into v_rank_group from league.board(v_lang, 'group', v_uid, v_start, v_end) b where b.is_me;
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

-- Deletes the caller's profile, stats, membership (and the group if it becomes empty) and XP
-- events. The auth user itself stays (anonymous, no data); the client signs out.
create function public.league_delete_me() returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := league.require_uid();
  v_found boolean;
begin
  perform league.leave(v_uid);
  delete from league.xp_events where user_id = v_uid;
  delete from league.stats where user_id = v_uid;
  delete from league.profiles where user_id = v_uid;
  v_found := found;
  return v_found;
end $$;

-- Only signed-in users (anonymous ones included) may call the RPCs.
revoke all on function
  public.league_set_profile(text, text),
  public.league_record_xp(jsonb, jsonb),
  public.league_create_group(text),
  public.league_join_group(text),
  public.league_leave_group(),
  public.league_leaderboard(text, text),
  public.league_last_week_podium(text, text),
  public.league_me(text),
  public.league_delete_me()
from public, anon;
grant execute on function
  public.league_set_profile(text, text),
  public.league_record_xp(jsonb, jsonb),
  public.league_create_group(text),
  public.league_join_group(text),
  public.league_leave_group(),
  public.league_leaderboard(text, text),
  public.league_last_week_podium(text, text),
  public.league_me(text),
  public.league_delete_me()
to authenticated;
