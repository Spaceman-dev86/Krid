-- =============================================================================
-- TRANCHE 02 — Tenancy coach (subscriptions + branding)
-- Prérequis : tranche 01 OK
-- Après Run : dis « 02 OK » → code shell / trial
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

-- Coach peut démarrer / lire son essai (insert own trial row)
drop policy if exists "coach_subscriptions_insert_own_trial" on public.coach_subscriptions;
create policy "coach_subscriptions_insert_own_trial"
on public.coach_subscriptions for insert to authenticated
with check (
  coach_id = auth.uid()
  and status = 'trial'
  and plan_tier in ('starter', 'business', 'scale', 'studio')
);

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

insert into public.schema_migrations_trainly (id)
values ('02_coach_tenancy')
on conflict (id) do nothing;

comment on table public.coach_subscriptions is 'SaaS coach plan + trial (15 calendar days from first app login)';
comment on table public.coach_branding is 'White-label / showroom slug /c/[slug]';
