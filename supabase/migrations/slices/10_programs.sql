-- =============================================================================
-- TRANCHE 10 — Programmes (builder + template presta + plans client)
-- Prérequis : 01 → 09
-- Après Run : dis « 10 OK » → on branche UI coach /programs + portail séance
-- =============================================================================
-- Périmètre V1 de cette tranche :
--   • Catalogue coach : programs → weeks → sessions → items/blocks/exercises
--   • exercise_library minimale (FK éditeur ; seed contenu = plus tard)
--   • RPCs utilisés par program-editor-v2
--   • FK prestations.program_template_id → programs
--   • client_fitness_plans (waiting|started|paused|done) — achat ≠ démarrage
-- Hors scope (tranche suivante) : session_runs / player séance / historique
-- =============================================================================

-- -----------------------------------------------------------------------------
-- exercise_library (minimal — coach_id null = catalogue Trainly)
-- -----------------------------------------------------------------------------

create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  muscle_group text,
  difficulty text,
  video_url text,
  demo_media_path text,
  replacement_exercise_id uuid references public.exercise_library(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists exercise_library_coach_id_idx
  on public.exercise_library (coach_id)
  where deleted_at is null;

create index if not exists exercise_library_name_idx
  on public.exercise_library (lower(name))
  where deleted_at is null;

alter table public.exercise_library enable row level security;

drop policy if exists "exercise_library_select" on public.exercise_library;
create policy "exercise_library_select"
on public.exercise_library for select to authenticated
using (
  deleted_at is null
  and (
    coach_id is null
    or coach_id = auth.uid()
    or public.is_platform_admin()
  )
);

drop policy if exists "exercise_library_coach_write" on public.exercise_library;
create policy "exercise_library_coach_write"
on public.exercise_library for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- programs
-- -----------------------------------------------------------------------------

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  description text,
  goal text,
  level text,
  duration text,
  image_url text,
  is_published boolean not null default false,
  is_template boolean not null default false,
  is_calendar boolean not null default false,
  start_date date,
  status text not null default 'draft'
    check (status in ('draft', 'running', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists programs_coach_id_idx
  on public.programs (coach_id)
  where deleted_at is null;

create index if not exists programs_template_idx
  on public.programs (coach_id)
  where is_template = true and deleted_at is null;

alter table public.programs enable row level security;

drop policy if exists "programs_coach_all" on public.programs;
create policy "programs_coach_all"
on public.programs for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

create or replace function public.owns_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.programs p
    where p.id = p_program_id
      and p.deleted_at is null
      and (p.coach_id = auth.uid() or public.is_platform_admin())
  );
$$;

grant execute on function public.owns_program(uuid) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- program_weeks
-- -----------------------------------------------------------------------------

create table if not exists public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  title text,
  week_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists program_weeks_program_id_idx
  on public.program_weeks (program_id, week_order);

alter table public.program_weeks enable row level security;

drop policy if exists "program_weeks_coach_all" on public.program_weeks;
create policy "program_weeks_coach_all"
on public.program_weeks for all to authenticated
using (public.owns_program(program_id))
with check (public.owns_program(program_id));

-- -----------------------------------------------------------------------------
-- sessions
-- -----------------------------------------------------------------------------

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.program_weeks(id) on delete cascade,
  title text,
  description text,
  session_order integer not null default 0,
  sport text,
  created_at timestamptz not null default now()
);

create index if not exists sessions_week_id_idx
  on public.sessions (week_id, session_order);

alter table public.sessions enable row level security;

create or replace function public.owns_session_via_week(p_week_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.program_weeks w
    where w.id = p_week_id
      and public.owns_program(w.program_id)
  );
$$;

grant execute on function public.owns_session_via_week(uuid) to authenticated, anon;

drop policy if exists "sessions_coach_all" on public.sessions;
create policy "sessions_coach_all"
on public.sessions for all to authenticated
using (public.owns_session_via_week(week_id))
with check (public.owns_session_via_week(week_id));

create or replace function public.owns_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    join public.program_weeks w on w.id = s.week_id
    where s.id = p_session_id
      and public.owns_program(w.program_id)
  );
$$;

grant execute on function public.owns_session(uuid) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- session_blocks (colonne program_session_id = sessions.id — convention éditeur)
-- -----------------------------------------------------------------------------

create table if not exists public.session_blocks (
  id uuid primary key default gen_random_uuid(),
  program_session_id uuid not null references public.sessions(id) on delete cascade,
  position integer not null default 0,
  type text,
  title text,
  notes text,
  objective text,
  created_at timestamptz not null default now(),
  unique (program_session_id, position)
);

create index if not exists session_blocks_session_id_idx
  on public.session_blocks (program_session_id, position);

alter table public.session_blocks enable row level security;

