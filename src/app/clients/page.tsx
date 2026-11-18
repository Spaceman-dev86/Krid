import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { AddClientDialog } from '../../components/coach/AddClientDialog'
import { ClientsHubHeader } from '../../components/coach/ClientsHubHeader'
import { ClientsListFilters } from '../../components/coach/ClientsListFilters'
import { CoachQueryFlash } from '../../components/coach/CoachQueryFlash'
import { canAccessCoachApp } from '../../lib/auth/roles'
import {
  clientListDisplayName,
  clientListStatusLabel,
  loadClientsListRows,
} from '../../lib/coach/loadClientsListRows'
import { isSchemaCacheError } from '../../lib/supabase/errors'
import { createClient } from '../../lib/supabase/server'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ error?: string; archived?: string; q?: string; status?: string; presta?: string }>
    | { error?: string; archived?: string; q?: string; status?: string; presta?: string }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  let rows: Awaited<ReturnType<typeof loadClientsListRows>> = []
  let loadError: string | null = null
  try {
    rows = await loadClientsListRows(supabase, user.id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur chargement'
    loadError = isSchemaCacheError(msg) ? null : msg
  }

  const { data: prestations } = await supabase
    .from('prestations')
    .select('id, name')
    .eq('coach_id', user.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const q = (params.q ?? '').trim().toLowerCase()
  const statusFilter = params.status ?? ''
  const prestaFilter = params.presta ?? ''

  const filtered = rows
    .filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false
      if (prestaFilter && !c.prestationIds.includes(prestaFilter)) return false
      if (q) {
        const hay = `${clientListDisplayName(c)} ${c.email}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      // Actifs en tête, puis dernière séance la plus récente
      const aActive = a.status === 'active' ? 0 : 1
      const bActive = b.status === 'active' ? 0 : 1
      if (aActive !== bActive) return aActive - bActive
      const aT = a.lastSessionAt ? new Date(a.lastSessionAt).getTime() : 0
      const bT = b.lastSessionAt ? new Date(b.lastSessionAt).getTime() : 0
      if (bT !== aT) return bT - aT
      return clientListDisplayName(a).localeCompare(clientListDisplayName(b), 'fr')
    })

  return (
    <>
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            archived: { tone: 'success', message: 'Client archivé' },
            created: { tone: 'success', message: 'Client créé' },
          }}
        />
      </Suspense>

      <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
        <ClientsHubHeader
          title="Clients"
          subtitle={
            <>
              {filtered.length}
              {filtered.length !== rows.length ? ` / ${rows.length}` : ''} client
              {filtered.length > 1 ? 's' : ''}
            </>
          }
          actions={<AddClientDialog />}
        />

        {loadError ? (
          <p className="text-sm font-semibold text-[var(--danger)]">{loadError}</p>
        ) : null}

        <Suspense fallback={null}>
          <ClientsListFilters
            prestations={(prestations ?? []).map((p) => ({ id: p.id, name: p.name }))}
          />
        </Suspense>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Liste</h2>
          </div>
          {!filtered.length ? (
            <p className="px-5 py-8 text-sm text-[color:var(--muted)]">
              {rows.length ? 'Aucun client ne correspond aux filtres.' : 'Aucun client pour l’instant. Utilise + pour en ajouter.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                    <th className="px-5 py-2.5 font-extrabold">Client</th>
                    <th className="px-3 py-2.5 font-extrabold">Prestation(s)</th>
                    <th className="px-3 py-2.5 font-extrabold">Dernier bilan</th>
                    <th className="px-3 py-2.5 font-extrabold">Dernière séance</th>
                    <th className="px-5 py-2.5 font-extrabold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]">
                      <td className="px-5 py-3">
                        <Link href={`/clients/${c.id}`} className="block min-w-0">
                          <p className="truncate font-semibold text-[color:var(--brand)]">
                            {clientListDisplayName(c)}
                          </p>
                          <p className="truncate text-xs text-[color:var(--muted)]">{c.email}</p>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[color:var(--fg)]">
                        {c.prestationNames.length ? c.prestationNames.join(' · ') : '—'}
                      </td>
                      <td className="px-3 py-3 text-[color:var(--fg)]">{c.lastBilanLabel}</td>
                      <td className="px-3 py-3 text-[color:var(--muted)]">{c.lastSessionLabel}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]">
                          {clientListStatusLabel(c.status)}
                          {c.is_demo ? ' · démo' : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
