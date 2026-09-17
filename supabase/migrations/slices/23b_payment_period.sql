-- =============================================================================
-- TRANCHE 23b — Période mensuelle sur payment_ledger (anti double paiement)
-- Prérequis : 04 + 23
-- Après Run : dis « 23b OK »
--
-- Idempotent : nettoyage des doublons Payé (Accorder + manuel) avant les index.
-- Garde le plus ancien Payé ; les doublons → refunded + grants liés terminés.
-- =============================================================================

alter table public.payment_ledger
  add column if not exists period_ym text;

comment on column public.payment_ledger.period_ym is
  'Mois couvert YYYY-MM pour presta renewable ; null si unique';

-- ---------------------------------------------------------------------------
-- 1) Doublons presta unique (period_ym null)
-- ---------------------------------------------------------------------------
with ranked as (
  select
    id,
    row_number() over (
      partition by coach_id, client_id, prestation_id
      order by created_at asc, id asc
    ) as rn
  from public.payment_ledger
  where status = 'paid'
    and period_ym is null
),
refunded as (
  update public.payment_ledger pl
  set status = 'refunded'
  from ranked r
  where pl.id = r.id
    and r.rn > 1
  returning pl.id
)
update public.client_grants cg
set
  status = 'ended',
  ends_at = coalesce(cg.ends_at, now())
where cg.status = 'active'
  and cg.payment_ledger_id in (select id from refunded);

-- ---------------------------------------------------------------------------
-- 2) Doublons presta mensuelle (même period_ym)
-- ---------------------------------------------------------------------------
with ranked as (
  select
    id,
    row_number() over (
      partition by coach_id, client_id, prestation_id, period_ym
      order by created_at asc, id asc
    ) as rn
  from public.payment_ledger
  where status = 'paid'
    and period_ym is not null
),
refunded as (
  update public.payment_ledger pl
  set status = 'refunded'
  from ranked r
  where pl.id = r.id
    and r.rn > 1
  returning pl.id
)
update public.client_grants cg
set
  status = 'ended',
  ends_at = coalesce(cg.ends_at, now())
where cg.status = 'active'
  and cg.payment_ledger_id in (select id from refunded);

-- Un seul paiement Payé par (client, presta) si unique (period_ym null)
create unique index if not exists payment_ledger_unique_paid_uidx
  on public.payment_ledger (coach_id, client_id, prestation_id)
  where status = 'paid' and period_ym is null;

-- Un seul paiement Payé par mois pour renewable
create unique index if not exists payment_ledger_renewable_paid_uidx
  on public.payment_ledger (coach_id, client_id, prestation_id, period_ym)
  where status = 'paid' and period_ym is not null;

insert into public.schema_migrations_trainly (id)
values ('23b_payment_period')
on conflict (id) do nothing;
