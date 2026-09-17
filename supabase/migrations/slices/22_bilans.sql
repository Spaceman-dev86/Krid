-- =============================================================================
-- TRANCHE 22 — Bilans (templates · instances · photos storage)
-- Prérequis : 03_clients (+ 04 is_my_client_row) · 03b groupes (option envoi)
-- Après Run : dis « 22 OK »
-- =============================================================================
-- Périmètre MVP :
--   • bilan_templates (schema jsonb : photos / mensurations / questions)
--   • bilan_instances (snapshot schéma + payload réponse · J+14 lock)
--   • bilan_recurrences (config série — 1ʳᵉ instance à l’envoi ; cron later)
--   • notifications (minimal, pour soumission → coach ; cloche UI hors V1)
--   • bucket privé « bilans »
-- Hors scope V1 UI : onglet Notifications coach · cron récurrence auto
-- =============================================================================

create table if not exists public.bilan_templates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  instructions text,
  -- { photos: bool, measurements: [{id,label,unit}], questions: [{id,label,type}] }
  schema jsonb not null default '{"photos":false,"measurements":[],"questions":[]}'::jsonb,
  status text not null default 'ready'
    check (status in ('draft', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists bilan_templates_coach_idx
  on public.bilan_templates (coach_id)
  where deleted_at is null;

alter table public.bilan_templates enable row level security;

drop policy if exists "bilan_templates_coach_all" on public.bilan_templates;
create policy "bilan_templates_coach_all"
on public.bilan_templates for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- -----------------------------------------------------------------------------

create table if not exists public.bilan_recurrences (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.bilan_templates(id) on delete cascade,
  -- clients et/ou groupes ciblés à chaque occurrence
  client_ids uuid[] not null default '{}',
  group_ids uuid[] not null default '{}',
  -- null = une seule fois ; sinon jour du mois 1–28
  day_of_month int check (day_of_month is null or (day_of_month >= 1 and day_of_month <= 28)),
  active boolean not null default true,
  next_appears_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bilan_recurrences_coach_idx
  on public.bilan_recurrences (coach_id)
  where active = true;

alter table public.bilan_recurrences enable row level security;

drop policy if exists "bilan_recurrences_coach_all" on public.bilan_recurrences;
create policy "bilan_recurrences_coach_all"
on public.bilan_recurrences for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- -----------------------------------------------------------------------------

create table if not exists public.bilan_instances (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  template_id uuid references public.bilan_templates(id) on delete set null,
  recurrence_id uuid references public.bilan_recurrences(id) on delete set null,
  title text not null,
  -- schéma figé à la création
  schema_snapshot jsonb not null default '{"photos":false,"measurements":[],"questions":[]}'::jsonb,
  -- réponses client : { measurements:{}, questions:{}, photos:[{path,label?}] }
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'waiting'
    check (status in ('waiting', 'in_progress', 'submitted', 'no_response')),
  appears_at timestamptz not null default now(),
  due_at timestamptz not null,
  submitted_at timestamptz,
  client_opened_at timestamptz,
  coach_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bilan_instances_coach_idx
  on public.bilan_instances (coach_id, created_at desc);

create index if not exists bilan_instances_client_idx
  on public.bilan_instances (client_id, appears_at desc);

create index if not exists bilan_instances_status_idx
  on public.bilan_instances (coach_id, status);

alter table public.bilan_instances enable row level security;

drop policy if exists "bilan_instances_coach_all" on public.bilan_instances;
create policy "bilan_instances_coach_all"
on public.bilan_instances for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "bilan_instances_client_select" on public.bilan_instances;
create policy "bilan_instances_client_select"
on public.bilan_instances for select to authenticated
using (
  public.is_my_client_row(client_id)
  and appears_at <= now()
);

drop policy if exists "bilan_instances_client_update" on public.bilan_instances;
create policy "bilan_instances_client_update"
on public.bilan_instances for update to authenticated
using (
  public.is_my_client_row(client_id)
  and appears_at <= now()
  and status in ('waiting', 'in_progress')
  and due_at >= now()
)
with check (
  public.is_my_client_row(client_id)
);

-- -----------------------------------------------------------------------------
-- Notifications (table prête ; cloche UI hors V1)
-- -----------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text,
  body text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own"
on public.notifications for all to authenticated
using (user_id = auth.uid() or public.is_platform_admin())
with check (user_id = auth.uid() or public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- Storage bucket bilans
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bilans',
  'bilans',
  false,
  20971520, -- 20 Mo
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bilans_storage_coach" on storage.objects;
create policy "bilans_storage_coach"
on storage.objects for all to authenticated
using (
  bucket_id = 'bilans'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_platform_admin()
  )
)
with check (
  bucket_id = 'bilans'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Client : lecture / upload sur chemins d’instances qui lui appartiennent
-- path = coach_id / instance_id / …
drop policy if exists "bilans_storage_client" on storage.objects;
create policy "bilans_storage_client"
on storage.objects for all to authenticated
using (
  bucket_id = 'bilans'
  and exists (
    select 1
    from public.bilan_instances i
    where i.id::text = (storage.foldername(name))[2]
      and public.is_my_client_row(i.client_id)
  )
)
with check (
  bucket_id = 'bilans'
  and exists (
    select 1
    from public.bilan_instances i
    where i.id::text = (storage.foldername(name))[2]
      and public.is_my_client_row(i.client_id)
      and i.status in ('waiting', 'in_progress')
      and i.due_at >= now()
  )
);

comment on table public.bilan_templates is 'Modèles de bilan coach · schema jsonb';
comment on table public.bilan_instances is 'Instances envoyées · schéma figé · payload client';
comment on table public.bilan_recurrences is 'Séries périodiques · cron génération later';

insert into public.schema_migrations_trainly (id)
values ('22_bilans')
on conflict (id) do nothing;
