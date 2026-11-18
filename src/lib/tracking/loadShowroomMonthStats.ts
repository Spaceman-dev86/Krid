import type { SupabaseClient } from '@supabase/supabase-js'

export type ShowroomMonthStats = {
  monthLabel: string
  /** Clics uniques (approx.) sur toutes les campagnes Liens ce mois. */
  allClickPeople: number
  /** Clics uniques sur campagnes ciblant une fiche presta. */
  prestaClickPeople: number
  /** Clients distincts ayant payé via showroom ce mois. */
  showroomBuyers: number
}

function monthStartIso(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function monthLabelFr(d = new Date()) {
  const raw = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** Compte unique : visitor_key si présent, sinon 1 par clic. */
function uniqueClickPeople(
  rows: { id: string; visitor_key: string | null; link_id?: string }[] | null | undefined,
  linkFilter?: Set<string>,
): number {
  const keys = new Set<string>()
  let anon = 0
  for (const row of rows ?? []) {
    if (linkFilter && row.link_id && !linkFilter.has(row.link_id)) continue
    const key = row.visitor_key?.trim()
    if (key) keys.add(key)
    else anon += 1
  }
  return keys.size + anon
}

export async function loadShowroomMonthStats(
  supabase: SupabaseClient,
  coachId: string,
): Promise<ShowroomMonthStats> {
  const now = new Date()
  const since = monthStartIso(now)
  const empty: ShowroomMonthStats = {
    monthLabel: monthLabelFr(now),
    allClickPeople: 0,
    prestaClickPeople: 0,
    showroomBuyers: 0,
  }

  const [{ data: links }, { data: clicks }, { data: paid }] = await Promise.all([
    supabase.from('coach_tracked_links').select('id, target_kind').eq('coach_id', coachId),
    supabase
      .from('coach_tracked_link_clicks')
      .select('id, visitor_key, link_id')
      .eq('coach_id', coachId)
      .gte('created_at', since),
    supabase
      .from('payment_ledger')
      .select('client_id, paid_at, created_at')
      .eq('coach_id', coachId)
      .eq('status', 'paid')
      .eq('source', 'showroom')
      .gte('created_at', since),
  ])

  const prestaLinkIds = new Set(
    (links ?? []).filter((l) => l.target_kind === 'prestation').map((l) => l.id as string),
  )

  const buyers = new Set<string>()
  for (const row of paid ?? []) {
    const when = row.paid_at ?? row.created_at
    if (!when || when < since) continue
    if (row.client_id) buyers.add(row.client_id)
  }

  return {
    ...empty,
    allClickPeople: uniqueClickPeople(clicks),
    prestaClickPeople: uniqueClickPeople(clicks, prestaLinkIds),
    showroomBuyers: buyers.size,
  }
}
