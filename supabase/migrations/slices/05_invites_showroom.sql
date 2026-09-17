-- =============================================================================
-- TRANCHE 05 — Invites client + support showroom
-- Prérequis : 01 → 04
-- Après Run : dis « 05 OK » → code /c/[slug] + bouton inviter
-- =============================================================================

create table if not exists public.client_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint client_invites_token_format check (char_length(token) >= 16)
);

create unique index if not exists client_invites_token_uidx
  on public.client_invites (token);

create index if not exists client_invites_client_id_idx
  on public.client_invites (client_id);

create index if not exists client_invites_coach_id_idx
  on public.client_invites (coach_id);

create unique index if not exists client_invites_one_open_per_client
  on public.client_invites (client_id)
  where revoked_at is null and accepted_at is null;

alter table public.client_invites enable row level security;

drop policy if exists "client_invites_coach_all" on public.client_invites;
create policy "client_invites_coach_all"
on public.client_invites for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

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

  update public.clients
  set
    user_id = v_uid,
    email = coalesce(nullif(email, ''), v_invite.email),
    status = 'active',
    updated_at = now()
  where id = v_invite.client_id
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
  where id = v_uid;

  update public.client_invites
  set accepted_at = now()
  where id = v_invite.id;

  return v_invite.client_id;
end;
$$;

grant execute on function public.redeem_client_invite(text) to authenticated;

insert into public.schema_migrations_trainly (id)
values ('05_invites_showroom')
on conflict (id) do nothing;

comment on table public.client_invites is 'Lien d’invitation client → claim user_id ; showroom /c/[slug] côté app';
comment on function public.redeem_client_invite(text) is 'Lie auth.uid() au client de l’invite';
