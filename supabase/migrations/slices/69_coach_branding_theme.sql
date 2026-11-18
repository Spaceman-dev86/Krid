-- =============================================================================
-- TRANCHE 69 — Branding thème portail client (white-label)
-- Prérequis : 02 / 68
-- Après Run : dis « 69 OK »
-- =============================================================================
-- theme_mode · bg_style · secondary_color
-- =============================================================================

alter table public.coach_branding
  add column if not exists theme_mode text not null default 'dark';

alter table public.coach_branding
  add column if not exists bg_style text not null default 'carbon';

alter table public.coach_branding
  add column if not exists secondary_color text;

-- Contraintes (idempotent : drop puis recreate)
alter table public.coach_branding drop constraint if exists coach_branding_theme_mode_check;
alter table public.coach_branding
  add constraint coach_branding_theme_mode_check
  check (theme_mode in ('dark', 'light'));

alter table public.coach_branding drop constraint if exists coach_branding_bg_style_check;
alter table public.coach_branding
  add constraint coach_branding_bg_style_check
  check (bg_style in ('carbon', 'solid'));

comment on column public.coach_branding.theme_mode is 'Portail client: dark | light';
comment on column public.coach_branding.bg_style is 'Portail client: carbon (motif DA) | solid';
comment on column public.coach_branding.secondary_color is 'Accent secondaire white-label (hex)';

insert into public.schema_migrations_trainly (id)
values ('69_coach_branding_theme')
on conflict (id) do nothing;
