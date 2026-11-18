-- =============================================================================
-- TRANCHE 87 — Témoignages showroom (profil coach)
-- Prérequis : 32_coach_public_profile
-- Après Run : dis « 87 OK »
-- =============================================================================

alter table public.coach_public_profile
  add column if not exists showroom_testimonials jsonb not null default '[]'::jsonb;

comment on column public.coach_public_profile.showroom_testimonials is
  'Témoignages showroom [{id,name,quote,photo_url}]';

insert into public.schema_migrations_trainly (id)
values ('87_coach_showroom_testimonials')
on conflict (id) do nothing;
