-- =============================================================================
-- TRANCHE 48 — Unité Note (texte libre, non convertible en chiffre)
-- Prérequis : 46_units_value_mode
-- =============================================================================

insert into public.units (coach_id, key, label, dimension, value_mode)
select null, 'note', 'Note', 'other', 'text'
where not exists (
  select 1 from public.units u
  where u.deleted_at is null
    and u.coach_id is null
    and lower(trim(u.key)) = 'note'
);

update public.units
set value_mode = 'text',
    label = coalesce(nullif(trim(label), ''), 'Note')
where coach_id is null
  and deleted_at is null
  and lower(trim(key)) = 'note';

comment on column public.units.value_mode is
  'number = stepper · time = mm:ss · text = note libre (Note, Variable…) — non convertible';

insert into public.schema_migrations_trainly (id)
values ('48_units_note')
on conflict (id) do nothing;
