-- =============================================================================
-- TRANCHE 96 — Provenance exercices (Krid / own / network réservé V2)
-- Coach-only ; jamais exposé au client portail.
-- =============================================================================

alter table public.exercise_library
  add column if not exists source_kind text not null default 'own',
  add column if not exists source_exercise_id uuid null references public.exercise_library(id) on delete set null;

do $$ begin
  alter table public.exercise_library
    drop constraint if exists exercise_library_source_kind_check;
  alter table public.exercise_library
    add constraint exercise_library_source_kind_check
    check (source_kind in ('own', 'krid', 'network'));
exception when others then null;
end $$;

comment on column public.exercise_library.source_kind is
  'Provenance coach-only: own | krid | network (V2). Jamais exposé au client.';
comment on column public.exercise_library.source_exercise_id is
  'Exercice d’origine (fork Krid/réseau). Nullable.';

create index if not exists exercise_library_source_exercise_id_idx
  on public.exercise_library (source_exercise_id)
  where source_exercise_id is not null;

create index if not exists exercise_library_coach_source_krid_idx
  on public.exercise_library (coach_id, source_exercise_id)
  where source_kind = 'krid' and deleted_at is null;
