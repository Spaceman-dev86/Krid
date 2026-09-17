-- =============================================================================
-- TRANCHE 23 — Comptabilités (liens 24h · demandes facture · factures)
-- Prérequis : 04_prestations_grants (payment_ledger · client_grants)
-- Après Run : dis « 23 OK »
-- =============================================================================
-- Périmètre MVP :
--   • payment_links_24h (lien de paiement — mock sans Stripe Connect)
--   • invoice_requests (demande client)
--   • invoices (génération manuelle coach)
-- Hors scope : Stripe Connect · PDF avancé · cron renouvellements
-- =============================================================================

create table if not exists public.payment_links_24h (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  prestation_id uuid not null references public.prestations(id) on delete restrict,
  title text,
  description text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  payment_ledger_id uuid references public.payment_ledger(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payment_links_24h_coach_idx on public.payment_links_24h (coach_id);
create index if not exists payment_links_24h_token_idx on public.payment_links_24h (token);

alter table public.payment_links_24h enable row level security;

drop policy if exists "payment_links_coach_all" on public.payment_links_24h;
create policy "payment_links_coach_all"
on public.payment_links_24h for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "payment_links_client_select" on public.payment_links_24h;
create policy "payment_links_client_select"
on public.payment_links_24h for select to authenticated
using (public.is_my_client_row(client_id));

-- -----------------------------------------------------------------------------

create table if not exists public.invoice_requests (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  prestation_id uuid references public.prestations(id) on delete set null,
  payment_ledger_id uuid references public.payment_ledger(id) on delete set null,
  comment text,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists invoice_requests_coach_idx
  on public.invoice_requests (coach_id, status);

alter table public.invoice_requests enable row level security;

drop policy if exists "invoice_requests_coach_all" on public.invoice_requests;
create policy "invoice_requests_coach_all"
on public.invoice_requests for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "invoice_requests_client_all" on public.invoice_requests;
create policy "invoice_requests_client_all"
on public.invoice_requests for all to authenticated
using (public.is_my_client_row(client_id))
with check (public.is_my_client_row(client_id));

-- -----------------------------------------------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  payment_ledger_id uuid not null references public.payment_ledger(id) on delete restrict,
  invoice_request_id uuid references public.invoice_requests(id) on delete set null,
  number text not null,
  amount_cents integer not null default 0,
  issued_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  unique (coach_id, number)
);

create index if not exists invoices_coach_idx on public.invoices (coach_id, issued_at desc);

alter table public.invoices enable row level security;

drop policy if exists "invoices_coach_all" on public.invoices;
create policy "invoices_coach_all"
on public.invoices for all to authenticated
using (coach_id = auth.uid() or public.is_platform_admin())
with check (coach_id = auth.uid() or public.is_platform_admin());

drop policy if exists "invoices_client_select" on public.invoices;
create policy "invoices_client_select"
on public.invoices for select to authenticated
using (public.is_my_client_row(client_id));

comment on table public.payment_links_24h is 'Liens paiement 24h · Connect later';
comment on table public.invoice_requests is 'Demandes facture client → Suivi coach';
comment on table public.invoices is 'Factures générées manuellement (V1)';

insert into public.schema_migrations_trainly (id)
values ('23_compta')
on conflict (id) do nothing;
