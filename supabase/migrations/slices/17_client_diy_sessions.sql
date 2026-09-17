-- =============================================================================
-- TRANCHE 17 — Séances libres client (DIY)
-- Prérequis : 11_session_runs (+ 11a biblio)
-- Après Run : dis « 17 OK » → hub /seance créer + jouer libre
-- =============================================================================
-- Périmètre V1 :
--   • client_diy_sessions : brouillons / templates DIY (snapshot jsonb)
--   • Runs via session_runs source=libre (déjà en place)
-- Hors scope : fork éditeur complet · blocs DIY avancés · unités custom
-- =============================================================================

create table if not exists public.client_diy_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Séance libre',
  snapshot jsonb not null default '{"version":1,"session_id":"","title":"","items":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists client_diy_sessions_client_idx
  on public.client_diy_sessions (client_id, updated_at desc)
  where deleted_at is null;

alter table public.client_diy_sessions enable row level security;

drop policy if exists "client_diy_sessions_coach_select" on public.client_diy_sessions;
create policy "client_diy_sessions_coach_select"
on public.client_diy_sessions for select to authenticated
using (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "client_diy_sessions_client_all" on public.client_diy_sessions;
create policy "client_diy_sessions_client_all"
on public.client_diy_sessions for all to authenticated
using (public.is_my_client_row(client_id) and deleted_at is null)
with check (
  public.is_my_client_row(client_id)
  and coach_id = (
    select c.coach_id from public.clients c where c.id = client_id
  )
);

comment on table public.client_diy_sessions is
  'Séances DIY client (brouillons / modèles) — jouées via session_runs source=libre';

-- Client lit la biblio Trainly + biblio de son coach (picker DIY)
drop policy if exists "exercise_library_select" on public.exercise_library;
create policy "exercise_library_select"
on public.exercise_library for select to authenticated
using (
  deleted_at is null
  and (
    coach_id is null
    or coach_id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1 from public.clients c
      where c.user_id = auth.uid()
        and c.coach_id = exercise_library.coach_id
        and c.deleted_at is null
    )
  )
);

insert into public.schema_migrations_trainly (id)
values ('17_client_diy_sessions')
on conflict (id) do nothing;
