-- Vérifier les médias référencés en base vs fichiers uploadés (à lancer après import + upload)
-- Les chemins doivent correspondre EXACTEMENT aux noms à la racine du bucket exercise-media.

SELECT
  el.id,
  el.name,
  el.demo_media_path,
  CASE
    WHEN el.demo_media_path IS NULL THEN 'no_media'
    ELSE 'check_storage'
  END AS status
FROM public.exercise_library el
WHERE el.coach_id IS NULL
  AND el.deleted_at IS NULL
ORDER BY el.muscle_group NULLS LAST, el.name;

-- Comptage catalogue Trainly
SELECT count(*) AS trainly_exercises
FROM public.exercise_library
WHERE coach_id IS NULL AND deleted_at IS NULL;
