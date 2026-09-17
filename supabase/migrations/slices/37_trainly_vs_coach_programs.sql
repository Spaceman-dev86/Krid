-- =============================================================================
-- TRANCHE 37 — Séparer catalogue Trainly vs biblio coach (même compte admin)
-- Prérequis : 36_catalog_workflow
-- =============================================================================
-- is_trainly_catalog = true  → visible mode Trainly (publish plateforme)
-- is_trainly_catalog = false → biblio perso coach (mode Coach, lecture seule admin)
-- Un admin (ex. Remi) peut avoir les deux : créer via /admin = Trainly, via /programs = coach
-- =============================================================================

alter table public.programs
  add column if not exists is_trainly_catalog boolean;

-- Backfill : comptes coach → biblio coach
update public.programs p
set is_trainly_catalog = false
from public.profiles pr
where pr.id = p.coach_id
  and pr.role = 'coach'
  and p.is_trainly_catalog is null;

-- Backfill : staff déjà publiés / review → Trainly
update public.programs p
set is_trainly_catalog = true
from public.profiles pr
where pr.id = p.coach_id
  and pr.role in ('admin', 'platform_admin')
  and p.is_trainly_catalog is null
  and (
    coalesce(p.is_published, false) = true
    or coalesce(p.catalog_status, 'draft') in ('published', 'review')
    or coalesce(p.is_template, false) = true
  );

-- Backfill : staff brouillons non publiés → biblio coach perso (ex. Remi)
update public.programs p
set is_trainly_catalog = false
from public.profiles pr
where pr.id = p.coach_id
  and pr.role in ('admin', 'platform_admin')
  and p.is_trainly_catalog is null;

-- Sécurité : tout le reste → Trainly (fail-safe)
update public.programs
set is_trainly_catalog = true
where is_trainly_catalog is null;

alter table public.programs
  alter column is_trainly_catalog set default false;

alter table public.programs
  alter column is_trainly_catalog set not null;

create index if not exists programs_trainly_catalog_idx
  on public.programs (is_trainly_catalog, created_at desc)
  where deleted_at is null;

comment on column public.programs.is_trainly_catalog is
  'true = catalogue plateforme Trainly · false = biblio coach (y compris workspace perso d’un admin)';

-- Quand on publie vers le catalogue, forcer le flag Trainly
create or replace function public.ensure_trainly_on_catalog_publish()
returns trigger
language plpgsql
as $$
begin
  if NEW.catalog_status = 'published' or NEW.catalog_status = 'review' then
    NEW.is_trainly_catalog := true;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_ensure_trainly_on_catalog_publish on public.programs;
create trigger trg_ensure_trainly_on_catalog_publish
before insert or update of catalog_status on public.programs
for each row
execute function public.ensure_trainly_on_catalog_publish();

insert into public.schema_migrations_trainly (id)
values ('37_trainly_vs_coach_programs')
on conflict (id) do nothing;
