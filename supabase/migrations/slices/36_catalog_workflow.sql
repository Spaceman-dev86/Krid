-- =============================================================================
-- TRANCHE 36 — Catalogue workflow Brouillon → Review → Publié + droits
-- Prérequis : 10_programs · 20_exercise_status
-- Spec : /admin/catalog (FIGÉ 2026-03-13)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- programs.catalog_status (+ sync is_published) · allow_duplicate / allow_download
-- -----------------------------------------------------------------------------

alter table public.programs
  add column if not exists catalog_status text,
  add column if not exists allow_duplicate boolean not null default true,
  add column if not exists allow_download boolean not null default true;

update public.programs
set catalog_status = case when coalesce(is_published, false) then 'published' else 'draft' end
where catalog_status is null;

alter table public.programs
  alter column catalog_status set default 'draft';

alter table public.programs
  alter column catalog_status set not null;

do $$
begin
  alter table public.programs
    add constraint programs_catalog_status_check
    check (catalog_status in ('draft', 'review', 'published'));
exception
  when duplicate_object then null;
end $$;

create or replace function public.sync_program_catalog_published()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.catalog_status is null then
      NEW.catalog_status := case when coalesce(NEW.is_published, false) then 'published' else 'draft' end;
    end if;
  elsif TG_OP = 'UPDATE' then
    -- Écrivains legacy qui ne touchent que is_published
    if NEW.is_published is distinct from OLD.is_published
       and NEW.catalog_status is not distinct from OLD.catalog_status then
      NEW.catalog_status := case when NEW.is_published then 'published' else 'draft' end;
    end if;
  end if;

  NEW.is_published := (NEW.catalog_status = 'published');
  return NEW;
end;
$$;

drop trigger if exists trg_sync_program_catalog_published on public.programs;
create trigger trg_sync_program_catalog_published
before insert or update on public.programs
for each row
execute function public.sync_program_catalog_published();

create index if not exists programs_catalog_status_idx
  on public.programs (catalog_status, is_template)
  where deleted_at is null;

comment on column public.programs.catalog_status is
  'Workflow catalogue Trainly : draft → review → published (is_published synchronisé)';
comment on column public.programs.allow_duplicate is
  'Coach peut dupliquer / récupérer dans son espace';
comment on column public.programs.allow_download is
  'Coach peut télécharger (export) si applicable';

-- -----------------------------------------------------------------------------
-- exercise_library : status + review · droits catalogue Trainly
-- -----------------------------------------------------------------------------

alter table public.exercise_library
  add column if not exists allow_duplicate boolean not null default true,
  add column if not exists allow_download boolean not null default true;

alter table public.exercise_library
  drop constraint if exists exercise_library_status_check;

do $$
begin
  alter table public.exercise_library
    add constraint exercise_library_status_check
    check (status in ('draft', 'review', 'published'));
exception
  when duplicate_object then null;
end $$;

comment on column public.exercise_library.status is
  'draft | review | published — coach : draft/published · Trainly admin : + review';
comment on column public.exercise_library.allow_duplicate is
  'Coach peut récupérer une copie dans Ma biblio (Trainly)';
comment on column public.exercise_library.allow_download is
  'Coach peut télécharger le média si applicable';

insert into public.schema_migrations_trainly (id)
values ('36_catalog_workflow')
on conflict (id) do nothing;
