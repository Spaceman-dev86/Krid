import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { GrantPrestationDialog } from '../../../../components/coach/GrantPrestationDialog'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import { parseModules } from '../../../../lib/prestations/modules'
import { createClient } from '../../../../lib/supabase/server'
import { endClientGrantAction } from '../../../payments/actions'
import { clientDisplayName } from '../../../../lib/chat/chat'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

export default async function ClientPrestationPage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('id, email, first_name, last_name')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) notFound()

  const title = clientDisplayName({
    first_name: client.first_name,
    last_name: client.last_name,
    email: client.email,
  })

  const { data: grants } = await supabase
    .from('client_grants')
    .select('id, status, modules, starts_at, ends_at, prestation_id, prestations(name)')
    .eq('client_id', id)
    .eq('coach_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const { data: endedGrants } = await supabase
    .from('client_grants')
    .select('id, status, modules, ends_at, prestations(name)')
    .eq('client_id', id)
    .eq('coach_id', user.id)
    .eq('status', 'ended')
    .order('ends_at', { ascending: false })
    .limit(10)

  const { data: prestations } = await supabase
    .from('prestations')
    .select('id, name, status, pricing_type, price_cents')
    .eq('coach_id', user.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const { data: paidLedger } = await supabase
    .from('payment_ledger')
    .select('prestation_id, period_ym')
    .eq('coach_id', user.id)
    .eq('client_id', id)
    .eq('status', 'paid')

  const returnTo = `/clients/${id}/prestation`

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
        Prestation / accès
      </h2>
      <p className="mt-1 text-xs text-[color:var(--muted)]">
        Accorder = ledger manuel Payé + grant. Modules : Fitness, Nutrition, Drive, etc.
      </p>

      {!grants?.length ? (
        <p className="mt-3 text-sm text-[color:var(--muted)]">Aucun accès actif.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {grants.map((g) => {
            const presta = g.prestations as { name?: string } | { name?: string }[] | null
            const prestaName = Array.isArray(presta) ? presta[0]?.name : presta?.name
            const mods = parseModules(g.modules)
            return (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-semibold text-[color:var(--brand)]">{prestaName ?? 'Prestation'}</p>
                  <p className="text-xs text-[color:var(--muted)]">
                    Actif
                    {mods.length ? ` · ${mods.join(', ')}` : ''}
                  </p>
                </div>
                <form action={endClientGrantAction}>
                  <input type="hidden" name="grant_id" value={g.id} />
                  <input type="hidden" name="client_id" value={client.id} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <button type="submit" className="text-xs font-semibold text-red-600 hover:underline">
                    Terminer
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      )}

      {endedGrants?.length ? (
        <details className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--accent)] px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-[color:var(--muted)]">
            Historique ({endedGrants.length} terminé{endedGrants.length > 1 ? 's' : ''})
          </summary>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {endedGrants.map((g) => {
              const presta = g.prestations as { name?: string } | { name?: string }[] | null
              const prestaName = Array.isArray(presta) ? presta[0]?.name : presta?.name
              return (
                <li key={g.id} className="py-2 text-xs text-[color:var(--muted)]">
                  {prestaName ?? 'Prestation'}
                  {g.ends_at
                    ? ` · terminé le ${new Date(g.ends_at).toLocaleDateString('fr-FR')}`
                    : ' · terminé'}
                </li>
              )
            })}
          </ul>
        </details>
      ) : null}

      {(prestations ?? []).length ? (
        <div className="mt-4">
          <GrantPrestationDialog
            clientId={client.id}
            clientLabel={title}
            returnTo={returnTo}
            prestations={(prestations ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              pricing_type: p.pricing_type ?? 'unique',
              price_cents: p.price_cents ?? 0,
            }))}
            alreadyPaid={(paidLedger ?? []).map((r) => ({
              prestation_id: r.prestation_id,
              period_ym: r.period_ym,
            }))}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Crée d’abord une prestation active dans{' '}
          <Link href="/profile/prestations" className="font-semibold underline">
            Comptabilités
          </Link>
          .
        </p>
      )}
    </section>
  )
}
