-- =============================================================================
-- TRANCHE 44 — Ajustements formats / unités / contraintes libres blocs
-- Prérequis : 43_block_library_catalog
-- =============================================================================

-- Retirer Death by + Rounds du catalogue formats
update public.block_formats
set deleted_at = now(), updated_at = now()
where deleted_at is null
  and key in ('death_by', 'rounds');

-- EMOM : intervalle (« Démarre toutes les ») + durée totale
update public.block_formats
set
  constraint_fields = array['work_seconds', 'duration_seconds'],
  description = 'Every minute on the minute — intervalle + durée',
  updated_at = now()
where deleted_at is null and key = 'emom';

-- For time : nb de tours (pas timecap comme contrainte principale)
update public.block_formats
set
  constraint_fields = array['rounds'],
  description = 'Finir le plus vite possible — contrainte = nombre de tours',
  updated_at = now()
where deleted_at is null and key = 'for_time';

-- Intervals : travail / repos (mm:ss) × rounds
update public.block_formats
set
  constraint_fields = array['work_seconds', 'rest_seconds', 'rounds'],
  updated_at = now()
where deleted_at is null and key = 'intervals';

-- Unité calories + temps en minutes (résultat attendu)
insert into public.units (coach_id, key, label, dimension)
select null, v.key, v.label, v.dimension
from (values
  ('cal', 'Calories (cal)', 'other'),
  ('time_min', 'Temps (min)', 'time')
) as v(key, label, dimension)
where not exists (
  select 1 from public.units u
  where u.deleted_at is null
    and u.coach_id is null
    and lower(trim(u.key)) = lower(trim(v.key))
);

-- Contraintes libres (label + valeur texte)
alter table public.block_library
  add column if not exists free_constraints jsonb not null default '[]'::jsonb;

comment on column public.block_library.free_constraints is
  'Contraintes custom [{label, value}] — en plus des champs format.';

insert into public.schema_migrations_trainly (id)
values ('44_block_formats_units_free_constraints')
on conflict (id) do nothing;
