-- =============================================================================
-- TRANCHE 78 — Presta showroom : vidéo + tag highlight
-- Prérequis : 77_prestation_showroom_media
-- Après Run : dis « 78 OK »
-- =============================================================================

alter table public.prestations
  add column if not exists video_url text;

alter table public.prestations
  add column if not exists highlight_tag text;

comment on column public.prestations.video_url is
  'Vidéo showroom (URL YouTube / Vimeo / MP4) — affichée dans la fiche détail';
comment on column public.prestations.highlight_tag is
  'Pastille mise en avant sur la card / fiche (ex. Perte de poids)';

insert into public.schema_migrations_trainly (id)
values ('78_prestation_showroom_media_v2')
on conflict (id) do nothing;
