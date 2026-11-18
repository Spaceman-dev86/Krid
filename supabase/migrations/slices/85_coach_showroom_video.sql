-- =============================================================================
-- TRANCHE 85 — Vidéo présentation showroom (profil coach)
-- Prérequis : 32_coach_public_profile · cover_url déjà existant
-- Après Run : dis « 85 OK »
-- =============================================================================

alter table public.coach_public_profile
  add column if not exists video_url text;

comment on column public.coach_public_profile.video_url is
  'URL vidéo présentation showroom (YouTube / Vimeo / MP4)';

insert into public.schema_migrations_trainly (id)
values ('85_coach_showroom_video')
on conflict (id) do nothing;
