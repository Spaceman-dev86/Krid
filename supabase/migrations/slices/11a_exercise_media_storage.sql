-- =============================================================================
-- TRANCHE 11a — Bucket exercise-media + policies (médias exercices Trainly)
-- Prérequis : 10_programs
-- À lancer APRÈS avoir uploadé les GIF/PNG/MP4 dans le bucket (racine du bucket).
-- Nom du bucket OBLIGATOIRE : exercise-media (utilisé par l’app)
-- Après Run : dis « 11a storage OK »
-- =============================================================================

BEGIN;

-- Créer le bucket s’il n’existe pas (Dashboard : Storage → New bucket → id = exercise-media)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-media',
  'exercise-media',
  false,
  52428800,
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Policies storage.objects — lecture auth (coach + client) · écriture admin
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "exercise_media_select_authenticated" ON storage.objects;
CREATE POLICY "exercise_media_select_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'exercise-media');

DROP POLICY IF EXISTS "exercise_media_admin_insert" ON storage.objects;
CREATE POLICY "exercise_media_admin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exercise-media'
  AND public.is_platform_admin()
);

DROP POLICY IF EXISTS "exercise_media_admin_update" ON storage.objects;
CREATE POLICY "exercise_media_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'exercise-media'
  AND public.is_platform_admin()
)
WITH CHECK (
  bucket_id = 'exercise-media'
  AND public.is_platform_admin()
);

DROP POLICY IF EXISTS "exercise_media_admin_delete" ON storage.objects;
CREATE POLICY "exercise_media_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'exercise-media'
  AND public.is_platform_admin()
);

-- Coach : upload dans son dossier (exercices perso futurs)
DROP POLICY IF EXISTS "exercise_media_coach_insert_own_folder" ON storage.objects;
CREATE POLICY "exercise_media_coach_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exercise-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "exercise_media_coach_update_own_folder" ON storage.objects;
CREATE POLICY "exercise_media_coach_update_own_folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'exercise-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'exercise-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "exercise_media_coach_delete_own_folder" ON storage.objects;
CREATE POLICY "exercise_media_coach_delete_own_folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'exercise-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

INSERT INTO public.schema_migrations_trainly (id)
VALUES ('11a_exercise_media_storage')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Vérification rapide (hors transaction) :
-- SELECT id, public FROM storage.buckets WHERE id = 'exercise-media';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'exercise_media%';
