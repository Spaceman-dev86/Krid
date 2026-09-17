-- =============================================================================
-- TRANCHE 03b — Fix RLS recursion client_groups ↔ client_group_members
-- Prérequis : 03 OK
-- Après Run : dis « 03b OK » et réessaie créer un groupe
-- =============================================================================

create or replace function public.is_client_group_member(p_group_id uuid)
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
    where m.group_id = p_group_id
      and c.user_id = auth.uid()
      and c.deleted_at is null
  );
$$;

create or replace function public.owns_client_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_groups g
    where g.id = p_group_id
      and (g.coach_id = auth.uid() or public.is_platform_admin())
  );
$$;

grant execute on function public.is_client_group_member(uuid) to authenticated, anon;
grant execute on function public.owns_client_group(uuid) to authenticated, anon;

-- client_groups : SELECT membre via helper (plus de join RLS croisé)
drop policy if exists "client_groups_member_select" on public.client_groups;
create policy "client_groups_member_select"
on public.client_groups for select to authenticated
using (public.is_client_group_member(id));

-- client_group_members : coach via helper (plus de select RLS sur client_groups)
drop policy if exists "client_group_members_coach_all" on public.client_group_members;
create policy "client_group_members_coach_all"
on public.client_group_members for all to authenticated
using (public.owns_client_group(group_id))
with check (public.owns_client_group(group_id));

insert into public.schema_migrations_trainly (id)
values ('03b_fix_groups_rls')
on conflict (id) do nothing;
