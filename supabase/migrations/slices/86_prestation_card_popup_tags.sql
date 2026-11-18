-- =============================================================================
-- TRANCHE 86 — Pastilles card vs popup (prestation showroom)
-- Prérequis : 77_prestation_showroom_media · 81_prestation_hidden_program_tags
-- Après Run : dis « 86 OK »
-- =============================================================================

alter table public.prestations
  add column if not exists showroom_popup_tags jsonb not null default '[]'::jsonb;

comment on column public.prestations.showroom_tags is
  'Pastilles custom sur la card showroom (jsonb string[])';
comment on column public.prestations.showroom_popup_tags is
  'Pastilles custom dans la popup fiche (jsonb string[])';
comment on column public.prestations.showroom_description is
  'Note complémentaire popup (s’ajoute à description catalogue)';

-- Seed : copie les pastilles existantes vers la popup pour ne pas vider les fiches
update public.prestations
set showroom_popup_tags = coalesce(showroom_tags, '[]'::jsonb)
where coalesce(showroom_popup_tags, '[]'::jsonb) = '[]'::jsonb
  and coalesce(showroom_tags, '[]'::jsonb) <> '[]'::jsonb;

insert into public.schema_migrations_trainly (id)
values ('86_prestation_card_popup_tags')
on conflict (id) do nothing;
