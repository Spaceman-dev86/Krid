-- =============================================================================
-- TRANCHE 03 — Clients CRM (sans grants / prestations)
-- Prérequis : 01 + 02 OK
-- Après Run : dis « 03 OK » → code liste / fiche clients
-- =============================================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  first_name text,
  last_name text,
  phone text,
  sex text,
  birth_date date,
  weight_kg numeric,
  height_cm numeric,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'archived')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists clients_coach_id_idx on public.clients (coach_id)
  where deleted_at is null;
create index if not exists clients_user_id_idx on public.clients (user_id)
  where user_id is not null and deleted_at is null;
create unique index if not exists clients_coach_email_uidx
  on public.clients (coach_id, lower(email))
  where deleted_at is null;

alter table public.clients enable row level security;

drop policy if exists "clients_coach_all" on public.clients;
create policy "clients_coach_all"
on public.clients for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "clients_self_select" on public.clients;
create policy "clients_self_select"
on public.clients for select to authenticated
using (user_id = auth.uid());

drop policy if exists "clients_self_update" on public.clients;
create policy "clients_self_update"
on public.clients for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.clients c
  where c.user_id = auth.uid()
    and c.deleted_at is null
  order by c.created_at desc nulls last
  limit 1;
$$;

grant execute on function public.current_client_id() to authenticated, anon;

-- Coach voit les profiles liés à ses clients
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.clients c
    where c.coach_id = auth.uid()
      and c.user_id = profiles.id
      and c.deleted_at is null
  )
);

create table if not exists public.client_groups (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null default 'manual'
    check (type in ('auto', 'manual')),
  prestation_id uuid,
  chat_enabled boolean not null default false,
  drive_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists client_groups_coach_id_idx on public.client_groups (coach_id);

create table if not exists public.client_group_members (
  group_id uuid not null references public.client_groups(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, client_id)
);

alter table public.client_groups enable row level security;
alter table public.client_group_members enable row level security;

-- Helpers anti-récursion RLS (groups ↔ members)
create or replace function public.is_client_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_group_members m
    join public.clients c on c.id = m.client_id
    where m.group_id = p_group_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
  );
$$;

create or replace function public.owns_client_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_groups g
    where g.id = p_group_id
      and (g.coach_id = auth.uid() or public.is_platform_admin())
  );
$$;

grant execute on function public.is_client_group_member(uuid) to authenticated, anon;
grant execute on function public.owns_client_group(uuid) to authenticated, anon;

drop policy if exists "client_groups_coach_all" on public.client_groups;
create policy "client_groups_coach_all"
on public.client_groups for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "client_groups_member_select" on public.client_groups;
create policy "client_groups_member_select"
on public.client_groups for select to authenticated
using (public.is_client_group_member(id));

drop policy if exists "client_group_members_coach_all" on public.client_group_members;
create policy "client_group_members_coach_all"
on public.client_group_members for all to authenticated
using (public.owns_client_group(group_id))
with check (public.owns_client_group(group_id));

drop policy if exists "client_group_members_self_select" on public.client_group_members;
create policy "client_group_members_self_select"
on public.client_group_members for select to authenticated
using (
  client_id in (select id from public.clients where user_id = auth.uid() and deleted_at is null)
);

create table if not exists public.coach_onboarding_questions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  type text not null default 'texte'
    check (type in ('texte', 'nombre', 'choix', 'oui_non')),
  required boolean not null default false,
  sort_order integer not null default 0,
  options jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.coach_onboarding_questions(id) on delete cascade,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  unique (client_id, question_id)
);

alter table public.coach_onboarding_questions enable row level security;
alter table public.onboarding_answers enable row level security;

drop policy if exists "onboarding_q_coach_all" on public.coach_onboarding_questions;
create policy "onboarding_q_coach_all"
on public.coach_onboarding_questions for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "onboarding_q_client_select" on public.coach_onboarding_questions;
create policy "onboarding_q_client_select"
on public.coach_onboarding_questions for select to authenticated
using (
  coach_id in (
    select c.coach_id from public.clients c
    where c.user_id = auth.uid() and c.deleted_at is null
  )
);

drop policy if exists "onboarding_a_coach_select" on public.onboarding_answers;
create policy "onboarding_a_coach_select"
on public.onboarding_answers for select to authenticated
using (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "onboarding_a_client_crud" on public.onboarding_answers;
create policy "onboarding_a_client_crud"
on public.onboarding_answers for all to authenticated
using (
  client_id in (select id from public.clients where user_id = auth.uid() and deleted_at is null)
)
with check (
  client_id in (select id from public.clients where user_id = auth.uid() and deleted_at is null)
);

insert into public.schema_migrations_trainly (id)
values ('03_clients')
on conflict (id) do nothing;
