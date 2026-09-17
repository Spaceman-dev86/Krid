-- =============================================================================
-- TRANCHE 26 — Flag onboarding terminé (questionnaire nouveau compte)
-- Prérequis : 03
-- Après Run : dis « 26 OK »
-- =============================================================================

alter table public.clients
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.clients.onboarding_completed_at is
  'Null = doit passer le questionnaire si le coach a des questions ; set = skip (réinstall / 2e presta)';

-- Clients déjà existants : ne pas forcer le questionnaire
update public.clients
set onboarding_completed_at = coalesce(onboarding_completed_at, now())
where deleted_at is null
  and onboarding_completed_at is null;

insert into public.schema_migrations_trainly (id)
values ('26_onboarding_completed')
on conflict (id) do nothing;
