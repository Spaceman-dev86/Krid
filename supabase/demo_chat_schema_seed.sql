l/-- Create demo chat + calendar tables with shared demo data and coach-private overlays.
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

-- =========================
-- Demo clients (shared)
-- =========================
create table if not exists public.demo_clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  avatar_seed text,
  created_at timestamptz not null default now()
);

alter table public.demo_clients
  add column if not exists first_name text;
alter table public.demo_clients
  add column if not exists last_name text;
alter table public.demo_clients
  add column if not exists sex text;
alter table public.demo_clients
  add column if not exists height_cm int;
alter table public.demo_clients
  add column if not exists weight_kg numeric;
alter table public.demo_clients
  add column if not exists age int;
alter table public.demo_clients
  add column if not exists sessions_per_week int;
alter table public.demo_clients
  add column if not exists activity_factor numeric;

alter table public.demo_clients enable row level security;

drop policy if exists "demo_clients_select_all" on public.demo_clients;
create policy "demo_clients_select_all"
on public.demo_clients
for select
to authenticated
using (true);

drop policy if exists "demo_clients_insert_all" on public.demo_clients;
create policy "demo_clients_insert_all"
on public.demo_clients
for insert
to authenticated
with check (true);

drop policy if exists "demo_clients_update_all" on public.demo_clients;
create policy "demo_clients_update_all"
on public.demo_clients
for update
to authenticated
using (true)
with check (true);

-- =========================
-- Demo conversations (shared)
-- =========================
create table if not exists public.demo_conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.demo_clients(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.demo_conversations enable row level security;

drop policy if exists "demo_conversations_select_all" on public.demo_conversations;
create policy "demo_conversations_select_all"
on public.demo_conversations
for select
to authenticated
using (true);

-- =========================
-- Demo messages (shared + private per coach)
-- owner_coach_id is NULL for shared seeded messages.
-- owner_coach_id = auth.uid() for coach private messages.
-- =========================
create table if not exists public.demo_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.demo_conversations(id) on delete cascade,
  owner_coach_id uuid,
  reply_to_id uuid references public.demo_messages(id) on delete set null,
  sender text not null check (sender in ('client','coach','system')),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.demo_messages
  add column if not exists reply_to_id uuid references public.demo_messages(id) on delete set null;

create index if not exists demo_messages_conversation_created_idx
  on public.demo_messages (conversation_id, created_at desc);

alter table public.demo_messages enable row level security;

drop policy if exists "demo_messages_select_shared_or_owned" on public.demo_messages;
create policy "demo_messages_select_shared_or_owned"
on public.demo_messages
for select
to authenticated
using (owner_coach_id is null or owner_coach_id = auth.uid());

drop policy if exists "demo_messages_insert_owned" on public.demo_messages;
create policy "demo_messages_insert_owned"
on public.demo_messages
for insert
to authenticated
with check (owner_coach_id = auth.uid());

-- =========================
-- Calendar events (shared demo + private per coach)
-- owner_coach_id is NULL for shared seeded events.
-- owner_coach_id = auth.uid() for coach private events.
-- =========================
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_coach_id uuid,
  client_id uuid references public.demo_clients(id) on delete set null,
  type text not null default 'in_person',
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_owner_start_idx
  on public.calendar_events (owner_coach_id, start_at desc);

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_select_shared_or_owned" on public.calendar_events;
create policy "calendar_events_select_shared_or_owned"
on public.calendar_events
for select
to authenticated
using (owner_coach_id is null or owner_coach_id = auth.uid());

drop policy if exists "calendar_events_insert_owned" on public.calendar_events;
create policy "calendar_events_insert_owned"
on public.calendar_events
for insert
to authenticated
with check (owner_coach_id = auth.uid());

drop policy if exists "calendar_events_delete_owned" on public.calendar_events;
create policy "calendar_events_delete_owned"
on public.calendar_events
for delete
to authenticated
using (owner_coach_id = auth.uid());

-- =========================
-- Nutrition ingredients (shared)
-- Calories are computed from macros: protein*4 + carbs*4 + fat*9
-- =========================
create table if not exists public.nutrition_ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  calories numeric generated always as ((protein_g * 4) + (carbs_g * 4) + (fat_g * 9)) stored,
  created_at timestamptz not null default now(),
  constraint nutrition_ingredients_name_unique unique (name)
);

alter table public.nutrition_ingredients enable row level security;

drop policy if exists "nutrition_ingredients_select_all" on public.nutrition_ingredients;
create policy "nutrition_ingredients_select_all"
on public.nutrition_ingredients
for select
to authenticated
using (true);

create table if not exists public.nutrition_recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text,
  photo_url text,
  created_at timestamptz not null default now(),
  constraint nutrition_recipes_title_unique unique (title)
);

create table if not exists public.nutrition_recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.nutrition_recipes(id) on delete cascade,
  step_order int not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint nutrition_recipe_steps_order_unique unique (recipe_id, step_order)
);

create table if not exists public.nutrition_recipe_ingredients (
  recipe_id uuid not null references public.nutrition_recipes(id) on delete cascade,
  ingredient_id uuid not null references public.nutrition_ingredients(id) on delete restrict,
  quantity_g numeric not null,
  created_at timestamptz not null default now(),
  primary key (recipe_id, ingredient_id)
);

create table if not exists public.nutrition_client_recipe_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.demo_clients(id) on delete cascade,
  recipe_id uuid not null references public.nutrition_recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint nutrition_client_recipe_assignments_unique unique (client_id, recipe_id)
);

create table if not exists public.nutrition_client_profiles (
  client_id uuid primary key references public.demo_clients(id) on delete cascade,
  objective text not null,
  target_kcal int not null,
  maintenance_kcal int,
  age int,
  sessions_per_week int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_week_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.demo_clients(id) on delete cascade,
  title text not null default 'Semaine type',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint nutrition_week_plans_active_unique unique (client_id, is_active)
);

create table if not exists public.nutrition_week_plan_entries (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references public.nutrition_week_plans(id) on delete cascade,
  day_of_week int not null,
  meal_key text not null,
  recipe_id uuid not null references public.nutrition_recipes(id) on delete restrict,
  servings numeric not null default 1,
  created_at timestamptz not null default now(),
  constraint nutrition_week_plan_entries_unique unique (week_plan_id, day_of_week, meal_key)
);

create or replace view public.nutrition_recipe_totals as
select
  r.id as recipe_id,
  coalesce(sum(i.calories * ri.quantity_g / 100), 0) as calories,
  coalesce(sum(i.protein_g * ri.quantity_g / 100), 0) as protein_g,
  coalesce(sum(i.carbs_g * ri.quantity_g / 100), 0) as carbs_g,
  coalesce(sum(i.fat_g * ri.quantity_g / 100), 0) as fat_g
from public.nutrition_recipes r
left join public.nutrition_recipe_ingredients ri on ri.recipe_id = r.id
left join public.nutrition_ingredients i on i.id = ri.ingredient_id
group by r.id;

grant select on public.nutrition_recipe_totals to authenticated;

alter table public.nutrition_recipes enable row level security;
alter table public.nutrition_recipe_steps enable row level security;
alter table public.nutrition_recipe_ingredients enable row level security;
alter table public.nutrition_client_recipe_assignments enable row level security;
alter table public.nutrition_client_profiles enable row level security;
alter table public.nutrition_week_plans enable row level security;
alter table public.nutrition_week_plan_entries enable row level security;

drop policy if exists "nutrition_recipes_select_all" on public.nutrition_recipes;
create policy "nutrition_recipes_select_all" on public.nutrition_recipes for select to authenticated using (true);

drop policy if exists "nutrition_recipe_steps_select_all" on public.nutrition_recipe_steps;
create policy "nutrition_recipe_steps_select_all" on public.nutrition_recipe_steps for select to authenticated using (true);

drop policy if exists "nutrition_recipe_ingredients_select_all" on public.nutrition_recipe_ingredients;
create policy "nutrition_recipe_ingredients_select_all" on public.nutrition_recipe_ingredients for select to authenticated using (true);

