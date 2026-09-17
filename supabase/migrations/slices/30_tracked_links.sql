-- =============================================================================
-- TRANCHE 30 — Liens trackés showroom (?ref=) + leads optionnels
-- Prérequis : 02_coach_tenancy, 03_clients, 04_prestations_grants
-- Après Run : dis « 30 OK »
-- =============================================================================

create table if not exists public.coach_tracked_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  label text not null,
  channel text not null default 'other'
    check (channel in ('ig', 'wa', 'fb', 'other')),
  target_kind text not null default 'showroom'
    check (target_kind in ('showroom', 'prestation')),
  prestation_id uuid references public.prestations(id) on delete cascade,
  capture_leads boolean not null default false,
  is_default boolean not null default false,
  share_message text,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  constraint coach_tracked_links_presta_check check (
    (target_kind = 'showroom' and prestation_id is null)
    or (target_kind = 'prestation' and prestation_id is not null)
  )
);

create unique index if not exists coach_tracked_links_coach_code_uidx
  on public.coach_tracked_links (coach_id, lower(code));

create unique index if not exists coach_tracked_links_default_uidx
  on public.coach_tracked_links (coach_id)
  where is_default = true and status = 'active';

create index if not exists coach_tracked_links_coach_id_idx
  on public.coach_tracked_links (coach_id);

alter table public.coach_tracked_links enable row level security;

drop policy if exists "coach_tracked_links_coach_all" on public.coach_tracked_links;
create policy "coach_tracked_links_coach_all"
on public.coach_tracked_links for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- Lecture publique des liens actifs (résolution ?ref= côté client / anon)
drop policy if exists "coach_tracked_links_public_select" on public.coach_tracked_links;
create policy "coach_tracked_links_public_select"
on public.coach_tracked_links for select to anon, authenticated
using (status = 'active');

-- -----------------------------------------------------------------------------
-- Clics anonymes (pas de PII canal)
-- -----------------------------------------------------------------------------

create table if not exists public.coach_tracked_link_clicks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.coach_tracked_links(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  visitor_key text,
  created_at timestamptz not null default now()
);

create index if not exists coach_tracked_link_clicks_link_id_idx
  on public.coach_tracked_link_clicks (link_id);
create index if not exists coach_tracked_link_clicks_coach_id_idx
  on public.coach_tracked_link_clicks (coach_id);
create index if not exists coach_tracked_link_clicks_created_at_idx
  on public.coach_tracked_link_clicks (created_at desc);

alter table public.coach_tracked_link_clicks enable row level security;

drop policy if exists "coach_tracked_link_clicks_coach_select" on public.coach_tracked_link_clicks;
create policy "coach_tracked_link_clicks_coach_select"
on public.coach_tracked_link_clicks for select to authenticated
using (coach_id = auth.uid() or public.is_platform_admin());

-- Inserts via service role / server actions (pas de policy insert anon large)

-- -----------------------------------------------------------------------------
-- Leads volontaires (si capture_leads sur le lien)
-- -----------------------------------------------------------------------------

create table if not exists public.coach_tracked_leads (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.coach_tracked_links(id) on delete cascade,
  click_id uuid references public.coach_tracked_link_clicks(id) on delete set null,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('ig', 'wa', 'fb', 'other')),
  handle text,
  phone text,
  first_name text,
  last_name text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists coach_tracked_leads_link_id_idx
  on public.coach_tracked_leads (link_id);
create index if not exists coach_tracked_leads_coach_id_idx
  on public.coach_tracked_leads (coach_id);

alter table public.coach_tracked_leads enable row level security;

drop policy if exists "coach_tracked_leads_coach_select" on public.coach_tracked_leads;
create policy "coach_tracked_leads_coach_select"
on public.coach_tracked_leads for select to authenticated
using (coach_id = auth.uid() or public.is_platform_admin());

-- Attribution
alter table public.clients
  add column if not exists tracked_link_id uuid references public.coach_tracked_links(id) on delete set null;

create index if not exists clients_tracked_link_id_idx
  on public.clients (tracked_link_id)
  where tracked_link_id is not null;

alter table public.payment_ledger
  add column if not exists tracked_link_id uuid references public.coach_tracked_links(id) on delete set null;

create index if not exists payment_ledger_tracked_link_id_idx
  on public.payment_ledger (tracked_link_id)
  where tracked_link_id is not null;

insert into public.schema_migrations_trainly (id)
values ('30_tracked_links')
on conflict (id) do nothing;

comment on table public.coach_tracked_links is
  'Campagnes showroom/presta (?ref=code) · canal IG/WA/FB · capture leads optionnelle';
comment on table public.coach_tracked_link_clicks is
  'Clics anonymes — pas de handle/téléphone/nom';
comment on table public.coach_tracked_leads is
  'Leads volontaires si capture_leads = true sur le lien';
