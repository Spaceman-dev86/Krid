-- =============================================================================
-- TRANCHE 34 — Admin coaches ops + SAV admin-initiated + unread badges
-- Prérequis : 33_support_tickets
-- =============================================================================

-- Suspend + notes internes admin (fiche coach)
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists admin_notes text;

comment on column public.profiles.suspended_at is 'Si non null, login coach bloqué (admin suspend)';
comment on column public.profiles.admin_notes is 'Notes internes admin — jamais visibles coach';

-- SAV : qui a ouvert le ticket + curseurs de lecture (badges)
alter table public.support_tickets
  add column if not exists opened_by text not null default 'coach'
    check (opened_by in ('coach', 'admin')),
  add column if not exists coach_last_read_at timestamptz,
  add column if not exists admin_last_read_at timestamptz;

-- Admin peut créer un ticket pour un coach
drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
for insert to authenticated
with check (
  (coach_id = auth.uid() and opened_by = 'coach')
  or (public.is_platform_admin() and opened_by = 'admin')
);

-- Biblio Drive Trainly (packs admin → coaches, download-only côté coach plus tard)
create table if not exists public.trainly_drive_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_path text,
  published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainly_drive_library_published_idx
  on public.trainly_drive_library (published, created_at desc);

alter table public.trainly_drive_library enable row level security;

drop policy if exists trainly_drive_library_admin_all on public.trainly_drive_library;
create policy trainly_drive_library_admin_all on public.trainly_drive_library
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists trainly_drive_library_coach_read_published on public.trainly_drive_library;
create policy trainly_drive_library_coach_read_published on public.trainly_drive_library
for select to authenticated
using (published = true);

insert into public.schema_migrations_trainly (id)
values ('34_admin_coaches_ops')
on conflict (id) do nothing;
