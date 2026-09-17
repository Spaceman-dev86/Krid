-- =============================================================================
-- TRANCHE 47 — Blocs libres : format optionnel · timer_note coach
-- Prérequis : 43_block_library_catalog · 46…
-- Décision produit : plus de format structurel ; minuteur = saisie libre coach
-- =============================================================================

alter table public.block_library
  alter column format_id drop not null;

alter table public.block_library
  add column if not exists timer_note text;

comment on column public.block_library.format_id is
  'Optionnel / legacy — plus requis à la création (blocs libres).';
comment on column public.block_library.timer_note is
  'Minuteur / intervalle libre saisi par le coach (ex. « 20 min », « toutes les 5:00 »).';

insert into public.schema_migrations_trainly (id)
values ('47_block_freeform_timer_note')
on conflict (id) do nothing;
