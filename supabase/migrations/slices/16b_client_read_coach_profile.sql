-- =============================================================================
-- TRANCHE 16b — Client lit le profil de son coach (nom chat)
-- Prérequis : 03_clients + 16_chat
-- Après Run : dis « 16b OK »
-- =============================================================================

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.clients c
    where c.coach_id = auth.uid()
      and c.user_id = profiles.id
      and c.deleted_at is null
  )
  -- Client lié : lit le profil de son coach (full_name pour Messages)
  or exists (
    select 1 from public.clients c
    where c.user_id = auth.uid()
      and c.coach_id = profiles.id
      and c.deleted_at is null
  )
);

insert into public.schema_migrations_trainly (id)
values ('16b_client_read_coach_profile')
on conflict (id) do nothing;
