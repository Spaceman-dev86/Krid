-- =============================================================================
-- TRANCHE 98 — Tags coach : source_id + unicité scoped (sports / types)
-- Permet copie perso du catalogue Krid (même label) sans toucher coach_id null.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) source_id (provenance Krid)
-- -----------------------------------------------------------------------------

alter table public.sports
  add column if not exists source_id uuid references public.sports(id) on delete set null;

alter table public.exercise_types
  add column if not exists source_id uuid references public.exercise_types(id) on delete set null;

alter table public.units
  add column if not exists source_id uuid references public.units(id) on delete set null;

comment on column public.sports.source_id is
  'Id sport Krid (coach_id null) dont cette ligne coach est une copie ; null si créé from scratch.';
comment on column public.exercise_types.source_id is
  'Id type Krid dont cette ligne coach est une copie.';
comment on column public.units.source_id is
  'Id unit Krid dont cette ligne coach est une copie.';

create index if not exists sports_coach_source_idx
  on public.sports (coach_id, source_id)
  where deleted_at is null and coach_id is not null and source_id is not null;

create index if not exists exercise_types_coach_source_idx
  on public.exercise_types (coach_id, source_id)
  where deleted_at is null and coach_id is not null and source_id is not null;

create index if not exists units_coach_source_idx
  on public.units (coach_id, source_id)
  where deleted_at is null and coach_id is not null and source_id is not null;

-- Une seule copie active par source Krid et par coach
create unique index if not exists sports_coach_source_unique
  on public.sports (coach_id, source_id)
  where deleted_at is null and coach_id is not null and source_id is not null;

create unique index if not exists exercise_types_coach_source_unique
  on public.exercise_types (coach_id, source_id)
  where deleted_at is null and coach_id is not null and source_id is not null;

create unique index if not exists units_coach_source_unique
  on public.units (coach_id, source_id)
  where deleted_at is null and coach_id is not null and source_id is not null;

-- -----------------------------------------------------------------------------
-- 2) Unicité label : globale → scoped (comme units.key)
-- -----------------------------------------------------------------------------

drop index if exists public.sports_label_unique_ci;
create unique index if not exists sports_label_unique_ci
  on public.sports (lower(trim(label)))
  where deleted_at is null and coach_id is null;
create unique index if not exists sports_coach_label_unique_ci
  on public.sports (coach_id, lower(trim(label)))
  where deleted_at is null and coach_id is not null;

drop index if exists public.exercise_types_label_unique_ci;
create unique index if not exists exercise_types_label_unique_ci
  on public.exercise_types (lower(trim(label)))
  where deleted_at is null and coach_id is null;
create unique index if not exists exercise_types_coach_label_unique_ci
  on public.exercise_types (coach_id, lower(trim(label)))
  where deleted_at is null and coach_id is not null;
