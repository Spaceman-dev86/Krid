-- =============================================================================
-- TRANCHE 21 — Drive (dossiers · fichiers · partages · bucket)
-- Prérequis : 03_clients (+ 04 is_my_client_row)
-- Après Run : dis « 21 OK »
-- =============================================================================
-- Périmètre MVP :
--   • drive_folders / drive_files / drive_shares
--   • bucket privé « drive » path coach_id/…
--   • RLS coach own · client lecture si partagé
-- Hors scope : quota Settings · biblio Trainly · corbeille UI
-- =============================================================================

create table if not exists public.drive_folders (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.drive_folders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists drive_folders_coach_parent_idx
  on public.drive_folders (coach_id, parent_id)
  where deleted_at is null;

alter table public.drive_folders enable row level security;

drop policy if exists "drive_folders_coach_all" on public.drive_folders;
create policy "drive_folders_coach_all"
on public.drive_folders for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- -----------------------------------------------------------------------------

create table if not exists public.drive_files (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid references public.drive_folders(id) on delete set null,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists drive_files_coach_folder_idx
  on public.drive_files (coach_id, folder_id)
  where deleted_at is null;

alter table public.drive_files enable row level security;

drop policy if exists "drive_files_coach_all" on public.drive_files;
create policy "drive_files_coach_all"
on public.drive_files for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

-- -----------------------------------------------------------------------------

create table if not exists public.drive_shares (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  file_id uuid references public.drive_files(id) on delete cascade,
  folder_id uuid references public.drive_folders(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  group_id uuid references public.client_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint drive_shares_target_chk check (
    (file_id is not null and folder_id is null)
    or (file_id is null and folder_id is not null)
  ),
  constraint drive_shares_audience_chk check (
    (client_id is not null and group_id is null)
    or (client_id is null and group_id is not null)
  )
);

create unique index if not exists drive_shares_file_client_uidx
  on public.drive_shares (file_id, client_id)
  where file_id is not null and client_id is not null;

create unique index if not exists drive_shares_folder_client_uidx
  on public.drive_shares (folder_id, client_id)
  where folder_id is not null and client_id is not null;

create index if not exists drive_shares_client_idx
  on public.drive_shares (client_id)
  where client_id is not null;

alter table public.drive_shares enable row level security;

drop policy if exists "drive_shares_coach_all" on public.drive_shares;
create policy "drive_shares_coach_all"
on public.drive_shares for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "drive_shares_client_select" on public.drive_shares;
create policy "drive_shares_client_select"
on public.drive_shares for select to authenticated
using (
  public.is_my_client_row(client_id)
  or (
    group_id is not null
    and exists (
      select 1
      from public.client_group_members m
      join public.clients c on c.id = m.client_id
      where m.group_id = drive_shares.group_id
        and c.user_id = auth.uid()
        and c.deleted_at is null
    )
  )
);

-- Client lit fichiers partagés (direct ou via dossier)
drop policy if exists "drive_files_client_select_shared" on public.drive_files;
create policy "drive_files_client_select_shared"
on public.drive_files for select to authenticated
using (
  deleted_at is null
  and (
    exists (
      select 1 from public.drive_shares s
      where s.file_id = drive_files.id
        and (
          public.is_my_client_row(s.client_id)
          or (
            s.group_id is not null
            and exists (
              select 1
              from public.client_group_members m
              join public.clients c on c.id = m.client_id
              where m.group_id = s.group_id
                and c.user_id = auth.uid()
                and c.deleted_at is null
            )
          )
        )
    )
    or exists (
      select 1 from public.drive_shares s
      where s.folder_id = drive_files.folder_id
        and drive_files.folder_id is not null
        and (
          public.is_my_client_row(s.client_id)
          or (
            s.group_id is not null
            and exists (
              select 1
              from public.client_group_members m
              join public.clients c on c.id = m.client_id
              where m.group_id = s.group_id
                and c.user_id = auth.uid()
                and c.deleted_at is null
            )
          )
        )
    )
  )
);

drop policy if exists "drive_folders_client_select_shared" on public.drive_folders;
create policy "drive_folders_client_select_shared"
on public.drive_folders for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.drive_shares s
    where s.folder_id = drive_folders.id
      and (
        public.is_my_client_row(s.client_id)
        or (
          s.group_id is not null
          and exists (
            select 1
            from public.client_group_members m
            join public.clients c on c.id = m.client_id
            where m.group_id = s.group_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
          )
        )
      )
  )
);

-- -----------------------------------------------------------------------------
-- Storage bucket
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drive',
  'drive',
  false,
  209715200, -- 200 Mo
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'video/mp4', 'video/quicktime',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "drive_storage_coach_select" on storage.objects;
create policy "drive_storage_coach_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'drive'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_platform_admin()
  )
);

-- Client : lecture si le path correspond à un fichier partagé (via signed URL preferred)
-- Signed URLs bypass RLS for download after server creates them with user session.
-- Also allow select if object name matches a shared drive_files.storage_path
drop policy if exists "drive_storage_client_select_shared" on storage.objects;
create policy "drive_storage_client_select_shared"
on storage.objects for select to authenticated
using (
  bucket_id = 'drive'
  and exists (
    select 1
    from public.drive_files f
    where f.storage_path = name
      and f.deleted_at is null
      and (
        exists (
          select 1 from public.drive_shares s
          where s.file_id = f.id and public.is_my_client_row(s.client_id)
        )
        or (
          f.folder_id is not null
          and exists (
            select 1 from public.drive_shares s
            where s.folder_id = f.folder_id and public.is_my_client_row(s.client_id)
          )
        )
      )
  )
);

drop policy if exists "drive_storage_coach_insert" on storage.objects;
create policy "drive_storage_coach_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'drive'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "drive_storage_coach_update" on storage.objects;
create policy "drive_storage_coach_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'drive'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'drive'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "drive_storage_coach_delete" on storage.objects;
create policy "drive_storage_coach_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'drive'
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on table public.drive_files is 'Fichiers Drive coach · path storage coach_id/…';
comment on table public.drive_shares is 'Partage 1 fichier ou 1 dossier → client ou groupe';

insert into public.schema_migrations_trainly (id)
values ('21_drive')
on conflict (id) do nothing;
