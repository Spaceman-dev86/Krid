-- Repos entre items de composition (séance catalogue).
-- item_kind = 'rest' : ni bloc ni exo ; durée dans prescriptions [{ "rest_seconds": N }].

alter table public.session_library_items
  drop constraint if exists session_library_items_kind_check;

alter table public.session_library_items
  add constraint session_library_items_kind_check
  check (item_kind in ('block', 'exercise', 'rest'));

alter table public.session_library_items
  drop constraint if exists session_library_items_ref_check;

alter table public.session_library_items
  add constraint session_library_items_ref_check
  check (
    (item_kind = 'block' and block_id is not null and exercise_id is null)
    or (item_kind = 'exercise' and exercise_id is not null and block_id is null)
    or (item_kind = 'rest' and block_id is null and exercise_id is null)
  );

comment on column public.session_library_items.prescriptions is
  'exercise: [{unit_id, value, input_mode, varies, group}] ; rest: [{rest_seconds}] ; block: [].';

insert into public.schema_migrations_trainly (id)
values ('53_session_library_items_rest')
on conflict (id) do nothing;
