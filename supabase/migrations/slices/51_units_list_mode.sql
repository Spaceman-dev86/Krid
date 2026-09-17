-- =============================================================================
-- TRANCHE 51 — Unités : mode liste (value_mode=list) + list_options
-- Prérequis : 46_units_value_mode
-- =============================================================================

alter table public.units
  add column if not exists list_options jsonb;

comment on column public.units.list_options is
  'Options UI quand value_mode=list (json array de strings). Ex. ["1","2",…,"10"] pour RPE.';

-- Élargir le check value_mode
alter table public.units drop constraint if exists units_value_mode_check;
alter table public.units
  add constraint units_value_mode_check
  check (value_mode in ('number', 'time', 'text', 'list'));

comment on column public.units.value_mode is
  'number = chiffre+steppers · time = mm:ss · text = libre · list = select (list_options)';

-- RPE plateforme → liste 1–10 si pas déjà list
update public.units
set
  value_mode = 'list',
  list_options = coalesce(
    list_options,
    '["1","2","3","4","5","6","7","8","9","10"]'::jsonb
  )
where coach_id is null
  and deleted_at is null
  and key = 'rpe';

insert into public.schema_migrations_trainly (id)
values ('51_units_list_mode')
on conflict (id) do nothing;
