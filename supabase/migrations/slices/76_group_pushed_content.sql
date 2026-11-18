-- =============================================================================
-- TRANCHE 76 — Contenus envoyés depuis un groupe (sport | nutrition)
-- Prérequis : 72_group_linked_presta · 10_programs · 19_nutrition
-- Liste coach : quels programmes / plans ont été pushés depuis le groupe
-- =============================================================================

create table if not exists public.client_group_pushed_content (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.client_groups(id) on delete cascade,
  kind text not null check (kind in ('fitness', 'nutrition')),
  content_id uuid not null,
  last_pushed_at timestamptz not null default now(),
  last_pushed_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (group_id, kind, content_id)
);

create index if not exists client_group_pushed_content_group_idx
  on public.client_group_pushed_content (group_id, last_pushed_at desc);

alter table public.client_group_pushed_content enable row level security;

drop policy if exists "client_group_pushed_content_coach_all" on public.client_group_pushed_content;
create policy "client_group_pushed_content_coach_all"
on public.client_group_pushed_content for all to authenticated
using (
  exists (
    select 1 from public.client_groups g
    where g.id = group_id
      and (g.coach_id = auth.uid() or public.is_platform_admin())
  )
)
with check (
  exists (
    select 1 from public.client_groups g
    where g.id = group_id
      and (g.coach_id = auth.uid() or public.is_platform_admin())
  )
);

comment on table public.client_group_pushed_content is
  'Historique / liste des programmes sport & nutrition envoyés depuis un groupe';
