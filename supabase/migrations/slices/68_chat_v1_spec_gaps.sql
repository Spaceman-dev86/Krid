-- =============================================================================
-- TRANCHE 68 — Gaps spec chat V1
-- Prérequis : 67
-- Après Run : dis « 68 OK »
-- =============================================================================
-- description groupes · clear historique global (RPC)
-- =============================================================================

alter table public.client_groups
  add column if not exists description text;

-- Soft-delete tous les messages d’un thread (coach only, effet global)
create or replace function public.clear_chat_thread_history(p_thread_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid;
  v_n integer;
begin
  select t.coach_id into v_coach
  from public.chat_threads t
  where t.id = p_thread_id
    and t.deleted_at is null;

  if v_coach is null then
    raise exception 'thread not found';
  end if;

  if auth.uid() <> v_coach and not public.is_platform_admin() then
    raise exception 'not allowed';
  end if;

  update public.chat_messages
  set deleted_at = now(), body = '', pinned_at = null
  where thread_id = p_thread_id
    and deleted_at is null;

  get diagnostics v_n = row_count;

  update public.chat_threads
  set
    last_message_preview = 'Historique effacé',
    updated_at = now()
  where id = p_thread_id;

  return v_n;
end;
$$;

grant execute on function public.clear_chat_thread_history(uuid) to authenticated;

comment on column public.client_groups.description is 'Description groupe (chat / fiche).';

insert into public.schema_migrations_trainly (id)
values ('68_chat_v1_spec_gaps')
on conflict (id) do nothing;
