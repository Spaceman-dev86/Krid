-- =============================================================================
-- TRANCHE 31 — Storage logos branding coach (upload Mon app)
-- Prérequis : 02_coach_tenancy
-- Après Run : dis « 31 OK »
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-branding',
  'coach-branding',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lecture publique (showroom / OG)
drop policy if exists "coach_branding_storage_public_select" on storage.objects;
create policy "coach_branding_storage_public_select"
on storage.objects for select
to public
using (bucket_id = 'coach-branding');

-- Coach : CRUD dans son dossier {coach_id}/…
drop policy if exists "coach_branding_storage_coach_insert" on storage.objects;
create policy "coach_branding_storage_coach_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'coach-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "coach_branding_storage_coach_update" on storage.objects;
create policy "coach_branding_storage_coach_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'coach-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'coach-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "coach_branding_storage_coach_delete" on storage.objects;
create policy "coach_branding_storage_coach_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'coach-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

insert into public.schema_migrations_trainly (id)
values ('31_coach_branding_storage')
on conflict (id) do nothing;
