-- =============================================================================
-- TRANCHE 46 — Unités : value_mode (number|time|text) + unité Variable
-- Prérequis : 42_sports_units_exercise_sport · 45…
-- =============================================================================

alter table public.units
  add column if not exists value_mode text;

update public.units
set value_mode = case
  when key in ('time_s', 'time_min') then 'time'
  when key in ('variable', 'completed') then 'text'
  when dimension in ('count', 'mass', 'distance') then 'number'
  else 'text'
end
where value_mode is null;

alter table public.units
  alter column value_mode set default 'number';

update public.units set value_mode = 'number' where value_mode is null;

do $$
begin
  alter table public.units
    add constraint units_value_mode_check
    check (value_mode in ('number', 'time', 'text'));
exception
  when duplicate_object then null;
end $$;

comment on column public.units.value_mode is
  'number = stepper chiffres · time = mm:ss · text = note libre (ex. Variable)';

insert into public.units (coach_id, key, label, dimension, value_mode)
select null, 'variable', 'Variable', 'other', 'text'
where not exists (
  select 1 from public.units u
  where u.deleted_at is null
    and u.coach_id is null
    and lower(trim(u.key)) = 'variable'
);

-- Reps / tours / charge / distance / cal → number explicite
update public.units
set value_mode = 'number'
where coach_id is null
  and deleted_at is null
  and key in ('reps', 'rounds', 'load_kg', 'distance_m', 'cal');

update public.units
set value_mode = 'time'
where coach_id is null
  and deleted_at is null
  and key in ('time_s', 'time_min');

update public.units
set value_mode = 'text'
where coach_id is null
  and deleted_at is null
  and key in ('variable', 'completed');

insert into public.schema_migrations_trainly (id)
values ('46_units_value_mode')
on conflict (id) do nothing;
