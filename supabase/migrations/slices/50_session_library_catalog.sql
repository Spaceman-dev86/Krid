-- =============================================================================
-- TRANCHE 50 — Catalogue séances (session_library) + unités Rx séance
-- Prérequis : 43–49 (blocs, units, exos)
-- Après Run : dis « 50 OK »
-- =============================================================================
-- Template séance = briques (blocs publiés et/ou exos publiés).
-- Types / sports = hérités des enfants ; masquables, non ajoutables.
-- Objectif client post-séance : ressenti · note · difficulté (5 smileys).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Unités Rx séance (séries / RPE / repos / tempo) — reps & load_kg déjà en 42
-- -----------------------------------------------------------------------------

insert into public.units (coach_id, key, label, dimension, value_mode)
select null, v.key, v.label, v.dimension, v.value_mode
from (values
  ('sets', 'Séries', 'count', 'number'),
  ('rpe', 'RPE', 'other', 'number'),
  ('rest_s', 'Repos (s)', 'time', 'time'),
  ('tempo', 'Tempo', 'other', 'text')
) as v(key, label, dimension, value_mode)
where not exists (
  select 1 from public.units u
  where u.deleted_at is null
    and u.coach_id is null
    and lower(trim(u.key)) = lower(trim(v.key))
);

-- -----------------------------------------------------------------------------
-- 2) session_library
-- -----------------------------------------------------------------------------

create table if not exists public.session_library (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  notes text,
  -- Objectif post-séance côté client (ce qu’il remplit après)
  objective_ressenti boolean not null default true,
  objective_note boolean not null default true,
  objective_difficulty boolean not null default true,
  status text not null default 'draft',
  allow_duplicate boolean not null default true,
  allow_download boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint session_library_name_nonempty check (length(trim(name)) > 0),
  constraint session_library_status_check check (status in ('draft', 'published'))
);

comment on table public.session_library is
  'Templates séance catalogue (Trainly coach_id null). Composition = blocs + exos.';
comment on column public.session_library.objective_ressenti is
  'Client remplit un ressenti après la séance.';
comment on column public.session_library.objective_note is
  'Client peut laisser une note après la séance.';
comment on column public.session_library.objective_difficulty is
  'Client note la difficulté (5 smileys) après la séance.';

create index if not exists session_library_coach_status_idx
  on public.session_library (coach_id, status)
  where deleted_at is null;

alter table public.session_library enable row level security;

drop policy if exists "session_library_select" on public.session_library;
create policy "session_library_select"
on public.session_library for select to authenticated
using (
  deleted_at is null
  and (
    public.is_platform_admin()
    or (coach_id is null and status = 'published')
    or coach_id = auth.uid()
  )
);

drop policy if exists "session_library_write" on public.session_library;
create policy "session_library_write"
on public.session_library for all to authenticated
using (
  public.is_platform_admin()
  or (coach_id = auth.uid() and coach_id is not null)
)
with check (
  public.is_platform_admin()
  or (coach_id = auth.uid() and coach_id is not null)
);

-- -----------------------------------------------------------------------------
-- 3) session_library_items (bloc OU exo)
-- -----------------------------------------------------------------------------

create table if not exists public.session_library_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.session_library(id) on delete cascade,
  position integer not null default 0,
  item_kind text not null,
  block_id uuid references public.block_library(id) on delete restrict,
  exercise_id uuid references public.exercise_library(id) on delete restrict,
  -- Rx exos libre (texte) — défaut série/reps/charge/RPE/repos/tempo côté UI
  prescriptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint session_library_items_kind_check check (item_kind in ('block', 'exercise')),
  constraint session_library_items_ref_check check (
    (item_kind = 'block' and block_id is not null and exercise_id is null)
    or (item_kind = 'exercise' and exercise_id is not null and block_id is null)
  )
);

comment on table public.session_library_items is
  'Slots d’une séance template : bloc catalogue OU exo + prescriptions.';
comment on column public.session_library_items.prescriptions is
  '[{unit_id, value, input_mode, varies}] — surtout pour item_kind=exercise.';

create index if not exists session_library_items_session_idx
  on public.session_library_items (session_id, position);

create index if not exists session_library_items_block_idx
  on public.session_library_items (block_id)
  where block_id is not null;

create index if not exists session_library_items_exercise_idx
  on public.session_library_items (exercise_id)
  where exercise_id is not null;

alter table public.session_library_items enable row level security;

drop policy if exists "session_library_items_select" on public.session_library_items;
create policy "session_library_items_select"
on public.session_library_items for select to authenticated
using (
  exists (
    select 1 from public.session_library s
    where s.id = session_id
      and s.deleted_at is null
      and (
        public.is_platform_admin()
        or (s.coach_id is null and s.status = 'published')
        or s.coach_id = auth.uid()
      )
  )
);

drop policy if exists "session_library_items_write" on public.session_library_items;
create policy "session_library_items_write"
on public.session_library_items for all to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.session_library s
    where s.id = session_id
      and s.deleted_at is null
      and s.coach_id = auth.uid()
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1 from public.session_library s
    where s.id = session_id
      and s.deleted_at is null
      and s.coach_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- 4) Masquage héritage types / sports
-- -----------------------------------------------------------------------------

create table if not exists public.session_library_hidden_types (
  session_id uuid not null references public.session_library(id) on delete cascade,
  exercise_type_id uuid not null references public.exercise_types(id) on delete cascade,
  primary key (session_id, exercise_type_id)
);

create table if not exists public.session_library_hidden_sports (
  session_id uuid not null references public.session_library(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete cascade,
  primary key (session_id, sport_id)
);

alter table public.session_library_hidden_types enable row level security;
alter table public.session_library_hidden_sports enable row level security;

drop policy if exists "session_library_hidden_types_select" on public.session_library_hidden_types;
create policy "session_library_hidden_types_select"
on public.session_library_hidden_types for select to authenticated
using (
  exists (
    select 1 from public.session_library s
    where s.id = session_id and s.deleted_at is null
      and (public.is_platform_admin() or (s.coach_id is null and s.status = 'published') or s.coach_id = auth.uid())
  )
);

drop policy if exists "session_library_hidden_types_write" on public.session_library_hidden_types;
create policy "session_library_hidden_types_write"
on public.session_library_hidden_types for all to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.session_library s
    where s.id = session_id and s.deleted_at is null and s.coach_id = auth.uid()
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1 from public.session_library s
    where s.id = session_id and s.deleted_at is null and s.coach_id = auth.uid()
  )
);

drop policy if exists "session_library_hidden_sports_select" on public.session_library_hidden_sports;
create policy "session_library_hidden_sports_select"
on public.session_library_hidden_sports for select to authenticated
using (
  exists (
    select 1 from public.session_library s
    where s.id = session_id and s.deleted_at is null
      and (public.is_platform_admin() or (s.coach_id is null and s.status = 'published') or s.coach_id = auth.uid())
  )
);

drop policy if exists "session_library_hidden_sports_write" on public.session_library_hidden_sports;
create policy "session_library_hidden_sports_write"
on public.session_library_hidden_sports for all to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.session_library s
    where s.id = session_id and s.deleted_at is null and s.coach_id = auth.uid()
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1 from public.session_library s
    where s.id = session_id and s.deleted_at is null and s.coach_id = auth.uid()
  )
);

insert into public.schema_migrations_trainly (id)
values ('50_session_library_catalog')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
