import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { AddGroupDialog } from '../../../components/coach/AddGroupDialog'
import { ClientsHubHeader } from '../../../components/coach/ClientsHubHeader'
import { CoachQueryFlash } from '../../../components/coach/CoachQueryFlash'
import { GroupsListFilters } from '../../../components/coach/GroupsListFilters'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { clientDisplayName } from '../../../lib/chat/chat'
import { migrateAutoGroupsAway } from '../../../lib/coach/syncAutoGroups'
import { createClient } from '../../../lib/supabase/server'

type TagLabel = { kind: 'prestation' | 'program'; label: string }

export default async function ClientGroupsPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{
        error?: string
        deleted?: string
        q?: string
        type?: string
        nouveau?: string
        presta?: string
      }>
    | {
        error?: string
        deleted?: string
        q?: string
        type?: string
        nouveau?: string
        presta?: string
      }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const typeFilter =
    params.type === 'linked' || params.type === 'manual' ? params.type : ''
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  // Migration legacy auto→manual : ne bloque plus la navigation (fire-and-forget)
  void migrateAutoGroupsAway(supabase, user.id).catch(() => {})

  const { data: groups } = await supabase
    .from('client_groups')
    .select('id, name, type, chat_enabled, drive_enabled, prestation_id, created_at')
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .order('created_at', { ascending: false })

  const groupIds = (groups ?? []).map((g) => g.id)

  const linkedPrestaIds = new Set(
    (groups ?? []).filter((g) => g.type === 'linked' && g.prestation_id).map((g) => g.prestation_id as string),
  )
  const { data: allPrestas } = await supabase
    .from('prestations')
    .select('id, name')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  const linkablePrestations = (allPrestas ?? [])
    .filter((p) => !linkedPrestaIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }))

  const prestaNameById = new Map((allPrestas ?? []).map((p) => [p.id, p.name] as const))

  const { data: clientRows } = await supabase
    .from('clients')
    .select('id, email, first_name, last_name')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('first_name', { ascending: true })
    .limit(500)

  const clientIds = (clientRows ?? []).map((c) => c.id)
  const prestaByClient = new Map<string, string[]>()
  const programByClient = new Map<string, string[]>()
  const programTitles = new Map<string, string>()

  if (clientIds.length) {
    const [{ data: grants }, { data: plans }] = await Promise.all([
      supabase
        .from('client_grants')
        .select('client_id, prestation_id')
        .eq('coach_id', user.id)
        .eq('status', 'active')
        .in('client_id', clientIds),
      supabase
        .from('client_fitness_plans')
        .select('client_id, source_program_id')
        .eq('coach_id', user.id)
        .in('status', ['waiting', 'started', 'paused'])
        .in('client_id', clientIds),
    ])
    for (const g of grants ?? []) {
      if (!g.client_id || !g.prestation_id) continue
      const list = prestaByClient.get(g.client_id) ?? []
      if (!list.includes(g.prestation_id)) list.push(g.prestation_id)
      prestaByClient.set(g.client_id, list)
    }
    const programIds = [
      ...new Set((plans ?? []).map((p) => p.source_program_id).filter(Boolean) as string[]),
    ]
    if (programIds.length) {
      const { data: programs } = await supabase.from('programs').select('id, title').in('id', programIds)
      for (const p of programs ?? []) programTitles.set(p.id, p.title?.trim() || 'Programme')
    }
    for (const pl of plans ?? []) {
      if (!pl.client_id || !pl.source_program_id) continue
      const list = programByClient.get(pl.client_id) ?? []
      if (!list.includes(pl.source_program_id)) list.push(pl.source_program_id)
      programByClient.set(pl.client_id, list)
    }
  }

  const dialogClients = (clientRows ?? []).map((c) => ({
    id: c.id,
    label: clientDisplayName({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
    }),
    prestationIds: prestaByClient.get(c.id) ?? [],
    programIds: programByClient.get(c.id) ?? [],
  }))

  const filterPrograms = [...programTitles.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'))

  const memberCounts = new Map<string, number>()
  const tagsByGroup = new Map<string, TagLabel[]>()

  if (groupIds.length) {
    const [{ data: members }, { data: tagRows, error: tagsErr }] = await Promise.all([
      supabase.from('client_group_members').select('group_id, client_id').in('group_id', groupIds),
      supabase
        .from('client_group_tags')
        .select('group_id, kind, ref_id, sort_order')
        .in('group_id', groupIds)
        .order('sort_order', { ascending: true }),
    ])

    for (const m of members ?? []) {
      memberCounts.set(m.group_id, (memberCounts.get(m.group_id) ?? 0) + 1)
    }

    const programTagIds = [
      ...new Set(
        (!tagsErr ? (tagRows ?? []) : [])
          .filter((t) => t.kind === 'program')
          .map((t) => t.ref_id as string),
      ),
    ]
    const programNameById = new Map<string, string>()
    if (programTagIds.length) {
      const { data: progs } = await supabase
        .from('programs')
        .select('id, title')
        .in('id', programTagIds)
        .is('deleted_at', null)
      for (const p of progs ?? []) programNameById.set(p.id, p.title?.trim() || 'Sans titre')
    }

    for (const t of !tagsErr ? (tagRows ?? []) : []) {
      let label: string | undefined
      if (t.kind === 'prestation') label = prestaNameById.get(t.ref_id)
      else if (t.kind === 'program') label = programNameById.get(t.ref_id)
      if (!label) continue
      const list = tagsByGroup.get(t.group_id) ?? []
      list.push({
        kind: t.kind === 'program' ? 'program' : 'prestation',
        label,
      })
      tagsByGroup.set(t.group_id, list)
    }
  }

  // Fallback / linked : presta liée ou ancien prestation_id
  for (const g of groups ?? []) {
    const existing = tagsByGroup.get(g.id) ?? []
    if (existing.length) continue
    if (g.prestation_id) {
      const name = prestaNameById.get(g.prestation_id)
      if (name) tagsByGroup.set(g.id, [{ kind: 'prestation', label: name }])
    }
  }

  const openLinked = params.nouveau === 'lie'
  const searchQ = (params.q ?? '').trim().toLowerCase()

  const filtered = (groups ?? [])
    .filter((g) => {
      if (typeFilter && g.type !== typeFilter) return false
      if (!searchQ) return true
      if (g.name.toLowerCase().includes(searchQ)) return true
      const tags = tagsByGroup.get(g.id) ?? []
      return tags.some((t) => t.label.toLowerCase().includes(searchQ))
    })
    .sort((a, b) => {
      const diff = (memberCounts.get(b.id) ?? 0) - (memberCounts.get(a.id) ?? 0)
      if (diff !== 0) return diff
      return a.name.localeCompare(b.name, 'fr')
    })

  return (
    <>
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            deleted: { tone: 'success', message: 'Groupe supprimé' },
            created: { tone: 'success', message: 'Groupe créé' },
          }}
        />
      </Suspense>

      <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
        <ClientsHubHeader
          title="Groupes"
          subtitle="Groupes liés (sync presta) + libres · chat / Drive / bilans"
          actions={
            <AddGroupDialog
              linkablePrestations={linkablePrestations}
              filterPrestations={(allPrestas ?? []).map((p) => ({ id: p.id, name: p.name }))}
              filterPrograms={filterPrograms}
              clients={dialogClients}
              defaultKind={openLinked ? 'lie' : 'libre'}
              defaultPrestationId={params.presta ?? null}
            />
          }
        />

        <Suspense fallback={null}>
          <GroupsListFilters />
        </Suspense>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Liste
              <span className="ml-2 font-semibold normal-case tracking-normal text-[color:var(--muted)]">
                {filtered.length}
                {filtered.length !== (groups?.length ?? 0) ? ` / ${groups?.length ?? 0}` : ''}
              </span>
            </h2>
          </div>
          {!filtered.length ? (
            <p className="px-5 py-8 text-sm text-[color:var(--muted)]">
              {(groups?.length ?? 0)
                ? 'Aucun groupe ne correspond à la recherche.'
                : 'Aucun groupe. Utilise + pour en créer un (audience volontaire).'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                    <th className="px-5 py-2.5 font-extrabold">Groupe</th>
                    <th className="px-3 py-2.5 font-extrabold">Tags</th>
                    <th className="px-3 py-2.5 font-extrabold">Membres</th>
                    <th className="px-5 py-2.5 font-extrabold">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((g) => {
                    const n = memberCounts.get(g.id) ?? 0
                    const tags = tagsByGroup.get(g.id) ?? []
                    const extras = [
                      g.chat_enabled ? 'Chat' : null,
                      g.drive_enabled ? 'Drive' : null,
                    ].filter(Boolean)

                    return (
                      <tr
                        key={g.id}
                        className="hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                      >
                        <td className="px-5 py-3">
                          <Link href={`/clients/groupes/${g.id}`} className="block min-w-0">
                            <p className="truncate font-semibold text-[color:var(--brand)]">{g.name}</p>
                            <p className="truncate text-xs text-[color:var(--muted)]">
                              {extras.length ? extras.join(' · ') : '—'}
                              {g.type === 'manual' && n < 2 ? ' · ajoute des membres' : ''}
                            </p>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          {tags.length ? (
                            <ul className="flex flex-wrap gap-1">
                              {tags.map((t, i) => (
                                <li
                                  key={`${t.kind}-${t.label}-${i}`}
                                  className="rounded-full bg-[color-mix(in_srgb,var(--brand)_16%,var(--accent))] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--fg)]"
                                >
                                  <span className="text-[9px] font-bold uppercase tracking-wide text-[color:var(--brand)]">
                                    {t.kind === 'program' ? 'Prog' : 'Presta'}
                                  </span>{' '}
                                  {t.label}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-[color:var(--muted)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[color:var(--fg)]">
                          {n} membre{n > 1 ? 's' : ''}
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]">
                            {g.type === 'linked' ? 'Lié' : 'Libre'}
                          </span>
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
