-- =============================================================================
-- TRANCHE 107 — Catalogue programmes Krid : SELECT coach (lecture seule)
-- Admin « publié » → visible coach en preview · écriture = fork → brouillon
-- Prérequis : 10_programs · 37_trainly_vs_coach_programs
-- =============================================================================

-- Helper : programme catalogue plateforme publié (lecture structure).
-- SECURITY DEFINER = même pattern que owns_program (évite récursion RLS).
create or replace function public.coach_can_read_krid_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programs p
    where p.id = p_program_id
      and p.deleted_at is null
      and p.is_trainly_catalog = true
      and p.catalog_status = 'published'
  )
  and exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('coach', 'platform_admin', 'admin')
  );
$$;

grant execute on function public.coach_can_read_krid_program(uuid) to authenticated, anon;

comment on function public.coach_can_read_krid_program(uuid) is
  'Coach/admin : lecture seule d’un programme catalogue Krid publié (preview / fork).';

-- programs : SELECT catalogue publié (FOR ALL owns reste inchangé → pas d’écriture)
drop policy if exists "programs_coach_select_krid_catalog" on public.programs;
create policy "programs_coach_select_krid_catalog"
on public.programs for select to authenticated
using (
  deleted_at is null
  and is_trainly_catalog = true
  and catalog_status = 'published'
  and exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('coach', 'platform_admin', 'admin')
  )
);

-- program_weeks
drop policy if exists "program_weeks_coach_select_krid" on public.program_weeks;
create policy "program_weeks_coach_select_krid"
on public.program_weeks for select to authenticated
using (public.coach_can_read_krid_program(program_id));

-- sessions (via week → program)
drop policy if exists "sessions_coach_select_krid" on public.sessions;
create policy "sessions_coach_select_krid"
on public.sessions for select to authenticated
using (
  exists (
    select 1
    from public.program_weeks w
    where w.id = sessions.week_id
      and public.coach_can_read_krid_program(w.program_id)
  )
);

-- session_blocks
drop policy if exists "session_blocks_coach_select_krid" on public.session_blocks;
create policy "session_blocks_coach_select_krid"
on public.session_blocks for select to authenticated
using (
  exists (
    select 1
    from public.sessions s
    join public.program_weeks w on w.id = s.week_id
    where s.id = session_blocks.program_session_id
      and public.coach_can_read_krid_program(w.program_id)
  )
);

-- block_exercises
drop policy if exists "block_exercises_coach_select_krid" on public.block_exercises;
create policy "block_exercises_coach_select_krid"
on public.block_exercises for select to authenticated
using (
  exists (
    select 1
    from public.session_blocks b
    join public.sessions s on s.id = b.program_session_id
    join public.program_weeks w on w.id = s.week_id
    where b.id = block_exercises.session_block_id
      and public.coach_can_read_krid_program(w.program_id)
  )
);

-- program_exercises
drop policy if exists "program_exercises_coach_select_krid" on public.program_exercises;
create policy "program_exercises_coach_select_krid"
on public.program_exercises for select to authenticated
using (
  exists (
    select 1
    from public.sessions s
    join public.program_weeks w on w.id = s.week_id
    where s.id = program_exercises.session_id
      and public.coach_can_read_krid_program(w.program_id)
  )
);

-- session_items
drop policy if exists "session_items_coach_select_krid" on public.session_items;
create policy "session_items_coach_select_krid"
on public.session_items for select to authenticated
using (
  exists (
    select 1
    from public.sessions s
    join public.program_weeks w on w.id = s.week_id
    where s.id = session_items.session_id
      and public.coach_can_read_krid_program(w.program_id)
  )
);

insert into public.schema_migrations_trainly (id)
values ('107_programs_krid_catalogue_select')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
