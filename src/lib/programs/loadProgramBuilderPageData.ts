import { notFound, redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { AdminProgramBuilderData } from '@/src/components/admin/AdminProgramBuilderShell'
import type { CompositionEditorCatalog } from '@/src/components/admin/ProgramBuilderDayBoard'
import type {
  CatalogFilterOption,
  PaletteBlockItem,
  PaletteExerciseItem,
  PaletteSessionItem,
} from '@/src/components/admin/ProgramBuilderPalette'
import { loadSessionLibraryFilterMeta } from '@/src/lib/sessions/sessionLibraryFilterMeta'

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
  status: string | null
  is_template: boolean | null
  is_published: boolean | null
  allow_duplicate: boolean | null
  is_trainly_catalog: boolean | null
  is_client_instance?: boolean | null
  coach_id: string | null
  deleted_at: string | null
}

export type ProgramBuilderPageData = {
  initialWeekId: string | null
  initialDay: number | null
  softFlash: string | null
  errorFlash: string | null
  catalogSessions: PaletteSessionItem[]
  catalogBlocks: PaletteBlockItem[]
  catalogExercises: PaletteExerciseItem[]
  catalogSports: CatalogFilterOption[]
  catalogTypes: CatalogFilterOption[]
  compositionEditor: CompositionEditorCatalog
  program: AdminProgramBuilderData
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const r of rows) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
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
  composition_version?: number | null
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

