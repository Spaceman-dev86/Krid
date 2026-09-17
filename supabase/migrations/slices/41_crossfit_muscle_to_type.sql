-- =============================================================================
-- TRANCHE 41 — Crossfit n’est plus un groupe musculaire → type
-- Prérequis : 39 (exercise_types) · 40
-- Après Run : dis « 41 OK »
-- =============================================================================

-- Type Crossfit (Trainly) si absent
insert into public.exercise_types (coach_id, label)
select null, 'Crossfit'
where not exists (
  select 1 from public.exercise_types t
  where t.deleted_at is null
    and lower(trim(t.label)) = 'crossfit'
);

-- Exos avec muscle_group = Crossfit → type Crossfit + muscle vidé
update public.exercise_library e
set
  exercise_type_id = t.id,
  exercise_type = t.label,
  muscle_group = null,
  updated_at = now()
from public.exercise_types t
where t.deleted_at is null
  and lower(trim(t.label)) = 'crossfit'
  and e.deleted_at is null
  and e.muscle_group is not null
  and lower(trim(e.muscle_group)) = 'crossfit';

-- Anciens « review » → brouillon (plus de step Review dans l’UI)
update public.exercise_library
set status = 'draft', updated_at = now()
where status = 'review'
  and coach_id is null
  and deleted_at is null;

insert into public.schema_migrations_trainly (id)
values ('41_crossfit_muscle_to_type')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
