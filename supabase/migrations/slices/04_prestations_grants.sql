-- =============================================================================
-- TRANCHE 04 — Prestations + payment_ledger + client_grants
-- Prérequis : 01 → 03b
-- Pas de FK vers programs (table pas encore sur le nouveau projet)
-- Après Run : dis « 04 OK » → code UI prestations / grants
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers clients (tables déjà là)
-- -----------------------------------------------------------------------------

create or replace function public.owns_client_row(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client_id
      and c.deleted_at is null
      and (c.coach_id = auth.uid() or c.user_id = auth.uid() or public.is_platform_admin())
  );
$$;

create or replace function public.is_my_client_row(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
  );
$$;

grant execute on function public.owns_client_row(uuid) to authenticated, anon;
grant execute on function public.is_my_client_row(uuid) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- prestations
-- -----------------------------------------------------------------------------

create table if not exists public.prestations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  pricing_type text not null default 'unique'
    check (pricing_type in ('unique', 'renewable')),
  price_cents integer not null default 0 check (price_cents >= 0),
  modules jsonb not null default '[]'::jsonb,
  -- FK programs ajoutée quand tranche programmes sera en place
  program_template_id uuid,
  nutrition_template_id uuid,
  showroom_visible boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists prestations_coach_id_idx
  on public.prestations (coach_id)
  where deleted_at is null;

create index if not exists prestations_showroom_idx
  on public.prestations (coach_id)
  where showroom_visible = true and status = 'active' and deleted_at is null;

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

create or replace function public.owns_prestation(p_prestation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.prestations p
    where p.id = p_prestation_id
      and p.deleted_at is null
      and (p.coach_id = auth.uid() or public.is_platform_admin())
  );
$$;

grant execute on function public.owns_prestation(uuid) to authenticated, anon;

-- Link client_groups.prestation_id → prestations (optional FK)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_groups_prestation_id_fkey'
  ) then
    alter table public.client_groups
      add constraint client_groups_prestation_id_fkey
      foreign key (prestation_id) references public.prestations(id) on delete set null;
  end if;
exception
  when others then null;
end $$;

-- -----------------------------------------------------------------------------
-- payment_ledger (immutable — no delete policy)
-- -----------------------------------------------------------------------------

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
create index if not exists payment_ledger_prestation_id_idx on public.payment_ledger (prestation_id);

alter table public.payment_ledger enable row level security;

drop policy if exists "payment_ledger_coach_select" on public.payment_ledger;
create policy "payment_ledger_coach_select"
on public.payment_ledger for select to authenticated
using (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "payment_ledger_client_select" on public.payment_ledger;
create policy "payment_ledger_client_select"
on public.payment_ledger for select to authenticated
using (public.is_my_client_row(client_id));

drop policy if exists "payment_ledger_coach_insert" on public.payment_ledger;
create policy "payment_ledger_coach_insert"
on public.payment_ledger for insert to authenticated
with check (
  (coach_id = auth.uid() or public.is_platform_admin())
  and public.owns_client_row(client_id)
  and public.owns_prestation(prestation_id)
);

drop policy if exists "payment_ledger_coach_update" on public.payment_ledger;
create policy "payment_ledger_coach_update"
on public.payment_ledger for update to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- client_grants
-- -----------------------------------------------------------------------------

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
create index if not exists client_grants_prestation_id_idx on public.client_grants (prestation_id);
create index if not exists client_grants_active_idx
  on public.client_grants (client_id, status)
  where status = 'active';

alter table public.client_grants enable row level security;

drop policy if exists "client_grants_coach_all" on public.client_grants;
create policy "client_grants_coach_all"
on public.client_grants for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (
  (coach_id = auth.uid() or public.is_platform_admin())
  and public.owns_client_row(client_id)
  and public.owns_prestation(prestation_id)
);

drop policy if exists "client_grants_client_select" on public.client_grants;
create policy "client_grants_client_select"
on public.client_grants for select to authenticated
using (public.is_my_client_row(client_id));

insert into public.schema_migrations_trainly (id)
values ('04_prestations_grants')
on conflict (id) do nothing;

comment on table public.prestations is 'Offres coach — accès via client_grants ; templates programmes plus tard';
comment on table public.payment_ledger is 'Ledger immuable (pas de delete) ; Payé → grant';
comment on table public.client_grants is 'Accès modules issus d’une presta ; achat ≠ démarrage plan';
