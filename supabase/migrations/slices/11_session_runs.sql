-- =============================================================================
-- TRANCHE 11 — session_runs (player séance + historique)
-- Prérequis : 10_programs (+ 11a recommandé pour contenus exo)
-- Après Run : dis « 11 OK » → on branche le player UI portail
-- =============================================================================
-- Périmètre V1 :
--   • Table session_runs (plan | libre | adapted)
--   • Styles Accueil : fait | fait_edite | libre | pas_fait | en_cours
--   • snapshot jsonb figé à l’ouverture du run · realized jsonb pendant/après
--   • RLS coach own · client own (is_my_client_row)
-- Hors scope : records matérialisés · favoris · nutrition runs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- session_runs
-- -----------------------------------------------------------------------------

create table if not exists public.session_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.client_fitness_plans(id) on delete set null,
  -- Séance template (nullable = DIY / libre sans template)
  source_session_id uuid references public.sessions(id) on delete set null,
  source text not null default 'plan'
    check (source in ('plan', 'libre', 'adapted')),
  title text,
  scheduled_date date,
  actual_date date,
  style text not null default 'en_cours'
    check (style in ('fait', 'fait_edite', 'libre', 'pas_fait', 'en_cours')),
  -- Contenu figé à l’ouverture du run (structure coach + consignes)
  snapshot jsonb,
  -- Réalisé client (séries, notes, items non faits, ajouts client)
  realized jsonb,
  comment text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists session_runs_client_id_idx
  on public.session_runs (client_id, style)
  where deleted_at is null;

create index if not exists session_runs_coach_id_idx
  on public.session_runs (coach_id)
  where deleted_at is null;

create index if not exists session_runs_plan_id_idx
  on public.session_runs (plan_id)
  where plan_id is not null and deleted_at is null;

create index if not exists session_runs_source_session_idx
  on public.session_runs (source_session_id)
  where source_session_id is not null and deleted_at is null;

create index if not exists session_runs_scheduled_date_idx
  on public.session_runs (client_id, scheduled_date)
  where deleted_at is null and scheduled_date is not null;

create index if not exists session_runs_actual_date_idx
  on public.session_runs (client_id, actual_date)
  where deleted_at is null and actual_date is not null;

-- Au plus 1 run « en cours » par client (reprise player)
create unique index if not exists session_runs_one_en_cours_idx
  on public.session_runs (client_id)
  where style = 'en_cours' and deleted_at is null;

-- 1 instance de séance template par plan (pas de re-run de la même instance)
-- Les styles terminés / pas_fait bloquent un second démarrage de la même séance du plan.
create unique index if not exists session_runs_plan_session_uidx
  on public.session_runs (plan_id, source_session_id)
  where plan_id is not null
    and source_session_id is not null
    and deleted_at is null
    and source = 'plan';

alter table public.session_runs enable row level security;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

drop policy if exists "session_runs_coach_all" on public.session_runs;
create policy "session_runs_coach_all"
on public.session_runs for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "session_runs_client_select" on public.session_runs;
create policy "session_runs_client_select"
on public.session_runs for select to authenticated
using (public.is_my_client_row(client_id) and deleted_at is null);

drop policy if exists "session_runs_client_insert" on public.session_runs;
create policy "session_runs_client_insert"
on public.session_runs for insert to authenticated
with check (
  public.is_my_client_row(client_id)
  and coach_id = (
    select c.coach_id from public.clients c where c.id = client_id
  )
);

drop policy if exists "session_runs_client_update" on public.session_runs;
create policy "session_runs_client_update"
on public.session_runs for update to authenticated
using (public.is_my_client_row(client_id) and deleted_at is null)
with check (public.is_my_client_row(client_id));

-- Soft-delete côté client (optionnel) — pas de DELETE hard pour le client
drop policy if exists "session_runs_client_soft_delete" on public.session_runs;
-- (couvert par UPDATE : deleted_at)

-- -----------------------------------------------------------------------------
-- Helpers player
-- -----------------------------------------------------------------------------

-- Run en cours du client authentifié (reprise)
create or replace function public.my_session_run_en_cours()
returns public.session_runs
language sql
stable
security definer
set search_path = public
as $$
  select sr.*
  from public.session_runs sr
  join public.clients c on c.id = sr.client_id
  where c.user_id = auth.uid()
    and c.deleted_at is null
    and sr.style = 'en_cours'
    and sr.deleted_at is null
  limit 1;
$$;

grant execute on function public.my_session_run_en_cours() to authenticated;

comment on table public.session_runs is
  'Exécution séance client : plan|libre|adapted · styles Accueil · snapshot + realized jsonb';
comment on column public.session_runs.snapshot is
  'Structure figée à l’ouverture du run (exos/blocs/consignes coach)';
comment on column public.session_runs.realized is
  'Réalisé client : séries, notes, Non fait, ajouts détachés du template';
comment on column public.session_runs.style is
  'fait | fait_edite | libre | pas_fait | en_cours — styles calendrier Accueil';

-- -----------------------------------------------------------------------------
-- Tracking
-- -----------------------------------------------------------------------------

insert into public.schema_migrations_trainly (id)
values ('11_session_runs')
on conflict (id) do nothing;
