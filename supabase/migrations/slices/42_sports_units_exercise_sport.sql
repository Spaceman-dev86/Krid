-- =============================================================================
-- TRANCHE 42 — Sports · unités · sport sur fiche exercice
-- Prérequis : 39_exercise_fiche_types_replacements · 36_catalog_workflow
-- Spec blocs catalogue : sport sur exo ; units pour résultat attendu (+ prescription plus tard)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) sports
-- -----------------------------------------------------------------------------

create table if not exists public.sports (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.profiles(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sports_label_nonempty check (length(trim(label)) > 0)
);

comment on table public.sports is
  'Sports : coach_id null = Trainly global ; sinon sport perso coach.';
comment on column public.sports.coach_id is
  'null = catalogue Trainly ; uuid = créé par le coach';

create unique index if not exists sports_label_unique_ci
  on public.sports (lower(trim(label)))
  where deleted_at is null;

create index if not exists sports_coach_idx
  on public.sports (coach_id)
  where deleted_at is null;

alter table public.sports enable row level security;

drop policy if exists "sports_select" on public.sports;
create policy "sports_select"
on public.sports for select to authenticated
using (
  deleted_at is null
  and (
    coach_id is null
    or coach_id = auth.uid()
    or public.is_platform_admin()
  )
);

drop policy if exists "sports_write" on public.sports;
create policy "sports_write"
on public.sports for all to authenticated
using (
  public.is_platform_admin()
  or (coach_id = auth.uid() and coach_id is not null)
)
with check (
  public.is_platform_admin()
  or (coach_id = auth.uid() and coach_id is not null)
);

insert into public.sports (coach_id, label)
select null, v.label
from (values
  ('Musculation'),
  ('Crossfit'),
  ('Running'),
  ('Hyrox'),
  ('Outdoor'),
  ('Natation'),
  ('Cyclisme'),
  ('Général')
) as v(label)
where not exists (
  select 1 from public.sports s
  where s.deleted_at is null
    and lower(trim(s.label)) = lower(trim(v.label))
);

-- -----------------------------------------------------------------------------
-- 2) units (Trainly + custom coach plus tard)
-- -----------------------------------------------------------------------------

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.profiles(id) on delete cascade,
  key text not null,
  label text not null,
  dimension text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint units_key_nonempty check (length(trim(key)) > 0),
  constraint units_label_nonempty check (length(trim(label)) > 0),
  constraint units_dimension_check check (
    dimension in ('count', 'time', 'mass', 'distance', 'boolean', 'other')
  )
);

comment on table public.units is
  'Unités plateforme / coach : résultat attendu bloc, prescription builder, etc.';
comment on column public.units.coach_id is
  'null = unité Trainly ; uuid = custom coach';
comment on column public.units.key is
  'Slug stable (rounds, time_s, kg…) — snapshot du label à la pose plus tard';
comment on column public.units.dimension is
  'count | time | mass | distance | boolean | other';

create unique index if not exists units_key_unique_ci
  on public.units (lower(trim(key)))
  where deleted_at is null and coach_id is null;

create unique index if not exists units_coach_key_unique_ci
  on public.units (coach_id, lower(trim(key)))
  where deleted_at is null and coach_id is not null;

create index if not exists units_coach_idx
  on public.units (coach_id)
  where deleted_at is null;

alter table public.units enable row level security;

drop policy if exists "units_select" on public.units;
create policy "units_select"
on public.units for select to authenticated
using (
  deleted_at is null
  and (
    coach_id is null
    or coach_id = auth.uid()
    or public.is_platform_admin()
  )
);

drop policy if exists "units_write" on public.units;
create policy "units_write"
on public.units for all to authenticated
using (
  public.is_platform_admin()
  or (coach_id = auth.uid() and coach_id is not null)
)
with check (
  public.is_platform_admin()
  or (coach_id = auth.uid() and coach_id is not null)
);

insert into public.units (coach_id, key, label, dimension)
select null, v.key, v.label, v.dimension
from (values
  ('rounds', 'Tours', 'count'),
  ('time_s', 'Temps (s)', 'time'),
  ('time_min', 'Temps (min)', 'time'),
  ('reps', 'Reps', 'count'),
  ('load_kg', 'Charge (kg)', 'mass'),
  ('distance_m', 'Distance (m)', 'distance'),
  ('cal', 'Calories (cal)', 'other'),
  ('completed', 'Effectué', 'boolean')
) as v(key, label, dimension)
where not exists (
  select 1 from public.units u
  where u.deleted_at is null
    and u.coach_id is null
    and lower(trim(u.key)) = lower(trim(v.key))
);

-- -----------------------------------------------------------------------------
-- 3) exercise_library.sport_id + backfill
-- -----------------------------------------------------------------------------

alter table public.exercise_library
  add column if not exists sport_id uuid references public.sports(id) on delete set null;

comment on column public.exercise_library.sport_id is
  'Sport de la fiche (requis à la publication admin).';

create index if not exists exercise_library_sport_id_idx
  on public.exercise_library (sport_id)
  where deleted_at is null;

-- Map depuis exercise_types.label / exercise_type text legacy
update public.exercise_library e
set sport_id = s.id
from public.sports s
where e.sport_id is null
  and e.deleted_at is null
  and s.deleted_at is null
  and s.coach_id is null
  and lower(trim(s.label)) = lower(trim(coalesce(
    (select t.label from public.exercise_types t where t.id = e.exercise_type_id),
    e.exercise_type,
    ''
  )));

-- Heuristiques restantes (type ≠ sport exact)
update public.exercise_library e
set sport_id = s.id
from public.sports s
where e.sport_id is null
  and e.deleted_at is null
  and s.deleted_at is null
  and s.coach_id is null
  and lower(trim(s.label)) = 'running'
  and lower(trim(coalesce(
    (select t.label from public.exercise_types t where t.id = e.exercise_type_id),
    e.exercise_type,
    ''
  ))) in ('cardio', 'outdoor');

update public.exercise_library e
set sport_id = s.id
from public.sports s
where e.sport_id is null
  and e.deleted_at is null
  and s.deleted_at is null
  and s.coach_id is null
  and lower(trim(s.label)) = 'musculation'
  and lower(trim(coalesce(
    (select t.label from public.exercise_types t where t.id = e.exercise_type_id),
    e.exercise_type,
    ''
  ))) in (
    'musculation', 'haltères', 'poids du corps', 'machine',
    'fonctionnel', 'rééducation', 'mobilité'
  );

-- Fallback : Général
update public.exercise_library e
set sport_id = s.id
from public.sports s
where e.sport_id is null
  and e.deleted_at is null
  and s.deleted_at is null
  and s.coach_id is null
  and lower(trim(s.label)) = 'général';

insert into public.schema_migrations_trainly (id)
values ('42_sports_units_exercise_sport')
on conflict (id) do nothing;
