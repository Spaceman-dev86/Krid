-- Unique indexes for group audience on drive_shares (parity with client indexes).

create unique index if not exists drive_shares_file_group_uidx
  on public.drive_shares (file_id, group_id)
  where file_id is not null and group_id is not null;

create unique index if not exists drive_shares_folder_group_uidx
  on public.drive_shares (folder_id, group_id)
  where folder_id is not null and group_id is not null;

create index if not exists drive_shares_group_idx
  on public.drive_shares (group_id)
  where group_id is not null;