drop policy if exists "nutrition_client_recipe_assignments_select_all" on public.nutrition_client_recipe_assignments;
create policy "nutrition_client_recipe_assignments_select_all" on public.nutrition_client_recipe_assignments for select to authenticated using (true);

drop policy if exists "nutrition_client_profiles_select_all" on public.nutrition_client_profiles;
create policy "nutrition_client_profiles_select_all" on public.nutrition_client_profiles for select to authenticated using (true);

drop policy if exists "nutrition_client_profiles_insert_all" on public.nutrition_client_profiles;
create policy "nutrition_client_profiles_insert_all"
on public.nutrition_client_profiles
for insert
to authenticated
with check (true);

drop policy if exists "nutrition_client_profiles_update_all" on public.nutrition_client_profiles;
create policy "nutrition_client_profiles_update_all"
on public.nutrition_client_profiles
for update
to authenticated
using (true)
with check (true);

drop policy if exists "nutrition_week_plans_select_all" on public.nutrition_week_plans;
create policy "nutrition_week_plans_select_all" on public.nutrition_week_plans for select to authenticated using (true);

drop policy if exists "nutrition_week_plans_insert_all" on public.nutrition_week_plans;
create policy "nutrition_week_plans_insert_all"
on public.nutrition_week_plans
for insert
to authenticated
with check (true);

drop policy if exists "nutrition_week_plans_update_all" on public.nutrition_week_plans;
create policy "nutrition_week_plans_update_all"
on public.nutrition_week_plans
for update
to authenticated
using (true)
with check (true);

drop policy if exists "nutrition_week_plan_entries_select_all" on public.nutrition_week_plan_entries;
create policy "nutrition_week_plan_entries_select_all" on public.nutrition_week_plan_entries for select to authenticated using (true);

-- =========================
-- Seed shared demo data
-- =========================

insert into public.demo_clients (id, full_name, avatar_seed)
values
  ('11111111-1111-1111-1111-111111111111', 'Sarah Martin', 'sarah'),
  ('22222222-2222-2222-2222-222222222222', 'Mehdi Benali', 'mehdi'),
  ('33333333-3333-3333-3333-333333333333', 'Camille Dubois', 'camille'),
  ('44444444-4444-4444-4444-444444444444', 'Lucas Morel', 'lucas'),
  ('55555555-5555-5555-5555-555555555555', 'Nina Garcia', 'nina')
on conflict (id) do nothing;

insert into public.nutrition_client_profiles (client_id, objective, target_kcal, maintenance_kcal, age, sessions_per_week)
values
  ('11111111-1111-1111-1111-111111111111', 'prise_de_masse', 2800, 2600, 28, 5),
  ('22222222-2222-2222-2222-222222222222', 'seche', 2100, 2500, 31, 4),
  ('33333333-3333-3333-3333-333333333333', 'maintien', 2300, 2300, 26, 3),
  ('44444444-4444-4444-4444-444444444444', 'recomposition', 2400, 2450, 34, 4),
  ('55555555-5555-5555-5555-555555555555', 'seche', 1900, 2200, 29, 5)
on conflict (client_id) do update
set objective = excluded.objective,
    target_kcal = excluded.target_kcal,
    maintenance_kcal = excluded.maintenance_kcal,
    age = excluded.age,
    sessions_per_week = excluded.sessions_per_week,
    updated_at = now();

update public.nutrition_client_profiles p
set target_kcal = round(calc.avg_kcal)::int,
    updated_at = now()
from (
  select
    wp.client_id,
    case
      when count(distinct e.day_of_week) = 0 then null
      else sum(coalesce(rt.calories, 0) * coalesce(e.servings, 1)) / count(distinct e.day_of_week)
    end as avg_kcal
  from public.nutrition_week_plans wp
  join public.nutrition_week_plan_entries e on e.week_plan_id = wp.id
  left join public.nutrition_recipe_totals rt on rt.recipe_id = e.recipe_id
  where wp.is_active = true
  group by wp.client_id
) calc
where p.client_id = calc.client_id
  and calc.avg_kcal is not null;

insert into public.nutrition_week_plans (id, client_id, title, is_active)
values
  ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Semaine type', true),
  ('90000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Semaine type', true),
  ('90000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Semaine type', true),
  ('90000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Semaine type', true),
  ('90000000-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', 'Semaine type', true)
on conflict on constraint nutrition_week_plans_active_unique do update
set title = excluded.title;

