-- =============================================================================
-- TRANCHE 75 — Tags groupe libre (presta | programme sport, max 3)
-- Prérequis : 72_group_linked_presta · 10_programs · 04_prestations_grants
-- Classement coach only — pas de sync membres
-- =============================================================================

create table if not exists public.client_group_tags (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.client_groups(id) on delete cascade,
  kind text not null check (kind in ('prestation', 'program')),
  ref_id uuid not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (group_id, kind, ref_id)
);

create index if not exists client_group_tags_group_idx
  on public.client_group_tags (group_id, sort_order);

alter table public.client_group_tags enable row level security;

drop policy if exists "client_group_tags_coach_all" on public.client_group_tags;
create policy "client_group_tags_coach_all"
on public.client_group_tags for all to authenticated
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
      and g.type = 'manual'
      and (g.coach_id = auth.uid() or public.is_platform_admin())
  )
);

create or replace function public.enforce_client_group_tags_max3()
returns trigger
language plpgsql
as $$
declare
  n int;
begin
  select count(*)::int into n
  from public.client_group_tags
  where group_id = new.group_id;

  if tg_op = 'INSERT' and n >= 3 then
    raise exception 'max 3 tags par groupe libre';
  end if;
  return new;
end;
$$;

drop trigger if exists client_group_tags_max3_trg on public.client_group_tags;
create trigger client_group_tags_max3_trg
before insert on public.client_group_tags
for each row execute function public.enforce_client_group_tags_max3();

-- Backfill depuis l’ancien tag presta unique (groupes manuels)
insert into public.client_group_tags (group_id, kind, ref_id, sort_order)
select g.id, 'prestation', g.prestation_id, 0
from public.client_groups g
where g.type = 'manual'
  and g.prestation_id is not null
on conflict (group_id, kind, ref_id) do nothing;

comment on table public.client_group_tags is
  'Tags classement groupe libre · prestation | program · max 3 · pas de sync';
