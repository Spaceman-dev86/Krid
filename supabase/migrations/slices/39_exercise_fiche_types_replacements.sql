-- =============================================================================
-- TRANCHE 39 — Fiche exercice : types · remplacements multi · problème fréquent
-- Prérequis : 10_programs · 20_exercise_status · 36_catalog_workflow
-- Spec : f-ex-add / f-ex-type / f-ex-replacements · Phase 1 admin /admin/exercises
-- =============================================================================
-- Périmètre :
--   • exercise_types (coach_id null = Trainly global)
--   • exercise_library.exercise_type_id (+ backfill depuis exercise_type text)
--   • common_mistakes = note « Problème fréquent » (pas de séries/reps)
--   • exercise_replacements (N) + backfill depuis replacement_exercise_id
--   • Difficulté produit : Débutant | Intermédiaire | Avancé (soft normalize)
-- Hors scope : coach_exercise_units · prescription builder
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) exercise_types
-- -----------------------------------------------------------------------------

create table if not exists public.exercise_types (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.profiles(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint exercise_types_label_nonempty check (length(trim(label)) > 0)
);

comment on table public.exercise_types is
  'Types d’exercice : coach_id null = Trainly global ; sinon type perso coach. Libellés uniques (global + perso).';
comment on column public.exercise_types.coach_id is
  'null = type catalogue Trainly ; uuid = type créé par le coach';

-- Pas de doublon de libellé (Trainly ou perso) — spec FIGÉ
create unique index if not exists exercise_types_label_unique_ci
  on public.exercise_types (lower(trim(label)))
  where deleted_at is null;

create index if not exists exercise_types_coach_idx
  on public.exercise_types (coach_id)
  where deleted_at is null;

alter table public.exercise_types enable row level security;

drop policy if exists "exercise_types_select" on public.exercise_types;
create policy "exercise_types_select"
on public.exercise_types for select to authenticated
using (
  deleted_at is null
  and (
    coach_id is null
    or coach_id = auth.uid()
    or public.is_platform_admin()
  )
);

drop policy if exists "exercise_types_write" on public.exercise_types;
create policy "exercise_types_write"
on public.exercise_types for all to authenticated
using (
  public.is_platform_admin()
  or (coach_id = auth.uid() and coach_id is not null)
)
with check (
  public.is_platform_admin()
  or (coach_id = auth.uid() and coach_id is not null)
);

-- Seed types Trainly de base (idempotent via index unique CI)
insert into public.exercise_types (coach_id, label)
select null, v.label
from (values
  ('Musculation'),
  ('Cardio'),
  ('Crossfit'),
  ('Mobilité'),
  ('Haltères'),
  ('Poids du corps'),
  ('Machine'),
  ('Outdoor'),
  ('Rééducation'),
  ('Fonctionnel')
) as v(label)
where not exists (
  select 1 from public.exercise_types t
  where t.deleted_at is null
    and lower(trim(t.label)) = lower(trim(v.label))
);

-- -----------------------------------------------------------------------------
-- 2) exercise_library.exercise_type_id + common_mistakes
-- -----------------------------------------------------------------------------

alter table public.exercise_library
  add column if not exists exercise_type_id uuid references public.exercise_types(id) on delete set null;

alter table public.exercise_library
  add column if not exists common_mistakes text;

comment on column public.exercise_library.exercise_type_id is
  'FK type (Trainly ou perso) — préféré à exercise_type text';
comment on column public.exercise_library.common_mistakes is
  'Note optionnelle « Problème fréquent » sur la fiche (pas de prescription)';
comment on column public.exercise_library.difficulty is
  'Débutant | Intermédiaire | Avancé (UI fermée) — null autorisé';
comment on column public.exercise_library.exercise_type is
  'Legacy text — garder sync / lecture ; préférer exercise_type_id';

create index if not exists exercise_library_type_id_idx
  on public.exercise_library (exercise_type_id)
  where deleted_at is null;

-- Créer types manquants depuis les libellés text déjà en base
insert into public.exercise_types (coach_id, label)
select distinct
  case
    when e.coach_id is null then null
    else e.coach_id
  end,
  trim(e.exercise_type)
from public.exercise_library e
where e.exercise_type is not null
  and length(trim(e.exercise_type)) > 0
  and e.deleted_at is null
  and not exists (
    select 1 from public.exercise_types t
    where t.deleted_at is null
      and lower(trim(t.label)) = lower(trim(e.exercise_type))
  );

-- Si collision label (type Trainly existe déjà) : rattacher au type existant (réutilisation)
-- Backfill FK : match case-insensitive sur label
update public.exercise_library e
set exercise_type_id = t.id
from public.exercise_types t
where e.exercise_type_id is null
  and e.exercise_type is not null
  and length(trim(e.exercise_type)) > 0
  and t.deleted_at is null
  and lower(trim(t.label)) = lower(trim(e.exercise_type))
  and (
    t.coach_id is null
    or t.coach_id = e.coach_id
  );

-- Soft normalize difficulté hors enum produit
update public.exercise_library
set difficulty = null
where difficulty is not null
  and trim(difficulty) not in ('Débutant', 'Intermédiaire', 'Avancé');

-- -----------------------------------------------------------------------------
-- 3) exercise_replacements (ponts multi)
-- -----------------------------------------------------------------------------

create table if not exists public.exercise_replacements (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  replacement_id uuid not null references public.exercise_library(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint exercise_replacements_not_self check (exercise_id <> replacement_id),
  constraint exercise_replacements_unique unique (exercise_id, replacement_id)
);

comment on table public.exercise_replacements is
  'Ponts exercice → exercices de remplacement (multi). Interdit soi-même.';

create index if not exists exercise_replacements_exercise_idx
  on public.exercise_replacements (exercise_id, position);

create index if not exists exercise_replacements_replacement_idx
  on public.exercise_replacements (replacement_id);

alter table public.exercise_replacements enable row level security;

-- Lecture : si on peut lire l’exercice source
drop policy if exists "exercise_replacements_select" on public.exercise_replacements;
create policy "exercise_replacements_select"
on public.exercise_replacements for select to authenticated
using (
  exists (
    select 1 from public.exercise_library e
    where e.id = exercise_id
      and e.deleted_at is null
      and (
        e.coach_id is null
        or e.coach_id = auth.uid()
        or public.is_platform_admin()
      )
  )
);

-- Écriture : propriétaire de l’exo source ou admin (Trainly inclus)
drop policy if exists "exercise_replacements_write" on public.exercise_replacements;
create policy "exercise_replacements_write"
on public.exercise_replacements for all to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.exercise_library e
    where e.id = exercise_id
      and e.deleted_at is null
      and e.coach_id = auth.uid()
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1 from public.exercise_library e
    where e.id = exercise_id
      and e.deleted_at is null
      and e.coach_id = auth.uid()
  )
);

-- Backfill depuis l’ancien lien 1:1
insert into public.exercise_replacements (exercise_id, replacement_id, position)
select e.id, e.replacement_exercise_id, 0
from public.exercise_library e
where e.replacement_exercise_id is not null
  and e.deleted_at is null
  and e.id <> e.replacement_exercise_id
  and exists (
    select 1 from public.exercise_library r
    where r.id = e.replacement_exercise_id
      and r.deleted_at is null
  )
on conflict (exercise_id, replacement_id) do nothing;

comment on column public.exercise_library.replacement_exercise_id is
  'Legacy 1:1 — préférer exercise_replacements ; conservé pour compat lecture';

insert into public.schema_migrations_trainly (id)
values ('39_exercise_fiche_types_replacements')
on conflict (id) do nothing;
