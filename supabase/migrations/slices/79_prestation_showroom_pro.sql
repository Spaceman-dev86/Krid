-- =============================================================================
-- TRANCHE 79 — Presta showroom pro (description popup · semaine · CTA · eyebrow)
-- Prérequis : 78_prestation_showroom_media_v2
-- Après Run : dis « 79 OK »
-- =============================================================================

alter table public.prestations
  add column if not exists showroom_description text;

alter table public.prestations
  add column if not exists showroom_week_id uuid;

alter table public.prestations
  add column if not exists showroom_cta_label text;

alter table public.prestations
  add column if not exists showroom_eyebrow text;

alter table public.prestations
  add column if not exists show_program_tags boolean not null default true;

comment on column public.prestations.showroom_description is
  'Texte marketing de la fiche popup showroom (peut différer de description catalogue)';
comment on column public.prestations.showroom_week_id is
  'Semaine programme mise en avant dans la popup (aperçu Lun→Dim)';
comment on column public.prestations.showroom_cta_label is
  'Label CTA popup (ex. Découvrir, Demander une clé)';
comment on column public.prestations.showroom_eyebrow is
  'Sur-titre au-dessus du nom sur card / fiche';
comment on column public.prestations.show_program_tags is
  'Inclure les tags auto du programme lié dans les pastilles';

-- Fusion legacy highlight_tag → showroom_tags (une seule fois si highlight présent)
update public.prestations p
set showroom_tags = (
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  from (
    select distinct trim(x) as t
    from (
      select p.highlight_tag as x
      union all
      select jsonb_array_elements_text(coalesce(p.showroom_tags, '[]'::jsonb))
    ) s
    where trim(coalesce(x, '')) <> ''
  ) u
)
where p.highlight_tag is not null
  and trim(p.highlight_tag) <> ''
  and not exists (
    select 1
    from jsonb_array_elements_text(coalesce(p.showroom_tags, '[]'::jsonb)) e
    where lower(trim(e)) = lower(trim(p.highlight_tag))
  );

insert into public.schema_migrations_trainly (id)
values ('79_prestation_showroom_pro')
on conflict (id) do nothing;
