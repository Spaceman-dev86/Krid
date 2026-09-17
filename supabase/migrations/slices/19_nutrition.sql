-- =============================================================================
-- TRANCHE 19 — Nutrition (plans + recettes + logs client)
-- Prérequis : 03_clients (+ 04 is_my_client_row)
-- Après Run : dis « 19 OK »
-- =============================================================================
-- Périmètre V1 MVP :
--   • nutrition_recipes (coach)
--   • nutrition_plans (template/brouillon, structure jsonb)
--   • client_nutrition_plans (snapshot + status)
--   • nutrition_day_logs (meals_validated)
-- Hors scope : DnD twin · catalogue Admin · add repas DIY client
-- =============================================================================

create table if not exists public.nutrition_recipes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  notes text,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists nutrition_recipes_coach_idx
  on public.nutrition_recipes (coach_id)
  where deleted_at is null;

alter table public.nutrition_recipes enable row level security;

drop policy if exists "nutrition_recipes_coach_all" on public.nutrition_recipes;
create policy "nutrition_recipes_coach_all"
on public.nutrition_recipes for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- -----------------------------------------------------------------------------

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Plan nutrition',
  status text not null default 'draft'
    check (status in ('draft', 'template')),
  structure jsonb not null default '{"weeks":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists nutrition_plans_coach_idx
  on public.nutrition_plans (coach_id)
  where deleted_at is null;

alter table public.nutrition_plans enable row level security;

drop policy if exists "nutrition_plans_coach_all" on public.nutrition_plans;
create policy "nutrition_plans_coach_all"
on public.nutrition_plans for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- -----------------------------------------------------------------------------

create table if not exists public.client_nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  source_plan_id uuid references public.nutrition_plans(id) on delete set null,
  title text,
  status text not null default 'waiting'
    check (status in ('waiting', 'started', 'paused', 'done')),
  start_date date,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_nutrition_plans_client_idx
  on public.client_nutrition_plans (client_id, status);

create index if not exists client_nutrition_plans_coach_idx
  on public.client_nutrition_plans (coach_id);

-- Au plus 1 plan nutrition démarré/pause par client
create unique index if not exists client_nutrition_plans_one_active_idx
  on public.client_nutrition_plans (client_id)
  where status in ('started', 'paused');

alter table public.client_nutrition_plans enable row level security;

drop policy if exists "client_nutrition_plans_coach_all" on public.client_nutrition_plans;
create policy "client_nutrition_plans_coach_all"
on public.client_nutrition_plans for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "client_nutrition_plans_client_select" on public.client_nutrition_plans;
create policy "client_nutrition_plans_client_select"
on public.client_nutrition_plans for select to authenticated
using (public.is_my_client_row(client_id));

drop policy if exists "client_nutrition_plans_client_update" on public.client_nutrition_plans;
create policy "client_nutrition_plans_client_update"
on public.client_nutrition_plans for update to authenticated
using (public.is_my_client_row(client_id))
with check (public.is_my_client_row(client_id));

-- -----------------------------------------------------------------------------

create table if not exists public.nutrition_day_logs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.client_nutrition_plans(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  day_date date not null,
  meals_validated jsonb not null default '{}'::jsonb,
  day_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, day_date)
);

create index if not exists nutrition_day_logs_client_day_idx
  on public.nutrition_day_logs (client_id, day_date);

alter table public.nutrition_day_logs enable row level security;

drop policy if exists "nutrition_day_logs_coach_select" on public.nutrition_day_logs;
create policy "nutrition_day_logs_coach_select"
on public.nutrition_day_logs for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.client_nutrition_plans p
    where p.id = plan_id and p.coach_id = auth.uid()
  )
);

drop policy if exists "nutrition_day_logs_client_all" on public.nutrition_day_logs;
create policy "nutrition_day_logs_client_all"
on public.nutrition_day_logs for all to authenticated
using (public.is_my_client_row(client_id))
with check (
  public.is_my_client_row(client_id)
  and exists (
    select 1 from public.client_nutrition_plans p
    where p.id = plan_id
      and p.client_id = client_id
      and public.is_my_client_row(p.client_id)
  )
);

comment on table public.nutrition_plans is
  'Plans nutrition coach · structure jsonb (semaines/jours/repas)';
comment on table public.client_nutrition_plans is
  'Snapshot client · waiting|started|paused|done · 1 actif max';
comment on table public.nutrition_day_logs is
  'Validation repas jour · meals_validated { mealId: true }';

insert into public.schema_migrations_trainly (id)
values ('19_nutrition')
on conflict (id) do nothing;
