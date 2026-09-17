-- =============================================================================
-- TRANCHE 16 — Chat 1:1 (threads + messages)
-- Prérequis : 03_clients
-- Après Run : dis « 16 OK » → inbox coach /chat + portail /messages
-- =============================================================================
-- Périmètre V1 :
--   • chat_threads type dm (1 thread / coach+client)
--   • chat_messages texte
--   • chat_thread_reads (badge non lus)
--   • RLS coach own · client participant DM
-- Hors scope V1 : groupes · médias · realtime · quote / RDV depuis chat
-- =============================================================================

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'dm'
    check (type in ('dm', 'group')),
  client_id uuid references public.clients(id) on delete cascade,
  group_id uuid references public.client_groups(id) on delete cascade,
  title text,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chat_threads_dm_client_chk check (
    (type = 'dm' and client_id is not null and group_id is null)
    or (type = 'group' and group_id is not null)
  )
);

create unique index if not exists chat_threads_dm_uidx
  on public.chat_threads (coach_id, client_id)
  where type = 'dm' and deleted_at is null;

create index if not exists chat_threads_coach_last_idx
  on public.chat_threads (coach_id, last_message_at desc nulls last)
  where deleted_at is null;

create index if not exists chat_threads_client_idx
  on public.chat_threads (client_id)
  where deleted_at is null and client_id is not null;

alter table public.chat_threads enable row level security;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at asc)
  where deleted_at is null;

alter table public.chat_messages enable row level security;

create table if not exists public.chat_thread_reads (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  reader_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, reader_id)
);

alter table public.chat_thread_reads enable row level security;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

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
      )
  );
$$;

grant execute on function public.can_access_chat_thread(uuid) to authenticated;

-- Créer ou renvoyer le thread DM coach↔client
create or replace function public.ensure_dm_thread(p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_thread_id uuid;
begin
  select c.coach_id into v_coach_id
  from public.clients c
  where c.id = p_client_id
    and c.deleted_at is null;

  if v_coach_id is null then
    raise exception 'client not found';
  end if;

  -- Coach own client OR client is the authenticated linked user
  if not (
    v_coach_id = auth.uid()
    or public.is_platform_admin()
    or public.is_my_client_row(p_client_id)
  ) then
    raise exception 'not allowed';
  end if;

  select t.id into v_thread_id
  from public.chat_threads t
  where t.coach_id = v_coach_id
    and t.client_id = p_client_id
    and t.type = 'dm'
    and t.deleted_at is null
  limit 1;

  if v_thread_id is not null then
    return v_thread_id;
  end if;

  insert into public.chat_threads (coach_id, type, client_id)
  values (v_coach_id, 'dm', p_client_id)
  returning id into v_thread_id;

  return v_thread_id;
end;
$$;

grant execute on function public.ensure_dm_thread(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS chat_threads
-- -----------------------------------------------------------------------------

drop policy if exists "chat_threads_coach_all" on public.chat_threads;
create policy "chat_threads_coach_all"
on public.chat_threads for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "chat_threads_client_select" on public.chat_threads;
create policy "chat_threads_client_select"
on public.chat_threads for select to authenticated
using (
  type = 'dm'
  and client_id is not null
  and public.is_my_client_row(client_id)
  and deleted_at is null
);

-- Client may not insert threads directly — use ensure_dm_thread

-- -----------------------------------------------------------------------------
-- RLS chat_messages
-- -----------------------------------------------------------------------------

drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select"
on public.chat_messages for select to authenticated
using (public.can_access_chat_thread(thread_id) and deleted_at is null);

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert"
on public.chat_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
);

drop policy if exists "chat_messages_update_soft" on public.chat_messages;
create policy "chat_messages_update_soft"
on public.chat_messages for update to authenticated
using (public.can_access_chat_thread(thread_id))
with check (public.can_access_chat_thread(thread_id));

-- -----------------------------------------------------------------------------
-- RLS chat_thread_reads
-- -----------------------------------------------------------------------------

drop policy if exists "chat_thread_reads_own" on public.chat_thread_reads;
create policy "chat_thread_reads_own"
on public.chat_thread_reads for all to authenticated
using (
  reader_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
)
with check (
  reader_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
);

-- -----------------------------------------------------------------------------
-- Trigger: maj last_message_* sur insert message
-- -----------------------------------------------------------------------------

create or replace function public.chat_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_threads
  set
    last_message_at = new.created_at,
    last_message_preview = left(new.body, 160),
    updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_after_insert_trg on public.chat_messages;
create trigger chat_messages_after_insert_trg
after insert on public.chat_messages
for each row execute function public.chat_messages_after_insert();

comment on table public.chat_threads is
  'Threads chat : dm (1:1 coach↔client) · group (hors UI V1)';
comment on table public.chat_messages is
  'Messages texte V1 — médias plus tard (bucket chat)';

insert into public.schema_migrations_trainly (id)
values ('16_chat')
on conflict (id) do nothing;
