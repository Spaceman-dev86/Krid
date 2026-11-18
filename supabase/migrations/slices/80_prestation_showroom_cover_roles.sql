-- =============================================================================
-- TRANCHE 80 — Presta showroom : rôles photo / vidéo (cover vs inline)
-- Prérequis : 79_prestation_showroom_pro
-- Après Run : dis « 80 OK »
-- =============================================================================

alter table public.prestations
  add column if not exists showroom_photo_is_cover boolean not null default true;

alter table public.prestations
  add column if not exists showroom_video_role text;

comment on column public.prestations.showroom_photo_is_cover is
  'true = photo aussi en couverture popup ; false = photo vignette uniquement';
comment on column public.prestations.showroom_video_role is
  'cover = vidéo couverture popup ; inline = vidéo dans le corps ; null = pas de vidéo';

-- Backfill : si une vidéo existe déjà, la traiter comme cover (comportement historique)
update public.prestations
set showroom_video_role = 'cover',
    showroom_photo_is_cover = false
where video_url is not null
  and trim(video_url) <> ''
  and showroom_video_role is null;

alter table public.prestations
  drop constraint if exists prestations_showroom_video_role_check;

alter table public.prestations
  add constraint prestations_showroom_video_role_check
  check (showroom_video_role is null or showroom_video_role in ('cover', 'inline'));

insert into public.schema_migrations_trainly (id)
values ('80_prestation_showroom_cover_roles')
on conflict (id) do nothing;
