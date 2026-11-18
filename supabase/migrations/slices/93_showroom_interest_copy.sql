-- =============================================================================
-- TRANCHE 93 — Textes CTA « Je suis intéressé » (titre + corps)
-- Prérequis : coach_branding
-- Après Run : dis « 93 OK »
-- =============================================================================

alter table public.coach_branding
  add column if not exists interest_discuss_title text,
  add column if not exists interest_discuss_body text;

comment on column public.coach_branding.interest_discuss_title is
  'Titre écran Je suis intéressé (prospect)';
comment on column public.coach_branding.interest_discuss_body is
  'Texte d’accroche sous le titre (prospect)';

insert into public.schema_migrations_trainly (id)
values ('93_showroom_interest_copy')
on conflict (id) do nothing;
