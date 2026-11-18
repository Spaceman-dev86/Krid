-- =============================================================================
-- TRANCHE 97 — Provenance blocs coach (Krid / own)
-- =============================================================================

alter table public.block_library
  add column if not exists source_kind text not null default 'own',
  add column if not exists source_block_id uuid null references public.block_library(id) on delete set null;

do $$ begin
  alter table public.block_library
    drop constraint if exists block_library_source_kind_check;
  alter table public.block_library
    add constraint block_library_source_kind_check
    check (source_kind in ('own', 'krid', 'network'));
exception when others then null;
end $$;

comment on column public.block_library.source_kind is
  'Provenance coach-only: own | krid | network (V2). Pas de réseau blocs en produit.';
comment on column public.block_library.source_block_id is
  'Bloc d’origine (fork Krid). Nullable.';

create index if not exists block_library_source_block_id_idx
  on public.block_library (source_block_id)
  where source_block_id is not null;

create index if not exists block_library_coach_source_krid_idx
  on public.block_library (coach_id, source_block_id)
  where source_kind = 'krid' and deleted_at is null;
