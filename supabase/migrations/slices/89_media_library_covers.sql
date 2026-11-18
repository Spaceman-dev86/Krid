-- =============================================================================
-- TRANCHE 89 — Banque d’images covers (plateforme)
-- Usage : showroom cover · covers programmes (référence URL, pas de copie)
-- Après Run : upload les images dans le bucket puis insert des rows.
-- Dis « 89 OK »
-- =============================================================================

-- Bucket public (lecture coach / showroom) — écriture manuelle ou admin
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media-library',
  'media-library',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media_library_storage_public_select" on storage.objects;
create policy "media_library_storage_public_select"
on storage.objects for select
to public
using (bucket_id = 'media-library');

drop policy if exists "media_library_storage_admin_insert" on storage.objects;
create policy "media_library_storage_admin_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'media-library'
  and public.is_platform_admin()
);

drop policy if exists "media_library_storage_admin_update" on storage.objects;
create policy "media_library_storage_admin_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'media-library'
  and public.is_platform_admin()
)
with check (
  bucket_id = 'media-library'
  and public.is_platform_admin()
);

drop policy if exists "media_library_storage_admin_delete" on storage.objects;
create policy "media_library_storage_admin_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'media-library'
  and public.is_platform_admin()
);

create table if not exists public.media_library (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'cover'
    check (kind in ('cover')),
  -- Chemin dans le bucket, ex. covers/fitness/01.webp
  storage_path text not null unique,
  label text,
  category text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.media_library is
  'Catalogue covers libres de droit (bucket media-library) — référence URL côté coach';
comment on column public.media_library.storage_path is
  'Path objet Storage dans media-library (sans préfixe bucket)';

create index if not exists media_library_kind_active_sort_idx
  on public.media_library (kind, active, sort_order);

alter table public.media_library enable row level security;

drop policy if exists "media_library_select_active" on public.media_library;
create policy "media_library_select_active"
on public.media_library for select
to authenticated
using (active = true or public.is_platform_admin());

drop policy if exists "media_library_admin_write" on public.media_library;
create policy "media_library_admin_write"
on public.media_library for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

insert into public.schema_migrations_trainly (id)
values ('89_media_library_covers')
on conflict (id) do nothing;

-- Exemple d’insert après upload Storage (à adapter) :
-- insert into public.media_library (kind, storage_path, label, category, sort_order)
-- values ('cover', 'covers/fitness/01.webp', 'Salle · haltères', 'fitness', 10);
