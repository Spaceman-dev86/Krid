-- =============================================================================
-- TRANCHE 65 — Chat groupes + médias + reply + réactions
-- Prérequis : 16_chat · 03_clients (client_groups) · 18_calendar_rdv (tag optionnel)
-- Après Run : dis « 65 OK »
-- =============================================================================

-- Accès thread : DM (existant) OU membre d’un groupe chat
create or replace function public.can_access_chat_thread(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_threads t
    where t.id = p_thread_id
      and t.deleted_at is null
      and (
        t.coach_id = auth.uid()
        or public.is_platform_admin()
        or (
          t.type = 'dm'
          and t.client_id is not null
          and public.is_my_client_row(t.client_id)
        )
        or (
          t.type = 'group'
          and t.group_id is not null
          and exists (
            select 1
            from public.client_group_members m
            join public.clients c on c.id = m.client_id
            where m.group_id = t.group_id
              and c.user_id = auth.uid()
              and c.deleted_at is null
          )
        )
      )
  );
$$;

-- Créer / renvoyer thread groupe
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
  select g.coach_id, g.name, g.chat_enabled
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
    return v_thread_id;
  end if;

  insert into public.chat_threads (coach_id, type, group_id, title)
  values (v_coach_id, 'group', p_group_id, v_title)
  returning id into v_thread_id;

  return v_thread_id;
end;
$$;

grant execute on function public.ensure_group_thread(uuid) to authenticated;

-- Client : SELECT threads groupe dont il est membre
drop policy if exists "chat_threads_client_select" on public.chat_threads;
create policy "chat_threads_client_select"
on public.chat_threads for select to authenticated
using (
  deleted_at is null
  and (
    (
      type = 'dm'
      and client_id is not null
      and public.is_my_client_row(client_id)
    )
    or (
      type = 'group'
      and group_id is not null
      and exists (
        select 1
        from public.client_group_members m
        join public.clients c on c.id = m.client_id
        where m.group_id = chat_threads.group_id
          and c.user_id = auth.uid()
          and c.deleted_at is null
      )
    )
  )
);

-- Messages : médias + reply (+ tag si absent)
alter table public.chat_messages
  alter column body set default '';

alter table public.chat_messages
  add column if not exists reply_to_id uuid references public.chat_messages(id) on delete set null;

alter table public.chat_messages
  add column if not exists media_kind text
    check (media_kind is null or media_kind in ('image', 'video', 'audio', 'file'));

alter table public.chat_messages
  add column if not exists media_path text;

alter table public.chat_messages
  add column if not exists media_mime text;

alter table public.chat_messages
  add column if not exists media_name text;

alter table public.chat_messages
  add column if not exists media_bytes bigint;

alter table public.chat_messages
  add column if not exists media_duration_ms integer;

alter table public.chat_messages
  add column if not exists tag text;

create index if not exists chat_messages_reply_idx
  on public.chat_messages (reply_to_id)
  where reply_to_id is not null and deleted_at is null;

-- Réactions
create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists chat_message_reactions_message_idx
  on public.chat_message_reactions (message_id);

alter table public.chat_message_reactions enable row level security;

drop policy if exists "chat_reactions_select" on public.chat_message_reactions;
create policy "chat_reactions_select"
on public.chat_message_reactions for select to authenticated
using (
  exists (
    select 1 from public.chat_messages m
    where m.id = message_id and public.can_access_chat_thread(m.thread_id)
  )
);

drop policy if exists "chat_reactions_insert" on public.chat_message_reactions;
create policy "chat_reactions_insert"
on public.chat_message_reactions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.chat_messages m
    where m.id = message_id and public.can_access_chat_thread(m.thread_id)
  )
);

drop policy if exists "chat_reactions_delete" on public.chat_message_reactions;
create policy "chat_reactions_delete"
on public.chat_message_reactions for delete to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.chat_messages m
    where m.id = message_id and public.can_access_chat_thread(m.thread_id)
  )
);

-- Preview trigger : médias
create or replace function public.chat_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preview text;
begin
  if new.media_kind = 'image' then
    v_preview := '📷 Photo';
  elsif new.media_kind = 'video' then
    v_preview := '🎬 Vidéo';
  elsif new.media_kind = 'audio' then
    v_preview := '🎤 Audio';
  elsif new.media_kind = 'file' then
    v_preview := '📎 ' || coalesce(new.media_name, 'Fichier');
  else
    v_preview := left(coalesce(new.body, ''), 160);
  end if;

  update public.chat_threads
  set
    last_message_at = new.created_at,
    last_message_preview = v_preview,
    updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

-- Storage chat-media (privé) path: {coach_id}/{thread_id}/{file}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  104857600, -- 100 Mo
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-m4a',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat_media_select" on storage.objects;
create policy "chat_media_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_platform_admin()
    or exists (
      select 1
      from public.chat_messages m
      join public.chat_threads t on t.id = m.thread_id
      where m.media_path = name
        and m.deleted_at is null
        and public.can_access_chat_thread(t.id)
    )
  )
);

drop policy if exists "chat_media_insert" on storage.objects;
create policy "chat_media_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.chat_threads t
      where t.id = ((storage.foldername(name))[2])::uuid
        and public.can_access_chat_thread(t.id)
        and (storage.foldername(name))[1] = t.coach_id::text
    )
  )
);

drop policy if exists "chat_media_delete" on storage.objects;
create policy "chat_media_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_platform_admin()
  )
);

comment on table public.chat_message_reactions is 'Réactions emoji par message (WhatsApp-like).';
comment on column public.chat_messages.media_path is 'Path storage bucket chat-media.';
comment on column public.chat_messages.reply_to_id is 'Quote / reply parent message.';

insert into public.schema_migrations_trainly (id)
values ('65_chat_groups_media')
on conflict (id) do nothing;
