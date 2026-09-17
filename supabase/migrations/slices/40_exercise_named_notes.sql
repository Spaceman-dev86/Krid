-- =============================================================================
-- TRANCHE 40 — Notes libres + ponts titrés · allow_download off Trainly
-- Prérequis : 39_exercise_fiche_types_replacements
-- Après Run : dis « 40 OK » (recharge aussi le schema cache PostgREST)
-- =============================================================================

alter table public.exercise_library
  add column if not exists named_notes jsonb not null default '[]'::jsonb;

comment on column public.exercise_library.named_notes is
  'Notes libres [{title, body}] — titre choisi par l’auteur';

comment on column public.exercise_library.common_mistakes is
  'Legacy — préférer named_notes';

-- Ponts : titre + note optionnelle + exercice cible
alter table public.exercise_replacements
  add column if not exists title text,
  add column if not exists note text;

comment on column public.exercise_replacements.title is
  'Titre du pont (affiché sur la fiche)';
comment on column public.exercise_replacements.note is
  'Note optionnelle sur le pont';

-- Coach ne télécharge pas le contenu d’un exo Trainly
update public.exercise_library
set allow_download = false
where coach_id is null;

alter table public.exercise_library
  alter column allow_download set default false;

comment on column public.exercise_library.allow_download is
  'Toujours false pour catalogue Trainly (coach_id null) — pas de téléchargement contenu exo';

-- Forcer false à l’écriture Trainly
create or replace function public.exercise_library_force_no_download_trainly()
returns trigger
language plpgsql
as $$
begin
  if NEW.coach_id is null then
    NEW.allow_download := false;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_exercise_no_download_trainly on public.exercise_library;
create trigger trg_exercise_no_download_trainly
before insert or update on public.exercise_library
for each row
execute function public.exercise_library_force_no_download_trainly();

insert into public.schema_migrations_trainly (id)
values ('40_exercise_named_notes')
on conflict (id) do nothing;

-- Recharge le cache schema PostgREST / Supabase API
notify pgrst, 'reload schema';
