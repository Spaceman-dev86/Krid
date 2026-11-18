-- TRANCHE 56 — session_library plateforme : lecture admin only
-- Les séances catalogue published (coach_id null) ne sont plus visibles des coaches.
-- Prérequis : 50_session_library_catalog

-- =============================================================================
-- session_library
-- =============================================================================

drop policy if exists "session_library_select" on public.session_library;
create policy "session_library_select"
on public.session_library for select to authenticated
using (
  deleted_at is null
  and (
    public.is_platform_admin()
    or coach_id = auth.uid()
  )
);

-- =============================================================================
-- session_library_items
-- =============================================================================

drop policy if exists "session_library_items_select" on public.session_library_items;
create policy "session_library_items_select"
on public.session_library_items for select to authenticated
using (
  exists (
    select 1 from public.session_library s
    where s.id = session_id
      and s.deleted_at is null
      and (
        public.is_platform_admin()
        or s.coach_id = auth.uid()
      )
  )
);

-- =============================================================================
-- hidden types / sports
-- =============================================================================

drop policy if exists "session_library_hidden_types_select" on public.session_library_hidden_types;
create policy "session_library_hidden_types_select"
on public.session_library_hidden_types for select to authenticated
using (
  exists (
    select 1 from public.session_library s
    where s.id = session_id
      and s.deleted_at is null
      and (
        public.is_platform_admin()
        or s.coach_id = auth.uid()
      )
  )
);

drop policy if exists "session_library_hidden_sports_select" on public.session_library_hidden_sports;
create policy "session_library_hidden_sports_select"
on public.session_library_hidden_sports for select to authenticated
using (
  exists (
    select 1 from public.session_library s
    where s.id = session_id
      and s.deleted_at is null
      and (
        public.is_platform_admin()
        or s.coach_id = auth.uid()
      )
  )
);

insert into public.schema_migrations_trainly (id)
values ('56_session_library_admin_only')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
