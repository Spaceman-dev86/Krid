-- =============================================================================
-- TRANCHE 81 — Pastilles programme : masquage unitaire
-- Prérequis : 79_prestation_showroom_pro
-- Après Run : dis « 81 OK »
-- =============================================================================

alter table public.prestations
  add column if not exists showroom_hidden_program_tags jsonb not null default '[]'::jsonb;

comment on column public.prestations.showroom_hidden_program_tags is
  'Tags programme masqués unitairement par le coach (jsonb string[])';

-- Si show_program_tags était false : on marque un sentinelle pour masquer tout côté app
-- (les tags concrets sont recalculés à l’édition ; sentinelle = ["*"])
update public.prestations
set showroom_hidden_program_tags = '["*"]'::jsonb
where show_program_tags = false
  and coalesce(showroom_hidden_program_tags, '[]'::jsonb) = '[]'::jsonb;

insert into public.schema_migrations_trainly (id)
values ('81_prestation_hidden_program_tags')
on conflict (id) do nothing;
