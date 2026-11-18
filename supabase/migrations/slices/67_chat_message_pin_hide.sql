-- =============================================================================
-- TRANCHE 67 — Épingler un message · supprimer pour moi
-- Prérequis : 66_chat_pro_messaging
-- Après Run : dis « 67 OK »
-- =============================================================================

-- Pin message (en tête de fil). 1 pin max / thread.
alter table public.chat_messages
  add column if not exists pinned_at timestamptz;

create unique index if not exists chat_messages_one_pin_per_thread
  on public.chat_messages (thread_id)
  where pinned_at is not null and deleted_at is null;

-- Masquer un message pour soi (effacer pour moi)
create table if not exists public.chat_message_hides (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists chat_message_hides_user_idx
  on public.chat_message_hides (user_id);

alter table public.chat_message_hides enable row level security;

drop policy if exists "chat_message_hides_select" on public.chat_message_hides;
create policy "chat_message_hides_select"
on public.chat_message_hides for select to authenticated
using (user_id = auth.uid());

drop policy if exists "chat_message_hides_insert" on public.chat_message_hides;
create policy "chat_message_hides_insert"
on public.chat_message_hides for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.chat_messages m
    where m.id = message_id and public.can_access_chat_thread(m.thread_id)
  )
);

drop policy if exists "chat_message_hides_delete" on public.chat_message_hides;
create policy "chat_message_hides_delete"
on public.chat_message_hides for delete to authenticated
using (user_id = auth.uid());

-- Pin / unpin (auteur ou coach du thread)
create or replace function public.toggle_pin_chat_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread uuid;
  v_sender uuid;
  v_coach uuid;
  v_pinned timestamptz;
begin
  select m.thread_id, m.sender_id, t.coach_id, m.pinned_at
    into v_thread, v_sender, v_coach, v_pinned
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

  if v_pinned is not null then
    update public.chat_messages set pinned_at = null where id = p_message_id;
  else
    update public.chat_messages
    set pinned_at = null
    where thread_id = v_thread and pinned_at is not null and deleted_at is null;
    update public.chat_messages set pinned_at = now() where id = p_message_id;
  end if;
end;
$$;

grant execute on function public.toggle_pin_chat_message(uuid) to authenticated;

insert into public.schema_migrations_trainly (id)
values ('67_chat_message_pin_hide')
on conflict (id) do nothing;
