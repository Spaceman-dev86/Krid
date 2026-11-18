-- =============================================================================
-- TRANCHE 72 — Groupe lié à une presta (sync roster)
-- Prérequis : 03_clients · 04_prestations_grants
-- type linked = 0..1 groupe sync / presta · manual = libre (+ tag optionnel)
-- =============================================================================

-- Étendre le check type : auto (legacy) | manual | linked
alter table public.client_groups drop constraint if exists client_groups_type_check;
alter table public.client_groups
  add constraint client_groups_type_check
  check (type in ('auto', 'manual', 'linked'));

-- Un seul groupe lié par presta (par coach)
create unique index if not exists client_groups_one_linked_per_presta_uidx
  on public.client_groups (coach_id, prestation_id)
  where type = 'linked' and prestation_id is not null;

-- Exclusion sticky (retrait coach) — clear au repay / nouveau grant actif
create table if not exists public.client_group_exclusions (
  group_id uuid not null references public.client_groups(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, client_id)
);

create index if not exists client_group_exclusions_client_idx
  on public.client_group_exclusions (client_id);

alter table public.client_group_exclusions enable row level security;

drop policy if exists "client_group_exclusions_coach_all" on public.client_group_exclusions;
create policy "client_group_exclusions_coach_all"
on public.client_group_exclusions for all to authenticated
using (
  exists (
    select 1 from public.client_groups g
    where g.id = group_id
      and (g.coach_id = auth.uid() or public.is_platform_admin())
  )
)
with check (
  exists (
    select 1 from public.client_groups g
    where g.id = group_id
      and (g.coach_id = auth.uid() or public.is_platform_admin())
  )
);

comment on table public.client_group_exclusions is
  'Retrait manuel d’un membre d’un groupe lié — sticky jusqu’à repay / re-grant';

comment on column public.client_groups.type is
  'manual = libre · linked = sync presta (0..1) · auto = legacy';
