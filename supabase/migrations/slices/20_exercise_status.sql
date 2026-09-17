-- =============================================================================
-- TRANCHE 20 — Exercices coach (status draft|published + type)
-- Prérequis : 10_programs (exercise_library)
-- Après Run : dis « 20 OK »
-- =============================================================================
-- Périmètre :
--   • status : draft | published (Trainly = published)
--   • exercise_type text (libellé libre V1)
-- Hors scope : remplacements multi · types table dédiée · corbeille Settings
-- =============================================================================

alter table public.exercise_library
  add column if not exists status text;

alter table public.exercise_library
  add column if not exists exercise_type text;

-- Backfill : catalogue Trainly + existants → published
update public.exercise_library
set status = 'published'
where status is null;

alter table public.exercise_library
  alter column status set default 'draft';

do $$
begin
  alter table public.exercise_library
    add constraint exercise_library_status_check
    check (status in ('draft', 'published'));
exception
  when duplicate_object then null;
end $$;

-- Index filtrage builder / land
create index if not exists exercise_library_coach_status_idx
  on public.exercise_library (coach_id, status)
  where deleted_at is null;

comment on column public.exercise_library.status is
  'draft = brouillon coach (hors builder) · published = Ma biblio / Trainly';
comment on column public.exercise_library.exercise_type is
  'Type libre V1 (ex. musculation, cardio) — table types dédiée plus tard';

insert into public.schema_migrations_trainly (id)
values ('20_exercise_status')
on conflict (id) do nothing;
