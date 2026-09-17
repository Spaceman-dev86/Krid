-- =============================================================================
-- TRANCHE 35 — Drive biblio flags · Formation · SAV pièces jointes · buckets
-- Prérequis : 33_support_tickets · 34_admin_coaches_ops
-- Spec : /admin/spec → Admin Drive / Formation / SAV (décisions 2026-03-13)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- trainly_drive_library : droits duplicable / téléchargeable
-- -----------------------------------------------------------------------------

alter table public.trainly_drive_library
  add column if not exists allow_duplicate boolean not null default true,
  add column if not exists allow_download boolean not null default true,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists original_name text;

comment on column public.trainly_drive_library.allow_duplicate is
  'Coach peut récupérer une copie dans son Drive (compte quota)';
comment on column public.trainly_drive_library.allow_download is
  'Coach peut télécharger le fichier';

-- -----------------------------------------------------------------------------
-- Formation (lecture seule coach)
-- -----------------------------------------------------------------------------

create table if not exists public.trainly_formation_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  media_type text not null check (media_type in ('pdf', 'video', 'image')),
  file_path text,
  mime_type text,
  size_bytes bigint,
  original_name text,
  published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainly_formation_items_published_idx
  on public.trainly_formation_items (published, created_at desc);

alter table public.trainly_formation_items enable row level security;

drop policy if exists trainly_formation_admin_all on public.trainly_formation_items;
create policy trainly_formation_admin_all on public.trainly_formation_items
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists trainly_formation_coach_read_published on public.trainly_formation_items;
create policy trainly_formation_coach_read_published on public.trainly_formation_items
for select to authenticated
using (published = true);

-- -----------------------------------------------------------------------------
-- SAV : pièces jointes sur messages
-- -----------------------------------------------------------------------------

alter table public.support_messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text;

-- body peut être court si PJ seule — garder not null, app envoie un placeholder si besoin

-- -----------------------------------------------------------------------------
-- Storage buckets
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trainly-library',
  'trainly-library',
  false,
  52428800, -- 50 Mo PDF
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trainly-formation',
  'trainly-formation',
  false,
  209715200, -- 200 Mo
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  26214400, -- 25 Mo
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- trainly-library policies
drop policy if exists "trainly_library_admin_all" on storage.objects;
create policy "trainly_library_admin_all"
on storage.objects for all to authenticated
using (bucket_id = 'trainly-library' and public.is_platform_admin())
with check (bucket_id = 'trainly-library' and public.is_platform_admin());

drop policy if exists "trainly_library_coach_select_published" on storage.objects;
create policy "trainly_library_coach_select_published"
on storage.objects for select to authenticated
using (
  bucket_id = 'trainly-library'
  and exists (
    select 1 from public.trainly_drive_library L
    where L.file_path = name and L.published = true
  )
);

-- trainly-formation policies
drop policy if exists "trainly_formation_admin_all" on storage.objects;
create policy "trainly_formation_admin_all"
on storage.objects for all to authenticated
using (bucket_id = 'trainly-formation' and public.is_platform_admin())
with check (bucket_id = 'trainly-formation' and public.is_platform_admin());

drop policy if exists "trainly_formation_coach_select_published" on storage.objects;
create policy "trainly_formation_coach_select_published"
on storage.objects for select to authenticated
using (
  bucket_id = 'trainly-formation'
  and exists (
    select 1 from public.trainly_formation_items I
    where I.file_path = name and I.published = true
  )
);

-- support-attachments policies
drop policy if exists "support_att_admin_all" on storage.objects;
create policy "support_att_admin_all"
on storage.objects for all to authenticated
using (bucket_id = 'support-attachments' and public.is_platform_admin())
with check (bucket_id = 'support-attachments' and public.is_platform_admin());

drop policy if exists "support_att_coach_select" on storage.objects;
create policy "support_att_coach_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and exists (
    select 1
    from public.support_messages m
    join public.support_tickets t on t.id = m.ticket_id
    where m.attachment_path = name
      and t.coach_id = auth.uid()
  )
);

drop policy if exists "support_att_coach_insert" on storage.objects;
create policy "support_att_coach_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and exists (
    select 1 from public.support_tickets t
    where t.id::text = (storage.foldername(name))[1]
      and t.coach_id = auth.uid()
  )
);

insert into public.schema_migrations_trainly (id)
values ('35_trainly_library_formation_sav')
on conflict (id) do nothing;
