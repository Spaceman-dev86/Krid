-- =============================================================================
-- TRANCHE 83 — Présentation app sur le showroom
-- Prérequis : branding (logo / app_name)
-- Après Run : dis « 83 OK »
-- =============================================================================

alter table public.coach_branding
  add column if not exists app_showroom_title text,
  add column if not exists app_showroom_pitch text;

comment on column public.coach_branding.app_showroom_title is
  'Titre card app showroom (fallback = app_name)';
comment on column public.coach_branding.app_showroom_pitch is
  'Texte card app showroom : explique que les programmes sont dans l’app';

insert into public.schema_migrations_trainly (id)
values ('83_coach_app_showroom_pitch')
on conflict (id) do nothing;
