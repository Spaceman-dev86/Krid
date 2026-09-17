-- =============================================================================
-- TRANCHE 33 — Support tickets (SAV admin ↔ coach)
-- Spec : /admin/spec → Admin · SAV
-- =============================================================================

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  category text not null default 'autre'
    check (category in ('bug', 'billing', 'compte', 'produit', 'autre')),
  status text not null default 'nouveau'
    check (status in ('nouveau', 'en_cours', 'attente_coach', 'resolu')),
  subject text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_coach_idx on public.support_tickets (coach_id, created_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  sender_role text not null check (sender_role in ('coach', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
for select to authenticated
using (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
for insert to authenticated
with check (coach_id = auth.uid());

drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets
for update to authenticated
using (public.is_platform_admin() or coach_id = auth.uid())
with check (public.is_platform_admin() or coach_id = auth.uid());

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and t.coach_id = auth.uid()
  )
);

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    (sender_role = 'admin' and public.is_platform_admin())
    or (
      sender_role = 'coach'
      and exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.coach_id = auth.uid()
      )
    )
  )
);
