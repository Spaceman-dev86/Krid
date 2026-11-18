import type { SupabaseClient } from '@supabase/supabase-js'

import { loadSessionLibraryFilterMeta } from '@/src/lib/sessions/sessionLibraryFilterMeta'

export type SessionSourceKind = 'own' | 'krid' | 'network'

export type CoachSessionRow = {
  id: string
  name: string
  status: 'draft' | 'published'
  source_kind: SessionSourceKind
  source_session_id: string | null
  sport_label: string | null
  type_labels: string[]
  exercise_count: number
  sport_ids: string[]
  type_ids: string[]
}

function mapSourceKind(raw: unknown): SessionSourceKind {
  if (raw === 'krid' || raw === 'network' || raw === 'own') return raw
  return 'own'
}

export function sessionOriginLabel(kind: SessionSourceKind): string {
  if (kind === 'krid') return 'Krid'
  if (kind === 'network') return 'Réseau'
  return 'Perso'
}

type ListMode = 'mine' | 'brouillon' | 'krid'

/** Liste hub séances coach (Ma biblio / Brouillons / Catalogue Krid). */
export async function listCoachSessions(
  supabase: SupabaseClient,
  coachId: string,
  mode: ListMode,
): Promise<CoachSessionRow[]> {
  let q = supabase
    .from('session_library' as never)
    .select('id, name, status, source_kind, source_session_id')
    .is('deleted_at' as never, null)
    .order('updated_at' as never, { ascending: false })
    .limit(400)

  if (mode === 'krid') {
    q = q.is('coach_id' as never, null).eq('status' as never, 'published')
  } else if (mode === 'mine') {
    q = q.eq('coach_id' as never, coachId as never).eq('status' as never, 'published')
  } else {
    q = q.eq('coach_id' as never, coachId as never).eq('status' as never, 'draft')
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as {
    id: string
    name: string | null
    status: string
    source_kind?: string | null
    source_session_id?: string | null
  }[]

  const ids = rows.map((r) => r.id)
  const meta = await loadSessionLibraryFilterMeta(supabase, ids)

  const [{ data: sportsRaw }, { data: typesRaw }, { data: itemsRaw }] = await Promise.all([
    supabase
      .from('sports' as never)
      .select('id, label')
      .is('deleted_at' as never, null)
      .limit(800),
    supabase
      .from('exercise_types' as never)
      .select('id, label')
      .is('deleted_at' as never, null)
      .limit(800),
    ids.length
      ? supabase
          .from('session_library_items' as never)
          .select('session_id, item_kind, block_id')
          .in('session_id' as never, ids as never)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  const sportLabel = new Map(
    ((sportsRaw ?? []) as { id: string; label: string }[]).map((s) => [s.id, s.label]),
  )
  const typeLabel = new Map(
    ((typesRaw ?? []) as { id: string; label: string }[]).map((t) => [t.id, t.label]),
  )

  const blockIdsBySession = new Map<string, string[]>()
  for (const it of (itemsRaw ?? []) as {
    session_id: string
    item_kind: string
    block_id?: string | null
  }[]) {
    if (it.item_kind === 'block' && it.block_id) {
      const list = blockIdsBySession.get(it.session_id) ?? []
      list.push(it.block_id)
      blockIdsBySession.set(it.session_id, list)
    }
  }

  // Compter aussi les exos dans les blocs
  const allBlockIds = [...new Set([...blockIdsBySession.values()].flat())]
  const exoCountByBlock = new Map<string, number>()
  if (allBlockIds.length) {
    const { data: be } = await supabase
      .from('block_library_exercises' as never)
      .select('block_id')
      .in('block_id' as never, allBlockIds as never)
    for (const r of (be ?? []) as { block_id: string }[]) {
      exoCountByBlock.set(r.block_id, (exoCountByBlock.get(r.block_id) ?? 0) + 1)
    }
  }

  return rows.map((r) => {
    const m = meta.get(r.id)
    const sportIds = m?.sport_ids ?? []
    const typeIds = m?.type_ids ?? []
    let exercise_count = 0
    for (const it of (itemsRaw ?? []) as { session_id: string; item_kind: string }[]) {
      if (it.session_id !== r.id) continue
      if (it.item_kind === 'exercise') exercise_count += 1
    }
    for (const bid of blockIdsBySession.get(r.id) ?? []) {
      exercise_count += exoCountByBlock.get(bid) ?? 0
    }
    const primarySport = sportIds[0] ? sportLabel.get(sportIds[0]) ?? null : null
    return {
      id: r.id,
      name: r.name?.trim() || 'Séance',
      status: r.status === 'draft' ? 'draft' : 'published',
      source_kind: mapSourceKind(r.source_kind),
      source_session_id: r.source_session_id ?? null,
      sport_label: primarySport,
      type_labels: typeIds.map((id) => typeLabel.get(id) ?? '').filter(Boolean),
      exercise_count,
      sport_ids: sportIds,
      type_ids: typeIds,
    } satisfies CoachSessionRow
  })
}

export function filterCoachSessions(
  rows: CoachSessionRow[],
  opts: { q?: string; type?: string; sport?: string },
): CoachSessionRow[] {
  const q = String(opts.q ?? '')
    .trim()
    .toLowerCase()
  const type = String(opts.type ?? '').trim()
  const sport = String(opts.sport ?? '').trim()
  return rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q)) return false
    if (type && !r.type_ids.includes(type)) return false
    if (sport && !r.sport_ids.includes(sport)) return false
    return true
  })
}

export function collectSessionFilterOptions(items: CoachSessionRow[]) {
  const sportIds = new Set<string>()
  const typeIds = new Set<string>()
  for (const r of items) {
    for (const id of r.sport_ids) sportIds.add(id)
    for (const id of r.type_ids) typeIds.add(id)
  }
  return { sportIds: [...sportIds], typeIds: [...typeIds] }
}
