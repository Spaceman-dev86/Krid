-- =============================================================================
-- TRANCHE 01 — Helpers RLS + profiles (+ login_logs)
-- Projet : NOUVEAU Supabase uniquement (trainly-saas)
-- Après Run : dis « 01 OK » au chat → on envoie la tranche 02
-- Spec : /admin/spec/supabase → SQL par tranches
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- profiles (créer si projet vide, sinon étendre)
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role is null or role in ('coach', 'client', 'platform_admin', 'admin'));
  end if;
exception
  when others then null;
end $$;

-- Auto-profile à l’inscription Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'coach'),
    now(),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers RLS
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('platform_admin', 'admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.current_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('coach', 'platform_admin', 'admin')
    ) then auth.uid()
    else null
  end;
$$;

grant execute on function public.current_profile_role() to authenticated, anon;
grant execute on function public.is_platform_admin() to authenticated, anon;
grant execute on function public.current_coach_id() to authenticated, anon;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_platform_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_platform_admin())
with check (id = auth.uid() or public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- login_logs
-- -----------------------------------------------------------------------------

create table if not exists public.login_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  context text,
  login_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.login_logs
  add column if not exists context text;

alter table public.login_logs
  add column if not exists login_at timestamptz;

update public.login_logs set login_at = coalesce(login_at, created_at, now()) where login_at is null;

alter table public.login_logs enable row level security;

drop policy if exists "login_logs_insert_self" on public.login_logs;
create policy "login_logs_insert_self"
on public.login_logs for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "login_logs_select_own" on public.login_logs;
create policy "login_logs_select_own"
on public.login_logs for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

-- Tracking tranches appliquées
create table if not exists public.schema_migrations_trainly (
  id text primary key,
  applied_at timestamptz not null default now()
);

insert into public.schema_migrations_trainly (id)
values ('01_helpers_profiles')
on conflict (id) do nothing;
