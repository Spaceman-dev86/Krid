-- =============================================================================
-- TRANCHE 64 — Calendrier RDV groupe (batch)
-- Prérequis : 18_calendar_rdv · 03_clients (client_groups)
-- Après Run : dis « 64 OK »
-- =============================================================================

alter table public.calendar_events
  add column if not exists group_id uuid references public.client_groups(id) on delete set null;

alter table public.calendar_events
  add column if not exists batch_id uuid;

create index if not exists calendar_events_batch_idx
  on public.calendar_events (coach_id, batch_id)
  where deleted_at is null and batch_id is not null;

create index if not exists calendar_events_group_idx
  on public.calendar_events (coach_id, group_id)
  where deleted_at is null and group_id is not null;

comment on column public.calendar_events.group_id is
  'Groupe source si RDV proposé à un groupe (1 ligne / membre).';
comment on column public.calendar_events.batch_id is
  'UUID partagé entre les lignes d’un même RDV multi-destinataires.';

insert into public.schema_migrations_trainly (id)
values ('64_calendar_group_rdv')
on conflict (id) do nothing;
