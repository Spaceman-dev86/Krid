-- Commentaires coach empilés sur une séance réalisée (fiche plan)
alter table public.session_runs
  add column if not exists coach_comments jsonb not null default '[]'::jsonb;

comment on column public.session_runs.coach_comments is
  'Array of { id, text, created_at, coach_id } — retours coach (notif client ultérieure)';
