-- Local fake Supabase only (npm run league:local): what GoTrue keeps besides auth.users.
-- Never part of supabase/migrations.

create schema local_auth;
revoke all on schema local_auth from public;

create table local_auth.migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table local_auth.refresh_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table local_auth.links (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('magiclink', 'email_change')),
  email text not null,
  redirect_to text not null,
  used boolean not null default false,
  expires_at timestamptz not null default now() + interval '1 hour',
  created_at timestamptz not null default now()
);

create table local_auth.seed_users (
  user_id uuid primary key references auth.users (id) on delete cascade
);
