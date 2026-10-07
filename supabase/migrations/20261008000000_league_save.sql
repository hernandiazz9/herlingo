-- Cloud save (plan 010): one copy of the Perfil backup blob per Liga account (docs/league.md).
--
-- The blob is the file backup format `{ app: "lang-lern", format, exportedAt, data: {...} }`.
-- The device stays the source of truth: every write names the revision it was based on and a
-- stale one gets `conflict` back (nothing written), so two devices never overwrite each other
-- silently. Same pattern as the other Liga RPCs: private table with RLS and no grants,
-- `security definer` RPCs with an empty search_path, executable by `authenticated` only, errors
-- as SQLSTATE P0001 with a snake_case token as the message.

-- ---------------------------------------------------------------------------------------------
-- Table

create table league.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  rev bigint not null check (rev >= 1),
  size integer not null check (size >= 0),
  updated_at timestamptz not null default now(),
  -- Rate limit: writes counted since window_start (a new window starts when it is an hour old).
  window_start timestamptz,
  window_writes integer
);
comment on table league.saves is 'Cloud save: the latest backup blob of each user (only through the league_save_* RPCs).';

alter table league.saves enable row level security;
-- No policies on purpose: nothing is readable or writable except through the RPCs below.
revoke all on table league.saves from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Rules (numbers documented in docs/league.md)

create function league.save_max_bytes() returns integer language sql immutable set search_path = '' as $$ select 2097152 $$;
create function league.save_max_writes_per_hour() returns integer language sql immutable set search_path = '' as $$ select 120 $$;

-- {rev, size, updated_at} of a save row (null when there is none).
create function league.save_head(s league.saves) returns jsonb
language sql immutable set search_path = ''
as $$
  select case when s.user_id is null then null
    else jsonb_build_object('rev', s.rev, 'size', s.size, 'updated_at', s.updated_at) end
$$;

revoke all on function
  league.save_max_bytes(),
  league.save_max_writes_per_hour(),
  league.save_head(league.saves)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- RPCs (public, security definer). Contract: docs/league.md.

-- Cheap status of the caller's cloud copy: {rev, size, updated_at} or null (no data).
create function public.league_save_head() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := league.require_uid();
  s league.saves;
begin
  select * into s from league.saves where user_id = v_uid;
  if not found then return null; end if;
  return league.save_head(s);
end $$;

-- The caller's cloud copy: {rev, size, updated_at, data} or null.
create function public.league_save_get() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := league.require_uid();
  s league.saves;
begin
  select * into s from league.saves where user_id = v_uid;
  if not found then return null; end if;
  return league.save_head(s) || jsonb_build_object('data', s.data);
end $$;

-- Writes the caller's cloud copy if `p_base_rev` is the stored revision (null = "I have never
-- seen a cloud copy": only when there is none). Returns {status: "ok", rev, size, updated_at}
-- with the new revision, or {status: "conflict", rev, size, updated_at} with the stored head
-- (all null when there is no copy) and nothing written.
create function public.league_save_put(p_data jsonb, p_base_rev bigint) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := league.require_uid();
  v_now timestamptz := now();
  v_size integer;
  v_format numeric;
  s league.saves;
  v_window_start timestamptz;
  v_window_writes integer;
begin
  -- Step by step (SQL does not short-circuit, and a bad cast must not escape as another error).
  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or jsonb_typeof(p_data -> 'app') is distinct from 'string'
     or jsonb_typeof(p_data -> 'format') is distinct from 'number'
     or jsonb_typeof(p_data -> 'data') is distinct from 'object' then
    perform league.fail('save_invalid');
  end if;
  v_format := (p_data ->> 'format')::numeric;
  if p_data ->> 'app' <> 'lang-lern' or v_format <> trunc(v_format) then
    perform league.fail('save_invalid');
  end if;
  v_size := octet_length(p_data::text);
  if v_size > league.save_max_bytes() then perform league.fail('save_too_large'); end if;

  -- One write per user at a time (the base-revision check and the counter cannot be raced,
  -- including the very first insert when no row exists yet).
  perform pg_advisory_xact_lock(hashtextextended('league-save:' || v_uid::text, 0));
  select * into s from league.saves where user_id = v_uid;

  if (p_base_rev is null and s.user_id is not null)
     or (p_base_rev is not null and (s.user_id is null or s.rev <> p_base_rev)) then
    return jsonb_build_object('status', 'conflict', 'rev', s.rev, 'size', s.size, 'updated_at', s.updated_at);
  end if;

  if s.user_id is null or s.window_start is null or s.window_start <= v_now - interval '1 hour' then
    v_window_start := v_now;
    v_window_writes := 0;
  else
    v_window_start := s.window_start;
    v_window_writes := coalesce(s.window_writes, 0);
  end if;
  if v_window_writes >= league.save_max_writes_per_hour() then perform league.fail('save_rate_limited'); end if;

  insert into league.saves as t (user_id, data, rev, size, updated_at, window_start, window_writes)
  values (v_uid, p_data, 1, v_size, v_now, v_window_start, v_window_writes + 1)
  on conflict (user_id) do update set
    data = excluded.data,
    rev = t.rev + 1,
    size = excluded.size,
    updated_at = excluded.updated_at,
    window_start = excluded.window_start,
    window_writes = excluded.window_writes
  returning * into s;

  return jsonb_build_object('status', 'ok') || league.save_head(s);
end $$;

-- Deletes the caller's cloud copy (no-op when there is none).
create function public.league_save_delete() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from league.saves where user_id = league.require_uid();
end $$;

-- Re-created: also deletes the caller's cloud copy. Returns true when a profile was deleted
-- (unchanged contract).
create or replace function public.league_delete_me() returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := league.require_uid();
  v_found boolean;
begin
  perform league.leave(v_uid);
  delete from league.saves where user_id = v_uid;
  delete from league.xp_events where user_id = v_uid;
  delete from league.stats where user_id = v_uid;
  delete from league.profiles where user_id = v_uid;
  v_found := found;
  return v_found;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Privileges: signed-in users only (Supabase's default grants open new public functions to anon).

revoke all on function
  public.league_save_head(),
  public.league_save_get(),
  public.league_save_put(jsonb, bigint),
  public.league_save_delete(),
  public.league_delete_me()
from public, anon;
grant execute on function
  public.league_save_head(),
  public.league_save_get(),
  public.league_save_put(jsonb, bigint),
  public.league_save_delete(),
  public.league_delete_me()
to authenticated;
