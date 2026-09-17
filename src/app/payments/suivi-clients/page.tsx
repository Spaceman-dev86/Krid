import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { PaymentsSubnav } from '../../../components/coach/PaymentsSubnav'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { clientDisplayName } from '../../../lib/chat/chat'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { formatPriceCents } from '../../../lib/prestations/modules'
import { createClient } from '../../../lib/supabase/server'
import { generateInvoiceAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string }>
    | { error?: string }
}

export default async function PaymentsSuiviPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('first_name', { ascending: true })

  const { data: ledger } = await supabase
    .from('payment_ledger')
    .select('client_id, amount_cents, status')
    .eq('coach_id', user.id)

  const { data: grants } = await supabase
    .from('client_grants')
    .select('client_id, prestation_id, status, ends_at, prestations(name)')
    .eq('coach_id', user.id)
    .eq('status', 'active')

  let invoiceRequests: {
    id: string
    client_id: string
    comment: string | null
    payment_ledger_id: string | null
    status: string
  }[] = []
  try {
    const { data } = await supabase
      .from('invoice_requests')
      .select('id, client_id, comment, payment_ledger_id, status')
      .eq('coach_id', user.id)
      .eq('status', 'pending')
    invoiceRequests = data ?? []
  } catch {
    invoiceRequests = []
  }

  const revenueByClient = new Map<string, number>()
  for (const row of ledger ?? []) {
    if (row.status !== 'paid') continue
    revenueByClient.set(row.client_id, (revenueByClient.get(row.client_id) ?? 0) + row.amount_cents)
  }

  const grantsByClient = new Map<string, string[]>()
  for (const g of grants ?? []) {
    const presta = g.prestations as { name?: string } | { name?: string }[] | null
    const name = Array.isArray(presta) ? presta[0]?.name : presta?.name
    const list = grantsByClient.get(g.client_id) ?? []
    if (name) list.push(name)
    grantsByClient.set(g.client_id, list)
  }

  const requestsByClient = new Map<string, typeof invoiceRequests>()
  for (const r of invoiceRequests) {
    const list = requestsByClient.get(r.client_id) ?? []
    list.push(r)
    requestsByClient.set(r.client_id, list)
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Suivi clients" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Suivi clients</PageTitle>
            <Muted className="mt-1">Revenus · presta actives · demandes de facture</Muted>
          </div>
          <PaymentsSubnav />
        </div>

        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{q.error}</div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          {!(clients ?? []).length ? (
            <p className="px-5 py-8 text-sm text-[color:var(--muted)]">Aucun client.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {(clients ?? []).map((c) => {
                const label = clientDisplayName({
                  first_name: c.first_name,
                  last_name: c.last_name,
                  email: c.email,
                })
                const revenue = revenueByClient.get(c.id) ?? 0
                const active = grantsByClient.get(c.id) ?? []
                const reqs = requestsByClient.get(c.id) ?? []
                return (
                  <li key={c.id} className="grid gap-2 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link href={`/clients/${c.id}`} className="font-semibold text-[color:var(--brand)] hover:underline">
                          {label}
                        </Link>
                        <p className="text-xs text-[color:var(--muted)]">{c.email}</p>
                      </div>
                      <p className="text-sm font-bold text-[color:var(--fg)]">{formatPriceCents(revenue)}</p>
                    </div>
                    <p className="text-xs text-[color:var(--muted)]">
                      {active.length
                        ? `Actives : ${active.join(', ')}`
                        : 'Aucune prestation active'}
                    </p>
                    {reqs.length ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-bold text-amber-900">
                          {reqs.length} demande{reqs.length > 1 ? 's' : ''} de facture
                        </p>
                        {reqs.map((r) => (
                          <div key={r.id} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-amber-900">{r.comment || 'Sans commentaire'}</span>
                            {r.payment_ledger_id ? (
                              <form action={generateInvoiceAction}>
                                <input type="hidden" name="ledger_id" value={r.payment_ledger_id} />
                                <input type="hidden" name="request_id" value={r.id} />
                                <button type="submit" className="font-bold text-[color:var(--brand)] underline">
                                  Générer facture
                                </button>
                              </form>
                            ) : (
                              <span className="text-[color:var(--muted)]">Lier un paiement d’abord</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
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
