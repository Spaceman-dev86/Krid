-- =============================================================================
-- TRANCHE 88 — Pastilles sous le header showroom (profil coach)
-- Prérequis : 84_coach_showroom_tags
-- Après Run : dis « 88 OK »
-- =============================================================================

alter table public.coach_public_profile
  add column if not exists showroom_header_tags jsonb not null default '[]'::jsonb;

comment on column public.coach_public_profile.showroom_header_tags is
  'Pastilles sous le header cover (jsonb string[])';
comment on column public.coach_public_profile.showroom_tags is
  'Pastilles sous la card app (jsonb string[])';

insert into public.schema_migrations_trainly (id)
values ('88_coach_showroom_header_tags')
on conflict (id) do nothing;
