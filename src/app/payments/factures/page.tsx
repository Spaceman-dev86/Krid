import { redirect } from 'next/navigation'

import { Button, PageTitle, Muted } from '@/src/components/ui'
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
    | Promise<{ error?: string; created?: string }>
    | { error?: string; created?: string }
}

export default async function PaymentsFacturesPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  const { data: paid } = await supabase
    .from('payment_ledger')
    .select(
      'id, amount_cents, paid_at, created_at, client_id, clients(first_name, last_name, email), prestations(name)'
    )
    .eq('coach_id', user.id)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(50)

  let invoices: {
    id: string
    number: string
    amount_cents: number
    issued_at: string
    client_id: string
    payment_ledger_id: string
    clients?: { first_name: string | null; last_name: string | null; email: string } | null
  }[] = []
  let invoicesError: string | null = null
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, number, amount_cents, issued_at, client_id, payment_ledger_id, clients(first_name, last_name, email)')
      .eq('coach_id', user.id)
      .order('issued_at', { ascending: false })
    if (error) invoicesError = error.message
    else invoices = (data as typeof invoices) ?? []
  } catch (e) {
    invoicesError = e instanceof Error ? e.message : 'Table invoices absente — lance 23_compta.sql'
  }

  const invoicedLedgerIds = new Set(invoices.map((i) => i.payment_ledger_id))

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Factures" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Factures</PageTitle>
            <Muted className="mt-1">Génération manuelle sur paiements Payé (PDF plus tard)</Muted>
          </div>
          <PaymentsSubnav />
        </div>

        {q.error || invoicesError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error || invoicesError}
          </div>
        ) : null}
        {q.created ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Facture créée.
          </div>
        ) : null}

        <section className="grid gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--muted)]">Factures émises</h2>
          {!invoices.length ? (
            <p className="text-sm text-[color:var(--muted)]">Aucune facture.</p>
          ) : (
            <ul className="grid gap-2">
              {invoices.map((inv) => {
                const client = inv.clients
                const label = client
                  ? clientDisplayName({
                      first_name: client.first_name,
                      last_name: client.last_name,
                      email: client.email,
                    })
                  : 'Client'
                return (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-[color:var(--fg)]">
                        {inv.number} · {label}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {new Date(inv.issued_at).toLocaleDateString('fr-FR')} ·{' '}
                        {formatPriceCents(inv.amount_cents)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="grid gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
            Paiements Payé sans facture
          </h2>
          <ul className="grid gap-2">
            {(paid ?? [])
              .filter((p) => !invoicedLedgerIds.has(p.id))
              .map((p) => {
                const clientsRel = p.clients as
                  | { first_name: string | null; last_name: string | null; email: string }
                  | { first_name: string | null; last_name: string | null; email: string }[]
                  | null
                const client = Array.isArray(clientsRel) ? clientsRel[0] : clientsRel
                const prestaRel = p.prestations as { name?: string } | { name?: string }[] | null
                const prestaName = Array.isArray(prestaRel) ? prestaRel[0]?.name : prestaRel?.name
                const label = client
                  ? clientDisplayName({
                      first_name: client.first_name,
                      last_name: client.last_name,
                      email: client.email,
                    })
                  : 'Client'
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {label} · {prestaName ?? 'Presta'}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">{formatPriceCents(p.amount_cents)}</p>
                    </div>
                    <form action={generateInvoiceAction}>
                      <input type="hidden" name="ledger_id" value={p.id} />
                      <Button type="submit" className="!rounded-lg !px-3 !py-1.5 text-xs font-bold">Générer facture</Button>
                    </form>
                  </li>
                )
              })}
          </ul>
          {!(paid ?? []).filter((p) => !invoicedLedgerIds.has(p.id)).length ? (
            <p className="text-sm text-[color:var(--muted)]">Rien à facturer.</p>
          ) : null}
        </section>
      </div>
    </CoachAppShell>
  )
}
