import Link from 'next/link'

import { ClientPortalShell } from '../../../../../components/client-portal/ClientPortalShell'
import { requireClientPortal } from '../../../../../lib/client-portal/context'
import { formatPriceCents, parseModules } from '../../../../../lib/prestations/modules'
import { selectFieldClass, selectFieldStyle } from '../../../../../lib/ui/selectField'
import { createClient } from '../../../../../lib/supabase/server'
import { requestInvoiceAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?:
    | Promise<{ error?: string; invoice_requested?: string }>
    | { error?: string; invoice_requested?: string }
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

function formatPeriodYm(ym: string | null) {
  if (!ym) return null
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
}

export default async function ClientPrestationsPage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)
  const returnTo = `/c/${ctx.slug}/profil/prestations`

  const { data: grants } = await supabase
    .from('client_grants')
    .select('id, status, modules, starts_at, ends_at, prestation_id, prestations(id, name, pricing_type)')
    .eq('client_id', ctx.client.id)
    .eq('coach_id', ctx.coachId)
    .order('created_at', { ascending: false })

  const { data: payments } = await supabase
    .from('payment_ledger')
    .select('id, amount_cents, status, source, paid_at, created_at, period_ym, prestation_id')
    .eq('client_id', ctx.client.id)
    .eq('coach_id', ctx.coachId)
    .order('created_at', { ascending: false })

  const { data: pendingInvoice } = await supabase
    .from('invoice_requests')
    .select('id')
    .eq('client_id', ctx.client.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  const active = (grants ?? []).filter((g) => g.status === 'active')
  const ended = (grants ?? []).filter((g) => g.status !== 'active')

  const prestaOptions = Array.from(
    new Map(
      (grants ?? [])
        .map((g) => {
          const p = g.prestations as { id?: string; name?: string } | { id?: string; name?: string }[] | null
          const presta = Array.isArray(p) ? p[0] : p
          return presta?.id ? ([presta.id, presta.name ?? 'Prestation'] as const) : null
        })
        .filter((x): x is readonly [string, string] => Boolean(x))
    )
  )

  function paymentsFor(prestationId: string) {
    return (payments ?? []).filter((p) => p.prestation_id === prestationId)
  }

  function renderGrant(g: NonNullable<typeof grants>[number]) {
    const p = g.prestations as
      | { id?: string; name?: string; pricing_type?: string }
      | { id?: string; name?: string; pricing_type?: string }[]
      | null
    const presta = Array.isArray(p) ? p[0] : p
    const mods = parseModules(g.modules)
    const rows = presta?.id ? paymentsFor(presta.id) : []
    const paid = rows.filter((r) => r.status === 'paid')

    return (
      <li key={g.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-extrabold" style={{ color: ctx.primaryColor }}>
              {presta?.name ?? 'Prestation'}
            </p>
            <p className="mt-1 text-xs text-black/45">
              {g.status === 'active' ? 'Accès actif' : 'Terminé'}
              {presta?.pricing_type === 'renewable' ? ' · mensuel' : ' · unique'}
              {mods.length ? ` · ${mods.join(', ')}` : ''}
            </p>
            <p className="mt-0.5 text-xs text-black/40">
              {g.starts_at ? `Depuis ${new Date(g.starts_at).toLocaleDateString('fr-FR')}` : ''}
              {g.ends_at ? ` · fin ${new Date(g.ends_at).toLocaleDateString('fr-FR')}` : ''}
            </p>
          </div>
          <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-bold uppercase text-black/55">
            {g.status === 'active' ? 'Actif' : 'Passé'}
          </span>
        </div>

        <div className="mt-3 border-t border-black/5 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">Paiements</p>
          {!paid.length ? (
            <p className="mt-1 text-sm text-black/45">Aucun paiement Payé enregistré.</p>
          ) : (
            <ul className="mt-2 divide-y divide-black/5">
              {paid.map((pay) => (
                <li key={pay.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                  <span className="text-black/70">
                    {new Date(pay.paid_at || pay.created_at).toLocaleDateString('fr-FR')}
                    {' · '}
                    {sourceLabel(pay.source)}
                    {pay.period_ym ? ` · ${formatPeriodYm(pay.period_ym)}` : ''}
                  </span>
                  <span className="font-semibold">{formatPriceCents(pay.amount_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </li>
    )
  }

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-5">
        <div>
          <Link
            href={`/c/${ctx.slug}/profil`}
            className="text-sm font-semibold"
            style={{ color: ctx.primaryColor }}
          >
            ← Profil
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            Mes prestations
          </h1>
          <p className="mt-1 text-sm text-black/55">Accès &amp; historique des paiements</p>
        </div>

        {q.invoice_requested ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Demande de facture envoyée à ton coach.
          </div>
        ) : null}
        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{q.error}</div>
        ) : null}

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-extrabold" style={{ color: ctx.primaryColor }}>
            Facture
          </h2>
          {pendingInvoice ? (
            <p className="mt-2 text-sm text-amber-900">
              Une demande est déjà en cours — ton coach la traitera bientôt.
            </p>
          ) : (
            <form action={requestInvoiceAction} className="mt-3 grid gap-3">
              <input type="hidden" name="slug" value={ctx.slug} />
              <input type="hidden" name="return_to" value={returnTo} />
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Prestation (optionnel)</span>
                <select
                  name="prestation_id"
                  className={selectFieldClass}
                  style={selectFieldStyle}
                >
                  <option value="">Toutes / non précisé</option>
                  {prestaOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Commentaire</span>
                <textarea
                  name="comment"
                  rows={2}
                  placeholder="Ex. facture pour le mois de mars…"
                  className="rounded-lg border border-black/15 px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="w-fit rounded-lg px-4 py-2 text-sm font-bold text-white"
                style={{ background: ctx.primaryColor }}
              >
                Demander une facture
              </button>
            </form>
          )}
        </section>

        <section className="grid gap-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">Actives</h2>
          {!active.length ? (
            <p className="text-sm text-black/45">
              Aucun accès actif.{' '}
              <Link href={`/c/${ctx.slug}/showroom`} className="font-semibold underline">
                Voir le showroom
              </Link>
            </p>
          ) : (
            <ul className="grid gap-3">{active.map(renderGrant)}</ul>
          )}
        </section>

        {ended.length ? (
          <section className="grid gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">Passées</h2>
            <ul className="grid gap-3">{ended.map(renderGrant)}</ul>
          </section>
        ) : null}
      </div>
    </ClientPortalShell>
  )
}
