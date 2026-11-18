-- =============================================================================
-- TRANCHE 62 — Partage dossier Drive récursif (sous-dossiers inclus)
-- =============================================================================

create or replace function public.drive_folder_is_under(root_id uuid, leaf_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select id, parent_id
    from public.drive_folders
    where id = leaf_id
      and deleted_at is null
    union all
    select f.id, f.parent_id
    from public.drive_folders f
    join chain c on f.id = c.parent_id
    where f.deleted_at is null
  )
  select exists (select 1 from chain where id = root_id);
$$;

revoke all on function public.drive_folder_is_under(uuid, uuid) from public;
grant execute on function public.drive_folder_is_under(uuid, uuid) to authenticated;

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
      where s.folder_id is not null
        and drive_files.folder_id is not null
        and public.drive_folder_is_under(s.folder_id, drive_files.folder_id)
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
    where s.folder_id is not null
      and public.drive_folder_is_under(s.folder_id, drive_folders.id)
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
