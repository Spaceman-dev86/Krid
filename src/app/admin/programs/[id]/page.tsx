import { notFound } from 'next/navigation'

import { AdminProgramBuilderShell } from '@/src/components/admin/AdminProgramBuilderShell'
import { DaBanner } from '@/src/components/ui'
import { requirePlatformAdmin } from '@/src/lib/auth/requirePlatformAdmin'
import { loadSessionLibraryFilterMeta } from '@/src/lib/sessions/sessionLibraryFilterMeta'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ProgramRow = {
  id: string
  title: string | null
  description: string | null
  goal: string | null
  level: string | null
  duration: string | null
  image_url: string | null
  is_calendar: boolean | null
  catalog_status: string | null
  allow_duplicate: boolean | null
  is_trainly_catalog: boolean | null
  deleted_at: string | null
}

type WeekRow = {
  id: string
  title: string | null
  week_order: number
}

type SessionRow = {
  id: string
  week_id: string
  title: string | null
  session_order: number
  notes: string | null
  objective_ressenti: boolean
  objective_note: boolean
  objective_difficulty: boolean
}

function flashMessage(ok?: string, error?: string): string | null {
  if (typeof error === 'string' && error) return error
  switch (ok) {
    case 'published':
      return 'Programme publié'
    case 'draft':
      return 'Repassé en brouillon'
    case 'week_renamed':
      return 'Semaine renommée'
    case 'week_duplicated':
      return 'Semaine dupliquée'
    case 'week_deleted':
      return 'Semaine supprimée'
    case 'weeks_synced':
      return 'Durée / semaines synchronisées'
    case 'session_added':
      return 'Séance catalogue ajoutée (composition copiée)'
    case 'session_created':
      return 'Séance créée'
    case 'session_renamed':
      return 'Séance renommée'
    case 'session_updated':
      return 'Séance mise à jour'
    case 'session_moved':
      return 'Séance déplacée'
    case 'session_removed':
      return 'Séance retirée'
    case 'composition_saved':
      return 'Composition enregistrée'
    case 'block_added':
      return 'Bloc ajouté'
    case 'exercise_added':
      return 'Exercice ajouté'
    default:
      return null
  }
}

