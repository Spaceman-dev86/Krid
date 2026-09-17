-- =============================================================================
-- TRANCHE 49 — muscle_group « maison » → type Maison ; défaut type Musculation
-- Prérequis : 39 (exercise_types) · 41
-- Après Run : dis « 49 OK »
-- =============================================================================

-- 1) Type Maison (Trainly) si absent
insert into public.exercise_types (coach_id, label)
select null, 'Maison'
where not exists (
  select 1 from public.exercise_types t
  where t.deleted_at is null
    and lower(trim(t.label)) = 'maison'
);

-- 2) Exos muscle_group = maison → type Maison + muscle vidé
update public.exercise_library e
set
  exercise_type_id = t.id,
  exercise_type = t.label,
  muscle_group = null,
  updated_at = now()
from public.exercise_types t
where t.deleted_at is null
  and lower(trim(t.label)) = 'maison'
  and e.deleted_at is null
  and e.muscle_group is not null
  and lower(trim(e.muscle_group)) = 'maison';

-- 3) Type Musculation (sécurité si seed 39 absent)
insert into public.exercise_types (coach_id, label)
select null, 'Musculation'
where not exists (
  select 1 from public.exercise_types t
  where t.deleted_at is null
    and lower(trim(t.label)) = 'musculation'
);

-- 4) Tous les autres sans type → Musculation
update public.exercise_library e
set
  exercise_type_id = t.id,
  exercise_type = t.label,
  updated_at = now()
from public.exercise_types t
where t.deleted_at is null
  and lower(trim(t.label)) = 'musculation'
  and e.deleted_at is null
  and e.exercise_type_id is null;

insert into public.schema_migrations_trainly (id)
values ('49_maison_muscle_to_type')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
