-- =============================================================================
-- TRANCHE 74 — Drive groupe lié : actifs only (alumni chat-only)
-- Prérequis : 21_drive · 62_drive_folder_share_recursive · 72_group_linked_presta
-- =============================================================================

-- Membre groupe + (si linked) grant actif sur la presta du groupe
create or replace function public.client_in_group_drive_audience(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_group_members m
    join public.clients c on c.id = m.client_id
    join public.client_groups g on g.id = m.group_id
    where m.group_id = p_group_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
      and (
        g.type is distinct from 'linked'
        or g.prestation_id is null
        or exists (
          select 1
          from public.client_grants gr
          where gr.client_id = c.id
            and gr.prestation_id = g.prestation_id
            and gr.coach_id = g.coach_id
            and gr.status = 'active'
        )
      )
  );
$$;

revoke all on function public.client_in_group_drive_audience(uuid) from public;
grant execute on function public.client_in_group_drive_audience(uuid) to authenticated;

drop policy if exists "drive_shares_client_select" on public.drive_shares;
create policy "drive_shares_client_select"
on public.drive_shares for select to authenticated
using (
  public.is_my_client_row(client_id)
  or (
    group_id is not null
    and public.client_in_group_drive_audience(group_id)
  )
);

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
            and public.client_in_group_drive_audience(s.group_id)
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
            and public.client_in_group_drive_audience(s.group_id)
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
          and public.client_in_group_drive_audience(s.group_id)
        )
      )
  )
);

comment on function public.client_in_group_drive_audience(uuid) is
  'Client membre du groupe ; si linked, grant actif requis (alumni = chat only)';
