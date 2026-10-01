-- Minimal stand-in for what Supabase provides before our migrations run (local check only).
-- Roles anon/authenticated/service_role are created by scripts/db/check.ts when missing.

create schema auth;

create table auth.users (
  id uuid primary key,
  email text,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now()
);

-- Same resolution as Supabase: the `sub` claim of the request JWT.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase's default grants on the public schema (everything it creates is open to the API
-- roles unless a migration revokes it), so the check proves our revokes really work.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