insert into public.nutrition_week_plan_entries (week_plan_id, day_of_week, meal_key, recipe_id, servings)
values
  -- Sarah (prise de masse)
  ('90000000-0000-0000-0000-000000000001', 1, 'Midi', '10000000-0000-0000-0000-000000000001', 1),
  ('90000000-0000-0000-0000-000000000001', 1, 'Soir', '10000000-0000-0000-0000-000000000012', 1),
  ('90000000-0000-0000-0000-000000000001', 2, 'Midi', '10000000-0000-0000-0000-000000000030', 1),
  ('90000000-0000-0000-0000-000000000001', 2, 'Soir', '10000000-0000-0000-0000-000000000017', 1),
  ('90000000-0000-0000-0000-000000000001', 3, 'Midi', '10000000-0000-0000-0000-000000000002', 1),
  ('90000000-0000-0000-0000-000000000001', 3, 'Soir', '10000000-0000-0000-0000-000000000003', 1),
  ('90000000-0000-0000-0000-000000000001', 4, 'Midi', '10000000-0000-0000-0000-000000000011', 1),
  ('90000000-0000-0000-0000-000000000001', 4, 'Soir', '10000000-0000-0000-0000-000000000013', 1),
  ('90000000-0000-0000-0000-000000000001', 5, 'Midi', '10000000-0000-0000-0000-000000000005', 1),
  ('90000000-0000-0000-0000-000000000001', 5, 'Soir', '10000000-0000-0000-0000-000000000021', 1),
  ('90000000-0000-0000-0000-000000000001', 6, 'Midi', '10000000-0000-0000-0000-000000000004', 1),
  ('90000000-0000-0000-0000-000000000001', 6, 'Soir', '10000000-0000-0000-0000-000000000018', 1),
  ('90000000-0000-0000-0000-000000000001', 7, 'Midi', '10000000-0000-0000-0000-000000000016', 1),
  ('90000000-0000-0000-0000-000000000001', 7, 'Soir', '10000000-0000-0000-0000-000000000006', 1),

  -- Mehdi (sèche)
  ('90000000-0000-0000-0000-000000000002', 1, 'Midi', '10000000-0000-0000-0000-000000000005', 1),
  ('90000000-0000-0000-0000-000000000002', 1, 'Soir', '10000000-0000-0000-0000-000000000006', 1),
  ('90000000-0000-0000-0000-000000000002', 2, 'Midi', '10000000-0000-0000-0000-000000000004', 1),
  ('90000000-0000-0000-0000-000000000002', 2, 'Soir', '10000000-0000-0000-0000-000000000023', 1),
  ('90000000-0000-0000-0000-000000000002', 3, 'Midi', '10000000-0000-0000-0000-000000000002', 1),
  ('90000000-0000-0000-0000-000000000002', 3, 'Soir', '10000000-0000-0000-0000-000000000028', 1),
  ('90000000-0000-0000-0000-000000000002', 4, 'Midi', '10000000-0000-0000-0000-000000000011', 1),
  ('90000000-0000-0000-0000-000000000002', 4, 'Soir', '10000000-0000-0000-0000-000000000003', 1),
  ('90000000-0000-0000-0000-000000000002', 5, 'Midi', '10000000-0000-0000-0000-000000000001', 1),
  ('90000000-0000-0000-0000-000000000002', 5, 'Soir', '10000000-0000-0000-0000-000000000023', 1),
  ('90000000-0000-0000-0000-000000000002', 6, 'Midi', '10000000-0000-0000-0000-000000000017', 1),
  ('90000000-0000-0000-0000-000000000002', 6, 'Soir', '10000000-0000-0000-0000-000000000005', 1),
  ('90000000-0000-0000-0000-000000000002', 7, 'Midi', '10000000-0000-0000-0000-000000000012', 1),
  ('90000000-0000-0000-0000-000000000002', 7, 'Soir', '10000000-0000-0000-0000-000000000006', 1),

  -- Camille (maintien)
  ('90000000-0000-0000-0000-000000000003', 1, 'Midi', '10000000-0000-0000-0000-000000000009', 1),
  ('90000000-0000-0000-0000-000000000003', 1, 'Soir', '10000000-0000-0000-0000-000000000003', 1),
  ('90000000-0000-0000-0000-000000000003', 2, 'Midi', '10000000-0000-0000-0000-000000000008', 1),
  ('90000000-0000-0000-0000-000000000003', 2, 'Soir', '10000000-0000-0000-0000-000000000005', 1),
  ('90000000-0000-0000-0000-000000000003', 3, 'Midi', '10000000-0000-0000-0000-000000000002', 1),
  ('90000000-0000-0000-0000-000000000003', 3, 'Soir', '10000000-0000-0000-0000-000000000024', 1),
  ('90000000-0000-0000-0000-000000000003', 4, 'Midi', '10000000-0000-0000-0000-000000000004', 1),
  ('90000000-0000-0000-0000-000000000003', 4, 'Soir', '10000000-0000-0000-0000-000000000017', 1),
  ('90000000-0000-0000-0000-000000000003', 5, 'Midi', '10000000-0000-0000-0000-000000000011', 1),
  ('90000000-0000-0000-0000-000000000003', 5, 'Soir', '10000000-0000-0000-0000-000000000003', 1),
  ('90000000-0000-0000-0000-000000000003', 6, 'Midi', '10000000-0000-0000-0000-000000000015', 1),
  ('90000000-0000-0000-0000-000000000003', 6, 'Soir', '10000000-0000-0000-0000-000000000023', 1),
  ('90000000-0000-0000-0000-000000000003', 7, 'Midi', '10000000-0000-0000-0000-000000000012', 1),
  ('90000000-0000-0000-0000-000000000003', 7, 'Soir', '10000000-0000-0000-0000-000000000006', 1),

  -- Lucas (recomposition)
  ('90000000-0000-0000-0000-000000000004', 1, 'Midi', '10000000-0000-0000-0000-000000000030', 1),
  ('90000000-0000-0000-0000-000000000004', 1, 'Soir', '10000000-0000-0000-0000-000000000023', 1),
  ('90000000-0000-0000-0000-000000000004', 2, 'Midi', '10000000-0000-0000-0000-000000000002', 1),
  ('90000000-0000-0000-0000-000000000004', 2, 'Soir', '10000000-0000-0000-0000-000000000005', 1),
  ('90000000-0000-0000-0000-000000000004', 3, 'Midi', '10000000-0000-0000-0000-000000000011', 1),
  ('90000000-0000-0000-0000-000000000004', 3, 'Soir', '10000000-0000-0000-0000-000000000003', 1),
  ('90000000-0000-0000-0000-000000000004', 4, 'Midi', '10000000-0000-0000-0000-000000000001', 1),
  ('90000000-0000-0000-0000-000000000004', 4, 'Soir', '10000000-0000-0000-0000-000000000017', 1),
  ('90000000-0000-0000-0000-000000000004', 5, 'Midi', '10000000-0000-0000-0000-000000000009', 1),
  ('90000000-0000-0000-0000-000000000004', 5, 'Soir', '10000000-0000-0000-0000-000000000028', 1),
  ('90000000-0000-0000-0000-000000000004', 6, 'Midi', '10000000-0000-0000-0000-000000000030', 1),
  ('90000000-0000-0000-0000-000000000004', 6, 'Soir', '10000000-0000-0000-0000-000000000006', 1),
  ('90000000-0000-0000-0000-000000000004', 7, 'Midi', '10000000-0000-0000-0000-000000000012', 1),
  ('90000000-0000-0000-0000-000000000004', 7, 'Soir', '10000000-0000-0000-0000-000000000023', 1),

  -- Nina (sèche)
  ('90000000-0000-0000-0000-000000000005', 1, 'Midi', '10000000-0000-0000-0000-000000000006', 1),
  ('90000000-0000-0000-0000-000000000005', 1, 'Soir', '10000000-0000-0000-0000-000000000005', 1),
  ('90000000-0000-0000-0000-000000000005', 2, 'Midi', '10000000-0000-0000-0000-000000000023', 1),
  ('90000000-0000-0000-0000-000000000005', 2, 'Soir', '10000000-0000-0000-0000-000000000028', 1),
  ('90000000-0000-0000-0000-000000000005', 3, 'Midi', '10000000-0000-0000-0000-000000000004', 1),
  ('90000000-0000-0000-0000-000000000005', 3, 'Soir', '10000000-0000-0000-0000-000000000006', 1),
  ('90000000-0000-0000-0000-000000000005', 4, 'Midi', '10000000-0000-0000-0000-000000000011', 1),
  ('90000000-0000-0000-0000-000000000005', 4, 'Soir', '10000000-0000-0000-0000-000000000023', 1),
  ('90000000-0000-0000-0000-000000000005', 5, 'Midi', '10000000-0000-0000-0000-000000000002', 1),
  ('90000000-0000-0000-0000-000000000005', 5, 'Soir', '10000000-0000-0000-0000-000000000005', 1),
  ('90000000-0000-0000-0000-000000000005', 6, 'Midi', '10000000-0000-0000-0000-000000000001', 1),
  ('90000000-0000-0000-0000-000000000005', 6, 'Soir', '10000000-0000-0000-0000-000000000006', 1),
  ('90000000-0000-0000-0000-000000000005', 7, 'Midi', '10000000-0000-0000-0000-000000000023', 1),
  ('90000000-0000-0000-0000-000000000005', 7, 'Soir', '10000000-0000-0000-0000-000000000028', 1)
on conflict on constraint nutrition_week_plan_entries_unique do update
set recipe_id = excluded.recipe_id,
    servings = excluded.servings;

insert into public.demo_conversations (id, client_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '55555555-5555-5555-5555-555555555555')
on conflict (id) do nothing;

insert into public.nutrition_ingredients (name, protein_g, carbs_g, fat_g)
values
  ('Poulet', 21, 0, 7),
  ('Dinde', 22, 0, 4),
  ('Boeuf 5%', 21, 0, 5),
  ('Thon', 25.6, 0, 1.6),
  ('Poisson blanc', 16, 0, 1),
  ('Saumon', 20, 0, 14),
  ('Oeuf', 6.4, 0.1, 5.7),
  ('Fromage', 27, 0, 28),

  ('Riz', 8, 77, 1),
  ('Pâtes', 12, 70, 2.5),
  ('Patate douce', 1.2, 23, 0.3),
  ('Pomme de terre', 2, 19, 0.1),
  ('Pain', 8.5, 58, 1),

  ('Lentille', 28, 57, 1.2),
  ('Quinoa', 13, 69, 5.8),
  ('Pois chiche', 5, 15, 1.5),
  ('Haricot rouge/blanc', 20, 46, 1),
  ('Lentille corail', 26, 49, 1.2),
  ('Pois cassé', 22.1, 58.3, 2.4),
  ('Panir', 20, 4, 24),

  ('Prot', 72, 7.3, 6.7),
  ('Noix', 19, 25, 48),
  ('Fruit sec', 4, 39, 1),
  ('Jambon', 20, 1, 3),
  ('Banane', 1.5, 20, 0),
  ('Pomme', 0.3, 12, 0.3),
  ('Fromage blanc', 7.5, 4, 3),
  ('Beurre', 1, 0, 84),
  ('Confiture', 0.5, 40, 0),
  ('Kiwi', 1.6, 11, 0.3),
  ('Lait soja', 3, 2, 2),

  ('Haricot', 2.5, 7, 0),
  ('Petit pois', 3, 8.5, 2),
  ('Poivron', 1, 3.3, 0.2),
  ('Champignon', 2, 5, 2.8),
  ('Carotte', 0.8, 8, 0),
  ('Poireaux', 1.4, 6, 0.6),
  ('Graine', 29, 15, 46),
  ('Epinards', 2.2, 3, 0.2),
  ('Radis', 1, 3, 0.2)
on conflict (name) do nothing;

