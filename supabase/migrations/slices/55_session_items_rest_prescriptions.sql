-- Composition programme = même modèle que séance catalogue :
-- rest first-class + prescriptions jsonb ; lien bloc → block_library.

alter table public.session_items
  drop constraint if exists session_items_kind_fk;

alter table public.session_items
  drop constraint if exists session_items_kind_check;

alter table public.session_items
  add column if not exists prescriptions jsonb not null default '[]'::jsonb;

alter table public.session_items
  add constraint session_items_kind_check
  check (kind in ('exercise', 'block', 'rest'));

alter table public.session_items
  add constraint session_items_kind_fk check (
    (kind = 'exercise' and program_exercise_id is not null and session_block_id is null)
    or (kind = 'block' and session_block_id is not null and program_exercise_id is null)
    or (kind = 'rest' and program_exercise_id is null and session_block_id is null)
  );

comment on column public.session_items.prescriptions is
  'exercise: [{unit_id, value, input_mode, varies, group}] ; rest: [{rest_seconds}] ; block: [].';

alter table public.session_blocks
  add column if not exists source_block_library_id uuid references public.block_library(id) on delete set null;

create index if not exists session_blocks_source_library_idx
  on public.session_blocks (source_block_library_id)
  where source_block_library_id is not null;

insert into public.schema_migrations_trainly (id)
values ('55_session_items_rest_prescriptions')
on conflict (id) do nothing;
