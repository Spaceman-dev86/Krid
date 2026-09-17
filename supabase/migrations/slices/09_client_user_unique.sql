-- =============================================================================
-- TRANCHE 09 — Un user_id = une fiche client par coach + délier doublons erronés
-- Prérequis : 08
-- Après Run : dis « 09 OK »
-- =============================================================================

-- Vincent partage le user_id de remi.sarro86 — délier (pas de compte auth vincent)
update public.clients
set user_id = null, status = 'invited', updated_at = now()
where email = 'vincentfrere@rochefort.com'
  and user_id is not null
  and deleted_at is null
  and not exists (
    select 1 from auth.users u where u.id = clients.user_id and lower(u.email) = lower(clients.email)
  );

-- Empêcher 2 fiches client avec le même user_id pour un coach
create unique index if not exists clients_coach_user_uidx
  on public.clients (coach_id, user_id)
  where user_id is not null and deleted_at is null;

insert into public.schema_migrations_trainly (id)
values ('09_client_user_unique')
on conflict (id) do nothing;
