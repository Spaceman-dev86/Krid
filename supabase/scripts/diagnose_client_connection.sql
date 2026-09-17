-- =============================================================================
-- DIAGNOSTIC — connexion client / coach / portail
-- À lancer dans Supabase → SQL Editor (lecture seule, ne modifie rien)
-- Copie les résultats et partage-les pour debug
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Tranches SQL appliquées sur ce projet
-- -----------------------------------------------------------------------------
select id, applied_at
from public.schema_migrations_trainly
order by applied_at;

-- -----------------------------------------------------------------------------
-- 1) Comptes AUTH (auth.users) — emails sarro / vincent / coach
-- -----------------------------------------------------------------------------
select
  u.id as auth_user_id,
  u.email as auth_email,
  u.email_confirmed_at is not null as email_confirmed,
  u.created_at,
  u.last_sign_in_at,
  u.raw_app_meta_data,
  u.raw_user_meta_data
from auth.users u
where u.email ilike '%sarro%'
   or u.email ilike '%vincent%'
   or u.email ilike '%remi%'
order by u.email;

-- -----------------------------------------------------------------------------
-- 2) Profiles publics (lié 1:1 à auth.users.id)
-- -----------------------------------------------------------------------------
select
  p.id as profile_id,
  p.email as profile_email,
  p.role,
  p.full_name,
  p.created_at,
  p.updated_at
from public.profiles p
where p.email ilike '%sarro%'
   or p.email ilike '%vincent%'
   or p.email ilike '%remi%'
   or p.role in ('coach', 'client')
order by p.role, p.email;

-- -----------------------------------------------------------------------------
-- 3) Coach + branding (slug showroom / portail)
-- -----------------------------------------------------------------------------
select
  p.id as coach_id,
  p.email as coach_email,
  p.role,
  cb.slug,
  cb.app_name,
  cb.primary_color
from public.profiles p
left join public.coach_branding cb on cb.coach_id = p.id
where p.role = 'coach'
   or p.email ilike '%remi.sarro@gmail.com%';

-- -----------------------------------------------------------------------------
-- 4) Fiches CLIENTS — liaison user_id vs email fiche (LE TABLEAU CLÉ)
-- -----------------------------------------------------------------------------
select
  c.id as client_id,
  c.email as fiche_email,
  c.first_name,
  c.last_name,
  c.status,
  c.user_id as lie_user_id,
  p_lie.email as lie_auth_email,
  p_lie.role as lie_role,
  c.coach_id,
  p_coach.email as coach_email,
  case
    when c.user_id is null then '❌ NON LIÉ (user_id null)'
    when c.user_id = c.coach_id then '❌ ERREUR: user_id = coach_id'
    when p_lie.id is null then '❌ ERREUR: user_id sans profile'
    when lower(trim(c.email)) <> lower(trim(p_lie.email)) then '⚠️ EMAIL FICHE ≠ EMAIL AUTH LIÉ'
    when p_lie.role = 'coach' then '❌ ERREUR: lié à un compte coach'
    else '✅ liaison cohérente'
  end as diagnostic_liaison,
  c.created_at,
  c.updated_at
from public.clients c
left join public.profiles p_lie on p_lie.id = c.user_id
left join public.profiles p_coach on p_coach.id = c.coach_id
where c.deleted_at is null
order by c.email;

-- -----------------------------------------------------------------------------
-- 5) Pour remi.sarro86@gmail.com : quel auth user devrait être lié ?
-- -----------------------------------------------------------------------------
with target as (
  select 'remi.sarro86@gmail.com'::text as wanted_email
)
select
  t.wanted_email,
  u.id as auth_user_id_pour_ce_mail,
  u.last_sign_in_at,
  p.role as profile_role,
  c.id as client_fiche_id,
  c.user_id as client_user_id_actuel,
  p_lie.email as email_actuellement_lie,
  case
    when c.id is null then '❌ pas de fiche client avec cet email CRM'
    when c.user_id is null then '→ claim 08 devrait lier auth_user_id_pour_ce_mail'
    when c.user_id = u.id then '✅ déjà lié au bon auth user'
    else '❌ lié à un autre user_id — délier côté coach'
  end as verdict
from target t
left join auth.users u on lower(u.email) = lower(t.wanted_email)
left join public.profiles p on p.id = u.id
left join public.clients c on c.deleted_at is null and lower(c.email) = lower(t.wanted_email)
left join public.profiles p_lie on p_lie.id = c.user_id;

-- -----------------------------------------------------------------------------
-- 6) Invitations ouvertes / récentes
-- -----------------------------------------------------------------------------
select
  i.id,
  i.token,
  left(i.token, 12) || '…' as token_preview,
  i.email as invite_email,
  i.expires_at,
  i.accepted_at,
  i.revoked_at,
  i.created_at,
  c.email as client_fiche_email,
  c.user_id as client_user_id,
  case
    when i.revoked_at is not null then 'révoquée'
    when i.accepted_at is not null then 'acceptée'
    when i.expires_at < now() then 'expirée'
    else 'ouverte'
  end as invite_statut
from public.client_invites i
join public.clients c on c.id = i.client_id
where c.deleted_at is null
order by i.created_at desc
limit 20;

-- -----------------------------------------------------------------------------
-- 7) Grants actifs par client
-- -----------------------------------------------------------------------------
select
  c.email as client_email,
  c.user_id,
  g.id as grant_id,
  g.status,
  g.modules,
  g.starts_at,
  pr.name as prestation
from public.client_grants g
join public.clients c on c.id = g.client_id
left join public.prestations pr on pr.id = g.prestation_id
where c.deleted_at is null
  and g.status = 'active'
order by c.email;

-- -----------------------------------------------------------------------------
-- 8) Fonctions claim présentes ?
-- -----------------------------------------------------------------------------
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'redeem_client_invite',
    'claim_client_by_email_for_coach',
    'claim_client_rows_by_email'
  )
order by p.proname;

-- -----------------------------------------------------------------------------
-- 9) Simulation claim (sans exécuter) — emails qui matchent claim 08
-- -----------------------------------------------------------------------------
select
  c.id as client_id,
  c.email as fiche_email,
  u.id as auth_user_meme_email,
  u.email as auth_email,
  c.user_id as user_id_actuel,
  case
    when u.id is null then 'pas de compte auth avec cet email'
    when c.user_id is null then 'claim possible (user_id null)'
    when c.user_id = c.coach_id then 'claim possible (liaison coach erronée)'
    when c.user_id = u.id then 'déjà bon'
    else 'bloqué: lié à un autre user'
  end as claim_08_verdict
from public.clients c
left join auth.users u on lower(u.email) = lower(trim(c.email))
where c.deleted_at is null
  and (c.email ilike '%sarro%' or c.email ilike '%vincent%')
order by c.email;

-- -----------------------------------------------------------------------------
-- 10) Doublons email auth (rare mais bloquant)
-- -----------------------------------------------------------------------------
select lower(email) as email_lower, count(*) as nb_comptes_auth
from auth.users
group by lower(email)
having count(*) > 1;

-- =============================================================================
-- CHECKLIST Supabase Dashboard (pas SQL — vérifier à la main)
-- Authentication → URL Configuration :
--   Site URL: http://localhost:3000
--   Redirect URLs:
--     http://localhost:3000/auth/callback/coach
--     http://localhost:3000/auth/callback/portal
--     http://localhost:3000/auth/callback/portal/invite/*
--     (ou http://localhost:3000/**)
-- Authentication → Providers → Email : enabled
-- =============================================================================
