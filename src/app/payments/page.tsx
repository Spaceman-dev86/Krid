import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { ManualPaymentForm } from '../../components/coach/ManualPaymentForm'
import { PaymentsSubnav } from '../../components/coach/PaymentsSubnav'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { clientDisplayName } from '../../lib/chat/chat'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { formatPriceCents } from '../../lib/prestations/modules'
import { createClient } from '../../lib/supabase/server'
import { markPaymentPaidAction, refundPaymentAction } from './actions'

export const dynamic = 'force-dynamic'

function ledgerStatusLabel(s: string) {
  switch (s) {
    case 'pending':
      return 'En attente'
    case 'paid':
      return 'Payé'
    case 'failed':
      return 'Échoué'
    case 'expired':
      return 'Expiré'
    case 'refunded':
      return 'Remboursé'
    default:
      return s
  }
}

function sourceLabel(s: string) {
  switch (s) {
    case 'manual':
      return 'Manuel'
    case 'link':
      return 'Lien'
    case 'stripe':
      return 'Stripe'
    case 'showroom':
      return 'Showroom'
    default:
      return s
  }
}

type Props = {
  searchParams?:
    | Promise<{
        error?: string
        created?: string
        paid?: string
        refunded?: string
        q?: string
        status?: string
      }>
    | {
        error?: string
        created?: string
        paid?: string
        refunded?: string
        q?: string
        status?: string
      }
}

export default async function PaymentsLedgerPage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  let query = supabase
    .from('payment_ledger')
    .select(
      'id, amount_cents, status, source, paid_at, created_at, period_ym, client_id, prestation_id, clients(first_name, last_name, email), prestations(name)'
    )
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  const { data: rows, error } = await query

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('first_name', { ascending: true })

  const { data: prestations } = await supabase
    .from('prestations')
    .select('id, name, price_cents, pricing_type')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .eq('status', 'active')
    .order('name', { ascending: true })

  const { data: paidRows } = await supabase
    .from('payment_ledger')
    .select('client_id, prestation_id, period_ym')
    .eq('coach_id', user.id)
    .eq('status', 'paid')

  const q = (params.q ?? '').trim().toLowerCase()
  const filtered = (rows ?? []).filter((r) => {
    if (!q) return true
    const clientsRel = r.clients as
      | { first_name: string | null; last_name: string | null; email: string }
      | { first_name: string | null; last_name: string | null; email: string }[]
      | null
    const client = Array.isArray(clientsRel) ? clientsRel[0] : clientsRel
    const prestaRel = r.prestations as { name?: string } | { name?: string }[] | null
    const prestaName = Array.isArray(prestaRel) ? prestaRel[0]?.name : prestaRel?.name
    const name = client
      ? clientDisplayName({
          first_name: client.first_name,
          last_name: client.last_name,
          email: client.email,
        })
      : ''
    return (
      name.toLowerCase().includes(q) ||
      (prestaName ?? '').toLowerCase().includes(q) ||
      String(r.amount_cents / 100).includes(q) ||
      (r.period_ym ?? '').includes(q)
    )
  })

  function formatPeriodYm(ym: string) {
    const [y, m] = ym.split('-')
    if (!y || !m) return ym
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Comptabilités" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Paiements</PageTitle>
            <Muted className="mt-1">Ledger immuable · manuel maintenant · Stripe plus tard</Muted>
          </div>
          <PaymentsSubnav />
        </div>

        {params.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{params.error}</div>
        ) : null}
        {params.created || params.paid || params.refunded ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {params.refunded
              ? 'Remboursé — accès retiré.'
              : params.paid
                ? 'Marqué Payé — accès accordé.'
                : 'Paiement ajouté.'}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error.message}</div>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Ajouter un paiement manuel
          </h2>
          <ManualPaymentForm
            clients={(clients ?? []).map((c) => ({
              id: c.id,
              label: clientDisplayName({
                first_name: c.first_name,
                last_name: c.last_name,
                email: c.email,
              }),
            }))}
            prestations={(prestations ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              price_cents: p.price_cents,
              pricing_type: p.pricing_type ?? 'unique',
            }))}
            alreadyPaid={(paidRows ?? []).map((r) => ({
              client_id: r.client_id,
              prestation_id: r.prestation_id,
              period_ym: r.period_ym,
            }))}
          />
          {!(prestations ?? []).length ? (
            <p className="mt-3 text-xs text-[color:var(--muted)]">
              Aucune presta active —{' '}
              <Link href="/payments/prestations" className="font-semibold text-[color:var(--brand)] underline">
                créer une prestation
              </Link>
              .
            </p>
          ) : null}
        </section>

        <form className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Rechercher client / presta / montant"
            className="min-w-[12rem] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
          <select
            name="status"
            defaultValue={params.status ?? 'all'}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="all">Tous statuts</option>
            <option value="pending">En attente</option>
            <option value="paid">Payé</option>
            <option value="refunded">Remboursé</option>
            <option value="failed">Échoué</option>
            <option value="expired">Expiré</option>
          </select>
          <button type="submit" className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-bold text-[color:var(--brand)]">
            Filtrer
          </button>
        </form>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          {!filtered.length ? (
            <p className="px-5 py-8 text-sm text-[color:var(--muted)]">Aucun paiement.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((r) => {
                const clientsRel = r.clients as
                  | { first_name: string | null; last_name: string | null; email: string }
                  | { first_name: string | null; last_name: string | null; email: string }[]
                  | null
                const client = Array.isArray(clientsRel) ? clientsRel[0] : clientsRel
                const prestaRel = r.prestations as { name?: string } | { name?: string }[] | null
                const prestaName = Array.isArray(prestaRel) ? prestaRel[0]?.name : prestaRel?.name
                const label = client
                  ? clientDisplayName({
                      first_name: client.first_name,
                      last_name: client.last_name,
                      email: client.email,
                    })
                  : 'Client'
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[color:var(--fg)]">
                        <Link href={`/clients/${r.client_id}`} className="text-[color:var(--brand)] hover:underline">
                          {label}
                        </Link>
                        <span className="text-[color:var(--muted)]"> · </span>
                        {prestaName ?? 'Prestation'}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {new Date(r.paid_at || r.created_at).toLocaleDateString('fr-FR')} ·{' '}
                        {sourceLabel(r.source)} · {formatPriceCents(r.amount_cents)}
                        {r.period_ym ? ` · ${formatPeriodYm(r.period_ym)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand)]">
                        {ledgerStatusLabel(r.status)}
                      </span>
                      {r.status === 'pending' ? (
                        <form action={markPaymentPaidAction}>
                          <input type="hidden" name="ledger_id" value={r.id} />
                          <button type="submit" className="text-xs font-bold text-emerald-700 hover:underline">
                            → Payé
                          </button>
                        </form>
                      ) : null}
                      {r.status === 'paid' ? (
                        <form action={refundPaymentAction}>
                          <input type="hidden" name="ledger_id" value={r.id} />
                          <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
                            Rembourser
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </CoachAppShell>
  )
}
