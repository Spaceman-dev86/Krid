-- =============================================================================
-- TRANCHE 06 — RLS portail client (lecture prestations via grants)
-- Prérequis : 01 → 05
-- Après Run : dis « 06 OK »
-- =============================================================================

drop policy if exists "prestations_client_granted_select" on public.prestations;
create policy "prestations_client_granted_select"
on public.prestations for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.client_grants g
    where g.prestation_id = prestations.id
      and public.is_my_client_row(g.client_id)
  )
);

insert into public.schema_migrations_trainly (id)
values ('06_portal_rls')
on conflict (id) do nothing;
