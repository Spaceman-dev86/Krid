import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CoachQueryFlash } from '../../../components/coach/CoachQueryFlash'
import { CodesListFilters } from '../../../components/coach/CodesListFilters'
import { CopyCodeButton } from '../../../components/coach/CopyCodeButton'
import { CreateAccessCodeDialog } from '../../../components/coach/CreateAccessCodeDialog'
import { CreatePromoCodeDialog } from '../../../components/coach/CreatePromoCodeDialog'
import { ProfileHubHeader } from '../../../components/coach/ProfileHubHeader'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { formatPriceCents } from '../../../lib/prestations/modules'
import { createClient } from '../../../lib/supabase/server'
import { revokeCodeAction } from './actions'

export const dynamic = 'force-dynamic'

function formatShortDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function statusLabel(status: string, expiresAt: string | null, used: number, maxUses: number | null) {
  if (status === 'revoked') return 'Révoqué'
  if (status === 'exhausted') return 'Épuisé'
  if (status === 'expired') return 'Expiré'
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'Expiré'
  if (maxUses != null && used >= maxUses) return 'Épuisé'
  return 'Actif'
}

function audienceLabel(audience: string | null) {
  switch (audience) {
    case 'public':
      return 'Public'
    case 'client':
      return '1 client'
    case 'group':
      return 'Groupe'
    case 'presta_clients':
      return 'Clients presta'
    default:
      return audience ?? '—'
  }
}

