-- =============================================================================
-- TRANCHE 84 — Tags personnalisés présentation showroom (profil coach)
-- Prérequis : 32_coach_public_profile
-- Après Run : dis « 84 OK »
-- =============================================================================

alter table public.coach_public_profile
  add column if not exists showroom_tags jsonb not null default '[]'::jsonb;

comment on column public.coach_public_profile.showroom_tags is
  'Pastilles custom présentation showroom (jsonb string[])';

insert into public.schema_migrations_trainly (id)
values ('84_coach_showroom_tags')
on conflict (id) do nothing;