insert into public.nutrition_recipes (id, title, note, photo_url)
values
  ('10000000-0000-0000-0000-000000000001', 'Bowl poulet riz', 'Simple et équilibré.', null),
  ('10000000-0000-0000-0000-000000000002', 'Dinde quinoa poivron', 'Protéines + glucides propres.', null),
  ('10000000-0000-0000-0000-000000000003', 'Saumon patate douce', 'Oméga 3 + énergie.', null),
  ('10000000-0000-0000-0000-000000000004', 'Thon pomme de terre', 'Rapide à préparer.', null),
  ('10000000-0000-0000-0000-000000000005', 'Poisson blanc riz', 'Léger et digeste.', null),
  ('10000000-0000-0000-0000-000000000006', 'Omelette épinards', 'Petit-déj protéiné.', null),
  ('10000000-0000-0000-0000-000000000007', 'Fromage blanc banane', 'Snack simple.', null),
  ('10000000-0000-0000-0000-000000000008', 'Lentilles carotte', 'Végétarien, riche en fibres.', null),
  ('10000000-0000-0000-0000-000000000009', 'Quinoa légumes', 'Base de meal prep.', null),
  ('10000000-0000-0000-0000-000000000010', 'Pâtes jambon', 'Option rapide post-training.', null),
  ('10000000-0000-0000-0000-000000000011', 'Riz dinde champignon', 'Propre et réconfortant.', null),
  ('10000000-0000-0000-0000-000000000012', 'Poulet patate douce', 'Meal prep classique.', null),
  ('10000000-0000-0000-0000-000000000013', 'Boeuf 5% pomme de terre', 'Riche en protéines.', null),
  ('10000000-0000-0000-0000-000000000014', 'Pois chiche poivron', 'Végé et complet.', null),
  ('10000000-0000-0000-0000-000000000015', 'Haricots rouges riz', 'Énergie longue.', null),
  ('10000000-0000-0000-0000-000000000016', 'Panir quinoa', 'Végé, gourmand.', null),
  ('10000000-0000-0000-0000-000000000017', 'Saumon quinoa', 'Oméga 3 + glucides.', null),
  ('10000000-0000-0000-0000-000000000018', 'Thon pâtes', 'Rapide et efficace.', null),
  ('10000000-0000-0000-0000-000000000019', 'Oeufs pain kiwi', 'Petit-déj express.', null),
  ('10000000-0000-0000-0000-000000000020', 'Fromage blanc pomme', 'Snack léger.', null),
  ('10000000-0000-0000-0000-000000000021', 'Poulet lentilles corail', 'Riche en protéines.', null),
  ('10000000-0000-0000-0000-000000000022', 'Dinde patate douce', 'Stable et digeste.', null),
  ('10000000-0000-0000-0000-000000000023', 'Poisson blanc pomme de terre', 'Léger le soir.', null),
  ('10000000-0000-0000-0000-000000000024', 'Riz légumes', 'Base neutre.', null),
  ('10000000-0000-0000-0000-000000000025', 'Pâtes champignon', 'Végé simple.', null),
  ('10000000-0000-0000-0000-000000000026', 'Lait soja banane', 'Smoothie rapide.', null),
  ('10000000-0000-0000-0000-000000000027', 'Noix + fruit sec', 'Snack dense.', null),
  ('10000000-0000-0000-0000-000000000028', 'Oeufs champignon', 'Omelette simple.', null),
  ('10000000-0000-0000-0000-000000000029', 'Lentilles pois cassé', 'Végé riche en fibres.', null),
  ('10000000-0000-0000-0000-000000000030', 'Bowl boeuf riz', 'Post-training.', null)
on conflict (id) do nothing;

delete from public.nutrition_recipe_steps
where recipe_id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000009',
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000012',
  '10000000-0000-0000-0000-000000000013',
  '10000000-0000-0000-0000-000000000014',
  '10000000-0000-0000-0000-000000000015',
  '10000000-0000-0000-0000-000000000016',
  '10000000-0000-0000-0000-000000000017',
  '10000000-0000-0000-0000-000000000018',
  '10000000-0000-0000-0000-000000000019',
  '10000000-0000-0000-0000-000000000020',
  '10000000-0000-0000-0000-000000000021',
  '10000000-0000-0000-0000-000000000022',
  '10000000-0000-0000-0000-000000000023',
  '10000000-0000-0000-0000-000000000024',
  '10000000-0000-0000-0000-000000000025',
  '10000000-0000-0000-0000-000000000026',
  '10000000-0000-0000-0000-000000000027',
  '10000000-0000-0000-0000-000000000028',
  '10000000-0000-0000-0000-000000000029',
  '10000000-0000-0000-0000-000000000030'
);

