-- =============================================================================
-- TRANCHE 77 — Presta showroom : photo + tags personnalisés
-- Prérequis : 04_prestations_grants
-- Après Run : dis « 77 OK »
-- =============================================================================

alter table public.prestations
  add column if not exists photo_url text;

alter table public.prestations
  add column if not exists showroom_tags jsonb not null default '[]'::jsonb;

comment on column public.prestations.photo_url is
  'Image showroom (card + fiche) — URL publique storage';
comment on column public.prestations.showroom_tags is
  'Tags marketing showroom (jsonb string[]) — ex. Niveau débutant, 8 semaines';

insert into public.schema_migrations_trainly (id)
values ('77_prestation_showroom_media')
on conflict (id) do nothing;
