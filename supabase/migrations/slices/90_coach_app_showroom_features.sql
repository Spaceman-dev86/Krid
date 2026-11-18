-- =============================================================================
-- TRANCHE 90 — Points forts card app showroom (switches ✓)
-- Prérequis : 83_coach_app_showroom_pitch
-- Après Run : dis « 90 OK »
-- =============================================================================

alter table public.coach_branding
  add column if not exists app_showroom_features jsonb not null default '[]'::jsonb;

comment on column public.coach_branding.app_showroom_features is
  'Points forts card app showroom (jsonb string[], checkmarks couleur brand)';

insert into public.schema_migrations_trainly (id)
values ('90_coach_app_showroom_features')
on conflict (id) do nothing;
