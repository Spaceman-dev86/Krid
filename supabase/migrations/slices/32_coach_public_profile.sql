-- =============================================================================
-- TRANCHE 32 — Profil public éditorial (showroom ≠ logo / app_name PWA)
-- Prérequis : 02_coach_tenancy, 31_coach_branding_storage
-- Après Run : dis « 32 OK »
-- =============================================================================

create table if not exists public.coach_public_profile (
  coach_id uuid primary key references public.profiles(id) on delete cascade,
  public_name text,
  tagline text,
  bio text,
  photo_url text,
  cover_url text,
  share_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_public_profile enable row level security;

drop policy if exists "coach_public_profile_select_public" on public.coach_public_profile;
create policy "coach_public_profile_select_public"
on public.coach_public_profile for select
to anon, authenticated
using (true);

drop policy if exists "coach_public_profile_coach_write" on public.coach_public_profile;
create policy "coach_public_profile_coach_write"
on public.coach_public_profile for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- Médias showroom (photo / cover) — bucket public séparé du logo PWA
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-showroom',
  'coach-showroom',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "coach_showroom_storage_public_select" on storage.objects;
create policy "coach_showroom_storage_public_select"
on storage.objects for select
to public
using (bucket_id = 'coach-showroom');

drop policy if exists "coach_showroom_storage_coach_insert" on storage.objects;
create policy "coach_showroom_storage_coach_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'coach-showroom'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "coach_showroom_storage_coach_update" on storage.objects;
create policy "coach_showroom_storage_coach_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'coach-showroom'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'coach-showroom'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "coach_showroom_storage_coach_delete" on storage.objects;
create policy "coach_showroom_storage_coach_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'coach-showroom'
  and (storage.foldername(name))[1] = auth.uid()::text
);

insert into public.schema_migrations_trainly (id)
values ('32_coach_public_profile')
on conflict (id) do nothing;
