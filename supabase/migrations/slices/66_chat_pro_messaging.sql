-- =============================================================================
-- TRANCHE 66 — Messagerie pro (hors appels / templates / snooze)
-- Prérequis : 65_chat_groups_media
-- Après Run : dis « 66 OK »
-- =============================================================================
-- Couvre : pin · archive · clear history · soft-delete for all · forward ·
--          mentions · GIF/sticker kind · realtime publication · notif chat
-- =============================================================================

-- Message : forward + mentions + soft kinds
alter table public.chat_messages
  add column if not exists forwarded_from_id uuid references public.chat_messages(id) on delete set null;

alter table public.chat_messages
  add column if not exists mentions uuid[] not null default '{}';

-- Élargir media_kind pour stickers / GIF (toujours image côté storage)
alter table public.chat_messages drop constraint if exists chat_messages_media_kind_check;
alter table public.chat_messages
  add constraint chat_messages_media_kind_check
  check (
    media_kind is null
    or media_kind in ('image', 'video', 'audio', 'file', 'sticker', 'gif')
  );

create index if not exists chat_messages_mentions_gin
  on public.chat_messages using gin (mentions)
  where deleted_at is null;

-- Pin / archive / clear par utilisateur
create table if not exists public.chat_thread_user_state (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pinned_at timestamptz,
  archived_at timestamptz,
  cleared_before timestamptz,
  updated_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists chat_thread_user_state_user_pin_idx
  on public.chat_thread_user_state (user_id, pinned_at desc nulls last)
  where pinned_at is not null;

create index if not exists chat_thread_user_state_user_arch_idx
  on public.chat_thread_user_state (user_id, archived_at desc nulls last)
  where archived_at is not null;

alter table public.chat_thread_user_state enable row level security;

drop policy if exists "chat_thread_user_state_select" on public.chat_thread_user_state;
create policy "chat_thread_user_state_select"
on public.chat_thread_user_state for select to authenticated
using (
  user_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
);

drop policy if exists "chat_thread_user_state_insert" on public.chat_thread_user_state;
create policy "chat_thread_user_state_insert"
on public.chat_thread_user_state for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
);

drop policy if exists "chat_thread_user_state_update" on public.chat_thread_user_state;
create policy "chat_thread_user_state_update"
on public.chat_thread_user_state for update to authenticated
using (
  user_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
)
with check (
  user_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
);

-- Soft-delete message pour tous (auteur ou coach du thread)
create or replace function public.soft_delete_chat_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread uuid;
  v_sender uuid;
  v_coach uuid;
begin
  select m.thread_id, m.sender_id, t.coach_id
    into v_thread, v_sender, v_coach
  from public.chat_messages m
  join public.chat_threads t on t.id = m.thread_id
  where m.id = p_message_id
    and m.deleted_at is null;

  if v_thread is null then
    raise exception 'message not found';
  end if;

  if not public.can_access_chat_thread(v_thread) then
    raise exception 'not allowed';
  end if;

  if auth.uid() <> v_sender and auth.uid() <> v_coach and not public.is_platform_admin() then
    raise exception 'not allowed';
  end if;

  update public.chat_messages
  set deleted_at = now(), body = ''
  where id = p_message_id;
end;
$$;

grant execute on function public.soft_delete_chat_message(uuid) to authenticated;

-- Upsert état fil (pin / archive / clear)
create or replace function public.upsert_chat_thread_user_state(
  p_thread_id uuid,
  p_pinned boolean default null,
  p_archived boolean default null,
  p_clear_now boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_chat_thread(p_thread_id) then
    raise exception 'not allowed';
  end if;

  insert into public.chat_thread_user_state (thread_id, user_id, pinned_at, archived_at, cleared_before, updated_at)
  values (
    p_thread_id,
    auth.uid(),
    case when p_pinned is true then now() when p_pinned is false then null else null end,
    case when p_archived is true then now() when p_archived is false then null else null end,
    case when p_clear_now then now() else null end,
    now()
  )
  on conflict (thread_id, user_id) do update set
    pinned_at = case
      when p_pinned is true then now()
      when p_pinned is false then null
      else public.chat_thread_user_state.pinned_at
    end,
    archived_at = case
      when p_archived is true then now()
      when p_archived is false then null
      else public.chat_thread_user_state.archived_at
    end,
    cleared_before = case
      when p_clear_now then now()
      else public.chat_thread_user_state.cleared_before
    end,
    updated_at = now();
end;
$$;

grant execute on function public.upsert_chat_thread_user_state(uuid, boolean, boolean, boolean) to authenticated;

-- Notif in-app quand message reçu (hors soi)
create or replace function public.chat_messages_notify_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid;
  v_type text;
  v_client_id uuid;
  v_title text;
  v_preview text;
  v_client_uid uuid;
  r record;
begin
  select t.coach_id, t.type, t.title, t.client_id
    into v_coach, v_type, v_title, v_client_id
  from public.chat_threads t
  where t.id = new.thread_id;

  if new.media_kind in ('image', 'gif', 'sticker') then
    v_preview := '📷 Photo';
  elsif new.media_kind = 'video' then
    v_preview := '🎬 Vidéo';
  elsif new.media_kind = 'audio' then
    v_preview := '🎤 Audio';
  elsif new.media_kind = 'file' then
    v_preview := '📎 Fichier';
  else
    v_preview := left(coalesce(new.body, ''), 120);
  end if;

  if v_coach is not null and new.sender_id <> v_coach then
    insert into public.notifications (user_id, type, title, body, payload)
    values (
      v_coach,
      'chat_message',
      coalesce(nullif(v_title, ''), 'Nouveau message'),
      v_preview,
      jsonb_build_object('thread_id', new.thread_id, 'href', '/chat/' || new.thread_id::text)
    );
  end if;

  if v_type = 'dm' and v_client_id is not null then
    select c.user_id into v_client_uid
    from public.clients c
    where c.id = v_client_id and c.deleted_at is null;
    if v_client_uid is not null and v_client_uid <> new.sender_id then
      insert into public.notifications (user_id, type, title, body, payload)
      values (
        v_client_uid,
        'chat_message',
        'Message de ton coach',
        v_preview,
        jsonb_build_object('thread_id', new.thread_id)
      );
    end if;
  end if;

  if v_type = 'group' then
    for r in
      select c.user_id as uid
      from public.chat_threads t
      join public.client_group_members m on m.group_id = t.group_id
      join public.clients c on c.id = m.client_id
      where t.id = new.thread_id
        and c.user_id is not null
        and c.deleted_at is null
        and c.user_id <> new.sender_id
    loop
      insert into public.notifications (user_id, type, title, body, payload)
      values (
        r.uid,
        'chat_message',
        coalesce(nullif(v_title, ''), 'Groupe'),
        v_preview,
        jsonb_build_object('thread_id', new.thread_id)
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists chat_messages_notify_ai on public.chat_messages;
create trigger chat_messages_notify_ai
after insert on public.chat_messages
for each row
execute function public.chat_messages_notify_recipients();

-- Realtime (si publication disponible)
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.chat_message_reactions;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.chat_thread_reads;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;

comment on table public.chat_thread_user_state is 'Pin / archive / clear history par utilisateur.';
comment on column public.chat_messages.forwarded_from_id is 'Message source si transfert.';
comment on column public.chat_messages.mentions is 'User ids mentionnés (@).';

insert into public.schema_migrations_trainly (id)
values ('66_chat_pro_messaging')
on conflict (id) do nothing;
