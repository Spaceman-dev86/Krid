-- Backfill optionnel : lie block_exercises.exercise_id quand seul exercise_name est renseigné.
-- À exécuter dans l’éditeur SQL Supabase si tu veux corriger l’historique en base.

BEGIN;

UPDATE block_exercises be
SET exercise_id = el.id
FROM exercise_library el
WHERE be.exercise_id IS NULL
  AND be.exercise_name IS NOT NULL
  AND trim(be.exercise_name) <> ''
  AND lower(trim(be.exercise_name)) = lower(trim(el.name));

COMMIT;

-- Vérification
SELECT be.id, be.exercise_name, be.exercise_id, el.name, el.demo_media_path
FROM block_exercises be
LEFT JOIN exercise_library el ON el.id = be.exercise_id
WHERE be.exercise_name IS NOT NULL
ORDER BY be.exercise_name
LIMIT 50;
