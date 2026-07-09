-- Program share links (token-based public preview)
-- Execute in Supabase → SQL Editor.
--
-- Creates a public token table to share program previews via URL:
--   /preview/<token>
--
-- Security notes:
-- - Tokens are secrets. Do NOT allow anon SELECT on this table.
-- - The Next.js preview route uses the server role key to resolve token → program.
-- - Only admins can create/revoke links.

create table if not exists public.program_share_links (
  token text primary key,
  program_id uuid not null references public.programs(id) on delete cascade,
  created_by uuid not null,
  recipient_email text null,
  message text null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null
);

create index if not exists program_share_links_program_id_idx
on public.program_share_links(program_id);

create index if not exists program_share_links_expires_at_idx
on public.program_share_links(expires_at);

alter table public.program_share_links enable row level security;

-- Only admins can read share links (optional, for future UI/audit).
create policy "Admins can read share links"
on public.program_share_links
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Only admins can insert share links.
create policy "Admins can insert share links"
on public.program_share_links
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Only admins can revoke (update).
create policy "Admins can update share links"
on public.program_share_links
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

