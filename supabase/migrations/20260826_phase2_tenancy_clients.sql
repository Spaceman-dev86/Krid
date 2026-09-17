-- Phase 2 — Tenancy + Clients foundation (roadmap step 2)
-- Source: plans/workspace/supabase.json (tenancy + clients-access FIGÉ)
-- + stubs prestations / payment_ledger for FK on client_grants
--
-- ⚠️  À exécuter UNIQUEMENT sur un NOUVEAU projet Supabase (trainly-saas).
--     Ne PAS appliquer sur l’ancien projet Trainly (demo_*, schéma historique).
-- Visible aussi : /admin/spec/supabase → onglet « SQL Phase 2 »
--
-- Apply in Supabase SQL Editor (Project → SQL → New query → Run).
-- Idempotent where practical (IF NOT EXISTS / DROP POLICY IF EXISTS).

create extension if not exists pgcrypto;

-- =============================================================================
-- Helpers RLS (security definer) — current_client_id created after clients
-- =============================================================================

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

-- =============================================================================
-- profiles (extend)
-- =============================================================================

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

-- Optional later: update public.profiles set role = 'platform_admin' where role = 'admin';

alter table public.profiles enable row level security;

-- Temporary self/admin policies (coach→client profile visibility added after clients)
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_platform_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_platform_admin())
with check (id = auth.uid() or public.is_platform_admin());

-- =============================================================================
-- coach_subscriptions
-- =============================================================================

create table if not exists public.coach_subscriptions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  plan_tier text not null default 'business'
    check (plan_tier in ('starter', 'business', 'scale', 'studio')),
  status text not null default 'trial'
    check (status in ('trial', 'active', 'past_due', 'canceled', 'expired_trial')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists coach_subscriptions_one_active_per_coach
  on public.coach_subscriptions (coach_id)
  where status in ('trial', 'active', 'past_due');

create index if not exists coach_subscriptions_coach_id_idx
  on public.coach_subscriptions (coach_id);

alter table public.coach_subscriptions enable row level security;

drop policy if exists "coach_subscriptions_select_own" on public.coach_subscriptions;
create policy "coach_subscriptions_select_own"
on public.coach_subscriptions for select to authenticated
using (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "coach_subscriptions_admin_write" on public.coach_subscriptions;
create policy "coach_subscriptions_admin_write"
on public.coach_subscriptions for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- =============================================================================
-- coach_branding
-- =============================================================================

create table if not exists public.coach_branding (
  coach_id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null,
  app_name text,
  logo_url text,
  primary_color text,
  pwa_icon_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_branding_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists coach_branding_slug_uidx
  on public.coach_branding (slug);

alter table public.coach_branding enable row level security;

drop policy if exists "coach_branding_select_public_or_own" on public.coach_branding;
create policy "coach_branding_select_public_or_own"
on public.coach_branding for select
to anon, authenticated
using (true);

drop policy if exists "coach_branding_coach_write" on public.coach_branding;
create policy "coach_branding_coach_write"
on public.coach_branding for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- =============================================================================
-- login_logs (extend)
-- =============================================================================

alter table public.login_logs
  add column if not exists context text;

alter table public.login_logs
  add column if not exists login_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'login_logs' and column_name = 'created_at'
  ) then
    execute 'update public.login_logs set login_at = created_at where login_at is null';
  end if;
end $$;

update public.login_logs set login_at = coalesce(login_at, now()) where login_at is null;

alter table public.login_logs enable row level security;

drop policy if exists "login_logs_insert_self" on public.login_logs;
create policy "login_logs_insert_self"
on public.login_logs for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "login_logs_select_own" on public.login_logs;
create policy "login_logs_select_own"
on public.login_logs for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

-- =============================================================================
-- clients
-- =============================================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  first_name text,
  last_name text,
  phone text,
  sex text,
  birth_date date,
  weight_kg numeric,
  height_cm numeric,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'archived')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists clients_coach_id_idx on public.clients (coach_id)
  where deleted_at is null;
create index if not exists clients_user_id_idx on public.clients (user_id)
  where user_id is not null and deleted_at is null;
create unique index if not exists clients_coach_email_uidx
  on public.clients (coach_id, lower(email))
  where deleted_at is null;

alter table public.clients enable row level security;

drop policy if exists "clients_coach_all" on public.clients;
create policy "clients_coach_all"
on public.clients for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "clients_self_select" on public.clients;
create policy "clients_self_select"
on public.clients for select to authenticated
using (user_id = auth.uid());

drop policy if exists "clients_self_update" on public.clients;
create policy "clients_self_update"
on public.clients for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.clients c
  where c.user_id = auth.uid()
    and c.deleted_at is null
  order by c.created_at desc nulls last
  limit 1;
$$;

grant execute on function public.current_client_id() to authenticated, anon;

-- Enrich profiles SELECT: coach sees linked client profiles
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.clients c
    where c.coach_id = auth.uid()
      and c.user_id = profiles.id
      and c.deleted_at is null
  )
);

