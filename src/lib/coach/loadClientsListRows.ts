import { isSchemaCacheError } from '@/src/lib/supabase/errors'

export type ClientListRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  status: string
  is_demo: boolean | null
  created_at: string
  prestationNames: string[]
  prestationIds: string[]
  /** Dernier bilan soumis (rempli), libellé court. */
  lastBilanLabel: string
  /** ISO dernier bilan soumis — pour tri. */
  lastBilanAt: string | null
  lastSessionLabel: string
  /** ISO date dernière séance finie — pour tri liste. */
  lastSessionAt: string | null
}

function displayName(c: {
  first_name: string | null
  last_name: string | null
  email: string
}) {
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return n || c.email
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

type Db = {
  from: (table: string) => {
    select: (cols: string) => any
  }
}

/** Enrichit la liste clients : prestas actives, dernier bilan rempli, dernière séance. */
export async function loadClientsListRows(
  supabase: Db,
  coachId: string,
  opts?: { clientIds?: string[] }
): Promise<ClientListRow[]> {
  let q = supabase
    .from('clients')
    .select('id, email, first_name, last_name, phone, status, is_demo, created_at')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (opts?.clientIds?.length) {
    q = q.in('id', opts.clientIds)
  } else if (opts?.clientIds && opts.clientIds.length === 0) {
    return []
  }

  const { data: clients, error } = await q

  if (error) {
    if (isSchemaCacheError(error.message)) return []
    throw new Error(error.message)
  }
  const list = (clients ?? []) as Array<{
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    status: string
    is_demo: boolean | null
    created_at: string
  }>
  if (!list.length) return []

  const clientIds = list.map((c) => c.id)

  const [{ data: grants }, { data: bilans }, { data: runs }] = await Promise.all([
    supabase
      .from('client_grants')
      .select('client_id, prestation_id, prestations(id, name)')
      .eq('coach_id', coachId)
      .eq('status', 'active')
      .in('client_id', clientIds),
    supabase
      .from('bilan_instances')
      .select('client_id, submitted_at')
      .eq('coach_id', coachId)
      .in('client_id', clientIds)
      .eq('status', 'submitted')
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('session_runs')
      .select('client_id, finished_at, actual_date')
      .eq('coach_id', coachId)
      .in('client_id', clientIds)
      .is('deleted_at', null)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false }),
  ])

  const prestaByClient = new Map<string, { ids: Set<string>; names: string[] }>()
  for (const g of grants ?? []) {
    const presta = g.prestations as { id?: string; name?: string } | { id?: string; name?: string }[] | null
    const row = Array.isArray(presta) ? presta[0] : presta
    const name = row?.name?.trim()
    const pid = (row?.id ?? g.prestation_id) as string | undefined
    if (!name || !pid) continue
    let bucket = prestaByClient.get(g.client_id)
    if (!bucket) {
      bucket = { ids: new Set(), names: [] }
      prestaByClient.set(g.client_id, bucket)
    }
    if (!bucket.ids.has(pid)) {
      bucket.ids.add(pid)
      bucket.names.push(name)
    }
  }

  const lastBilanByClient = new Map<string, string>()
  for (const b of bilans ?? []) {
    if (!b.submitted_at || lastBilanByClient.has(b.client_id)) continue
    lastBilanByClient.set(b.client_id, b.submitted_at)
  }

  const lastSessionByClient = new Map<string, string>()
  for (const r of runs ?? []) {
    if (!lastSessionByClient.has(r.client_id)) {
      const when = r.finished_at || r.actual_date
      if (when) lastSessionByClient.set(r.client_id, when)
    }
  }

  return list.map((c) => {
    const presta = prestaByClient.get(c.id)
    const bilanAt = lastBilanByClient.get(c.id) ?? null
    const lastAt = lastSessionByClient.get(c.id) ?? null
    return {
      ...c,
      prestationNames: presta?.names ?? [],
      prestationIds: presta ? [...presta.ids] : [],
      lastBilanAt: bilanAt,
      lastBilanLabel: bilanAt ? formatShortDate(bilanAt) : '—',
      lastSessionAt: lastAt,
      lastSessionLabel: lastAt ? formatShortDate(lastAt) : '—',
    }
  })
}

export { displayName as clientListDisplayName }

export function clientListStatusLabel(status: string) {
  switch (status) {
    case 'invited':
      return 'Invité'
    case 'active':
      return 'Actif'
    case 'archived':
      return 'Archivé'
    default:
      return status
  }
}
