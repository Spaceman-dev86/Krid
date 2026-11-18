-- =============================================================================
-- TRANCHE 61 — Documentation unifiée (dossiers + items)
-- Hub admin /admin/documentation · coach /documentation
-- Seed système : Formation · Contenu KRID
-- Migre trainly_formation_items + trainly_drive_library
-- =============================================================================

alter table public.trainly_formation_items
  add column if not exists allow_duplicate boolean not null default true;

create table if not exists public.documentation_folders (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  sort_order int not null default 100,
  is_system boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documentation_folders_slug_ck check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index if not exists documentation_folders_sort_idx
  on public.documentation_folders (sort_order, title);

create table if not exists public.documentation_items (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.documentation_folders (id) on delete cascade,
  title text not null,
  description text,
  media_type text not null check (media_type in ('pdf', 'video', 'image')),
  storage_bucket text not null check (storage_bucket in ('trainly-formation', 'trainly-library')),
  file_path text,
  mime_type text,
  size_bytes bigint,
  original_name text,
  allow_duplicate boolean not null default true,
  published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documentation_items_folder_idx
  on public.documentation_items (folder_id, published, created_at desc);

create index if not exists documentation_items_published_idx
  on public.documentation_items (published, created_at desc);

alter table public.documentation_folders enable row level security;
alter table public.documentation_items enable row level security;

drop policy if exists documentation_folders_admin_all on public.documentation_folders;
create policy documentation_folders_admin_all on public.documentation_folders
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists documentation_folders_coach_read on public.documentation_folders;
create policy documentation_folders_coach_read on public.documentation_folders
for select to authenticated
using (true);

drop policy if exists documentation_items_admin_all on public.documentation_items;
create policy documentation_items_admin_all on public.documentation_items
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists documentation_items_coach_read_published on public.documentation_items;
create policy documentation_items_coach_read_published on public.documentation_items
for select to authenticated
using (published = true);

-- Seed dossiers système (ids stables)
insert into public.documentation_folders (id, slug, title, description, sort_order, is_system)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'formation',
    'Formation',
    'Guides, vidéos et supports de formation Trainly',
    10,
    true
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'contenu-krid',
    'Contenu KRID',
    'Documents plateforme KRID publiés par l’admin',
    20,
    true
  )
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_system = true,
  updated_at = now();

-- Migrate formation → documentation_items
insert into public.documentation_items (
  id, folder_id, title, description, media_type, storage_bucket,
  file_path, mime_type, size_bytes, original_name, allow_duplicate, published,
  created_by, created_at, updated_at
)
select
  f.id,
  'a0000000-0000-4000-8000-000000000001'::uuid,
  f.title,
  f.description,
  f.media_type,
  'trainly-formation',
  f.file_path,
  f.mime_type,
  f.size_bytes,
  f.original_name,
  coalesce(f.allow_duplicate, true),
  f.published,
  f.created_by,
  f.created_at,
  f.updated_at
from public.trainly_formation_items f
on conflict (id) do nothing;

-- Migrate drive library → Contenu KRID
insert into public.documentation_items (
  id, folder_id, title, description, media_type, storage_bucket,
  file_path, mime_type, size_bytes, original_name, allow_duplicate, published,
  created_by, created_at, updated_at
)
select
  d.id,
  'a0000000-0000-4000-8000-000000000002'::uuid,
  d.title,
  d.description,
  'pdf',
  'trainly-library',
  d.file_path,
  coalesce(d.mime_type, 'application/pdf'),
  d.size_bytes,
  d.original_name,
  coalesce(d.allow_duplicate, true),
  d.published,
  d.created_by,
  d.created_at,
  coalesce(d.updated_at, d.created_at)
from public.trainly_drive_library d
on conflict (id) do nothing;

-- Storage : lecture coach si item publié (les deux buckets)
drop policy if exists "trainly_library_coach_select_published" on storage.objects;
create policy "trainly_library_coach_select_published"
on storage.objects for select to authenticated
using (
  bucket_id = 'trainly-library'
  and (
    exists (
      select 1 from public.documentation_items I
      where I.file_path = name
        and I.storage_bucket = 'trainly-library'
        and I.published = true
    )
    or exists (
      select 1 from public.trainly_drive_library L
      where L.file_path = name and L.published = true
    )
  )
);

drop policy if exists "trainly_formation_coach_select_published" on storage.objects;
create policy "trainly_formation_coach_select_published"
on storage.objects for select to authenticated
using (
  bucket_id = 'trainly-formation'
  and (
    exists (
      select 1 from public.documentation_items I
      where I.file_path = name
        and I.storage_bucket = 'trainly-formation'
        and I.published = true
    )
    or exists (
      select 1 from public.trainly_formation_items F
      where F.file_path = name and F.published = true
    )
  )
);

insert into public.schema_migrations_trainly (id)
values ('61_documentation_folders')
on conflict (id) do nothing;
