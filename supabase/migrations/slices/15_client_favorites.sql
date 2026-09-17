-- =============================================================================
-- TRANCHE 15 — client_favorites (historique land)
-- Prérequis : 03_clients (+ 11_session_runs pour usage UI)
-- Après Run : dis « 15 OK » → land historique + fiche exo/bloc
-- =============================================================================
-- Périmètre V1 :
--   • Favoris client : exercise | block
--   • target_id = uuid exercise_library OU fingerprint bloc (title|type)
--   • RLS client own CRUD · coach SELECT
-- Hors scope : table records matérialisés · 1RM réel
-- =============================================================================

create table if not exists public.client_favorites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null
    check (target_type in ('exercise', 'block')),
  target_id text not null,
  created_at timestamptz not null default now(),
  unique (client_id, target_type, target_id)
);

create index if not exists client_favorites_client_id_idx
  on public.client_favorites (client_id, created_at desc);

create index if not exists client_favorites_coach_id_idx
  on public.client_favorites (coach_id);

alter table public.client_favorites enable row level security;

drop policy if exists "client_favorites_coach_select" on public.client_favorites;
create policy "client_favorites_coach_select"
on public.client_favorites for select to authenticated
using (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "client_favorites_client_select" on public.client_favorites;
create policy "client_favorites_client_select"
on public.client_favorites for select to authenticated
using (public.is_my_client_row(client_id));

drop policy if exists "client_favorites_client_insert" on public.client_favorites;
create policy "client_favorites_client_insert"
on public.client_favorites for insert to authenticated
with check (
  public.is_my_client_row(client_id)
  and coach_id = (
    select c.coach_id from public.clients c where c.id = client_id
  )
);

drop policy if exists "client_favorites_client_update" on public.client_favorites;
create policy "client_favorites_client_update"
on public.client_favorites for update to authenticated
using (public.is_my_client_row(client_id))
with check (public.is_my_client_row(client_id));

drop policy if exists "client_favorites_client_delete" on public.client_favorites;
create policy "client_favorites_client_delete"
on public.client_favorites for delete to authenticated
using (public.is_my_client_row(client_id));

comment on table public.client_favorites is
  'Favoris historique portail : exercise (library uuid / local:…) · block (fingerprint title|type)';

insert into public.schema_migrations_trainly (id)
values ('15_client_favorites')
on conflict (id) do nothing;
