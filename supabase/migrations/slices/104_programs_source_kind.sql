-- Provenance hub programmes coach (Perso vs fork Catalogue Krid).
alter table public.programs
  add column if not exists source_kind text not null default 'own';

alter table public.programs
  drop constraint if exists programs_source_kind_check;

alter table public.programs
  add constraint programs_source_kind_check
  check (source_kind in ('own', 'krid'));

comment on column public.programs.source_kind is
  'Hub brouillon : own = créé coach · krid = fork catalogue plateforme';
