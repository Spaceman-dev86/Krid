-- =============================================================================
-- TRANCHE 82 — Prestations : plusieurs programmes / nutrition / drives
-- Prérequis : 24_presta_content_links
-- Après Run : dis « 82 OK »
-- =============================================================================

alter table public.prestations
  add column if not exists program_template_ids uuid[] not null default '{}'::uuid[],
  add column if not exists nutrition_template_ids uuid[] not null default '{}'::uuid[],
  add column if not exists drive_folder_ids uuid[] not null default '{}'::uuid[];

comment on column public.prestations.program_template_ids is
  'Programmes livrés à l’achat (uuid[]). program_template_id = 1er pour compat.';
comment on column public.prestations.nutrition_template_ids is
  'Plans nutrition livrés à l’achat (uuid[]). nutrition_template_id = 1er pour compat.';
comment on column public.prestations.drive_folder_ids is
  'Dossiers Drive livrés à l’achat (uuid[]). drive_folder_id = 1er pour compat.';

-- Backfill depuis les colonnes singulières
update public.prestations
set program_template_ids = array[program_template_id]
where program_template_id is not null
  and cardinality(coalesce(program_template_ids, '{}'::uuid[])) = 0;

update public.prestations
set nutrition_template_ids = array[nutrition_template_id]
where nutrition_template_id is not null
  and cardinality(coalesce(nutrition_template_ids, '{}'::uuid[])) = 0;

update public.prestations
set drive_folder_ids = array[drive_folder_id]
where drive_folder_id is not null
  and cardinality(coalesce(drive_folder_ids, '{}'::uuid[])) = 0;

insert into public.schema_migrations_trainly (id)
values ('82_prestation_content_multi')
on conflict (id) do nothing;
