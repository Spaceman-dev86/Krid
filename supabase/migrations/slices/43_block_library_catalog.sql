-- =============================================================================
-- TRANCHE 43 — Catalogue blocs (formats · block_library · exos sans RX)
-- Prérequis : 42_sports_units_exercise_sport · 39_exercise_fiche…
-- Spec : /admin/exercises?kind=blocks · /admin/blocks/new
-- =============================================================================
-- Format = recette de structure (contraintes UI).
-- Template bloc = fiche catalogue (sport + format + exos sans prescription).
-- Types bloc = héritage des exercise_types des exos (flags hidden).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) block_formats (seed Trainly)
-- -----------------------------------------------------------------------------

create table if not exists public.block_formats (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  label text not null,
  description text,
  -- Champs contrainte suggérés : duration_seconds, work_seconds, rest_seconds,
  -- rounds, distance_m (tous optionnels côté produit)
  constraint_fields text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint block_formats_key_nonempty check (length(trim(key)) > 0),
  constraint block_formats_label_nonempty check (length(trim(label)) > 0)
);

comment on table public.block_formats is
  'Formats de bloc (AMRAP, EMOM, Death by…) — template de structure, pas de contenu.';
comment on column public.block_formats.constraint_fields is
  'Liste des clés de contrainte pertinentes pour l’UI (toutes optionnelles).';

create unique index if not exists block_formats_key_unique_ci
  on public.block_formats (lower(trim(key)))
  where deleted_at is null;

alter table public.block_formats enable row level security;

drop policy if exists "block_formats_select" on public.block_formats;
create policy "block_formats_select"
on public.block_formats for select to authenticated
using (deleted_at is null);

drop policy if exists "block_formats_write" on public.block_formats;
create policy "block_formats_write"
on public.block_formats for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

insert into public.block_formats (key, label, description, constraint_fields, position)
select v.key, v.label, v.description, v.constraint_fields::text[], v.position
from (values
  ('amrap', 'AMRAP', 'As many rounds/reps as possible dans un temps donné',
   array['duration_seconds'], 10),
  ('for_time', 'For time', 'Finir le plus vite possible — contrainte = nombre de tours',
   array['rounds'], 20),
  ('emom', 'EMOM', 'Every minute on the minute — intervalle + durée',
   array['work_seconds', 'duration_seconds'], 30),
  ('intervals', 'Intervals', 'Intervalles génériques work / rest × rounds',
   array['work_seconds', 'rest_seconds', 'rounds'], 40),
  ('superset', 'Superset', 'Enchaînement d’exos (souvent 2) avec repos entre tours',
   array['rounds', 'rest_seconds'], 60),
  ('warmup', 'Warm-up', 'Échauffement structuré',
   array['duration_seconds'], 80),
  ('free', 'Libre', 'Structure libre',
   array[]::text[], 100)
) as v(key, label, description, constraint_fields, position)
where not exists (
  select 1 from public.block_formats f
  where f.deleted_at is null
    and lower(trim(f.key)) = lower(trim(v.key))
);

-- -----------------------------------------------------------------------------
-- 2) block_library
-- -----------------------------------------------------------------------------

create table if not exists public.block_library (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  notes text,
  sport_id uuid references public.sports(id) on delete set null,
  format_id uuid references public.block_formats(id) on delete restrict,
  expected_result_unit_id uuid references public.units(id) on delete set null,
  -- Contraintes structurelles (toutes optionnelles)
  duration_seconds integer,
  work_seconds integer,
  rest_seconds integer,
  rounds integer,
  distance_m integer,
  status text not null default 'draft',
  allow_duplicate boolean not null default true,
  allow_download boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint block_library_name_nonempty check (length(trim(name)) > 0),
  constraint block_library_status_check check (status in ('draft', 'published')),
  constraint block_library_duration_pos check (duration_seconds is null or duration_seconds > 0),
  constraint block_library_work_pos check (work_seconds is null or work_seconds > 0),
  constraint block_library_rest_pos check (rest_seconds is null or rest_seconds >= 0),
  constraint block_library_rounds_pos check (rounds is null or rounds > 0),
  constraint block_library_distance_pos check (distance_m is null or distance_m > 0)
);

comment on table public.block_library is
  'Templates bloc catalogue (Trainly coach_id null). Contenu = exos sans RX.';
comment on column public.block_library.sport_id is
  'Sport du bloc (manuel). Si renseigné, prime sur toute suggestion d’héritage.';
comment on column public.block_library.expected_result_unit_id is
  'Unité saisie client en fin de bloc — obligatoire pour publier.';
comment on column public.block_library.duration_seconds is
  'Timer / timecap / durée warm-up (s) — optionnel.';