export async function loadProgramBuilderPageData(opts: {
  supabase: SupabaseClient
  programId: string
  /** admin = Trainly · coach = programme du coach · krid = catalogue publié (preview coach). */
  scope: 'admin' | 'coach' | 'krid'
  coachId?: string
  searchParams?: { ok?: string; error?: string; week?: string; day?: string }
}): Promise<ProgramBuilderPageData> {
  const { supabase, programId: id, scope, coachId } = opts
  const q = opts.searchParams ?? {}
  const initialDayRaw = typeof q.day === 'string' ? Number.parseInt(q.day, 10) : NaN
  const initialDay =
    Number.isFinite(initialDayRaw) && initialDayRaw >= 0 ? initialDayRaw : null

  let programRes = await supabase
    .from('programs')
    .select(
      'id,title,description,goal,level,duration,image_url,is_calendar,catalog_status,status,is_template,is_published,allow_duplicate,is_trainly_catalog,is_client_instance,coach_id,deleted_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (programRes.error && /is_client_instance/i.test(programRes.error.message)) {
    programRes = await supabase
      .from('programs')
      .select(
        'id,title,description,goal,level,duration,image_url,is_calendar,catalog_status,status,is_template,is_published,allow_duplicate,is_trainly_catalog,coach_id,deleted_at',
      )
      .eq('id', id)
      .maybeSingle()
  }

  if (programRes.error || !programRes.data) {
    if (scope === 'krid') {
      redirect(
        '/programs/catalogue?error=' + encodeURIComponent('Programme introuvable'),
      )
    }
    notFound()
  }

  const program = programRes.data as ProgramRow
  if (program.deleted_at) {
    if (scope === 'krid') {
      redirect(
        '/programs/catalogue?error=' + encodeURIComponent('Programme introuvable'),
      )
    }
    notFound()
  }
  if (scope === 'admin') {
    if (program.is_trainly_catalog === false) notFound()
  } else if (scope === 'krid') {
    // Publié admin = visible coach en lecture seule. Édition = fork → brouillon.
    if (program.is_trainly_catalog !== true || program.catalog_status !== 'published') {
      redirect(
        '/programs/catalogue?error=' +
          encodeURIComponent('Ce programme n’est pas publié dans le catalogue Krid'),
      )
    }
    if (program.allow_duplicate === false) {
      redirect(
        '/programs/catalogue?error=' +
          encodeURIComponent('Ce programme n’est pas duplicable'),
      )
    }
  } else if (!coachId || program.coach_id !== coachId) {
    notFound()
  }

  type ItemRow = {
    id: string
    session_id: string
    position: number
    kind: string
    program_exercise_id: string | null
    session_block_id: string | null
    prescriptions: unknown
  }

  const weeksPromise = supabase
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', id)
    .order('week_order', { ascending: true })

  const platformSessionsQ = supabase
    .from('session_library' as never)
    .select('id, name, notes')
    .is('deleted_at' as never, null)
    .is('coach_id' as never, null)
    .eq('status' as never, 'published')
    .order('name' as never, { ascending: true })
    .limit(200)

  const coachSessionsQ =
    scope === 'coach' && coachId
      ? supabase
          .from('session_library' as never)
          .select('id, name, notes')
          .is('deleted_at' as never, null)
          .eq('coach_id' as never, coachId as never)
          .eq('status' as never, 'published')
          .eq('hub_visible' as never, true as never)
          .order('name' as never, { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [] as { id: string; name: string | null; notes: string | null }[] })

  const platformBlocksQ = supabase
    .from('block_library' as never)
    .select('id, name, sport_id, status')
    .is('deleted_at' as never, null)
    .is('coach_id' as never, null)
    .eq('status' as never, 'published')
    .order('name' as never, { ascending: true })
    .limit(300)

  const coachBlocksQ =
    scope === 'coach' && coachId
      ? supabase
          .from('block_library' as never)
          .select('id, name, sport_id, status')
          .is('deleted_at' as never, null)
          .eq('coach_id' as never, coachId as never)
          .eq('status' as never, 'published')
          .eq('hub_visible' as never, true as never)
          .order('name' as never, { ascending: true })
          .limit(300)
      : Promise.resolve({
          data: [] as { id: string; name: string; sport_id: string | null; status: string }[],
        })

  const platformExosQ = supabase
    .from('exercise_library')
    .select('id, name, sport_id, exercise_type_id, muscle_group')
    .is('deleted_at', null)
    .is('coach_id', null)
    .eq('status', 'published')
    .order('name', { ascending: true })
    .limit(500)

  const coachExosQ =
    scope === 'coach' && coachId
      ? supabase
          .from('exercise_library')
          .select('id, name, sport_id, exercise_type_id, muscle_group')
          .is('deleted_at', null)
          .eq('coach_id', coachId)
          .eq('status', 'published')
          .order('name', { ascending: true })
          .limit(500)
      : Promise.resolve({
          data: [] as {
            id: string
            name: string
            sport_id: string | null
            exercise_type_id: string | null
            muscle_group: string | null
          }[],
        })

  // Semaines + catalogue en parallèle (catalogue indépendant des sessions).
  const [
    weeksResult,
    platformSessionsResult,
    coachSessionsResult,
    platformBlocksResult,
    coachBlocksResult,
    platformExosResult,
    coachExosResult,
    sportsRawResult,
    typesRawResult,
    unitsRawResult,
  ] = await Promise.all([
    weeksPromise,
    platformSessionsQ,
    coachSessionsQ,
    platformBlocksQ,
    coachBlocksQ,
    platformExosQ,
    coachExosQ,
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

  const weeks = (weeksResult.data ?? []) as WeekRow[]
  const weekIds = weeks.map((w) => w.id)
  const libraryRaw = dedupeById([
    ...((platformSessionsResult.data ?? []) as {
      id: string
      name: string | null
      notes: string | null
    }[]),
    ...((coachSessionsResult.data ?? []) as {
      id: string
      name: string | null
      notes: string | null
    }[]),
  ])
  const blocksRaw = dedupeById([
    ...((platformBlocksResult.data ?? []) as {
      id: string
      name: string
      sport_id: string | null
      status: string
    }[]),
    ...((coachBlocksResult.data ?? []) as {
      id: string
      name: string
      sport_id: string | null
      status: string
    }[]),
  ])
  const exosRaw = dedupeById([
    ...((platformExosResult.data ?? []) as {
      id: string
      name: string
      sport_id: string | null
      exercise_type_id: string | null
      muscle_group: string | null
    }[]),
    ...((coachExosResult.data ?? []) as {
      id: string
      name: string
      sport_id: string | null
      exercise_type_id: string | null
      muscle_group: string | null
    }[]),
  ])
  const sportsRaw = sportsRawResult.data
  const typesRaw = typesRawResult.data
  const unitsRaw = unitsRawResult.data

  const libraryRows = (libraryRaw ?? []) as {
    id: string
    name: string | null
    notes: string | null
  }[]
  const libraryIds = libraryRows.map((r) => r.id)

  // Sessions programme + meta catalogue en parallèle.
  const [sessionsResult, filterMeta, libraryItemsRaw] = await Promise.all([
    weekIds.length
      ? supabase
          .from('sessions')
          .select(
            'id,week_id,title,session_order,notes,objective_ressenti,objective_note,objective_difficulty,composition_version',
          )
          .in('week_id', weekIds)
          .order('session_order', { ascending: true })
      : Promise.resolve({ data: [] as SessionRow[] }),
    loadSessionLibraryFilterMeta(supabase, libraryIds),
    libraryIds.length
      ? supabase
          .from('session_library_items' as never)
          .select('session_id')
          .in('session_id' as never, libraryIds)
      : Promise.resolve({ data: [] as { session_id: string }[] }),
  ])

  const sessions = (sessionsResult.data ?? []) as SessionRow[]
  const sessionIds = sessions.map((s) => s.id)
  const itemsResult = sessionIds.length
    ? await supabase
        .from('session_items')
        .select('id,session_id,position,kind,program_exercise_id,session_block_id,prescriptions')
        .in('session_id', sessionIds)
        .order('position', { ascending: true })
    : { data: [] as ItemRow[] }

  const itemRows = (itemsResult.data ?? []) as ItemRow[]

  const peIds = [
    ...new Set(itemRows.filter((i) => i.program_exercise_id).map((i) => i.program_exercise_id!)),
  ]
  const sbIds = [
    ...new Set(itemRows.filter((i) => i.session_block_id).map((i) => i.session_block_id!)),
  ]

  const unitByIdForRx = new Map(
    ((unitsRaw ?? []) as {
      id: string
      key: string
      label: string
      short_label: string | null
    }[]).map((u) => [u.id, u]),
  )

  function flatBeRxSummary(r: {
    sets?: number | null
    reps?: string | number | null
    load?: string | null
    rest_time?: string | null
    rpe?: number | null
  }): string | null {
    const bits = [
      r.sets != null ? `${r.sets} sér.` : null,
      r.reps != null && String(r.reps).trim() ? `${r.reps} reps` : null,
      r.load != null && String(r.load).trim() ? `Kg ${r.load}` : null,
      r.rpe != null ? `RPE ${r.rpe}` : null,
      r.rest_time != null && String(r.rest_time).trim() ? `repos ${r.rest_time}` : null,
    ].filter(Boolean)
    return bits.length ? bits.join(' · ') : null
  }

  type CompactChild = {
    id: string
    name: string
    rxSummary?: string | null
    rxSummaryLines?: string[]
  }

  const peMeta = new Map<string, { name: string; exercise_id: string | null }>()
  const sbMeta = new Map<
    string,
    { title: string; source_block_library_id: string | null }
  >()
  const blockChildren = new Map<string, CompactChild[]>()

  // pe + détails blocs + helpers en parallèle (détails = 2 requêtes batch).
  const [{ data: peRaw }, initialBlockDetails, blockDetailMod] = await Promise.all([
    peIds.length
      ? supabase.from('program_exercises').select('id,name,exercise_id').in('id', peIds)
      : Promise.resolve({
          data: [] as { id: string; name: string | null; exercise_id: string | null }[],
        }),
    sbIds.length
      ? import('@/src/lib/sessions/programSessionBlock').then((m) =>
          m.loadProgramSessionBlockDetails(supabase, sbIds),
        )
      : Promise.resolve([]),
    import('@/src/lib/sessions/blockDetail'),
  ])
  const { formatBlockTimerSummary, formatFilledPrescriptionLines } = blockDetailMod

  for (const r of (peRaw ?? []) as {
    id: string
    name: string | null
    exercise_id: string | null
  }[]) {
    peMeta.set(r.id, {
      name: r.name?.trim() || 'Exercice',
      exercise_id: r.exercise_id,
    })
  }

  for (const d of initialBlockDetails) {
    if (!sbIds.includes(d.id)) continue
    sbMeta.set(d.id, {
      title: d.name?.trim() || 'Bloc',
      source_block_library_id: d.source_block_library_id ?? null,
    })
    blockChildren.set(
      d.id,
      (d.exercises ?? []).map((ex) => {
        const lines = formatFilledPrescriptionLines(
          (ex.prescriptions ?? []).filter(
            (p) => p?.unit_id && String(p.value ?? '').trim() !== '',
          ),
          unitByIdForRx,
        )
        return {
          id: ex.exercise_id,
          name: ex.name?.trim() || 'Exercice',
          rxSummary: lines[0] ?? null,
          rxSummaryLines: lines,
        }
      }),
    )
  }
  // Fallback colonnes plates si détail manquant.
  const missingSb = sbIds.filter((id) => !blockChildren.has(id))
  if (missingSb.length) {
    const { data: beRaw } = await supabase
      .from('block_exercises')
      .select(
        'id,session_block_id,exercise_name,position,sets,reps,load,rest_time,rpe',
      )
      .in('session_block_id', missingSb)
      .order('position', { ascending: true })
    for (const r of (beRaw ?? []) as {
      id: string
      session_block_id: string
      exercise_name: string | null
      position: number
      sets: number | null
      reps: string | null
      load: string | null
      rest_time: string | null
      rpe: number | null
    }[]) {
      if (!blockChildren.has(r.session_block_id)) blockChildren.set(r.session_block_id, [])
      const line = flatBeRxSummary(r)
      blockChildren.get(r.session_block_id)!.push({
        id: r.id,
        name: r.exercise_name?.trim() || 'Exercice',
        rxSummary: line,
        rxSummaryLines: line ? [line] : [],
      })
    }
  }

  const detailBySbId = new Map(initialBlockDetails.map((d) => [d.id, d] as const))

  const itemsBySession = new Map<
    string,
    {
      id: string
      kind: 'block' | 'exercise' | 'rest'
      label: string
      position: number
      restSeconds?: number
      rxSummaryLines?: string[]
      timerSummary?: string | null
      blockNotes?: string | null
      children?: CompactChild[]
    }[]
  >()
  const slotsBySession = new Map<
    string,
    {
      key: string
      kind: 'block' | 'exercise' | 'rest'
      blockId?: string
      orphanSessionBlockId?: string
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
      if (!itemsBySession.has(it.session_id)) itemsBySession.set(it.session_id, [])
      itemsBySession.get(it.session_id)!.push({
        id: it.id,
        kind: 'rest',
        label: 'Pause',
        position: it.position,
        restSeconds: secs,
      })
      continue
    }

    const kind = it.kind === 'block' ? 'block' : 'exercise'
    if (kind === 'block') {
      const meta = sbMeta.get(it.session_block_id ?? '')
      const libraryId = meta?.source_block_library_id
      // Copie programme figée : orphanSessionBlockId = session_blocks.id (toujours).
      // blockId = provenance catalogue (optionnel) — jamais re-lu au save s’il existe une copie.
      if (libraryId || it.session_block_id) {
        slotsBySession.get(it.session_id)!.push({
          key: it.id,
          kind: 'block',
          blockId: libraryId || undefined,
          orphanSessionBlockId: it.session_block_id ?? undefined,
          prescriptions: [],
        })
      }
      if (!itemsBySession.has(it.session_id)) itemsBySession.set(it.session_id, [])
      // Deep-copy figée : preview = copie programme (pas live catalogue).
      const copyKids = it.session_block_id
        ? blockChildren.get(it.session_block_id) ?? []
        : []
      const detail = it.session_block_id
        ? detailBySbId.get(it.session_block_id)
        : undefined
      itemsBySession.get(it.session_id)!.push({
        id: it.id,
        kind: 'block',
        label: meta?.title ?? 'Bloc',
        position: it.position,
        timerSummary: formatBlockTimerSummary(detail?.timer_note),
        blockNotes: detail?.notes?.trim() || null,
        children: copyKids,
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
      const rxList = (
        prescriptions as { unit_id: string; value: string; group?: number }[]
      ).filter((p) => p && p.unit_id && String(p.value ?? '').trim() !== '')
      const rxSummaryLines = rxList.length
        ? formatFilledPrescriptionLines(rxList, unitByIdForRx)
        : []
      if (!itemsBySession.has(it.session_id)) itemsBySession.set(it.session_id, [])
      itemsBySession.get(it.session_id)!.push({
        id: it.id,
        kind: 'exercise',
        label: meta?.name ?? 'Exercice',
        position: it.position,
        rxSummaryLines,
      })
    }
  }

  const weekParam = typeof q.week === 'string' ? q.week : null
  const initialWeekId =
    weekParam && weeks.some((w) => w.id === weekParam) ? weekParam : (weeks[0]?.id ?? null)

  const libraryItemCountBySession = new Map<string, number>()
  for (const row of (libraryItemsRaw.data ?? []) as { session_id: string }[]) {
    libraryItemCountBySession.set(
      row.session_id,
      (libraryItemCountBySession.get(row.session_id) ?? 0) + 1,
    )
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

  const flash = flashMessage(
    typeof q.ok === 'string' ? q.ok : undefined,
    typeof q.error === 'string' ? q.error : undefined,
  )
  const softFlash = !q.error && flash ? flash : null
  const errorFlash = q.error && flash ? flash : null

  // Coach : badge « Publié » = template (is_template), pas programs.status (draft|running|…).
  // Krid preview : toujours publié catalogue.
  const catalogStatusForUi =
    scope === 'krid'
      ? 'published'
      : scope === 'coach'
        ? program.is_template || program.is_published
          ? 'published'
          : 'draft'
        : program.catalog_status

  return {
    initialWeekId,
    initialDay,
    softFlash,
    errorFlash,
    catalogSessions,
    catalogBlocks,
    catalogExercises,
    catalogSports,
    catalogTypes,
    compositionEditor: {
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
    },
    program: {
      id: program.id,
      title: program.title,
      description: program.description,
      goal: program.goal,
      level: program.level,
      duration: program.duration,
      image_url: program.image_url,
      is_calendar: Boolean(program.is_calendar),
      catalog_status: catalogStatusForUi,
      is_client_instance: Boolean(program.is_client_instance),
      allow_duplicate: program.allow_duplicate !== false,
      weeks: weeks.map((w) => ({
        id: w.id,
        title: w.title,
        week_order: w.week_order,
      })),
      sessions: sessions.map((s) => {
        const items = itemsBySession.get(s.id) ?? []
        const contentItems = items.filter((it) => it.kind !== 'rest')
        return {
          id: s.id,
          week_id: s.week_id,
          title: s.title,
          session_order: s.session_order,
          notes: s.notes,
          objective_ressenti: s.objective_ressenti !== false,
          objective_note: s.objective_note !== false,
          objective_difficulty: s.objective_difficulty !== false,
          composition_version: s.composition_version ?? 0,
          item_count: contentItems.length,
          items,
          compositionSlots: slotsBySession.get(s.id) ?? [],
        }
      }),
    },
  }
}