export default async function AdminProgramBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?:
    | Promise<{ ok?: string; error?: string; week?: string }>
    | { ok?: string; error?: string; week?: string }
}) {
  await requirePlatformAdmin()
  const { id } = await params
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()

  const { data: programRaw, error } = await supabase
    .from('programs')
    .select(
      'id,title,description,goal,level,duration,image_url,is_calendar,catalog_status,allow_duplicate,is_trainly_catalog,deleted_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !programRaw) notFound()

  const program = programRaw as ProgramRow
  if (program.deleted_at || program.is_trainly_catalog === false) notFound()

  const { data: weeksRaw } = await supabase
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', id)
    .order('week_order', { ascending: true })

  const weeks = (weeksRaw ?? []) as WeekRow[]
  const weekIds = weeks.map((w) => w.id)

  let sessions: SessionRow[] = []
  if (weekIds.length) {
    const { data: sessionsRaw } = await supabase
      .from('sessions')
      .select(
        'id,week_id,title,session_order,notes,objective_ressenti,objective_note,objective_difficulty',
      )
      .in('week_id', weekIds)
      .order('session_order', { ascending: true })
    sessions = (sessionsRaw ?? []) as SessionRow[]
  }

  const sessionIds = sessions.map((s) => s.id)

  type ItemRow = {
    id: string
    session_id: string
    position: number
    kind: string
    program_exercise_id: string | null
    session_block_id: string | null
    prescriptions: unknown
  }

  let itemRows: ItemRow[] = []
  if (sessionIds.length) {
    const { data } = await supabase
      .from('session_items')
      .select('id,session_id,position,kind,program_exercise_id,session_block_id,prescriptions')
      .in('session_id', sessionIds)
      .order('position', { ascending: true })
    itemRows = (data ?? []) as ItemRow[]
  }

  const peIds = [
    ...new Set(itemRows.filter((i) => i.program_exercise_id).map((i) => i.program_exercise_id!)),
  ]
  const sbIds = [
    ...new Set(itemRows.filter((i) => i.session_block_id).map((i) => i.session_block_id!)),
  ]

  const peMeta = new Map<string, { name: string; exercise_id: string | null }>()
  const sbMeta = new Map<
    string,
    { title: string; source_block_library_id: string | null }
  >()
  const blockChildren = new Map<string, { id: string; name: string }[]>()
  if (peIds.length) {
    const { data } = await supabase
      .from('program_exercises')
      .select('id,name,exercise_id')
      .in('id', peIds)
    for (const r of (data ?? []) as {
      id: string
      name: string | null
      exercise_id: string | null
    }[]) {
      peMeta.set(r.id, {
        name: r.name?.trim() || 'Exercice',
        exercise_id: r.exercise_id,
      })
    }
  }
  if (sbIds.length) {
    const { data } = await supabase
      .from('session_blocks')
      .select('id,title,source_block_library_id')
      .in('id', sbIds)
    for (const r of (data ?? []) as {
      id: string
      title: string | null
      source_block_library_id: string | null
    }[]) {
      sbMeta.set(r.id, {
        title: r.title?.trim() || 'Bloc',
        source_block_library_id: r.source_block_library_id,
      })
    }
    const { data: beRaw } = await supabase
      .from('block_exercises')
      .select('id,session_block_id,exercise_name,position')
      .in('session_block_id', sbIds)
      .order('position', { ascending: true })
    for (const r of (beRaw ?? []) as {
      id: string
      session_block_id: string
      exercise_name: string | null
      position: number
    }[]) {
      if (!blockChildren.has(r.session_block_id)) blockChildren.set(r.session_block_id, [])
      blockChildren.get(r.session_block_id)!.push({
        id: r.id,
        name: r.exercise_name?.trim() || 'Exercice',
      })
    }
  }

  const itemsBySession = new Map<
    string,
    {
      id: string
      kind: 'block' | 'exercise'
      label: string
      position: number
      children?: { id: string; name: string }[]
    }[]
  >()
  const slotsBySession = new Map<
    string,
    {
      key: string
      kind: 'block' | 'exercise' | 'rest'
      blockId?: string
      exerciseId?: string
      restSeconds?: number
      prescriptions: { unit_id: string; value: string; input_mode?: string; group?: number }[]
    }[]
  >()

  for (const it of itemRows) {
    if (!slotsBySession.has(it.session_id)) slotsBySession.set(it.session_id, [])
    const prescriptions = Array.isArray(it.prescriptions) ? it.prescriptions : []

    if (it.kind === 'rest') {
      const secs = (() => {
        const first = prescriptions[0] as { rest_seconds?: unknown } | undefined
        const n = Number(first?.rest_seconds)
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60
      })()
      slotsBySession.get(it.session_id)!.push({
        key: it.id,
        kind: 'rest',
        restSeconds: secs,
        prescriptions: [],
      })
      continue
    }

    const kind = it.kind === 'block' ? 'block' : 'exercise'
    if (kind === 'block') {
      const meta = sbMeta.get(it.session_block_id ?? '')
      const libraryId = meta?.source_block_library_id
      if (libraryId) {
        slotsBySession.get(it.session_id)!.push({
          key: it.id,
          kind: 'block',
          blockId: libraryId,
          prescriptions: [],
        })
      }
      if (!itemsBySession.has(it.session_id)) itemsBySession.set(it.session_id, [])
      itemsBySession.get(it.session_id)!.push({
        id: it.id,
        kind: 'block',
        label: meta?.title ?? 'Bloc',
        position: it.position,
        children: it.session_block_id ? blockChildren.get(it.session_block_id) ?? [] : [],
      })
    } else {
      const meta = peMeta.get(it.program_exercise_id ?? '')
      if (meta?.exercise_id) {
        slotsBySession.get(it.session_id)!.push({
          key: it.id,
          kind: 'exercise',
          exerciseId: meta.exercise_id,
          prescriptions: prescriptions as {
            unit_id: string
            value: string
            input_mode?: string
            group?: number
          }[],
        })
      }
      if (!itemsBySession.has(it.session_id)) itemsBySession.set(it.session_id, [])
      itemsBySession.get(it.session_id)!.push({
        id: it.id,
        kind: 'exercise',
        label: meta?.name ?? 'Exercice',
        position: it.position,
      })
    }
  }

  const weekParam = typeof q.week === 'string' ? q.week : null
  const initialWeekId =
    weekParam && weeks.some((w) => w.id === weekParam) ? weekParam : (weeks[0]?.id ?? null)

  const [
    { data: libraryRaw },
    { data: blocksRaw },
    { data: exosRaw },
    { data: sportsRaw },
    { data: typesRaw },
    { data: unitsRaw },
  ] = await Promise.all([
    supabase
      .from('session_library' as never)
      .select('id, name, notes')
      .is('deleted_at' as never, null)
      .is('coach_id' as never, null)
      .eq('status' as never, 'published')
      .order('name' as never, { ascending: true })
      .limit(200),
    supabase
      .from('block_library' as never)
      .select('id, name, sport_id, status')
      .is('deleted_at' as never, null)
      .is('coach_id' as never, null)
      .eq('status' as never, 'published')
      .order('name' as never, { ascending: true })
      .limit(300),
    supabase
      .from('exercise_library')
      .select('id, name, sport_id, exercise_type_id, muscle_group')
      .is('deleted_at', null)
      .is('coach_id', null)
      .eq('status', 'published')
      .order('name', { ascending: true })
      .limit(500),
    supabase
      .from('sports' as never)
      .select('id, label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true }),
    supabase
      .from('exercise_types' as never)
      .select('id, label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true }),
    supabase
      .from('units' as never)
      .select('id, key, label, short_label, value_mode, list_options')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true }),
  ])

  const libraryRows = (libraryRaw ?? []) as { id: string; name: string | null; notes: string | null }[]
  const libraryIds = libraryRows.map((r) => r.id)
  const filterMeta = await loadSessionLibraryFilterMeta(supabase, libraryIds)

  const libraryItemCountBySession = new Map<string, number>()
  if (libraryIds.length) {
    const { data: itemsRaw } = await supabase
      .from('session_library_items' as never)
      .select('session_id')
      .in('session_id' as never, libraryIds)
    for (const row of (itemsRaw ?? []) as { session_id: string }[]) {
      libraryItemCountBySession.set(
        row.session_id,
        (libraryItemCountBySession.get(row.session_id) ?? 0) + 1,
      )
    }
  }

  const catalogSessions = libraryRows.map((r) => {
    const meta = filterMeta.get(r.id)
    return {
      id: r.id,
      name: r.name,
      notes: r.notes,
      item_count: libraryItemCountBySession.get(r.id) ?? 0,
      sport_ids: meta?.sport_ids ?? [],
      type_ids: meta?.type_ids ?? [],
    }
  })

  const catalogBlocks = ((blocksRaw ?? []) as {
    id: string
    name: string
    sport_id: string | null
    status: string
  }[]).map((b) => ({
    id: b.id,
    name: b.name,
    sport_id: b.sport_id,
    status: b.status,
  }))

  const catalogExercises = ((exosRaw ?? []) as {
    id: string
    name: string
    sport_id: string | null
    exercise_type_id: string | null
    muscle_group: string | null
  }[]).map((e) => ({
    id: e.id,
    name: e.name,
    sport_id: e.sport_id,
    exercise_type_id: e.exercise_type_id,
    muscle_group: e.muscle_group,
  }))

  const catalogSports = ((sportsRaw ?? []) as { id: string; label: string }[]).map((s) => ({
    id: s.id,
    label: s.label,
  }))
  const catalogTypes = ((typesRaw ?? []) as { id: string; label: string }[]).map((t) => ({
    id: t.id,
    label: t.label,
  }))

  const sportLabel = new Map(catalogSports.map((s) => [s.id, s.label]))
  const typeLabel = new Map(catalogTypes.map((t) => [t.id, t.label]))

  const ficheBlocks = catalogBlocks.map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status,
    sport_id: b.sport_id,
    sport_label: b.sport_id ? sportLabel.get(b.sport_id) ?? null : null,
  }))

  const ficheExercises = catalogExercises.map((e) => ({
    id: e.id,
    name: e.name,
    exercise_type_id: e.exercise_type_id,
    exercise_type_label: e.exercise_type_id ? typeLabel.get(e.exercise_type_id) ?? null : null,
    sport_id: e.sport_id,
    sport_label: e.sport_id ? sportLabel.get(e.sport_id) ?? null : null,
    muscle_group: e.muscle_group,
  }))

  const ficheUnits = ((unitsRaw ?? []) as {
    id: string
    key: string
    label: string
    short_label?: string | null
    value_mode?: string | null
    list_options?: unknown
  }[]).map((u) => ({
    id: u.id,
    key: u.key,
    label: u.label,
    short_label: u.short_label ?? null,
    value_mode: u.value_mode,
    list_options: Array.isArray(u.list_options) ? (u.list_options as string[]) : null,
  }))

  const libraryBlockIdsForDetails = [
    ...new Set(
      [...slotsBySession.values()]
        .flat()
        .filter((s) => s.kind === 'block' && s.blockId)
        .map((s) => s.blockId!),
    ),
  ]
  const { loadSessionBlockDetails } = await import('@/src/lib/sessions/blockDetail')
  const initialBlockDetails =
    libraryBlockIdsForDetails.length > 0
      ? await loadSessionBlockDetails(supabase, libraryBlockIdsForDetails)
      : []

  const flash = flashMessage(
    typeof q.ok === 'string' ? q.ok : undefined,
    typeof q.error === 'string' ? q.error : undefined,
  )

  return (
    <>
      {flash ? (
        <div className="mx-auto max-w-6xl px-4 pt-3 md:px-6">
          <DaBanner tone={q.error ? 'danger' : 'success'}>{flash}</DaBanner>
        </div>
      ) : null}
      <AdminProgramBuilderShell
        initialWeekId={initialWeekId}
        catalogSessions={catalogSessions}
        catalogBlocks={catalogBlocks}
        catalogExercises={catalogExercises}
        catalogSports={catalogSports}
        catalogTypes={catalogTypes}
        compositionEditor={{
          blocks: ficheBlocks,
          exercises: ficheExercises,
          units: ficheUnits,
          blockCatalog: {
            candidates: ficheExercises.map((e) => ({
              id: e.id,
              name: e.name,
              exercise_type_id: e.exercise_type_id,
              exercise_type_label: e.exercise_type_label,
              sport_id: e.sport_id,
              sport_label: e.sport_label,
              muscle_group: e.muscle_group,
            })),
            sports: catalogSports,
            units: ficheUnits.map((u) => ({
              id: u.id,
              key: u.key,
              label: u.label,
              short_label: u.short_label,
              value_mode: (u.value_mode as 'number' | 'time' | 'text' | 'list' | null) ?? null,
              list_options: u.list_options,
            })),
          },
          initialBlockDetails,
        }}
        program={{
          id: program.id,
          title: program.title,
          description: program.description,
          goal: program.goal,
          level: program.level,
          duration: program.duration,
          image_url: program.image_url,
          is_calendar: Boolean(program.is_calendar),
          catalog_status: program.catalog_status,
          allow_duplicate: program.allow_duplicate !== false,
          weeks: weeks.map((w) => ({
            id: w.id,
            title: w.title,
            week_order: w.week_order,
          })),
          sessions: sessions.map((s) => {
            const items = itemsBySession.get(s.id) ?? []
            return {
              id: s.id,
              week_id: s.week_id,
              title: s.title,
              session_order: s.session_order,
              notes: s.notes,
              objective_ressenti: s.objective_ressenti !== false,
              objective_note: s.objective_note !== false,
              objective_difficulty: s.objective_difficulty !== false,
              item_count: items.length,
              items,
              compositionSlots: slotsBySession.get(s.id) ?? [],
            }
          }),
        }}
      />
    </>
  )
}