drop policy if exists "session_blocks_coach_all" on public.session_blocks;
create policy "session_blocks_coach_all"
on public.session_blocks for all to authenticated
using (public.owns_session(program_session_id))
with check (public.owns_session(program_session_id));

-- -----------------------------------------------------------------------------
-- block_exercises
-- -----------------------------------------------------------------------------

create table if not exists public.block_exercises (
  id uuid primary key default gen_random_uuid(),
  session_block_id uuid not null references public.session_blocks(id) on delete cascade,
  exercise_id uuid references public.exercise_library(id) on delete set null,
  exercise_name text,
  position integer not null default 0,
  sets integer,
  reps text,
  rest_time text,
  load text,
  rpe numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists block_exercises_block_id_idx
  on public.block_exercises (session_block_id, position);

alter table public.block_exercises enable row level security;

create or replace function public.owns_session_block(p_block_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.session_blocks b
    where b.id = p_block_id
      and public.owns_session(b.program_session_id)
  );
$$;

grant execute on function public.owns_session_block(uuid) to authenticated, anon;

drop policy if exists "block_exercises_coach_all" on public.block_exercises;
create policy "block_exercises_coach_all"
on public.block_exercises for all to authenticated
using (public.owns_session_block(session_block_id))
with check (public.owns_session_block(session_block_id));

-- -----------------------------------------------------------------------------
-- program_exercises (timeline exercice « plat » — toujours utilisé par l’éditeur)
-- -----------------------------------------------------------------------------

create table if not exists public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_id uuid references public.exercise_library(id) on delete set null,
  name text,
  exercise_order integer not null default 0,
  sets integer,
  reps text,
  rest_time text,
  rpe numeric,
  tempo text,
  load text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists program_exercises_session_id_idx
  on public.program_exercises (session_id, exercise_order);

alter table public.program_exercises enable row level security;

drop policy if exists "program_exercises_coach_all" on public.program_exercises;
create policy "program_exercises_coach_all"
on public.program_exercises for all to authenticated
using (public.owns_session(session_id))
with check (public.owns_session(session_id));

-- -----------------------------------------------------------------------------
-- session_items (timeline éditeur V2 — exercise | block)
-- -----------------------------------------------------------------------------

create table if not exists public.session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  position integer not null default 0,
  kind text not null check (kind in ('exercise', 'block')),
  program_exercise_id uuid references public.program_exercises(id) on delete cascade,
  session_block_id uuid references public.session_blocks(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint session_items_kind_fk check (
    (kind = 'exercise' and program_exercise_id is not null and session_block_id is null)
    or (kind = 'block' and session_block_id is not null and program_exercise_id is null)
  ),
  unique (session_id, position)
);

create index if not exists session_items_session_id_idx
  on public.session_items (session_id, position);

alter table public.session_items enable row level security;

drop policy if exists "session_items_coach_all" on public.session_items;
create policy "session_items_coach_all"
on public.session_items for all to authenticated
using (public.owns_session(session_id))
with check (public.owns_session(session_id));

-- -----------------------------------------------------------------------------
-- RPCs éditeur V2
-- -----------------------------------------------------------------------------

create or replace function public.insert_program_exercise(
  p_session_id uuid,
  p_exercise_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_order integer;
begin
  if not public.owns_session(p_session_id) then
    raise exception 'forbidden';
  end if;

  select name into v_name
  from public.exercise_library
  where id = p_exercise_id and deleted_at is null;

  select coalesce(max(exercise_order), -1) + 1 into v_order
  from public.program_exercises
  where session_id = p_session_id;

  insert into public.program_exercises (session_id, exercise_id, name, exercise_order)
  values (p_session_id, p_exercise_id, v_name, v_order)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.insert_program_exercise(uuid, uuid) to authenticated;

create or replace function public.append_session_item_exercise(
  p_session_id uuid,
  p_program_exercise_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pos integer;
begin
  if not public.owns_session(p_session_id) then
    raise exception 'forbidden';
  end if;

  select coalesce(max(position), -1) + 1 into v_pos
  from public.session_items
  where session_id = p_session_id;

  insert into public.session_items (session_id, position, kind, program_exercise_id)
  values (p_session_id, v_pos, 'exercise', p_program_exercise_id)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.append_session_item_exercise(uuid, uuid) to authenticated;

create or replace function public.append_session_item_block(
  p_session_id uuid,
  p_session_block_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pos integer;
begin
  if not public.owns_session(p_session_id) then
    raise exception 'forbidden';
  end if;

  select coalesce(max(position), -1) + 1 into v_pos
  from public.session_items
  where session_id = p_session_id;

  insert into public.session_items (session_id, position, kind, session_block_id)
  values (p_session_id, v_pos, 'block', p_session_block_id)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.append_session_item_block(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- FK prestations.program_template_id → programs
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prestations_program_template_id_fkey'
  ) then
    alter table public.prestations
      add constraint prestations_program_template_id_fkey
      foreign key (program_template_id) references public.programs(id) on delete set null;
  end if;
exception
  when others then null;
end $$;

-- -----------------------------------------------------------------------------
-- client_fitness_plans (assignation — achat ≠ démarrage)
-- -----------------------------------------------------------------------------

create table if not exists public.client_fitness_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  source_program_id uuid references public.programs(id) on delete set null,
  grant_id uuid references public.client_grants(id) on delete set null,
  status text not null default 'waiting'
    check (status in ('waiting', 'started', 'paused', 'done')),
  is_calendar boolean not null default false,
  start_date date,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_fitness_plans_client_id_idx
  on public.client_fitness_plans (client_id, status);

create index if not exists client_fitness_plans_coach_id_idx
  on public.client_fitness_plans (coach_id);

create index if not exists client_fitness_plans_source_program_idx
  on public.client_fitness_plans (source_program_id)
  where source_program_id is not null;

-- Au plus 1 plan fitness « démarré » par client (started|paused)
create unique index if not exists client_fitness_plans_one_active_idx
  on public.client_fitness_plans (client_id)
  where status in ('started', 'paused');

alter table public.client_fitness_plans enable row level security;

drop policy if exists "client_fitness_plans_coach_all" on public.client_fitness_plans;
create policy "client_fitness_plans_coach_all"
on public.client_fitness_plans for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "client_fitness_plans_client_select" on public.client_fitness_plans;
create policy "client_fitness_plans_client_select"
on public.client_fitness_plans for select to authenticated
using (public.is_my_client_row(client_id));

drop policy if exists "client_fitness_plans_client_update_status" on public.client_fitness_plans;
create policy "client_fitness_plans_client_update_status"
on public.client_fitness_plans for update to authenticated
using (public.is_my_client_row(client_id))
with check (public.is_my_client_row(client_id));

-- Recréer helper lecture programme (dépend de client_fitness_plans)
create or replace function public.client_can_read_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_fitness_plans cfp
    where cfp.source_program_id = p_program_id
      and public.is_my_client_row(cfp.client_id)
  );
$$;

grant execute on function public.client_can_read_program(uuid) to authenticated, anon;

drop policy if exists "programs_client_select" on public.programs;
create policy "programs_client_select"
on public.programs for select to authenticated
using (public.client_can_read_program(id));

drop policy if exists "program_weeks_client_select" on public.program_weeks;
create policy "program_weeks_client_select"
on public.program_weeks for select to authenticated
using (public.client_can_read_program(program_id));

drop policy if exists "sessions_client_select" on public.sessions;
create policy "sessions_client_select"
on public.sessions for select to authenticated
using (
  exists (
    select 1 from public.program_weeks w
    where w.id = sessions.week_id
      and public.client_can_read_program(w.program_id)
  )
);

drop policy if exists "session_blocks_client_select" on public.session_blocks;
create policy "session_blocks_client_select"
on public.session_blocks for select to authenticated
using (
  exists (
    select 1 from public.sessions s
    join public.program_weeks w on w.id = s.week_id
    where s.id = session_blocks.program_session_id
      and public.client_can_read_program(w.program_id)
  )
);

drop policy if exists "block_exercises_client_select" on public.block_exercises;
create policy "block_exercises_client_select"
on public.block_exercises for select to authenticated
using (
  exists (
    select 1 from public.session_blocks b
    join public.sessions s on s.id = b.program_session_id
    join public.program_weeks w on w.id = s.week_id
    where b.id = block_exercises.session_block_id
      and public.client_can_read_program(w.program_id)
  )
);

drop policy if exists "program_exercises_client_select" on public.program_exercises;
create policy "program_exercises_client_select"
on public.program_exercises for select to authenticated
using (
  exists (
    select 1 from public.sessions s
    join public.program_weeks w on w.id = s.week_id
    where s.id = program_exercises.session_id
      and public.client_can_read_program(w.program_id)
  )
);

drop policy if exists "session_items_client_select" on public.session_items;
create policy "session_items_client_select"
on public.session_items for select to authenticated
using (
  exists (
    select 1 from public.sessions s
    join public.program_weeks w on w.id = s.week_id
    where s.id = session_items.session_id
      and public.client_can_read_program(w.program_id)
  )
);

-- -----------------------------------------------------------------------------
-- Tracking
-- -----------------------------------------------------------------------------

insert into public.schema_migrations_trainly (id)
values ('10_programs')
on conflict (id) do nothing;

comment on table public.programs is 'Templates / plans fitness coach — éditeur V2';
comment on table public.client_fitness_plans is 'Plan client : waiting|started|paused|done — achat ≠ démarrage';
comment on table public.session_items is 'Timeline éditeur (exercise|block) par séance';
