import { chatDb } from '../chat/chat'
import { isSchemaCacheError } from '../supabase/errors'
import { parseTimerConfig, summarizeTimerConfig } from './timerConfig'

export type BlockStatus = 'draft' | 'published'
export type BlockSourceKind = 'own' | 'krid' | 'network'

export type CoachBlockRow = {
  id: string
  coach_id: string | null
  name: string
  notes: string | null
  timer_note: string | null
  sport_id: string | null
  sport_label: string | null
  status: BlockStatus
  source_kind: BlockSourceKind
  source_block_id: string | null
  exercise_count: number
  timer_summary: string
  /** Types hérités visibles (exos − hidden). */
  type_ids: string[]
  type_labels: string[]
  created_at: string
  updated_at: string
}

function mapSourceKind(raw: unknown): BlockSourceKind {
  if (raw === 'krid' || raw === 'network' || raw === 'own') return raw
  return 'own'
}

function timerSummary(timerNote: string | null): string {
  const cfg = parseTimerConfig(timerNote)
  if (!cfg) return '—'
  return summarizeTimerConfig(cfg)
}

type RawBlock = {
  id: string
  coach_id: string | null
  name: string
  notes: string | null
  timer_note: string | null
  sport_id: string | null
  status: string | null
  source_kind?: string | null
  source_block_id?: string | null
  created_at: string | null
  updated_at: string | null
  sports?: { label?: string | null } | { label?: string | null }[] | null
  block_library_exercises?: { id?: string }[] | null
}

