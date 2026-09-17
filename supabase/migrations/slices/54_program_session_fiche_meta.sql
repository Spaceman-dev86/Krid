-- Métadonnées fiche séance sur les séances programme (= session_library).
-- Ne touchent PAS la composition (session_items = structure).

alter table public.sessions
  add column if not exists notes text;

alter table public.sessions
  add column if not exists objective_ressenti boolean not null default true;

alter table public.sessions
  add column if not exists objective_note boolean not null default true;

alter table public.sessions
  add column if not exists objective_difficulty boolean not null default true;

comment on column public.sessions.notes is
  'Consignes coach — équivalent session_library.notes (hors composition).';
comment on column public.sessions.objective_ressenti is
  'Feedback client fin de séance : ressenti (hors composition).';
comment on column public.sessions.objective_note is
  'Feedback client fin de séance : note (hors composition).';
comment on column public.sessions.objective_difficulty is
  'Feedback client fin de séance : difficulté 5 smileys (hors composition).';

insert into public.schema_migrations_trainly (id)
values ('54_program_session_fiche_meta')
on conflict (id) do nothing;
