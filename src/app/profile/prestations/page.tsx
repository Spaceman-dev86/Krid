import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { CoachQueryFlash } from '../../../components/coach/CoachQueryFlash'
import { CreatePrestationDialog } from '../../../components/coach/CreatePrestationDialog'
import { PrestationsCatalogRow } from '../../../components/coach/PrestationsCatalogRow'
import { PrestationsListFilters } from '../../../components/coach/PrestationsListFilters'
import { ProfileHubHeader } from '../../../components/coach/ProfileHubHeader'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { formatPriceCents } from '../../../lib/prestations/modules'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

function statusLabel(s: string) {
  if (s === 'draft') return 'Brouillon'
  if (s === 'active') return 'Active'
  if (s === 'archived') return 'Archivée'
  return s
}

function pricingLabel(t: string) {
  if (t === 'renewable') return 'Mensuel'
  return 'Paiement unique'
}

export default async function ProfilePrestationsPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{
        error?: string
        archived?: string
        nouveau?: string
        q?: string
        status?: string
        showroom?: string
      }>
    | {
        error?: string
        archived?: string
        nouveau?: string
        q?: string
        status?: string
        showroom?: string
      }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: prestations, error } = await supabase
    .from('prestations')
    .select('id, name, pricing_type, price_cents, status, showroom_visible, created_at')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const searchQ = (params.q ?? '').trim().toLowerCase()
  const statusFilter =
    params.status === 'active' || params.status === 'draft' || params.status === 'archived'
      ? params.status
      : ''
  const showroomFilter =
    params.showroom === 'visible' || params.showroom === 'hidden' ? params.showroom : ''

  const allRows = prestations ?? []
  const rows = allRows.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false
    if (showroomFilter === 'visible' && !p.showroom_visible) return false
    if (showroomFilter === 'hidden' && p.showroom_visible) return false
    if (searchQ && !p.name.toLowerCase().includes(searchQ)) return false
    return true
  })

  const openCreate = params.nouveau === '1'

  return (
    <>
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            archived: { tone: 'success', message: 'Prestation archivée' },
            created: { tone: 'success', message: 'Prestation créée' },
          }}
        />
      </Suspense>

      <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
        <ProfileHubHeader
          title="Prestations"
          subtitle="Ton catalogue de vente — nom, prix, contenu inclus."
          actions={<CreatePrestationDialog defaultOpen={openCreate} />}
          showChromeActions={false}
        />

        <Suspense fallback={null}>
          <PrestationsListFilters />
        </Suspense>

        {error ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--accent)] px-4 py-3 text-sm text-[color:var(--muted)]">
            {error.message}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Catalogue
              <span className="ml-2 font-semibold normal-case tracking-normal text-[color:var(--muted)]">
                {rows.length}
                {rows.length !== allRows.length ? ` / ${allRows.length}` : ''}
              </span>
            </h2>
          </div>
          {!rows.length ? (
            <p className="px-5 py-8 text-sm text-[color:var(--muted)]">
              {allRows.length
                ? 'Aucune prestation ne correspond aux filtres.'
                : 'Aucune prestation pour l’instant. Crée-en une pour peupler ton showroom.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                    <th className="px-5 py-2.5 font-extrabold">Prestation</th>
                    <th className="px-3 py-2.5 font-extrabold">Prix</th>
                    <th className="px-3 py-2.5 font-extrabold">Facturation</th>
                    <th className="px-3 py-2.5 font-extrabold">Statut</th>
                    <th className="px-5 py-2.5 font-extrabold">Showroom</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((p) => {
                    const href = `/profile/prestations/${p.id}`
                    return (
                      <PrestationsCatalogRow key={p.id} href={href} label={p.name}>
                        <td className="px-5 py-3">
                          <p className="truncate font-semibold text-[color:var(--brand)]">
                            {p.name}
                          </p>
                        </td>
                        <td className="px-3 py-3 font-semibold text-[color:var(--fg)]">
                          {formatPriceCents(p.price_cents)}
                        </td>
                        <td className="px-3 py-3 text-[color:var(--muted)]">
                          {pricingLabel(p.pricing_type)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]">
                            {statusLabel(p.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]">
                            {p.showroom_visible ? 'Visible' : 'Masquée'}
                          </span>
                        </td>
                      </PrestationsCatalogRow>
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
