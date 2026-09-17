-- =============================================================================
-- TRANCHE 08 — Claim client par email (magic link sans invite)
-- Prérequis : 07
-- Après Run : dis « 08 OK »
-- =============================================================================

create or replace function public.claim_client_by_email_for_coach(p_coach_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_client public.clients%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_uid = p_coach_id then
    raise exception 'coach_cannot_be_client';
  end if;

  select email into v_email from public.profiles where id = v_uid;
  if v_email is null or length(trim(v_email)) = 0 then
    raise exception 'profile_email_missing';
  end if;

  select * into v_client
  from public.clients
  where coach_id = p_coach_id
    and lower(email) = lower(trim(v_email))
    and deleted_at is null
  for update;

  if not found then
    raise exception 'no_client_for_email';
  end if;

  if v_client.user_id is not null and v_client.user_id <> v_uid then
    if v_client.user_id = p_coach_id then
      -- liaison erronée (coach sur fiche client) — réattribuer
      null;
    else
      raise exception 'client_linked_to_other_user';
    end if;
  end if;

  update public.clients
  set
    user_id = v_uid,
    status = 'active',
    updated_at = now()
  where id = v_client.id;

  update public.profiles
  set
    role = 'client',
    email = coalesce(email, v_email),
    updated_at = now()
  where id = v_uid
    and role is distinct from 'coach'
    and role is distinct from 'admin'
    and role is distinct from 'platform_admin';

  return v_client.id;
end;
$$;

grant execute on function public.claim_client_by_email_for_coach(uuid) to authenticated;

-- Claim toutes les fiches client dont l’email CRM = email auth (cas magic link /login/client)
create or replace function public.claim_client_rows_by_email()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_count integer := 0;
  r record;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select email into v_email from public.profiles where id = v_uid;
  if v_email is null or length(trim(v_email)) = 0 then
    raise exception 'profile_email_missing';
  end if;

  for r in
    select id, coach_id, user_id
    from public.clients
    where lower(email) = lower(trim(v_email))
      and deleted_at is null
  loop
    if r.user_id is null or r.user_id = v_uid or r.user_id = r.coach_id then
      update public.clients
      set user_id = v_uid, status = 'active', updated_at = now()
      where id = r.id;
      v_count := v_count + 1;
    end if;
  end loop;

  if v_count > 0 then
    update public.profiles
    set role = 'client', email = coalesce(email, v_email), updated_at = now()
    where id = v_uid
      and role is distinct from 'coach'
      and role is distinct from 'admin'
      and role is distinct from 'platform_admin';
  end if;

  return v_count;
end;
$$;

grant execute on function public.claim_client_rows_by_email() to authenticated;

insert into public.schema_migrations_trainly (id)
values ('08_claim_client_email')
on conflict (id) do nothing;

comment on function public.claim_client_by_email_for_coach(uuid) is
  'Lie auth.uid() à la fiche client du coach si email correspond';
