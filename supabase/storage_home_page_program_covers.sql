-- Politiques Storage optionnelles pour permettre l’upload des couvertures
-- depuis le navigateur (bucket public home_page, dossier programs/).
--
-- Si SUPABASE_SERVICE_ROLE_KEY est configurée côté Next.js, l’app utilise
-- l’upload serveur et ce script n’est pas obligatoire.
--
-- Exécuter dans Supabase → SQL Editor.

create policy "Admins insert program covers on home_page"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'home_page'
  and (storage.foldername(name))[1] = 'programs'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "Admins update program covers on home_page"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'home_page'
  and (storage.foldername(name))[1] = 'programs'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  bucket_id = 'home_page'
  and (storage.foldername(name))[1] = 'programs'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
