-- Blocs usage (créés depuis une séance) : invisibles dans Ma biblio / Brouillon
alter table public.block_library
  add column if not exists hub_visible boolean not null default true;

comment on column public.block_library.hub_visible is
  'false = usage séance uniquement (pas listé dans hubs Ma biblio / Brouillon)';

create index if not exists block_library_hub_visible_idx
  on public.block_library (coach_id, status)
  where hub_visible = true and deleted_at is null;
