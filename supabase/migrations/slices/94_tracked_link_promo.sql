-- =============================================================================
-- TRANCHE 94 — Campagne Liens : promo Codes attachée (optionnelle)
-- Prérequis : 29_coach_codes, 30_tracked_links
-- Après Run : dis « 94 OK »
-- =============================================================================

alter table public.coach_tracked_links
  add column if not exists promo_code_id uuid references public.coach_codes(id) on delete set null;

create index if not exists coach_tracked_links_promo_code_id_idx
  on public.coach_tracked_links (promo_code_id)
  where promo_code_id is not null;

comment on column public.coach_tracked_links.promo_code_id is
  'Promo coach_codes (type=promo) préremplie au checkout fiche — optionnel';

insert into public.schema_migrations_trainly (id)
values ('94_tracked_link_promo')
on conflict (id) do nothing;
