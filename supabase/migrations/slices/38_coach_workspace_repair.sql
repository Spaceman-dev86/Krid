-- =============================================================================
-- TRANCHE 38 — Repair scope Trainly vs Coach + workspace coach pour admin
-- Prérequis : 37_trainly_vs_coach_programs
-- =============================================================================
-- Règle produit (FIGÉ) :
--   • Trainly  = is_trainly_catalog true  (créé côté /admin catalogue)
--   • Coach    = is_trainly_catalog false (biblio des coaches + workspace perso Remi)
--   • Admin peut aussi être “coach” via profiles.coach_workspace
-- =============================================================================

alter table public.profiles
  add column if not exists coach_workspace boolean not null default false;

comment on column public.profiles.coach_workspace is
  'Si true, le compte staff apparaît comme coach (biblio perso) tout en restant admin';

-- Tous les admins / platform_admin ont un workspace coach (ex. Remi)
update public.profiles
set coach_workspace = true
where role in ('admin', 'platform_admin')
  and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Repair programmes (FORCE, pas seulement null)
-- ---------------------------------------------------------------------------

-- 1) Tout programme d’un vrai coach → biblio coach
update public.programs p
set is_trainly_catalog = false
from public.profiles pr
where pr.id = p.coach_id
  and pr.role = 'coach';

-- 2) Programmes staff non publiés plateforme → biblio coach (Remi judo/crossfit/…)
update public.programs p
set is_trainly_catalog = false
from public.profiles pr
where pr.id = p.coach_id
  and pr.role in ('admin', 'platform_admin')
  and coalesce(p.catalog_status, 'draft') not in ('published', 'review')
  and coalesce(p.is_published, false) = false;

-- 3) Seuls les staff en review/published catalogue restent Trainly
update public.programs p
set is_trainly_catalog = true
from public.profiles pr
where pr.id = p.coach_id
  and pr.role in ('admin', 'platform_admin')
  and (
    coalesce(p.catalog_status, 'draft') in ('published', 'review')
    or coalesce(p.is_published, false) = true
  );

-- Ne plus auto-promouvoir les templates admin en Trainly (corrigé via repair ci-dessus)
-- Le trigger publish reste : review/published → Trainly

insert into public.schema_migrations_trainly (id)
values ('38_coach_workspace_repair')
on conflict (id) do nothing;