comment on column public.block_library.work_seconds is
  'Durée de travail intervalle / EMOM (s) — optionnel.';
comment on column public.block_library.rest_seconds is
  'Repos intervalle (s) — optionnel.';

create index if not exists block_library_coach_status_idx
  on public.block_library (coach_id, status)
  where deleted_at is null;

create index if not exists block_library_sport_idx
  on public.block_library (sport_id)
  where deleted_at is null;

create index if not exists block_library_format_idx
  on public.block_library (format_id)
  where deleted_at is null;

alter table public.block_library enable row level security;

drop policy if exists "block_library_select" on public.block_library;
create policy "block_library_select"
on public.block_library for select to authenticated
using (
  deleted_at is null
  and (
    (coach_id is null and status = 'published')
    or coach_id = auth.uid()
    or public.is_platform_admin()
  )
);

drop policy if exists "block_library_write" on public.block_library;
create policy "block_library_write"
on public.block_library for all to authenticated
using (
  public.is_platform_admin()
  or (coach_id = auth.uid() and coach_id is not null)
)
with check (
  public.is_platform_admin()
  or (coach_id = auth.uid() and coach_id is not null)
);

-- -----------------------------------------------------------------------------
-- 3) block_library_exercises (sans RX)
-- -----------------------------------------------------------------------------

create table if not exists public.block_library_exercises (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.block_library(id) on delete cascade,
  exercise_id uuid not null references public.exercise_library(id) on delete restrict,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint block_library_exercises_position_nonneg check (position >= 0)
);

comment on table public.block_library_exercises is
  'Exos d’un template bloc — références fiche uniquement (pas de séries/reps).';

create index if not exists block_library_exercises_block_idx
  on public.block_library_exercises (block_id, position);

create index if not exists block_library_exercises_exercise_idx
  on public.block_library_exercises (exercise_id);

alter table public.block_library_exercises enable row level security;

drop policy if exists "block_library_exercises_select" on public.block_library_exercises;
create policy "block_library_exercises_select"
on public.block_library_exercises for select to authenticated
using (
  exists (
    select 1 from public.block_library b
    where b.id = block_id
      and b.deleted_at is null
      and (
        (b.coach_id is null and b.status = 'published')
        or b.coach_id = auth.uid()
        or public.is_platform_admin()
      )
  )
);

drop policy if exists "block_library_exercises_write" on public.block_library_exercises;
create policy "block_library_exercises_write"
on public.block_library_exercises for all to authenticated
using (
  exists (
    select 1 from public.block_library b
    where b.id = block_id
      and (
        public.is_platform_admin()
        or (b.coach_id = auth.uid() and b.coach_id is not null)
      )
  )
)
with check (
  exists (
    select 1 from public.block_library b
    where b.id = block_id
      and (
        public.is_platform_admin()
        or (b.coach_id = auth.uid() and b.coach_id is not null)
      )
  )
);

-- -----------------------------------------------------------------------------
-- 4) Types hérités — flags masquer uniquement
-- -----------------------------------------------------------------------------