export default async function ProfileCodesPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ error?: string; created?: string; revoked?: string; q?: string; promo?: string }>
    | { error?: string; created?: string; revoked?: string; q?: string; promo?: string }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const searchQ = (params.q ?? '').trim().toLowerCase()
  const openPromo = params.promo === '1'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const [{ data: prestations }, { data: clients }, { data: groups }, { data: codes, error: codesError }] =
    await Promise.all([
      supabase
        .from('prestations')
        .select('id, name, price_cents, pricing_type, status')
        .eq('coach_id', user.id)
        .is('deleted_at', null)
        .neq('status', 'archived')
        .order('name'),
      supabase
        .from('clients')
        .select('id, email, first_name, last_name')
        .eq('coach_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('client_groups')
        .select('id, name')
        .eq('coach_id', user.id)
        .in('type', ['manual', 'linked'])
        .order('name'),
      supabase
        .from('coach_codes')
        .select(
          'id, type, code, prestation_id, amount_cents, percent_off, prestation_ids, audience, expires_at, max_uses, used_count, status, created_at',
        )
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  const prestaName = new Map((prestations ?? []).map((p) => [p.id, p.name]))
  const clientOpts = (clients ?? []).map((c) => {
    const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
    return { id: c.id, label: n || c.email }
  })

  const tableMissing =
    codesError && /relation|does not exist|coach_codes/i.test(codesError.message)

  const prestaOpts = (prestations ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price_cents: p.price_cents,
    pricing_type: p.pricing_type,
  }))

  const filtered = (codes ?? []).filter((row) => {
    if (!searchQ) return true
    if (row.code.toLowerCase().includes(searchQ)) return true
    const typeBlob = row.type === 'access' ? 'acces accès app' : 'promo'
    if (typeBlob.includes(searchQ)) return true
    if (row.type === 'access') {
      const name = (prestaName.get(row.prestation_id ?? '') ?? '').toLowerCase()
      return name.includes(searchQ)
    }
    const names = (row.prestation_ids ?? [])
      .map((id: string) => prestaName.get(id) ?? '')
      .join(' ')
      .toLowerCase()
    if (names.includes(searchQ)) return true
    if (String(row.percent_off ?? '').includes(searchQ)) return true
    if ((row.audience ?? '').toLowerCase().includes(searchQ)) return true
    return false
  })

  return (
    <>
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            created: {
              tone: 'success',
              message:
                params.created && params.created !== '1'
                  ? `Code créé : ${params.created}`
                  : 'Code créé',
            },
            revoked: { tone: 'success', message: 'Code révoqué' },
          }}
        />
      </Suspense>

      <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
        <ProfileHubHeader
          title="Codes"
          subtitle="Règles promo et accès app — à attacher ensuite à une campagne Liens."
          showChromeActions={false}
        />

        <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-da-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Accès app
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Code cash 1× pour activer une presta (paiement hors Stripe).
            </p>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Promo
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Remise % sur une ou plusieurs offres. Ensuite :{' '}
              <Link
                href="/profile/liens?nouveau=1"
                className="font-semibold text-[color:var(--brand)] underline"
              >
                créer une campagne Liens
              </Link>{' '}
              et lier cette promo — le prospect n’a rien à retaper.
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <CodesListFilters
            actions={
              <>
                <CreateAccessCodeDialog prestations={prestaOpts} />
                <CreatePromoCodeDialog
                  defaultOpen={openPromo}
                  prestations={prestaOpts.map((p) => ({
                    id: p.id,
                    name: p.name,
                    price_cents: p.price_cents,
                  }))}
                  clients={clientOpts}
                  groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name }))}
                />
              </>
            }
          />
        </Suspense>

        {tableMissing ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--accent)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Table codes absente — lance la tranche SQL 29 puis recharge.
          </p>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Liste
              <span className="ml-2 font-semibold normal-case tracking-normal text-[color:var(--muted)]">
                {filtered.length}
                {filtered.length !== (codes?.length ?? 0) ? ` / ${codes?.length ?? 0}` : ''}
              </span>
            </h2>
          </div>
          {!filtered.length ? (
            <p className="px-5 py-8 text-sm text-[color:var(--muted)]">
              {(codes?.length ?? 0)
                ? 'Aucun code ne correspond à la recherche.'
                : 'Aucun code. Utilise Accès app ou Promo pour en créer.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                    <th className="px-5 py-2.5 font-extrabold">Code</th>
                    <th className="px-3 py-2.5 font-extrabold">Détail</th>
                    <th className="px-3 py-2.5 font-extrabold">Validité</th>
                    <th className="px-3 py-2.5 font-extrabold">Statut</th>
                    <th className="px-5 py-2.5 font-extrabold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((row) => {
                    const label = statusLabel(
                      row.status,
                      row.expires_at,
                      row.used_count,
                      row.max_uses,
                    )
                    const active = label === 'Actif'
                    const prestaLabel =
                      row.type === 'access'
                        ? prestaName.get(row.prestation_id ?? '') ?? '—'
                        : (row.prestation_ids ?? [])
                            .map((id: string) => prestaName.get(id))
                            .filter(Boolean)
                            .join(' · ') || '—'

                    const expireLabel = formatShortDate(row.expires_at)
                    const usesLabel =
                      row.max_uses != null
                        ? `${row.used_count}/${row.max_uses}`
                        : row.used_count
                          ? `${row.used_count}×`
                          : null

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                      >
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-bold text-[color:var(--brand)]">
                              {row.code}
                            </span>
                            <CopyCodeButton code={row.code} />
                          </div>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                            {row.type === 'access' ? 'Accès app' : 'Promo'}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-[color:var(--fg)]">
                          {row.type === 'access' ? (
                            <>
                              <p className="truncate font-medium">{prestaLabel}</p>
                              <p className="text-xs text-[color:var(--muted)]">
                                {formatPriceCents(row.amount_cents ?? 0)} reçu
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-medium">−{row.percent_off}%</p>
                              <p className="truncate text-xs text-[color:var(--muted)]">
                                {prestaLabel} · {audienceLabel(row.audience)}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[color:var(--muted)]">
                          {expireLabel ? <p>Expire {expireLabel}</p> : <p>—</p>}
                          {usesLabel ? (
                            <p className="text-xs">{usesLabel} uses</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              active
                                ? 'bg-[color-mix(in_srgb,var(--brand)_16%,var(--accent))] text-[color:var(--fg)]'
                                : 'bg-[var(--accent)] text-[color:var(--muted)]'
                            }`}
                          >
                            {label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            {active && row.type === 'promo' ? (
                              <Link
                                href="/profile/liens?nouveau=1"
                                className="text-xs font-semibold text-[color:var(--brand)] hover:underline"
                              >
                                Diffuser via Liens
                              </Link>
                            ) : null}
                            {active ? (
                              <form action={revokeCodeAction}>
                                <input type="hidden" name="code_id" value={row.id} />
                                <button
                                  type="submit"
                                  className="text-xs font-semibold text-[var(--danger)] hover:underline"
                                >
                                  Révoquer
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
