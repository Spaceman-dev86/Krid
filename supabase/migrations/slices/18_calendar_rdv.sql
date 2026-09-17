-- =============================================================================
-- TRANCHE 18 — Calendrier RDV (1:1)
-- Prérequis : 03_clients (+ 16_chat recommandé pour tag message)
-- Après Run : dis « 18 OK »
-- =============================================================================
-- Périmètre V1 :
--   • calendar_events coach↔client (1:1)
--   • status : requested | pending | accepted | refused | cancelled
--   • RLS coach own · client own
-- Hors scope : groupes RDV · Google Calendar · notifs cloche matérialisées
-- =============================================================================

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null default 'RDV',
  starts_at timestamptz,
  ends_at timestamptz,
  modality text
    check (modality is null or modality in ('physique', 'visio')),
  location text,
  status text not null default 'pending'
    check (status in ('requested', 'pending', 'accepted', 'refused', 'cancelled')),
  notes text,
  client_message text,
  created_by text not null default 'coach'
    check (created_by in ('coach', 'client')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists calendar_events_coach_starts_idx
  on public.calendar_events (coach_id, starts_at)
  where deleted_at is null;

create index if not exists calendar_events_client_status_idx
  on public.calendar_events (client_id, status)
  where deleted_at is null;

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_coach_all" on public.calendar_events;
create policy "calendar_events_coach_all"
on public.calendar_events for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "calendar_events_client_select" on public.calendar_events;
create policy "calendar_events_client_select"
on public.calendar_events for select to authenticated
using (public.is_my_client_row(client_id) and deleted_at is null);

drop policy if exists "calendar_events_client_insert_request" on public.calendar_events;
create policy "calendar_events_client_insert_request"
on public.calendar_events for insert to authenticated
with check (
  public.is_my_client_row(client_id)
  and created_by = 'client'
  and status = 'requested'
  and coach_id = (
    select c.coach_id from public.clients c where c.id = client_id
  )
);

drop policy if exists "calendar_events_client_respond" on public.calendar_events;
create policy "calendar_events_client_respond"
on public.calendar_events for update to authenticated
using (public.is_my_client_row(client_id) and deleted_at is null)
with check (public.is_my_client_row(client_id));

comment on table public.calendar_events is
  'RDV 1:1 · requested=demande client (créneau proposé, coach Accept/Refuse) · pending=proposition coach · accepted|refused|cancelled';

-- Tag message chat (demande RDV) — colonne optionnelle si slice 16 déjà appliqué
alter table public.chat_messages
  add column if not exists tag text;

comment on column public.chat_messages.tag is
  'prise_de_rdv · autres tags métier (nullable)';

insert into public.schema_migrations_trainly (id)
values ('18_calendar_rdv')
on conflict (id) do nothing;
