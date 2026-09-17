-- =============================================================================
-- TRANCHE 29 — Codes coach (accès cash + promo)
-- Prérequis : 04_prestations_grants, 23b_payment_period, 03_clients
-- Après Run : dis « 29 OK »
-- =============================================================================

-- Ledger : source cash (redeem code d’accès)
do $$
begin
  alter table public.payment_ledger drop constraint if exists payment_ledger_source_check;
exception
  when undefined_object then null;
end $$;

alter table public.payment_ledger
  add constraint payment_ledger_source_check
  check (source in ('manual', 'link', 'stripe', 'showroom', 'cash'));

-- -----------------------------------------------------------------------------
-- coach_codes
-- -----------------------------------------------------------------------------

create table if not exists public.coach_codes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('access', 'promo')),
  code text not null,
  -- access : 1 presta + montant reçu (ledger à redeem)
  prestation_id uuid references public.prestations(id) on delete cascade,
  amount_cents integer,
  -- promo
  percent_off integer,
  prestation_ids uuid[] not null default '{}',
  audience text not null default 'public'
    check (audience in ('public', 'client', 'group', 'presta_clients')),
  audience_client_id uuid references public.clients(id) on delete cascade,
  audience_group_id uuid references public.client_groups(id) on delete cascade,
  audience_prestation_id uuid references public.prestations(id) on delete cascade,
  -- validité (AND : premier seuil atteint coupe)
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'exhausted', 'expired', 'revoked')),
  last_redeemed_at timestamptz,
  last_redeemed_client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint coach_codes_access_fields check (
    type <> 'access'
    or (
      prestation_id is not null
      and amount_cents is not null
      and amount_cents >= 0
      and max_uses = 1
    )
  ),
  constraint coach_codes_promo_fields check (
    type <> 'promo'
    or (
      percent_off is not null
      and percent_off >= 5
      and percent_off <= 100
      and percent_off % 5 = 0
      and cardinality(prestation_ids) >= 1
      and (expires_at is not null or max_uses is not null)
    )
  )
);

create unique index if not exists coach_codes_coach_code_uidx
  on public.coach_codes (coach_id, lower(code));

create index if not exists coach_codes_coach_id_idx on public.coach_codes (coach_id);
create index if not exists coach_codes_type_idx on public.coach_codes (coach_id, type);
create index if not exists coach_codes_prestation_id_idx on public.coach_codes (prestation_id);

alter table public.coach_codes enable row level security;

drop policy if exists "coach_codes_coach_all" on public.coach_codes;
create policy "coach_codes_coach_all"
on public.coach_codes for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- Clients authentifiés : lecture des codes actifs de leur coach (checkout)
drop policy if exists "coach_codes_client_select" on public.coach_codes;
create policy "coach_codes_client_select"
on public.coach_codes for select to authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.clients c
    where c.user_id = auth.uid()
      and c.coach_id = coach_codes.coach_id
      and c.deleted_at is null
  )
);

insert into public.schema_migrations_trainly (id)
values ('29_coach_codes')
on conflict (id) do nothing;

comment on table public.coach_codes is
  'Codes coach : access (cash 1×/24h/1 presta) · promo (% + audience + durée et/ou max uses)';
