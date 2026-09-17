-- =============================================================================
-- TRANCHE 28 — Inscription client depuis showroom (sans invite)
-- Prérequis : 08 (claim email)
-- Après Run : dis « 28 OK »
-- =============================================================================

create or replace function public.register_as_client_for_coach(
  p_coach_id uuid,
  p_first_name text default null,
  p_last_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_client public.clients%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_uid = p_coach_id then
    raise exception 'coach_cannot_be_client';
  end if;

  -- Coach : profil coach/admin OU présence branding (showroom)
  if not exists (
    select 1 from public.profiles
    where id = p_coach_id
      and role in ('coach', 'platform_admin', 'admin')
      and deleted_at is null
  ) and not exists (
    select 1 from public.coach_branding where coach_id = p_coach_id
  ) then
    raise exception 'coach_not_found';
  end if;

  select email into v_email from public.profiles where id = v_uid;
  if v_email is null or length(trim(v_email)) = 0 then
    select email into v_email from auth.users where id = v_uid;
  end if;
  if v_email is null or length(trim(v_email)) = 0 then
    raise exception 'profile_email_missing';
  end if;
  v_email := lower(trim(v_email));

  select * into v_client
  from public.clients
  where coach_id = p_coach_id
    and lower(email) = v_email
    and deleted_at is null
  for update;

  if found then
    if v_client.user_id is not null and v_client.user_id <> v_uid then
      raise exception 'client_linked_to_other_user';
    end if;

    update public.clients
    set
      user_id = v_uid,
      status = 'active',
      first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
      last_name = coalesce(nullif(trim(p_last_name), ''), last_name),
      updated_at = now()
    where id = v_client.id;

    v_id := v_client.id;
  else
    insert into public.clients (
      coach_id,
      user_id,
      email,
      first_name,
      last_name,
      status,
      created_at,
      updated_at
    )
    values (
      p_coach_id,
      v_uid,
      v_email,
      nullif(trim(p_first_name), ''),
      nullif(trim(p_last_name), ''),
      'active',
      now(),
      now()
    )
    returning id into v_id;
  end if;

  update public.profiles
  set
    role = 'client',
    email = coalesce(email, v_email),
    full_name = coalesce(
      nullif(trim(concat_ws(' ', p_first_name, p_last_name)), ''),
      full_name
    ),
    updated_at = now()
  where id = v_uid
    and role is distinct from 'coach'
    and role is distinct from 'admin'
    and role is distinct from 'platform_admin';

  return v_id;
end;
$$;

grant execute on function public.register_as_client_for_coach(uuid, text, text) to authenticated;

comment on function public.register_as_client_for_coach(uuid, text, text) is
  'Showroom / self-serve : crée ou lie la fiche client au user connecté (sans grant / paiement).';
