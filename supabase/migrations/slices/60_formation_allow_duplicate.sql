-- =============================================================================
-- TRANCHE 60 — Formation : flag récupérable (Drive coach)
-- Spec : /documentation · dossiers Formation / Contenu KRID
-- =============================================================================

alter table public.trainly_formation_items
  add column if not exists allow_duplicate boolean not null default true;

comment on column public.trainly_formation_items.allow_duplicate is
  'Coach peut récupérer une copie dans son Drive (compte quota) depuis /documentation';