insert into public.nutrition_recipe_steps (recipe_id, step_order, body)
values
  ('10000000-0000-0000-0000-000000000001', 1, 'Peser et préparer les ingrédients.'),
  ('10000000-0000-0000-0000-000000000001', 2, 'Cuire le riz (ou le réchauffer si meal prep).'),
  ('10000000-0000-0000-0000-000000000001', 3, 'Cuire le poulet à la poêle avec sel/poivre.'),
  ('10000000-0000-0000-0000-000000000001', 4, 'Cuire ou râper la carotte (selon préférence).'),
  ('10000000-0000-0000-0000-000000000001', 5, 'Assembler le bowl et ajuster l’assaisonnement.'),

  ('10000000-0000-0000-0000-000000000002', 1, 'Préparer les ingrédients (dinde, quinoa, poivron).'),
  ('10000000-0000-0000-0000-000000000002', 2, 'Cuire le quinoa et réserver.'),
  ('10000000-0000-0000-0000-000000000002', 3, 'Saisir la dinde à la poêle.'),
  ('10000000-0000-0000-0000-000000000002', 4, 'Ajouter le poivron et faire revenir 3-5 min.'),
  ('10000000-0000-0000-0000-000000000002', 5, 'Assembler quinoa + dinde + poivron.'),

  ('10000000-0000-0000-0000-000000000003', 1, 'Préchauffer le four ou préparer une poêle.'),
  ('10000000-0000-0000-0000-000000000003', 2, 'Cuire la patate douce (four, vapeur ou eau).'),
  ('10000000-0000-0000-0000-000000000003', 3, 'Cuire le saumon (poêle ou four) sans le dessécher.'),
  ('10000000-0000-0000-0000-000000000003', 4, 'Faire tomber les épinards 1-2 min à la poêle.'),
  ('10000000-0000-0000-0000-000000000003', 5, 'Dresser l’assiette et assaisonner.'),

  ('10000000-0000-0000-0000-000000000004', 1, 'Cuire les pommes de terre (eau ou vapeur).'),
  ('10000000-0000-0000-0000-000000000004', 2, 'Égoutter et laisser tiédir, puis couper en morceaux.'),
  ('10000000-0000-0000-0000-000000000004', 3, 'Ajouter le thon et mélanger.'),
  ('10000000-0000-0000-0000-000000000004', 4, 'Ajouter le poivron en dés et assaisonner.'),
  ('10000000-0000-0000-0000-000000000004', 5, 'Servir frais ou légèrement réchauffé.'),

  ('10000000-0000-0000-0000-000000000005', 1, 'Cuire le riz et réserver.'),
  ('10000000-0000-0000-0000-000000000005', 2, 'Cuire le poisson blanc à la poêle (ou vapeur).'),
  ('10000000-0000-0000-0000-000000000005', 3, 'Préparer la carotte (râpée ou cuite).'),
  ('10000000-0000-0000-0000-000000000005', 4, 'Assembler riz + poisson + carotte.'),
  ('10000000-0000-0000-0000-000000000005', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000006', 1, 'Laver et préparer les légumes.'),
  ('10000000-0000-0000-0000-000000000006', 2, 'Battre les oeufs avec sel/poivre.'),
  ('10000000-0000-0000-0000-000000000006', 3, 'Faire revenir champignons + épinards 2-3 min.'),
  ('10000000-0000-0000-0000-000000000006', 4, 'Verser les oeufs et cuire à feu moyen.'),
  ('10000000-0000-0000-0000-000000000006', 5, 'Plier l’omelette et servir.'),

  ('10000000-0000-0000-0000-000000000007', 1, 'Mettre le fromage blanc dans un bol.'),
  ('10000000-0000-0000-0000-000000000007', 2, 'Couper la banane en rondelles.'),
  ('10000000-0000-0000-0000-000000000007', 3, 'Ajouter la banane au bol.'),
  ('10000000-0000-0000-0000-000000000007', 4, 'Ajouter les noix (option concassées).'),
  ('10000000-0000-0000-0000-000000000007', 5, 'Mélanger légèrement et servir.'),

  ('10000000-0000-0000-0000-000000000008', 1, 'Rincer les lentilles si besoin.'),
  ('10000000-0000-0000-0000-000000000008', 2, 'Cuire les lentilles jusqu’à tendreté.'),
  ('10000000-0000-0000-0000-000000000008', 3, 'Ajouter carotte + poireaux en morceaux.'),
  ('10000000-0000-0000-0000-000000000008', 4, 'Poursuivre la cuisson 5-10 min.'),
  ('10000000-0000-0000-0000-000000000008', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000009', 1, 'Cuire le quinoa et réserver.'),
  ('10000000-0000-0000-0000-000000000009', 2, 'Couper poivron et champignons.'),
  ('10000000-0000-0000-0000-000000000009', 3, 'Faire revenir les légumes 5-7 min.'),
  ('10000000-0000-0000-0000-000000000009', 4, 'Mélanger quinoa + légumes.'),
  ('10000000-0000-0000-0000-000000000009', 5, 'Assaisonner et portionner (meal prep).'),

  ('10000000-0000-0000-0000-000000000010', 1, 'Cuire les pâtes al dente.'),
  ('10000000-0000-0000-0000-000000000010', 2, 'Égoutter et réserver.'),
  ('10000000-0000-0000-0000-000000000010', 3, 'Couper le jambon et la carotte.'),
  ('10000000-0000-0000-0000-000000000010', 4, 'Mélanger pâtes + jambon + carotte.'),
  ('10000000-0000-0000-0000-000000000010', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000011', 1, 'Cuire le riz et réserver.'),
  ('10000000-0000-0000-0000-000000000011', 2, 'Faire revenir champignons 3-4 min.'),
  ('10000000-0000-0000-0000-000000000011', 3, 'Ajouter la dinde et saisir.'),
  ('10000000-0000-0000-0000-000000000011', 4, 'Mélanger riz + dinde + champignons.'),
  ('10000000-0000-0000-0000-000000000011', 5, 'Rectifier l’assaisonnement et servir.'),

  ('10000000-0000-0000-0000-000000000012', 1, 'Cuire la patate douce et réserver.'),
  ('10000000-0000-0000-0000-000000000012', 2, 'Cuire le poulet à la poêle.'),
  ('10000000-0000-0000-0000-000000000012', 3, 'Faire tomber les épinards 1-2 min.'),
  ('10000000-0000-0000-0000-000000000012', 4, 'Assembler patate douce + poulet + épinards.'),
  ('10000000-0000-0000-0000-000000000012', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000013', 1, 'Cuire les pommes de terre et réserver.'),
  ('10000000-0000-0000-0000-000000000013', 2, 'Cuire le boeuf 5% à la poêle.'),
  ('10000000-0000-0000-0000-000000000013', 3, 'Préparer la carotte (râpée ou cuite).'),
  ('10000000-0000-0000-0000-000000000013', 4, 'Assembler boeuf + pommes de terre + carotte.'),
  ('10000000-0000-0000-0000-000000000013', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000014', 1, 'Rincer les pois chiches et égoutter.'),
  ('10000000-0000-0000-0000-000000000014', 2, 'Couper poivron et carotte en petits morceaux.'),
  ('10000000-0000-0000-0000-000000000014', 3, 'Mélanger pois chiches + légumes.'),
  ('10000000-0000-0000-0000-000000000014', 4, 'Assaisonner (sel/poivre/épices).'),
  ('10000000-0000-0000-0000-000000000014', 5, 'Servir ou réserver au frais.'),

  ('10000000-0000-0000-0000-000000000015', 1, 'Cuire le riz et réserver.'),
  ('10000000-0000-0000-0000-000000000015', 2, 'Réchauffer/égoutter les haricots rouges.'),
  ('10000000-0000-0000-0000-000000000015', 3, 'Couper le poivron en dés.'),
  ('10000000-0000-0000-0000-000000000015', 4, 'Mélanger riz + haricots + poivron.'),
  ('10000000-0000-0000-0000-000000000015', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000016', 1, 'Cuire le quinoa et réserver.'),
  ('10000000-0000-0000-0000-000000000016', 2, 'Saisir le panir à la poêle.'),
  ('10000000-0000-0000-0000-000000000016', 3, 'Faire tomber les épinards 1-2 min.'),
  ('10000000-0000-0000-0000-000000000016', 4, 'Assembler quinoa + panir + épinards.'),
  ('10000000-0000-0000-0000-000000000016', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000017', 1, 'Cuire le quinoa et réserver.'),
  ('10000000-0000-0000-0000-000000000017', 2, 'Cuire le saumon à la poêle ou au four.'),
  ('10000000-0000-0000-0000-000000000017', 3, 'Faire tomber les épinards 1-2 min.'),
  ('10000000-0000-0000-0000-000000000017', 4, 'Assembler quinoa + saumon + épinards.'),
  ('10000000-0000-0000-0000-000000000017', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000018', 1, 'Cuire les pâtes al dente.'),
  ('10000000-0000-0000-0000-000000000018', 2, 'Égoutter et réserver.'),
  ('10000000-0000-0000-0000-000000000018', 3, 'Ajouter le thon et mélanger.'),
  ('10000000-0000-0000-0000-000000000018', 4, 'Ajouter le poivron en dés.'),
  ('10000000-0000-0000-0000-000000000018', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000019', 1, 'Cuire les oeufs (durs ou mollets).'),
  ('10000000-0000-0000-0000-000000000019', 2, 'Griller ou préparer le pain.'),
  ('10000000-0000-0000-0000-000000000019', 3, 'Éplucher les oeufs et les couper.'),
  ('10000000-0000-0000-0000-000000000019', 4, 'Préparer le kiwi.'),
  ('10000000-0000-0000-0000-000000000019', 5, 'Assembler et servir.'),

  ('10000000-0000-0000-0000-000000000020', 1, 'Mettre le fromage blanc dans un bol.'),
  ('10000000-0000-0000-0000-000000000020', 2, 'Couper la pomme en morceaux.'),
  ('10000000-0000-0000-0000-000000000020', 3, 'Ajouter la pomme au bol.'),
  ('10000000-0000-0000-0000-000000000020', 4, 'Ajouter les noix.'),
  ('10000000-0000-0000-0000-000000000020', 5, 'Mélanger et servir.'),

  ('10000000-0000-0000-0000-000000000021', 1, 'Cuire les lentilles corail et réserver.'),
  ('10000000-0000-0000-0000-000000000021', 2, 'Cuire le poulet à la poêle.'),
  ('10000000-0000-0000-0000-000000000021', 3, 'Ajouter la carotte en morceaux.'),
  ('10000000-0000-0000-0000-000000000021', 4, 'Mélanger lentilles corail + poulet + carotte.'),
  ('10000000-0000-0000-0000-000000000021', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000022', 1, 'Cuire la patate douce et réserver.'),
  ('10000000-0000-0000-0000-000000000022', 2, 'Cuire la dinde à la poêle.'),
  ('10000000-0000-0000-0000-000000000022', 3, 'Cuire les haricots (ou les réchauffer).'),
  ('10000000-0000-0000-0000-000000000022', 4, 'Assembler patate douce + dinde + haricots.'),
  ('10000000-0000-0000-0000-000000000022', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000023', 1, 'Cuire les pommes de terre et réserver.'),
  ('10000000-0000-0000-0000-000000000023', 2, 'Cuire le poisson blanc.'),
  ('10000000-0000-0000-0000-000000000023', 3, 'Préparer les poireaux (fondre 5-8 min).'),
  ('10000000-0000-0000-0000-000000000023', 4, 'Assembler poisson + pommes de terre + poireaux.'),
  ('10000000-0000-0000-0000-000000000023', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000024', 1, 'Cuire le riz et réserver.'),
  ('10000000-0000-0000-0000-000000000024', 2, 'Préparer les légumes (haricots + carotte).'),
  ('10000000-0000-0000-0000-000000000024', 3, 'Cuire les légumes jusqu’à tendreté.'),
  ('10000000-0000-0000-0000-000000000024', 4, 'Mélanger riz + légumes.'),
  ('10000000-0000-0000-0000-000000000024', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000025', 1, 'Cuire les pâtes al dente.'),
  ('10000000-0000-0000-0000-000000000025', 2, 'Faire revenir les champignons 5-7 min.'),
  ('10000000-0000-0000-0000-000000000025', 3, 'Ajouter les pâtes égouttées.'),
  ('10000000-0000-0000-0000-000000000025', 4, 'Ajouter un peu de fromage et mélanger.'),
  ('10000000-0000-0000-0000-000000000025', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000026', 1, 'Mettre lait soja + banane dans un blender.'),
  ('10000000-0000-0000-0000-000000000026', 2, 'Ajouter la dose de protéines.'),
  ('10000000-0000-0000-0000-000000000026', 3, 'Mixer jusqu’à texture lisse.'),
  ('10000000-0000-0000-0000-000000000026', 4, 'Ajuster avec un peu d’eau si trop épais.'),
  ('10000000-0000-0000-0000-000000000026', 5, 'Servir frais.'),

  ('10000000-0000-0000-0000-000000000027', 1, 'Peser les noix et les fruits secs.'),
  ('10000000-0000-0000-0000-000000000027', 2, 'Mettre le fromage blanc dans un bol.'),
  ('10000000-0000-0000-0000-000000000027', 3, 'Ajouter noix + fruits secs.'),
  ('10000000-0000-0000-0000-000000000027', 4, 'Mélanger légèrement.'),
  ('10000000-0000-0000-0000-000000000027', 5, 'Servir.'),

  ('10000000-0000-0000-0000-000000000028', 1, 'Couper les champignons et préparer les épinards.'),
  ('10000000-0000-0000-0000-000000000028', 2, 'Battre les oeufs avec sel/poivre.'),
  ('10000000-0000-0000-0000-000000000028', 3, 'Faire revenir champignons + épinards.'),
  ('10000000-0000-0000-0000-000000000028', 4, 'Verser les oeufs et cuire.'),
  ('10000000-0000-0000-0000-000000000028', 5, 'Servir.'),

  ('10000000-0000-0000-0000-000000000029', 1, 'Rincer les légumineuses si besoin.'),
  ('10000000-0000-0000-0000-000000000029', 2, 'Cuire lentilles + pois cassé.'),
  ('10000000-0000-0000-0000-000000000029', 3, 'Ajouter la carotte en morceaux.'),
  ('10000000-0000-0000-0000-000000000029', 4, 'Poursuivre la cuisson jusqu’à tendreté.'),
  ('10000000-0000-0000-0000-000000000029', 5, 'Assaisonner et servir.'),

  ('10000000-0000-0000-0000-000000000030', 1, 'Cuire le riz et réserver.'),
  ('10000000-0000-0000-0000-000000000030', 2, 'Cuire le boeuf 5% à la poêle.'),
  ('10000000-0000-0000-0000-000000000030', 3, 'Couper le poivron en dés.'),
  ('10000000-0000-0000-0000-000000000030', 4, 'Mélanger riz + boeuf + poivron.'),
  ('10000000-0000-0000-0000-000000000030', 5, 'Assaisonner et servir.' )
on conflict do nothing;

delete from public.nutrition_recipe_ingredients
where recipe_id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000009',
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000012',
  '10000000-0000-0000-0000-000000000013',
  '10000000-0000-0000-0000-000000000014',
  '10000000-0000-0000-0000-000000000015',
  '10000000-0000-0000-0000-000000000016',
  '10000000-0000-0000-0000-000000000017',
  '10000000-0000-0000-0000-000000000018',
  '10000000-0000-0000-0000-000000000019',
  '10000000-0000-0000-0000-000000000020',
  '10000000-0000-0000-0000-000000000021',
  '10000000-0000-0000-0000-000000000022',
  '10000000-0000-0000-0000-000000000023',
  '10000000-0000-0000-0000-000000000024',
  '10000000-0000-0000-0000-000000000025',
  '10000000-0000-0000-0000-000000000026',
  '10000000-0000-0000-0000-000000000027',
  '10000000-0000-0000-0000-000000000028',
  '10000000-0000-0000-0000-000000000029',
  '10000000-0000-0000-0000-000000000030'
);

insert into public.nutrition_recipe_ingredients (recipe_id, ingredient_id, quantity_g)
values
  ('10000000-0000-0000-0000-000000000001', (select id from public.nutrition_ingredients where name = 'Poulet'), 180),
  ('10000000-0000-0000-0000-000000000001', (select id from public.nutrition_ingredients where name = 'Riz'), 200),
  ('10000000-0000-0000-0000-000000000001', (select id from public.nutrition_ingredients where name = 'Carotte'), 80),

  ('10000000-0000-0000-0000-000000000002', (select id from public.nutrition_ingredients where name = 'Dinde'), 180),
  ('10000000-0000-0000-0000-000000000002', (select id from public.nutrition_ingredients where name = 'Quinoa'), 180),
  ('10000000-0000-0000-0000-000000000002', (select id from public.nutrition_ingredients where name = 'Poivron'), 80),

  ('10000000-0000-0000-0000-000000000003', (select id from public.nutrition_ingredients where name = 'Saumon'), 160),
  ('10000000-0000-0000-0000-000000000003', (select id from public.nutrition_ingredients where name = 'Patate douce'), 250),
  ('10000000-0000-0000-0000-000000000003', (select id from public.nutrition_ingredients where name = 'Epinards'), 80),

  ('10000000-0000-0000-0000-000000000004', (select id from public.nutrition_ingredients where name = 'Thon'), 160),
  ('10000000-0000-0000-0000-000000000004', (select id from public.nutrition_ingredients where name = 'Pomme de terre'), 250),
  ('10000000-0000-0000-0000-000000000004', (select id from public.nutrition_ingredients where name = 'Poivron'), 80),

  ('10000000-0000-0000-0000-000000000005', (select id from public.nutrition_ingredients where name = 'Poisson blanc'), 200),
  ('10000000-0000-0000-0000-000000000005', (select id from public.nutrition_ingredients where name = 'Riz'), 200),
  ('10000000-0000-0000-0000-000000000005', (select id from public.nutrition_ingredients where name = 'Carotte'), 80),

  ('10000000-0000-0000-0000-000000000006', (select id from public.nutrition_ingredients where name = 'Oeuf'), 150),
  ('10000000-0000-0000-0000-000000000006', (select id from public.nutrition_ingredients where name = 'Epinards'), 80),
  ('10000000-0000-0000-0000-000000000006', (select id from public.nutrition_ingredients where name = 'Champignon'), 80),

  ('10000000-0000-0000-0000-000000000007', (select id from public.nutrition_ingredients where name = 'Fromage blanc'), 250),
  ('10000000-0000-0000-0000-000000000007', (select id from public.nutrition_ingredients where name = 'Banane'), 120),
  ('10000000-0000-0000-0000-000000000007', (select id from public.nutrition_ingredients where name = 'Noix'), 15),

  ('10000000-0000-0000-0000-000000000008', (select id from public.nutrition_ingredients where name = 'Lentille'), 150),
  ('10000000-0000-0000-0000-000000000008', (select id from public.nutrition_ingredients where name = 'Carotte'), 100),
  ('10000000-0000-0000-0000-000000000008', (select id from public.nutrition_ingredients where name = 'Poireaux'), 80),

  ('10000000-0000-0000-0000-000000000009', (select id from public.nutrition_ingredients where name = 'Quinoa'), 200),
  ('10000000-0000-0000-0000-000000000009', (select id from public.nutrition_ingredients where name = 'Poivron'), 80),
  ('10000000-0000-0000-0000-000000000009', (select id from public.nutrition_ingredients where name = 'Champignon'), 80),

  ('10000000-0000-0000-0000-000000000010', (select id from public.nutrition_ingredients where name = 'Pâtes'), 220),
  ('10000000-0000-0000-0000-000000000010', (select id from public.nutrition_ingredients where name = 'Jambon'), 120),
  ('10000000-0000-0000-0000-000000000010', (select id from public.nutrition_ingredients where name = 'Carotte'), 80),

  ('10000000-0000-0000-0000-000000000011', (select id from public.nutrition_ingredients where name = 'Dinde'), 180),
  ('10000000-0000-0000-0000-000000000011', (select id from public.nutrition_ingredients where name = 'Riz'), 200),
  ('10000000-0000-0000-0000-000000000011', (select id from public.nutrition_ingredients where name = 'Champignon'), 100),

  ('10000000-0000-0000-0000-000000000012', (select id from public.nutrition_ingredients where name = 'Poulet'), 180),
  ('10000000-0000-0000-0000-000000000012', (select id from public.nutrition_ingredients where name = 'Patate douce'), 250),
  ('10000000-0000-0000-0000-000000000012', (select id from public.nutrition_ingredients where name = 'Epinards'), 80),

  ('10000000-0000-0000-0000-000000000013', (select id from public.nutrition_ingredients where name = 'Boeuf 5%'), 180),
  ('10000000-0000-0000-0000-000000000013', (select id from public.nutrition_ingredients where name = 'Pomme de terre'), 250),
  ('10000000-0000-0000-0000-000000000013', (select id from public.nutrition_ingredients where name = 'Carotte'), 80),

  ('10000000-0000-0000-0000-000000000014', (select id from public.nutrition_ingredients where name = 'Pois chiche'), 200),
  ('10000000-0000-0000-0000-000000000014', (select id from public.nutrition_ingredients where name = 'Poivron'), 80),
  ('10000000-0000-0000-0000-000000000014', (select id from public.nutrition_ingredients where name = 'Carotte'), 60),

  ('10000000-0000-0000-0000-000000000015', (select id from public.nutrition_ingredients where name = 'Haricot rouge/blanc'), 180),
  ('10000000-0000-0000-0000-000000000015', (select id from public.nutrition_ingredients where name = 'Riz'), 200),
  ('10000000-0000-0000-0000-000000000015', (select id from public.nutrition_ingredients where name = 'Poivron'), 60),

  ('10000000-0000-0000-0000-000000000016', (select id from public.nutrition_ingredients where name = 'Panir'), 150),
  ('10000000-0000-0000-0000-000000000016', (select id from public.nutrition_ingredients where name = 'Quinoa'), 180),
  ('10000000-0000-0000-0000-000000000016', (select id from public.nutrition_ingredients where name = 'Epinards'), 80),

  ('10000000-0000-0000-0000-000000000017', (select id from public.nutrition_ingredients where name = 'Saumon'), 160),
  ('10000000-0000-0000-0000-000000000017', (select id from public.nutrition_ingredients where name = 'Quinoa'), 180),
  ('10000000-0000-0000-0000-000000000017', (select id from public.nutrition_ingredients where name = 'Epinards'), 80),

  ('10000000-0000-0000-0000-000000000018', (select id from public.nutrition_ingredients where name = 'Thon'), 160),
  ('10000000-0000-0000-0000-000000000018', (select id from public.nutrition_ingredients where name = 'Pâtes'), 220),
  ('10000000-0000-0000-0000-000000000018', (select id from public.nutrition_ingredients where name = 'Poivron'), 60),

  ('10000000-0000-0000-0000-000000000019', (select id from public.nutrition_ingredients where name = 'Oeuf'), 150),
  ('10000000-0000-0000-0000-000000000019', (select id from public.nutrition_ingredients where name = 'Pain'), 100),
  ('10000000-0000-0000-0000-000000000019', (select id from public.nutrition_ingredients where name = 'Kiwi'), 120),

  ('10000000-0000-0000-0000-000000000020', (select id from public.nutrition_ingredients where name = 'Fromage blanc'), 250),
  ('10000000-0000-0000-0000-000000000020', (select id from public.nutrition_ingredients where name = 'Pomme'), 150),
  ('10000000-0000-0000-0000-000000000020', (select id from public.nutrition_ingredients where name = 'Noix'), 15),

  ('10000000-0000-0000-0000-000000000021', (select id from public.nutrition_ingredients where name = 'Poulet'), 180),
  ('10000000-0000-0000-0000-000000000021', (select id from public.nutrition_ingredients where name = 'Lentille corail'), 160),
  ('10000000-0000-0000-0000-000000000021', (select id from public.nutrition_ingredients where name = 'Carotte'), 80),

  ('10000000-0000-0000-0000-000000000022', (select id from public.nutrition_ingredients where name = 'Dinde'), 180),
  ('10000000-0000-0000-0000-000000000022', (select id from public.nutrition_ingredients where name = 'Patate douce'), 250),
  ('10000000-0000-0000-0000-000000000022', (select id from public.nutrition_ingredients where name = 'Haricot'), 80),

  ('10000000-0000-0000-0000-000000000023', (select id from public.nutrition_ingredients where name = 'Poisson blanc'), 200),
  ('10000000-0000-0000-0000-000000000023', (select id from public.nutrition_ingredients where name = 'Pomme de terre'), 250),
  ('10000000-0000-0000-0000-000000000023', (select id from public.nutrition_ingredients where name = 'Poireaux'), 80),

  ('10000000-0000-0000-0000-000000000024', (select id from public.nutrition_ingredients where name = 'Riz'), 220),
  ('10000000-0000-0000-0000-000000000024', (select id from public.nutrition_ingredients where name = 'Haricot'), 100),
  ('10000000-0000-0000-0000-000000000024', (select id from public.nutrition_ingredients where name = 'Carotte'), 80),

  ('10000000-0000-0000-0000-000000000025', (select id from public.nutrition_ingredients where name = 'Pâtes'), 220),
  ('10000000-0000-0000-0000-000000000025', (select id from public.nutrition_ingredients where name = 'Champignon'), 120),
  ('10000000-0000-0000-0000-000000000025', (select id from public.nutrition_ingredients where name = 'Fromage'), 30),

  ('10000000-0000-0000-0000-000000000026', (select id from public.nutrition_ingredients where name = 'Lait soja'), 300),
  ('10000000-0000-0000-0000-000000000026', (select id from public.nutrition_ingredients where name = 'Banane'), 150),
  ('10000000-0000-0000-0000-000000000026', (select id from public.nutrition_ingredients where name = 'Prot'), 30),

  ('10000000-0000-0000-0000-000000000027', (select id from public.nutrition_ingredients where name = 'Noix'), 30),
  ('10000000-0000-0000-0000-000000000027', (select id from public.nutrition_ingredients where name = 'Fruit sec'), 40),
  ('10000000-0000-0000-0000-000000000027', (select id from public.nutrition_ingredients where name = 'Fromage blanc'), 200),

  ('10000000-0000-0000-0000-000000000028', (select id from public.nutrition_ingredients where name = 'Oeuf'), 150),
  ('10000000-0000-0000-0000-000000000028', (select id from public.nutrition_ingredients where name = 'Champignon'), 120),
  ('10000000-0000-0000-0000-000000000028', (select id from public.nutrition_ingredients where name = 'Epinards'), 80),

  ('10000000-0000-0000-0000-000000000029', (select id from public.nutrition_ingredients where name = 'Lentille'), 150),
  ('10000000-0000-0000-0000-000000000029', (select id from public.nutrition_ingredients where name = 'Pois cassé'), 150),
  ('10000000-0000-0000-0000-000000000029', (select id from public.nutrition_ingredients where name = 'Carotte'), 80),

  ('10000000-0000-0000-0000-000000000030', (select id from public.nutrition_ingredients where name = 'Boeuf 5%'), 180),
  ('10000000-0000-0000-0000-000000000030', (select id from public.nutrition_ingredients where name = 'Riz'), 200),
  ('10000000-0000-0000-0000-000000000030', (select id from public.nutrition_ingredients where name = 'Poivron'), 80)
on conflict do nothing;

insert into public.nutrition_client_recipe_assignments (client_id, recipe_id)
values
  ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000003'),
  ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000006'),
  ('22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000002'),
  ('22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000004'),
  ('22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000010'),
  ('33333333-3333-3333-3333-333333333333', '10000000-0000-0000-0000-000000000008'),
  ('33333333-3333-3333-3333-333333333333', '10000000-0000-0000-0000-000000000009'),
  ('44444444-4444-4444-4444-444444444444', '10000000-0000-0000-0000-000000000005'),
  ('44444444-4444-4444-4444-444444444444', '10000000-0000-0000-0000-000000000013'),
  ('55555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000007'),
  ('55555555-5555-5555-5555-555555555555', '10000000-0000-0000-0000-000000000020')
on conflict do nothing;

-- Shared client messages
insert into public.demo_messages (conversation_id, owner_coach_id, sender, body, created_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'client', 'Salut coach ! Je commence aujourd''hui, tu me conseilles quoi pour l''échauffement ?', now() - interval '3 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'coach', 'Top ! 8-10 min : rameur léger + mobilité épaules/hanches + 2 séries de montée progressive sur ton 1er exo.', now() - interval '3 days' + interval '20 minutes'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'client', 'Ok super, je fais ça. Merci !', now() - interval '3 days' + interval '45 minutes'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'client', 'J''ai un peu mal aux épaules sur le développé incliné, c''est normal ?', now() - interval '2 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'coach', 'Légère gêne ok, douleur non. Baisse la charge, serre les omoplates, et si ça persiste on passe sur haltères ou machine.', now() - interval '2 days' + interval '25 minutes'),

  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'client', 'Hello ! Je peux remplacer le tirage horizontal par un autre exo ?', now() - interval '4 days'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'coach', 'Oui : rowing barre, rowing haltère unilatéral ou tirage poulie basse neutre. Garde 3-4x8-12 et contrôle.', now() - interval '4 days' + interval '15 minutes'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'client', 'Parfait je vais faire le rowing haltère 👍', now() - interval '4 days' + interval '40 minutes'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'client', 'Je me sens fatigué cette semaine, je baisse les charges ?', now() - interval '1 days'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'coach', 'Oui, fais une semaine plus légère : -10/15% de charge OU 1 série en moins. Priorité au sommeil et à la technique.', now() - interval '1 days' + interval '30 minutes'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, 'client', 'Ok je deload et je te tiens au courant.', now() - interval '1 days' + interval '55 minutes'),

  ('cccccccc-cccc-cccc-cccc-cccccccccccc', null, 'client', 'Je suis motivée ! On vise combien de séances par semaine ?', now() - interval '5 days'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', null, 'coach', 'On part sur 3 séances/semaine. Si tu récupères bien au bout de 2 semaines, on pourra passer à 4.', now() - interval '5 days' + interval '35 minutes'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', null, 'client', 'Carré, je bloque mes créneaux.', now() - interval '5 days' + interval '55 minutes'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', null, 'client', 'Tu préfères que je note mes perfs où ?', now() - interval '2 days'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', null, 'coach', 'Dans l''app si possible (poids/répétitions/RPE). Sinon notes sur ton tel et tu me fais un récap en fin de semaine.', now() - interval '2 days' + interval '10 minutes'),

  ('dddddddd-dddd-dddd-dddd-dddddddddddd', null, 'client', 'Je peux faire la séance demain matin au lieu de ce soir ?', now() - interval '3 days'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', null, 'coach', 'Oui aucun souci. Essaie juste de garder au moins 24h avant la prochaine séance jambes.', now() - interval '3 days' + interval '12 minutes'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', null, 'client', 'Parfait, merci coach.', now() - interval '3 days' + interval '28 minutes'),

  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', null, 'client', 'Je pars en déplacement, tu as une séance “sans matériel” ?', now() - interval '6 days'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', null, 'coach', 'Oui : 4 tours (squat, pompes, fentes, gainage) + 10-15 min de marche rapide. Je te détaille si tu veux.', now() - interval '6 days' + interval '18 minutes'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', null, 'client', 'Yes envoie le détail stp 🙏', now() - interval '6 days' + interval '40 minutes')
;

-- Shared demo calendar events
insert into public.calendar_events (owner_coach_id, client_id, type, title, start_at, end_at, notes)
values
  (null, '11111111-1111-1111-1111-111111111111', 'in_person', 'Séance présentiel — Sarah Martin', now() + interval '2 days', now() + interval '2 days' + interval '1 hour', 'Focus technique + mobilité.'),
  (null, '22222222-2222-2222-2222-222222222222', 'in_person', 'Séance présentiel — Mehdi Benali', now() + interval '4 days', now() + interval '4 days' + interval '1 hour', 'Upper body léger.'),

  (null, '33333333-3333-3333-3333-333333333333', 'in_person', 'Séance présentiel — Camille Dubois', '2026-04-01T08:30:00+02:00', '2026-04-01T09:30:00+02:00', 'Full body + technique.'),
  (null, '11111111-1111-1111-1111-111111111111', 'in_person', 'Séance présentiel — Sarah Martin', '2026-04-02T18:00:00+02:00', '2026-04-02T19:00:00+02:00', 'Haut du corps + gainage.'),
  (null, '22222222-2222-2222-2222-222222222222', 'in_person', 'Séance présentiel — Mehdi Benali', '2026-04-03T12:15:00+02:00', '2026-04-03T13:00:00+02:00', 'Séance courte, focus technique.'),
  (null, '44444444-4444-4444-4444-444444444444', 'in_person', 'Séance présentiel — Lucas Morel', '2026-04-04T10:00:00+02:00', '2026-04-04T11:00:00+02:00', 'Jambes + mobilité hanches.'),
  (null, '55555555-5555-5555-5555-555555555555', 'in_person', 'Séance présentiel — Nina Garcia', '2026-04-05T09:00:00+02:00', '2026-04-05T10:00:00+02:00', 'Circuit sans matériel.'),
  (null, '33333333-3333-3333-3333-333333333333', 'in_person', 'Séance présentiel — Camille Dubois', '2026-04-07T19:00:00+02:00', '2026-04-07T20:00:00+02:00', 'Progression sur les charges.'),
  (null, '11111111-1111-1111-1111-111111111111', 'in_person', 'Séance présentiel — Sarah Martin', '2026-04-08T07:45:00+02:00', '2026-04-08T08:45:00+02:00', 'Échauffement + technique épaules.'),
  (null, '22222222-2222-2222-2222-222222222222', 'in_person', 'Séance présentiel — Mehdi Benali', '2026-04-09T18:30:00+02:00', '2026-04-09T19:30:00+02:00', 'Deload contrôlé.'),
  (null, '44444444-4444-4444-4444-444444444444', 'in_person', 'Séance présentiel — Lucas Morel', '2026-04-10T08:00:00+02:00', '2026-04-10T09:00:00+02:00', 'Technique squat + gainage.'),
  (null, '33333333-3333-3333-3333-333333333333', 'in_person', 'Séance présentiel — Camille Dubois', '2026-04-14T12:00:00+02:00', '2026-04-14T13:00:00+02:00', 'Full body + cardio léger.'),
  (null, '11111111-1111-1111-1111-111111111111', 'in_person', 'Séance présentiel — Sarah Martin', '2026-04-16T18:15:00+02:00', '2026-04-16T19:15:00+02:00', 'Incliné haltères + dos.'),
  (null, '22222222-2222-2222-2222-222222222222', 'in_person', 'Séance présentiel — Mehdi Benali', '2026-04-18T10:30:00+02:00', '2026-04-18T11:30:00+02:00', 'Upper body + posture.'),
  (null, '44444444-4444-4444-4444-444444444444', 'in_person', 'Séance présentiel — Lucas Morel', '2026-04-21T19:15:00+02:00', '2026-04-21T20:15:00+02:00', 'Jambes : volume modéré.'),
  (null, '55555555-5555-5555-5555-555555555555', 'in_person', 'Séance présentiel — Nina Garcia', '2026-04-24T08:45:00+02:00', '2026-04-24T09:45:00+02:00', 'Renfo + mobilité dos.'),
  (null, '33333333-3333-3333-3333-333333333333', 'in_person', 'Séance présentiel — Camille Dubois', '2026-04-27T18:00:00+02:00', '2026-04-27T19:00:00+02:00', 'Bilan mensuel + ajustements.')
;
