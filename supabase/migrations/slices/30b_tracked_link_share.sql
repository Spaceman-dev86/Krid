-- =============================================================================
-- TRANCHE 30b — Message de partage éditable sur liens trackés
-- Prérequis : 30_tracked_links
-- Après Run : dis « 30b OK »
-- =============================================================================

alter table public.coach_tracked_links
  add column if not exists share_message text;

comment on column public.coach_tracked_links.share_message is
  'Texte copié avec l’URL (WhatsApp / IG / etc.) — le coach l’édite';

insert into public.schema_migrations_trainly (id)
values ('30b_tracked_link_share')
on conflict (id) do nothing;
