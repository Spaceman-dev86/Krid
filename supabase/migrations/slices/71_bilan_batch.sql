-- =============================================================================
-- TRANCHE 71 — Bilans : batch_id + source_group_id (1 ligne hub / envoi groupe)
-- Prérequis : 22_bilans
-- =============================================================================

alter table public.bilan_instances
  add column if not exists batch_id uuid;

alter table public.bilan_instances
  add column if not exists source_group_id uuid references public.client_groups(id) on delete set null;

create index if not exists bilan_instances_batch_idx
  on public.bilan_instances (coach_id, batch_id)
  where batch_id is not null;

create index if not exists bilan_instances_source_group_idx
  on public.bilan_instances (coach_id, source_group_id)
  where source_group_id is not null;

comment on column public.bilan_instances.batch_id is 'UUID partagé par toutes les instances d’un même envoi';
comment on column public.bilan_instances.source_group_id is 'Groupe d’origine si expansion depuis un groupe';