-- =============================================================================
-- prestations (minimal stub — FK target)
-- =============================================================================

create table if not exists public.prestations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  pricing_type text not null default 'unique'
    check (pricing_type in ('unique', 'renewable')),
  price_cents integer not null default 0,
  modules jsonb not null default '[]'::jsonb,
  program_template_id uuid references public.programs(id) on delete set null,
  nutrition_template_id uuid,
  showroom_visible boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists prestations_coach_id_idx on public.prestations (coach_id)
  where deleted_at is null;

alter table public.prestations enable row level security;

drop policy if exists "prestations_coach_all" on public.prestations;
create policy "prestations_coach_all"
on public.prestations for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "prestations_showroom_select" on public.prestations;
create policy "prestations_showroom_select"
on public.prestations for select
to anon, authenticated
using (showroom_visible = true and status = 'active' and deleted_at is null);

-- =============================================================================
-- payment_ledger (minimal stub — FK target for client_grants)
-- =============================================================================

create table if not exists public.payment_ledger (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  prestation_id uuid not null references public.prestations(id) on delete restrict,
  amount_cents integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  source text not null default 'manual'
    check (source in ('manual', 'link', 'stripe', 'showroom')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_ledger_coach_id_idx on public.payment_ledger (coach_id);
create index if not exists payment_ledger_client_id_idx on public.payment_ledger (client_id);

alter table public.payment_ledger enable row level security;

drop policy if exists "payment_ledger_coach_select" on public.payment_ledger;
create policy "payment_ledger_coach_select"
on public.payment_ledger for select to authenticated
using (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "payment_ledger_client_select" on public.payment_ledger;
create policy "payment_ledger_client_select"
on public.payment_ledger for select to authenticated
using (
  client_id in (select id from public.clients where user_id = auth.uid() and deleted_at is null)
);

drop policy if exists "payment_ledger_coach_insert" on public.payment_ledger;
create policy "payment_ledger_coach_insert"
on public.payment_ledger for insert to authenticated
with check (coach_id = auth.uid() or public.is_platform_admin());

-- =============================================================================
-- client_grants
-- =============================================================================

create table if not exists public.client_grants (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  prestation_id uuid not null references public.prestations(id) on delete restrict,
  modules jsonb not null default '[]'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'ended')),
  starts_at timestamptz,
  ends_at timestamptz,
  payment_ledger_id uuid references public.payment_ledger(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_grants_client_id_idx on public.client_grants (client_id);
create index if not exists client_grants_coach_id_idx on public.client_grants (coach_id);

alter table public.client_grants enable row level security;

drop policy if exists "client_grants_coach_all" on public.client_grants;
create policy "client_grants_coach_all"
on public.client_grants for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "client_grants_client_select" on public.client_grants;
create policy "client_grants_client_select"
on public.client_grants for select to authenticated
using (
  client_id in (select id from public.clients where user_id = auth.uid() and deleted_at is null)
);

-- =============================================================================
-- client_groups + members
-- =============================================================================

create table if not exists public.client_groups (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null default 'manual'
    check (type in ('auto', 'manual')),
  prestation_id uuid references public.prestations(id) on delete set null,
  chat_enabled boolean not null default false,
  drive_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists client_groups_coach_id_idx on public.client_groups (coach_id);

create table if not exists public.client_group_members (
  group_id uuid not null references public.client_groups(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, client_id)
);

create index if not exists client_group_members_client_id_idx
  on public.client_group_members (client_id);

alter table public.client_groups enable row level security;
alter table public.client_group_members enable row level security;

drop policy if exists "client_groups_coach_all" on public.client_groups;
create policy "client_groups_coach_all"
on public.client_groups for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "client_groups_member_select" on public.client_groups;
create policy "client_groups_member_select"
on public.client_groups for select to authenticated
using (
  id in (
    select m.group_id from public.client_group_members m
    join public.clients c on c.id = m.client_id
    where c.user_id = auth.uid() and c.deleted_at is null
  )
);

drop policy if exists "client_group_members_coach_all" on public.client_group_members;
create policy "client_group_members_coach_all"
on public.client_group_members for all to authenticated
using (
  exists (
    select 1 from public.client_groups g
    where g.id = client_group_members.group_id
      and (g.coach_id = auth.uid() or public.is_platform_admin())
  )
)
with check (
  exists (
    select 1 from public.client_groups g
    where g.id = client_group_members.group_id
      and (g.coach_id = auth.uid() or public.is_platform_admin())
  )
);

drop policy if exists "client_group_members_self_select" on public.client_group_members;
create policy "client_group_members_self_select"
on public.client_group_members for select to authenticated
using (
  client_id in (select id from public.clients where user_id = auth.uid() and deleted_at is null)
);

-- =============================================================================
-- coach_onboarding_questions + onboarding_answers
-- =============================================================================

create table if not exists public.coach_onboarding_questions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  type text not null default 'texte'
    check (type in ('texte', 'nombre', 'choix', 'oui_non')),
  required boolean not null default false,
  sort_order integer not null default 0,
  options jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coach_onboarding_questions_coach_id_idx
  on public.coach_onboarding_questions (coach_id, sort_order);

create table if not exists public.onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.coach_onboarding_questions(id) on delete cascade,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  unique (client_id, question_id)
);

create index if not exists onboarding_answers_client_id_idx on public.onboarding_answers (client_id);

alter table public.coach_onboarding_questions enable row level security;
alter table public.onboarding_answers enable row level security;

drop policy if exists "onboarding_q_coach_all" on public.coach_onboarding_questions;
create policy "onboarding_q_coach_all"
on public.coach_onboarding_questions for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "onboarding_q_client_select" on public.coach_onboarding_questions;
create policy "onboarding_q_client_select"
on public.coach_onboarding_questions for select to authenticated
using (
  coach_id in (
    select c.coach_id from public.clients c
    where c.user_id = auth.uid() and c.deleted_at is null
  )
);

drop policy if exists "onboarding_a_coach_select" on public.onboarding_answers;
create policy "onboarding_a_coach_select"
on public.onboarding_answers for select to authenticated
using (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "onboarding_a_client_crud" on public.onboarding_answers;
create policy "onboarding_a_client_crud"
on public.onboarding_answers for all to authenticated
using (
  client_id in (select id from public.clients where user_id = auth.uid() and deleted_at is null)
)
with check (
  client_id in (select id from public.clients where user_id = auth.uid() and deleted_at is null)
);

comment on table public.coach_subscriptions is 'SaaS coach plan + trial (15 calendar days from first app login)';
comment on table public.clients is 'Replaces demo_clients for real multi-tenant CRM';
comment on table public.prestations is 'Phase 2 stub — full payments domain still product-stub';
comment on table public.payment_ledger is 'Phase 2 stub — immutable ledger; full rules later';
