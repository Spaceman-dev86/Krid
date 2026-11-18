-- =============================================================================
-- TRANCHE 91 — Ordre des cartes presta dans le showroom
-- Prérequis : prestations
-- Après Run : dis « 91 OK »
-- =============================================================================

alter table public.prestations
  add column if not exists showroom_sort_order integer not null default 0;

comment on column public.prestations.showroom_sort_order is
  'Ordre d’affichage des offres sur le showroom (0 = premier)';

insert into public.schema_migrations_trainly (id)
values ('91_prestation_showroom_sort')
on conflict (id) do nothing;
