-- =============================================================================
-- TRANCHE 25 — 1 plan « en cours » seulement (pause n’occupe plus le slot)
-- Prérequis : 10 + 19
-- Après Run : dis « 25 OK »
--
-- Avant : unique (client) où status in (started, paused)
--   → impossible de démarrer Crossfit si hypertrophy est en pause.
-- Après : unique seulement sur status = started
--   → pause libère le slot ; plusieurs paused OK ; 1 started max / track.
-- =============================================================================

drop index if exists public.client_fitness_plans_one_active_idx;
create unique index client_fitness_plans_one_started_idx
  on public.client_fitness_plans (client_id)
  where status = 'started';

drop index if exists public.client_nutrition_plans_one_active_idx;
create unique index client_nutrition_plans_one_started_idx
  on public.client_nutrition_plans (client_id)
  where status = 'started';

comment on index public.client_fitness_plans_one_started_idx is
  'Au plus 1 plan fitness démarré (started) par client — paused ne bloque pas';
comment on index public.client_nutrition_plans_one_started_idx is
  'Au plus 1 plan nutrition démarré (started) par client — paused ne bloque pas';

insert into public.schema_migrations_trainly (id)
values ('25_one_started_plan')
on conflict (id) do nothing;
