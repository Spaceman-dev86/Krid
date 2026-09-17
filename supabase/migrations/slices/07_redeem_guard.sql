-- =============================================================================
-- TRANCHE 07 — Garde-fous invite (coach ≠ client)
-- Prérequis : 05
-- Après Run : dis « 07 OK »
-- =============================================================================

create or replace function public.redeem_client_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.client_invites%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if public.is_platform_admin() then
    raise exception 'admin_cannot_redeem_invite';
  end if;

  select * into v_invite
  from public.client_invites
  where token = p_token
    and revoked_at is null
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invite_invalid_or_expired';
  end if;

  if v_uid = v_invite.coach_id then
    raise exception 'coach_cannot_redeem_own_invite';
  end if;

  update public.clients
  set
    user_id = v_uid,
    email = coalesce(nullif(email, ''), v_invite.email),
    status = 'active',
    updated_at = now()
  where id = v_invite.client_id
    and coach_id = v_invite.coach_id
    and deleted_at is null
    and (user_id is null or user_id = v_uid);

  if not found then
    raise exception 'client_unavailable';
  end if;

  update public.profiles
  set
    role = 'client',
    email = coalesce(email, v_invite.email),
    updated_at = now()
  where id = v_uid
    and role is distinct from 'coach'
    and role is distinct from 'admin'
    and role is distinct from 'platform_admin';

  update public.client_invites
  set accepted_at = now()
  where id = v_invite.id;

  return v_invite.client_id;
end;
$$;

-- Réparer les liaisons coach → fiche client (erreur invite en session coach)
update public.clients c
set user_id = null, updated_at = now()
where c.user_id = c.coach_id
  and c.deleted_at is null;

insert into public.schema_migrations_trainly (id)
values ('07_redeem_guard')
on conflict (id) do nothing;

comment on function public.redeem_client_invite(text) is 'Lie auth.uid() au client ; interdit coach_id = user_id';
