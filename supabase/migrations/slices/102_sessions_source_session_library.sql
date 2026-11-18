-- Provenance photocopie : séance programme ← modèle session_library
alter table public.sessions
  add column if not exists source_session_library_id uuid null
    references public.session_library(id) on delete set null;

comment on column public.sessions.source_session_library_id is
  'Modèle session_library d’origine (photocopie programme) — info usages, pas de lien live';

create index if not exists sessions_source_session_library_id_idx
  on public.sessions (source_session_library_id)
  where source_session_library_id is not null;
