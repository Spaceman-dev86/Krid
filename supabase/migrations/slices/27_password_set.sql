-- =============================================================================
-- TRANCHE 27 — password_set_at (1ère connexion client → set MDP)
-- Après Run : dis « 27 OK »
-- =============================================================================

alter table public.profiles
  add column if not exists password_set_at timestamptz;

comment on column public.profiles.password_set_at is
  'Quand l’utilisateur a défini un mot de passe (signup coach, set après magic link, ou reset).';

-- Comptes déjà créés avec un vrai mdp Auth : on ne peut pas lire encrypted_password
-- côté public facilement ; laisser null → ils passent par « Mot de passe oublié »
-- ou set-password une fois. Les nouveaux signup coach marquent la colonne côté app.
