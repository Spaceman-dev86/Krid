-- =============================================================================
-- TRANCHE 52 — Unités standard (short_label) + feedback run client
-- Prérequis : 50_session_library_catalog · 51_units_list_mode
-- Après Run : dis « 52 OK »
-- =============================================================================
-- Unités : short_label pour Rx compacte (séance / bloc / aperçu).
-- Objectifs :
--   • Fin de séance = feedback (ressenti / note / difficulté) sur session_runs
--   • Fin de bloc   = résultat attendu (unité) → realized.block_results jsonb
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) units.short_label
-- -----------------------------------------------------------------------------

alter table public.units
  add column if not exists short_label text;

comment on column public.units.short_label is
  'Symbole / abréviation Rx (ex. m, kg, Reps). Distinct du libellé (ex. Distance, Charge).';

-- Backfill catalogue Trainly (clés canoniques)
update public.units u set short_label = v.short
from (values
  ('sets', 'Séries'),
  ('reps', 'Reps'),
  ('load_kg', 'Kg'),
  ('rpe', 'RPE'),
  ('rest_s', 'Repos'),
  ('tempo', 'Tempo'),
  ('cal', 'Cal'),
  ('rounds', 'Rounds'),
  ('time_s', 'Temps'),
  ('time_min', 'Min'),
  ('distance_m', 'm'),
  ('completed', 'OK'),
  ('variable', 'Var'),
  ('note', 'Note')
) as v(key, short)
where u.coach_id is null
  and u.deleted_at is null
  and lower(trim(u.key)) = lower(trim(v.key))
  and (u.short_label is null or trim(u.short_label) = '');

-- Autres unités sans short : 1er mot du label, max 12
update public.units
set short_label = left(trim(split_part(label, ' ', 1)), 12)
where short_label is null
  and deleted_at is null
  and label is not null
  and length(trim(label)) > 0;

-- -----------------------------------------------------------------------------
-- 2) session_runs — feedback fin de séance (flags session_library.objective_*)
-- -----------------------------------------------------------------------------

alter table public.session_runs
  add column if not exists feedback_ressenti text,
  add column if not exists feedback_note text,
  add column if not exists feedback_difficulty smallint;

alter table public.session_runs
  drop constraint if exists session_runs_feedback_difficulty_chk;

alter table public.session_runs
  add constraint session_runs_feedback_difficulty_chk
  check (
    feedback_difficulty is null
    or (feedback_difficulty >= 1 and feedback_difficulty <= 5)
  );

comment on column public.session_runs.feedback_ressenti is
  'Feedback client fin de séance — texte libre (si objective_ressenti).';
comment on column public.session_runs.feedback_note is
  'Feedback client fin de séance — note libre (si objective_note).';
comment on column public.session_runs.feedback_difficulty is
  'Feedback client fin de séance — 1..5 smileys (si objective_difficulty).';
comment on column public.session_runs.realized is
  'Réalisé client. Inclut optionnellement block_results: '
  '[{ "block_id": uuid, "unit_id": uuid, "unit_key": text, "value": text }] '
  'pour le résultat attendu de chaque bloc (expected_result_unit_id).';

insert into public.schema_migrations_trainly (id)
values ('52_units_short_label_run_feedback')
on conflict (id) do nothing;
