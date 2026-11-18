-- =============================================================================
-- TRANCHE 73 — Setup chat / Drive groupe (nom chat + dossier lié)
-- Prérequis : 03_clients · 21_drive · 65_chat_groups_media · 72_group_linked_presta
-- =============================================================================

alter table public.client_groups
  add column if not exists chat_title text;

alter table public.client_groups
  add column if not exists drive_folder_id uuid references public.drive_folders(id) on delete set null;

create index if not exists client_groups_drive_folder_idx
  on public.client_groups (drive_folder_id)
  where drive_folder_id is not null;

comment on column public.client_groups.chat_title is
  'Nom du fil chat groupe (affiché côté messagerie)';
comment on column public.client_groups.drive_folder_id is
  'Dossier Drive collectif lié au groupe';

-- Titre thread = chat_title si renseigné, sinon name du groupe
create or replace function public.ensure_group_thread(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_title text;
  v_thread_id uuid;
  v_chat boolean;
begin
  select g.coach_id,
         coalesce(nullif(trim(g.chat_title), ''), g.name),
         g.chat_enabled
    into v_coach_id, v_title, v_chat
  from public.client_groups g
  where g.id = p_group_id;

  if v_coach_id is null then
    raise exception 'group not found';
  end if;

  if not (
    v_coach_id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1
      from public.client_group_members m
      join public.clients c on c.id = m.client_id
      where m.group_id = p_group_id
        and c.user_id = auth.uid()
        and c.deleted_at is null
    )
  ) then
    raise exception 'not allowed';
  end if;

  -- Coach peut ouvrir même si chat_enabled false (activation implicite)
  if v_coach_id = auth.uid() and not coalesce(v_chat, false) then
    update public.client_groups set chat_enabled = true where id = p_group_id;
  elsif not coalesce(v_chat, false) and v_coach_id <> auth.uid() then
    raise exception 'group chat disabled';
  end if;

  select t.id into v_thread_id
  from public.chat_threads t
  where t.group_id = p_group_id
    and t.type = 'group'
    and t.deleted_at is null
  limit 1;

  if v_thread_id is not null then
    -- Sync titre si chat_title a changé
    update public.chat_threads
       set title = v_title
     where id = v_thread_id
       and coalesce(title, '') is distinct from coalesce(v_title, '');
    return v_thread_id;
  end if;

  insert into public.chat_threads (coach_id, type, group_id, title)
  values (v_coach_id, 'group', p_group_id, v_title)
  returning id into v_thread_id;

  return v_thread_id;
end;
$$;

grant execute on function public.ensure_group_thread(uuid) to authenticated;