function mapBlock(row: RawBlock): CoachBlockRow {
  const sportJoin = Array.isArray(row.sports) ? row.sports[0] : row.sports
  return {
    id: row.id,
    coach_id: row.coach_id,
    name: String(row.name ?? '').trim() || 'Bloc',
    notes: row.notes,
    timer_note: row.timer_note,
    sport_id: row.sport_id,
    sport_label: sportJoin?.label ?? null,
    status: row.status === 'draft' ? 'draft' : 'published',
    source_kind: mapSourceKind(row.source_kind),
    source_block_id: row.source_block_id ?? null,
    exercise_count: Array.isArray(row.block_library_exercises) ? row.block_library_exercises.length : 0,
    timer_summary: timerSummary(row.timer_note),
    type_ids: [],
    type_labels: [],
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

const SELECT =
  'id, coach_id, name, notes, timer_note, sport_id, status, source_kind, source_block_id, created_at, updated_at, sports(label), block_library_exercises(id)'

const SELECT_NO_SPORT =
  'id, coach_id, name, notes, timer_note, sport_id, status, source_kind, source_block_id, created_at, updated_at, block_library_exercises(id)'

const SELECT_MIN =
  'id, coach_id, name, notes, timer_note, sport_id, status, created_at, updated_at'

function isMissingSportsEmbedError(message: string) {
  return isSchemaCacheError(message) || /sports|relationship/i.test(message)
}

/** Enrichit les types hérités (exos − hidden) pour une liste de blocs. */
async function withBlockInheritedTypes(
  supabase: unknown,
  items: CoachBlockRow[],
): Promise<CoachBlockRow[]> {
  if (!items.length) return items
  const db = chatDb(supabase)
  const blockIds = items.map((b) => b.id)

  const [{ data: linkedRaw }, { data: hiddenRaw }] = await Promise.all([
    db
      .from('block_library_exercises')
      .select('block_id, exercise_id')
      .in('block_id', blockIds),
    db
      .from('block_library_hidden_types')
      .select('block_id, exercise_type_id')
      .in('block_id', blockIds),
  ])

  const linked = (linkedRaw ?? []) as { block_id: string; exercise_id: string }[]
  const hidden = (hiddenRaw ?? []) as { block_id: string; exercise_type_id: string }[]

  const exerciseIds = [...new Set(linked.map((r) => r.exercise_id).filter(Boolean))]
  const typeByExercise = new Map<string, { id: string; label: string }>()

  if (exerciseIds.length) {
    const { data: exosRaw } = await db
      .from('exercise_library')
      .select('id, exercise_type_id, exercise_types(id, label)')
      .in('id', exerciseIds)

    for (const row of (exosRaw ?? []) as Array<{
      id: string
      exercise_type_id: string | null
      exercise_types?:
        | { id?: string; label?: string | null }
        | { id?: string; label?: string | null }[]
        | null
    }>) {
      const join = Array.isArray(row.exercise_types) ? row.exercise_types[0] : row.exercise_types
      const typeId = join?.id ?? row.exercise_type_id
      const label = join?.label?.trim()
      if (typeId && label) typeByExercise.set(row.id, { id: typeId, label })
    }

    // Fallback if nested join unsupported
    if (!typeByExercise.size) {
      const { data: flat } = await db
        .from('exercise_library')
        .select('id, exercise_type_id')
        .in('id', exerciseIds)
      const typeIds = [
        ...new Set(
          ((flat ?? []) as { exercise_type_id: string | null }[])
            .map((r) => r.exercise_type_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ]
      const labelByType = new Map<string, string>()
      if (typeIds.length) {
        const { data: typesRaw } = await db
          .from('exercise_types')
          .select('id, label')
          .in('id', typeIds)
        for (const t of (typesRaw ?? []) as { id: string; label: string }[]) {
          if (t.label?.trim()) labelByType.set(t.id, t.label.trim())
        }
      }
      for (const row of (flat ?? []) as { id: string; exercise_type_id: string | null }[]) {
        const tid = row.exercise_type_id
        if (!tid) continue
        const label = labelByType.get(tid)
        if (label) typeByExercise.set(row.id, { id: tid, label })
      }
    }
  }

  const hiddenByBlock = new Map<string, Set<string>>()
  for (const h of hidden) {
    const set = hiddenByBlock.get(h.block_id) ?? new Set()
    set.add(h.exercise_type_id)
    hiddenByBlock.set(h.block_id, set)
  }

  const typesByBlock = new Map<string, Map<string, string>>()
  for (const row of linked) {
    const t = typeByExercise.get(row.exercise_id)
    if (!t) continue
    const hiddenSet = hiddenByBlock.get(row.block_id)
    if (hiddenSet?.has(t.id)) continue
    const map = typesByBlock.get(row.block_id) ?? new Map()
    map.set(t.id, t.label)
    typesByBlock.set(row.block_id, map)
  }

  return items.map((b) => {
    const map = typesByBlock.get(b.id)
    if (!map?.size) return b
    const entries = [...map.entries()].sort((a, b2) => a[1].localeCompare(b2[1], 'fr'))
    return {
      ...b,
      type_ids: entries.map(([id]) => id),
      type_labels: entries.map(([, label]) => label),
    }
  })
}

/** Catalogue Krid blocs publiés. */
export async function listKridBlocks(supabase: unknown) {
  const db = chatDb(supabase)
  const res = await db
    .from('block_library')
    .select(SELECT)
    .is('coach_id', null)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  let rows: CoachBlockRow[]
  if (res.error && isMissingSportsEmbedError(res.error.message)) {
    const fallback = await db
      .from('block_library')
      .select(SELECT_NO_SPORT)
      .is('coach_id', null)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    if (fallback.error) {
      if (isSchemaCacheError(fallback.error.message)) return []
      throw new Error(fallback.error.message)
    }
    rows = ((fallback.data ?? []) as RawBlock[]).map(mapBlock)
  } else if (res.error) {
    if (isSchemaCacheError(res.error.message)) return []
    const fallback = await db
      .from('block_library')
      .select(SELECT_MIN)
      .is('coach_id', null)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    if (fallback.error) {
      if (isSchemaCacheError(fallback.error.message)) return []
      throw new Error(fallback.error.message)
    }
    rows = ((fallback.data ?? []) as RawBlock[]).map(mapBlock)
  } else {
    rows = ((res.data ?? []) as RawBlock[]).map(mapBlock)
  }
  return withBlockInheritedTypes(supabase, rows)
}

export async function listCoachBlocks(
  supabase: unknown,
  coachId: string,
  status: BlockStatus,
) {
  const db = chatDb(supabase)
  // hub_visible=false = usage séance only (pas dans Ma biblio / Brouillon)
  let res = await db
    .from('block_library')
    .select(SELECT)
    .eq('coach_id', coachId)
    .eq('status', status)
    .eq('hub_visible', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (res.error && /hub_visible/i.test(res.error.message)) {
    res = await db
      .from('block_library')
      .select(SELECT)
      .eq('coach_id', coachId)
      .eq('status', status)
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }

  let rows: CoachBlockRow[]
  if (res.error && isMissingSportsEmbedError(res.error.message)) {
    const fallback = await db
      .from('block_library')
      .select(SELECT_NO_SPORT)
      .eq('coach_id', coachId)
      .eq('status', status)
      .is('deleted_at', null)
      .order('name', { ascending: true })
    if (fallback.error) {
      if (isSchemaCacheError(fallback.error.message)) return []
      throw new Error(fallback.error.message)
    }
    rows = ((fallback.data ?? []) as RawBlock[]).map(mapBlock)
  } else if (res.error) {
    if (isSchemaCacheError(res.error.message)) return []
    const fallback = await db
      .from('block_library')
      .select(SELECT_MIN)
      .eq('coach_id', coachId)
      .eq('status', status)
      .is('deleted_at', null)
      .order('name', { ascending: true })
    if (fallback.error) {
      if (isSchemaCacheError(fallback.error.message)) return []
      throw new Error(fallback.error.message)
    }
    rows = ((fallback.data ?? []) as RawBlock[]).map(mapBlock)
  } else {
    rows = ((res.data ?? []) as RawBlock[]).map(mapBlock)
  }
  return withBlockInheritedTypes(supabase, rows)
}

export async function listCoachForkedKridBlockSourceIds(supabase: unknown, coachId: string) {
  const db = chatDb(supabase)
  const res = await db
    .from('block_library')
    .select('source_block_id')
    .eq('coach_id', coachId)
    .eq('source_kind', 'krid')
    .is('deleted_at', null)
    .not('source_block_id', 'is', null)

  if (res.error) return new Set<string>()
  const ids = new Set<string>()
  for (const row of res.data ?? []) {
    const id = (row as { source_block_id?: string | null }).source_block_id
    if (id) ids.add(id)
  }
  return ids
}

export async function getCoachBlock(supabase: unknown, id: string) {
  const db = chatDb(supabase)
  const res = await db
    .from('block_library')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)
  if (!res.data) return null
  const [enriched] = await withBlockInheritedTypes(supabase, [mapBlock(res.data as RawBlock)])
  return enriched
}

export function blockOriginLabel(kind: BlockSourceKind): string {
  if (kind === 'krid') return 'Krid'
  if (kind === 'network') return 'Réseau'
  return 'Perso'
}

export function filterBlockRows(
  items: CoachBlockRow[],
  opts: { q?: string; sport?: string; type?: string },
) {
  const q = (opts.q ?? '').trim().toLowerCase()
  const sport = (opts.sport ?? '').trim()
  const type = (opts.type ?? '').trim()
  return items.filter((b) => {
    if (sport && (b.sport_id ?? '') !== sport && (b.sport_label ?? '') !== sport) return false
    if (type) {
      const hit =
        b.type_ids.includes(type) ||
        b.type_labels.some((l) => l === type || l.toLowerCase() === type.toLowerCase())
      if (!hit) return false
    }
    if (q) {
      const hay =
        `${b.name} ${b.sport_label ?? ''} ${b.type_labels.join(' ')} ${b.timer_summary}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function collectBlockFilterOptions(items: CoachBlockRow[]) {
  const sports = new Map<string, string>()
  const types = new Map<string, string>()
  for (const b of items) {
    if (b.sport_id && b.sport_label) sports.set(b.sport_id, b.sport_label)
    b.type_ids.forEach((id, i) => {
      const label = b.type_labels[i]
      if (id && label) types.set(id, label)
    })
  }
  return {
    sportOptions: [...sports.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    typeOptions: [...types.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
  }
}
