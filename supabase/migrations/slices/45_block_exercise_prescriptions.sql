-- =============================================================================
-- TRANCHE 45 — Retirer circuit · prescriptions libres sur exos de bloc
-- Prérequis : 44_block_formats_units_free_constraints
-- =============================================================================

update public.block_formats
set deleted_at = now(), updated_at = now()
where deleted_at is null and key = 'circuit';

-- Lignes d’unité par exo du template (valeur toujours texte ; varie = évolue dans le bloc)
alter table public.block_library_exercises
  add column if not exists prescriptions jsonb not null default '[]'::jsonb;

comment on column public.block_library_exercises.prescriptions is
  '[{unit_id, value, varies}] — value texte libre (ex. "10", "1-2-3-4-5", "bodyweight").';

comment on table public.block_library_exercises is
  'Exos d’un template bloc + prescriptions libres (texte / varie), pas de RX structurée builder.';

insert into public.schema_migrations_trainly (id)
values ('45_block_exercise_prescriptions')
on conflict (id) do nothing;