create table if not exists public.block_library_hidden_types (
  block_id uuid not null references public.block_library(id) on delete cascade,
  exercise_type_id uuid not null references public.exercise_types(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (block_id, exercise_type_id)
);

comment on table public.block_library_hidden_types is
  'Types hérités des exos du bloc que l’admin a masqués (réaffichables). Pas d’ajout manuel.';

alter table public.block_library_hidden_types enable row level security;

drop policy if exists "block_library_hidden_types_select" on public.block_library_hidden_types;
create policy "block_library_hidden_types_select"
on public.block_library_hidden_types for select to authenticated
using (
  exists (
    select 1 from public.block_library b
    where b.id = block_id and b.deleted_at is null
      and (
        (b.coach_id is null and b.status = 'published')
        or b.coach_id = auth.uid()
        or public.is_platform_admin()
      )
  )
);

drop policy if exists "block_library_hidden_types_write" on public.block_library_hidden_types;
create policy "block_library_hidden_types_write"
on public.block_library_hidden_types for all to authenticated
using (
  exists (
    select 1 from public.block_library b
    where b.id = block_id
      and (public.is_platform_admin() or b.coach_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.block_library b
    where b.id = block_id
      and (public.is_platform_admin() or b.coach_id = auth.uid())
  )
);

-- -----------------------------------------------------------------------------
-- 5) Seeds Trainly (3 templates démo) — exos liés si présents en biblio
-- -----------------------------------------------------------------------------

do $$
declare
  v_sport_muscu uuid;
  v_sport_cf uuid;
  v_fmt_warmup uuid;
  v_fmt_superset uuid;
  v_fmt_amrap uuid;
  v_unit_time uuid;
  v_unit_rounds uuid;
  v_block_warmup uuid := 'a1000000-0000-4000-8000-000000000001'::uuid;
  v_block_superset uuid := 'a1000000-0000-4000-8000-000000000002'::uuid;
  v_block_amrap uuid := 'a1000000-0000-4000-8000-000000000003'::uuid;
  v_exo uuid;
begin
  select id into v_sport_muscu from public.sports
    where coach_id is null and deleted_at is null and lower(label) = 'musculation' limit 1;
  select id into v_sport_cf from public.sports
    where coach_id is null and deleted_at is null and lower(label) = 'crossfit' limit 1;
  select id into v_fmt_warmup from public.block_formats
    where deleted_at is null and key = 'warmup' limit 1;
  select id into v_fmt_superset from public.block_formats
    where deleted_at is null and key = 'superset' limit 1;
  select id into v_fmt_amrap from public.block_formats
    where deleted_at is null and key = 'amrap' limit 1;
  select id into v_unit_time from public.units
    where coach_id is null and deleted_at is null and key = 'time_s' limit 1;
  select id into v_unit_rounds from public.units
    where coach_id is null and deleted_at is null and key = 'rounds' limit 1;

  if v_sport_muscu is null or v_fmt_warmup is null or v_unit_time is null then
    raise notice '43 seeds skipped: missing sport/format/unit';
    return;
  end if;

  insert into public.block_library (
    id, coach_id, name, notes, sport_id, format_id, expected_result_unit_id,
    duration_seconds, status, allow_duplicate, allow_download
  ) values (
    v_block_warmup, null, 'Warm-up',
    'Échauffement type Trainly — exos sans prescription (RX au builder).',
    v_sport_muscu, v_fmt_warmup, v_unit_time,
    600, 'published', true, false
  )
  on conflict (id) do nothing;

  insert into public.block_library (
    id, coach_id, name, notes, sport_id, format_id, expected_result_unit_id,
    rounds, rest_seconds, status, allow_duplicate, allow_download
  ) values (
    v_block_superset, null, 'Superset',
    'Superset musculation type — 2 exos sans RX.',
    v_sport_muscu, v_fmt_superset, v_unit_time,
    3, 60, 'published', true, false
  )
  on conflict (id) do nothing;

  if v_sport_cf is not null and v_fmt_amrap is not null and v_unit_rounds is not null then
    insert into public.block_library (
      id, coach_id, name, notes, sport_id, format_id, expected_result_unit_id,
      duration_seconds, status, allow_duplicate, allow_download
    ) values (
      v_block_amrap, null, 'AMRAP 20',
      'AMRAP 20 min — résultat attendu = tours.',
      v_sport_cf, v_fmt_amrap, v_unit_rounds,
      1200, 'published', true, false
    )
    on conflict (id) do nothing;
  end if;

  -- Lier jusqu’à 3 exos Trainly publiés par seed (ordre name)
  for v_exo in
    select e.id from public.exercise_library e
    where e.coach_id is null and e.deleted_at is null and e.status = 'published'
    order by e.name
    limit 3
  loop
    insert into public.block_library_exercises (block_id, exercise_id, position)
    select v_block_warmup, v_exo,
      coalesce((select max(position)+1 from public.block_library_exercises where block_id = v_block_warmup), 0)
    where exists (select 1 from public.block_library where id = v_block_warmup)
      and not exists (
        select 1 from public.block_library_exercises
        where block_id = v_block_warmup and exercise_id = v_exo
      );

    insert into public.block_library_exercises (block_id, exercise_id, position)
    select v_block_superset, v_exo,
      coalesce((select max(position)+1 from public.block_library_exercises where block_id = v_block_superset), 0)
    where exists (select 1 from public.block_library where id = v_block_superset)
      and not exists (
        select 1 from public.block_library_exercises
        where block_id = v_block_superset and exercise_id = v_exo
      )
      and (select count(*) from public.block_library_exercises where block_id = v_block_superset) < 2;

    insert into public.block_library_exercises (block_id, exercise_id, position)
    select v_block_amrap, v_exo,
      coalesce((select max(position)+1 from public.block_library_exercises where block_id = v_block_amrap), 0)
    where exists (select 1 from public.block_library where id = v_block_amrap)
      and not exists (
        select 1 from public.block_library_exercises
        where block_id = v_block_amrap and exercise_id = v_exo
      );
  end loop;
end $$;

insert into public.schema_migrations_trainly (id)
values ('43_block_library_catalog')
on conflict (id) do nothing;
