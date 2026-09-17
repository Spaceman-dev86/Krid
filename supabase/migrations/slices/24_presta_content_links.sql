-- =============================================================================
-- TRANCHE 24 — Liaisons contenu presta (nutrition FK + dossier Drive)
-- Prérequis : 04 + 10 + 19 + 21
-- Après Run : dis « 24 OK »
-- =============================================================================

-- FK nutrition_template_id → nutrition_plans (colonne déjà en 04)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prestations_nutrition_template_id_fkey'
  ) then
    alter table public.prestations
      add constraint prestations_nutrition_template_id_fkey
      foreign key (nutrition_template_id) references public.nutrition_plans(id) on delete set null;
  end if;
end $$;

alter table public.prestations
  add column if not exists drive_folder_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prestations_drive_folder_id_fkey'
  ) then
    alter table public.prestations
      add constraint prestations_drive_folder_id_fkey
      foreign key (drive_folder_id) references public.drive_folders(id) on delete set null;
  end if;
end $$;

comment on column public.prestations.program_template_id is
  'Template fitness auto-envoyé (waiting) au Payé';
comment on column public.prestations.nutrition_template_id is
  'Template nutrition auto-envoyé (waiting) au Payé';
comment on column public.prestations.drive_folder_id is
  'Dossier Drive partagé automatiquement au Payé';

insert into public.schema_migrations_trainly (id)
values ('24_presta_content_links')
on conflict (id) do nothing;
