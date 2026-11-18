'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  assertEditableBuilderProgram,
  requireProgramBuilderUser,
} from '@/src/lib/programs/programBuilderAccess'
import {
  decodeDaySessionOrder,
  encodeDaySessionOrder,
  renumberDayOrders,
} from '@/src/lib/programs/builderDayOrder'
import {
  formatBlockTimerSummary,
  loadSessionBlockDetail,
} from '@/src/lib/sessions/blockDetail'
import { ingestSessionLibraryComposition } from '@/src/lib/sessions/ingestSessionLibrary'
import {
  appendLibraryBlockToSession,
  appendLibraryExerciseToSession,
} from '@/src/lib/sessions/materializeProgramSessionSlots'
import { createClient } from '@/src/lib/supabase/server'

const MAX_SLOTS = 6

/** Patch UI immédiat après drop (évite d’attendre le refresh SSR). */
export type CompositionAppendPatch = {
  sessionId: string
  composition_version?: number
  createdSession?: {
    id: string
    week_id: string
    title: string
    session_order: number
  }
  item: {
    id: string
    kind: 'block' | 'exercise'
    label: string
    position: number
    children?: { id: string; name: string; rxSummary?: string | null }[]
  }
  slot: {
    key: string
    kind: 'block' | 'exercise'
    blockId?: string
    /** Copie programme déjà matérialisée — obligatoire après append serveur. */
    orphanSessionBlockId?: string
    exerciseId?: string
    prescriptions: []
  }
}

/** Patch board (move / delete / drop séance) — pas de router.refresh. */
export type BoardMutationPatch = {
  deletedSessionIds?: string[]
  sessionOrders?: { id: string; session_order: number }[]
  upsertSession?: {
    id: string
    week_id: string
    title: string
    session_order: number
    notes?: string | null
    objective_ressenti?: boolean
    objective_note?: boolean
    objective_difficulty?: boolean
    item_count: number
    composition_version?: number
    items: CompositionLiveItem[]
    compositionSlots: CompositionLiveSlot[]
  }
}

export type CompositionLiveItem = {
  id: string
  kind: 'block' | 'exercise' | 'rest'
  label: string
  position: number
  restSeconds?: number
  rxSummaryLines?: string[]
  timerSummary?: string | null
  blockNotes?: string | null
  children?: {
    id: string
    name: string
    rxSummary?: string | null
    rxSummaryLines?: string[]
  }[]
}

export type CompositionLiveSlot = {
  key: string
  kind: 'block' | 'exercise' | 'rest'
  blockId?: string
  orphanSessionBlockId?: string
  exerciseId?: string
  restSeconds?: number
  prescriptions: {
    unit_id: string
    value: string
    input_mode?: string
    group?: number
    varies?: boolean
  }[]
}

export type CompositionLiveSnapshot = {
  items: CompositionLiveItem[]
  compositionSlots: CompositionLiveSlot[]
  item_count: number
  composition_version?: number
}

export type QuietMutationResult =
  | {
      ok: true
      day?: number | null
      append?: CompositionAppendPatch
      board?: BoardMutationPatch
    }
  | { ok: false; error: string }

async function bumpSessionCompositionVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
): Promise<number> {
  const { data } = await supabase
    .from('sessions')
    .select('composition_version')
    .eq('id', sessionId)
    .maybeSingle()
  const cur =
    (data as { composition_version?: number } | null)?.composition_version ?? 0
  const next = cur + 1
  await supabase
    .from('sessions')
    .update({
      composition_version: next,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', sessionId)
  return next
}

/** Snapshot board après write — orphans = nouveaux session_blocks.id. */
export async function loadProgramSessionBoardSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
): Promise<CompositionLiveSnapshot> {
  const { data: itemsRaw } = await supabase
    .from('session_items')
    .select('id,kind,position,session_block_id,program_exercise_id,prescriptions')
    .eq('session_id', sessionId)
    .order('position', { ascending: true })

  const rows = (itemsRaw ?? []) as {
    id: string
    kind: string
    position: number
    session_block_id: string | null
    program_exercise_id: string | null
    prescriptions: unknown
  }[]

  const blockIds = [
    ...new Set(rows.filter((r) => r.kind === 'block' && r.session_block_id).map((r) => r.session_block_id!)),
  ]
  const peIds = [
    ...new Set(
      rows
        .filter((r) => r.kind === 'exercise' && r.program_exercise_id)
        .map((r) => r.program_exercise_id!),
    ),
  ]

  const sbMeta = new Map<
    string,
    {
      title: string | null
      source_block_library_id: string | null
      notes: string | null
      timer_note: string | null
    }
  >()
  if (blockIds.length) {
    const { data } = await supabase
      .from('session_blocks')
      .select('id,title,source_block_library_id,notes,timer_note')
      .in('id', blockIds)
    for (const b of (data ?? []) as {
      id: string
      title: string | null
      source_block_library_id: string | null
      notes: string | null
      timer_note: string | null
    }[]) {
      sbMeta.set(b.id, {
        title: b.title,
        source_block_library_id: b.source_block_library_id,
        notes: b.notes,
        timer_note: b.timer_note,
      })
    }
  }

  const { data: unitsRaw } = await supabase
    .from('units' as never)
    .select('id,key,label,short_label')
    .is('coach_id' as never, null)
    .is('deleted_at' as never, null)
  const unitById = new Map(
    ((unitsRaw ?? []) as {
      id: string
      key: string
      label: string
      short_label?: string | null
    }[]).map((u) => [u.id, u] as const),
  )
  const unitIdByKey = new Map(
    [...unitById.values()].map((u) => [u.key, u.id] as const),
  )

  function rxLinesFromPrescriptions(
    prescriptions: { unit_id: string; value: string }[],
  ): string[] {
    return prescriptions
      .filter((p) => p.unit_id && String(p.value ?? '').trim() !== '')
      .map((p) => {
        const u = unitById.get(p.unit_id)
        const short =
          (u?.short_label && String(u.short_label).trim()) || u?.label || u?.key || '—'
        return `${short} ${String(p.value).trim()}`
      })
  }

  function rxLinesFromFlat(be: {
    sets: number | null
    reps: string | null
    rest_time: string | null
    load: string | null
    rpe: number | null
    notes: string | null
  }): string[] {
    const rows: { unit_id: string; value: string }[] = []
    const push = (key: string, value: string) => {
      const id = unitIdByKey.get(key)
      if (!id || !value.trim()) return
      rows.push({ unit_id: id, value: value.trim() })
    }
    if (be.sets != null) push('sets', String(be.sets))
    if (be.reps) push('reps', String(be.reps))
    if (be.rest_time) push('rest_s', String(be.rest_time))
    if (be.load) push('load_kg', String(be.load))
    if (be.rpe != null) push('rpe', String(be.rpe))
    if (be.notes) push('note', String(be.notes))
    return rxLinesFromPrescriptions(rows)
  }

  const blockChildren = new Map<
    string,
    { id: string; name: string; rxSummary?: string | null; rxSummaryLines?: string[] }[]
  >()
  if (blockIds.length) {
    const { data: beRaw } = await supabase
      .from('block_exercises')
      .select(
        'session_block_id,exercise_id,exercise_name,position,sets,reps,rest_time,load,rpe,notes,prescriptions',
      )
      .in('session_block_id', blockIds)
      .order('position', { ascending: true })
    for (const be of (beRaw ?? []) as {
      session_block_id: string
      exercise_id: string
      exercise_name: string | null
      position: number
      sets: number | null
      reps: string | null
      rest_time: string | null
      load: string | null
      rpe: number | null
      notes: string | null
      prescriptions?: unknown
    }[]) {
      const fromJson = Array.isArray(be.prescriptions)
        ? (be.prescriptions as { unit_id: string; value: string }[]).filter(
            (p) => p?.unit_id && String(p.value ?? '').trim() !== '',
          )
        : []
      const lines = fromJson.length
        ? rxLinesFromPrescriptions(fromJson)
        : rxLinesFromFlat(be)
      const list = blockChildren.get(be.session_block_id) ?? []
      list.push({
        id: be.exercise_id,
        name: be.exercise_name?.trim() || 'Exercice',
        rxSummary: lines[0] ?? null,
        rxSummaryLines: lines,
      })
      blockChildren.set(be.session_block_id, list)
    }
  }

  const peMeta = new Map<string, { exercise_id: string; name: string | null }>()
  if (peIds.length) {
    const { data } = await supabase
      .from('program_exercises')
      .select('id,exercise_id,name')
      .in('id', peIds)
    for (const e of (data ?? []) as {
      id: string
      exercise_id: string
      name: string | null
    }[]) {
      peMeta.set(e.id, { exercise_id: e.exercise_id, name: e.name })
    }
  }

  const compositionSlots: CompositionLiveSlot[] = []
  const items: CompositionLiveItem[] = []

  for (const it of rows) {
    if (it.kind === 'rest') {
      const rx = Array.isArray(it.prescriptions) ? it.prescriptions : []
      const secs =
        typeof (rx[0] as { rest_seconds?: number } | undefined)?.rest_seconds === 'number'
          ? (rx[0] as { rest_seconds: number }).rest_seconds
          : 60
      compositionSlots.push({
        key: it.id,
        kind: 'rest',
        restSeconds: secs,
        prescriptions: [],
      })
      items.push({
        id: it.id,
        kind: 'rest',
        label: 'Pause',
        position: it.position,
        restSeconds: secs,
      })
      continue
    }
    if (it.kind === 'block' && it.session_block_id) {
      const meta = sbMeta.get(it.session_block_id)
      compositionSlots.push({
        key: it.id,
        kind: 'block',
        blockId: meta?.source_block_library_id ?? undefined,
        orphanSessionBlockId: it.session_block_id,
        prescriptions: [],
      })
      items.push({
        id: it.id,
        kind: 'block',
        label: meta?.title?.trim() || 'Bloc',
        position: it.position,
        timerSummary: formatBlockTimerSummary(meta?.timer_note),
        blockNotes: meta?.notes?.trim() || null,
        children: blockChildren.get(it.session_block_id) ?? [],
      })
      continue
    }
    if (it.kind === 'exercise' && it.program_exercise_id) {
      const meta = peMeta.get(it.program_exercise_id)
      if (!meta?.exercise_id) continue
      const prescriptions = Array.isArray(it.prescriptions)
        ? (it.prescriptions as {
            unit_id: string
            value: string
            input_mode?: string
            group?: number
            varies?: boolean
          }[]).filter((p) => p?.unit_id)
        : []
      compositionSlots.push({
        key: it.id,
        kind: 'exercise',
        exerciseId: meta.exercise_id,
        prescriptions,
      })
      const lines = rxLinesFromPrescriptions(prescriptions)
      items.push({
        id: it.id,
        kind: 'exercise',
        label: meta.name?.trim() || 'Exercice',
        position: it.position,
        rxSummaryLines: lines,
      })
    }
  }

  return {
    item_count: items.filter((i) => i.kind !== 'rest').length,
    items,
    compositionSlots,
  }
}

async function requireBuilder() {
  return requireProgramBuilderUser({ adminLoginRedirect: '/loginadmin' })
}

async function assertProgram(
  ...args: Parameters<typeof assertEditableBuilderProgram>
) {
  return assertEditableBuilderProgram(...args)
}

function builderPath(
  programId: string,
  weekId?: string | null,
  ok?: string,
  error?: string,
  opts?: { day?: number | null },
) {
  const q = new URLSearchParams()
  if (weekId) q.set('week', weekId)
  if (ok) q.set('ok', ok)
  if (error) q.set('error', error)
  if (opts?.day != null && Number.isFinite(opts.day) && opts.day >= 0) {
    q.set('day', String(Math.floor(opts.day)))
  }
  const qs = q.toString()
  return `/admin/programs/${programId}${qs ? `?${qs}` : ''}`
}

function dayFromForm(formData: FormData): number | null {
  const raw = String(formData.get('day') ?? '').trim()
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

async function nextOrderForTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weekId: string,
  isCalendar: boolean,
  targetOrder: number,
) {
  const { data: existingRaw } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })

  const existing = (existingRaw ?? []) as { id: string; session_order: number }[]
  const maxDay = isCalendar ? 6 : MAX_SLOTS - 1
  const day = Number.isFinite(targetOrder)
    ? Math.min(Math.max(targetOrder, 0), maxDay)
    : 0

  // Slot = journée : même encodage multi-séances que le calendrier.
  // Cap slots : max 6 indices jour distincts (0…5) ; ajouter dans un slot existant OK.
  if (!isCalendar) {
    const occupied = new Set(
      existing.map((s) => decodeDaySessionOrder(s.session_order).day).filter((d) => d <= maxDay),
    )
    const onDay = existing.filter((s) => decodeDaySessionOrder(s.session_order).day === day)
    if (!onDay.length && occupied.size >= MAX_SLOTS && !occupied.has(day)) {
      throw new Error('Max 6 journées / semaine en mode slots')
    }
  }

  const onDay = existing.filter((s) => decodeDaySessionOrder(s.session_order).day === day)
  return encodeDaySessionOrder(day, onDay.length)
}

async function nextTimelinePosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
) {
  const { data } = await supabase
    .from('session_items')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const max = (data as { position?: number } | null)?.position
  return (typeof max === 'number' && Number.isFinite(max) ? max : -1) + 1
}

async function nextBlockTablePosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
) {
  const { data } = await supabase
    .from('session_blocks')
    .select('position')
    .eq('program_session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const max = (data as { position?: number } | null)?.position
  return (typeof max === 'number' && Number.isFinite(max) ? max : -1) + 1
}

/**
 * Bloc / exo → toujours une séance :
 * - session_id explicite (drop sur une carte) → on l’utilise
 * - sinon (drop hors séance / + catalogue) → crée une séance « Séance » avec l’item
 */
async function resolveSessionForItemDrop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weekId: string,
  isCalendar: boolean,
  targetOrder: number,
  explicitSessionId: string,
): Promise<string> {
  if (explicitSessionId) return explicitSessionId

  const insertOrder = await nextOrderForTarget(supabase, weekId, isCalendar, targetOrder)
  const { data: created, error } = await supabase
    .from('sessions')
    .insert({
      week_id: weekId,
      title: 'Séance',
      description: null,
      notes: null,
      objective_ressenti: true,
      objective_note: true,
      objective_difficulty: true,
      session_order: insertOrder,
    } as never)
    .select('id')
    .maybeSingle()
  if (error || !created) {
    throw new Error(error?.message ?? 'Création séance impossible')
  }
  return (created as { id: string }).id
}

/** Séance catalogue publiée → jour/slot + ingest composition (quiet). */
export async function addTrainlyLibrarySessionAction(
  formData: FormData,
): Promise<QuietMutationResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const libraryId = String(formData.get('library_session_id') ?? '').trim()
  const targetRaw = String(formData.get('target_order') ?? '').trim()
  const targetOrder = Number.parseInt(targetRaw, 10)
  const intoSessionId = String(formData.get('into_session_id') ?? '').trim()
  const dayHint = dayFromForm(formData)

  if (!programId || !weekId || !libraryId) return { ok: false, error: 'Paramètres manquants' }
  const program = await assertProgram(supabase, programId, auth)
  if (!program) return { ok: false, error: 'Programme introuvable' }

  const { data: week } = await supabase
    .from('program_weeks')
    .select('id')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()
  if (!week) return { ok: false, error: 'Semaine introuvable' }

  const { data: lib } = await supabase
    .from('session_library' as never)
    .select(
      'id,name,notes,status,coach_id,objective_ressenti,objective_note,objective_difficulty',
    )
    .eq('id', libraryId)
    .is('deleted_at', null)
    .maybeSingle()

  const library = lib as {
    id: string
    name: string | null
    notes: string | null
    status: string
    coach_id: string | null
    objective_ressenti?: boolean
    objective_note?: boolean
    objective_difficulty?: boolean
  } | null
  const libraryReadable =
    library &&
    library.status === 'published' &&
    (library.coach_id == null || library.coach_id === auth.userId)
  if (!libraryReadable || !library) {
    return { ok: false, error: 'Séance catalogue introuvable ou non publiée' }
  }

  let insertOrder = 0
  let restoreDay = dayHint
  try {
    if (intoSessionId) {
      const { data: host } = await supabase
        .from('sessions')
        .select('session_order')
        .eq('id', intoSessionId)
        .eq('week_id', weekId)
        .maybeSingle()
      if (!host) return { ok: false, error: 'Séance cible introuvable' }
      const day = decodeDaySessionOrder(
        (host as { session_order: number }).session_order,
      ).day
      restoreDay = day
      insertOrder = await nextOrderForTarget(supabase, weekId, program.is_calendar, day)
    } else {
      restoreDay = Number.isFinite(targetOrder) ? targetOrder : dayHint
      insertOrder = await nextOrderForTarget(supabase, weekId, program.is_calendar, targetOrder)
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Placement impossible' }
  }

  const { data: created, error } = await supabase
    .from('sessions')
    .insert({
      week_id: weekId,
      title: library.name?.trim() || 'Séance',
      description: library.notes?.trim() || null,
      notes: library.notes?.trim() || null,
      objective_ressenti: library.objective_ressenti !== false,
      objective_note: library.objective_note !== false,
      objective_difficulty: library.objective_difficulty !== false,
      session_order: insertOrder,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    return { ok: false, error: error?.message ?? 'Insert séance impossible' }
  }

  const programSessionId = (created as { id: string }).id
  const ingest = await ingestSessionLibraryComposition(supabase, {
    librarySessionId: libraryId,
    programSessionId,
  })
  if (!ingest.ok) {
    await supabase.from('sessions').delete().eq('id', programSessionId)
    return { ok: false, error: ingest.error }
  }

  const { data: weekOrders } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })

  // Relire la composition matérialisée (orphans) — pas les slots catalogue bruts.
  const live = await loadProgramSessionBoardSnapshot(supabase, programSessionId)

  return {
    ok: true,
    day: restoreDay,
    board: {
      sessionOrders: (weekOrders ?? []) as { id: string; session_order: number }[],
      upsertSession: {
        id: programSessionId,
        week_id: weekId,
        title: library.name?.trim() || 'Séance',
        session_order: insertOrder,
        item_count: live.item_count,
        composition_version: ingest.version ?? 0,
        items: live.items,
        compositionSlots: live.compositionSlots,
      },
    },
  }
}

/** Crée une séance vide sur un jour/slot (redirect legacy). */
export async function createEmptyProgramSessionAction(formData: FormData) {
  const quiet = await createEmptyProgramSessionQuietAction(formData)
  if (!quiet.ok) {
    const programId = String(formData.get('program_id') ?? '').trim()
    const weekId = String(formData.get('week_id') ?? '').trim()
    if (!programId) redirect('/admin/programs')
    redirect(builderPath(programId, weekId || null, undefined, quiet.error))
  }
  revalidatePath(`/admin/programs/${quiet.programId}`)
  redirect(
    builderPath(quiet.programId, quiet.weekId, 'session_created', undefined, {
      day: quiet.day,
    }),
  )
}

/** Crée une séance vide — quiet (garde le jour ouvert). Option publish_admin → session_library published. */
export type CatalogSessionPaletteItem = {
  id: string
  name: string | null
  notes: string | null
  item_count: number
  sport_ids: string[]
  type_ids: string[]
}

export async function createEmptyProgramSessionQuietAction(
  formData: FormData,
): Promise<
  | {
      ok: true
      programId: string
      weekId: string
      day: number | null
      board: BoardMutationPatch
      flash?: string
      catalogSession?: CatalogSessionPaletteItem
    }
  | { ok: false; error: string }
> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'Séance'
  const notes = String(formData.get('notes') ?? '').trim() || null
  const objectiveRessenti = formData.get('objective_ressenti') === 'on'
  const objectiveNote = formData.get('objective_note') === 'on'
  const objectiveDifficulty = formData.get('objective_difficulty') === 'on'
  const publishAdmin =
    formData.get('publish_admin') === '1' || formData.get('publish_admin') === 'on'
  const targetOrder = Number.parseInt(String(formData.get('target_order') ?? ''), 10)
  const day = Number.isFinite(targetOrder) ? targetOrder : dayFromForm(formData)

  if (!programId || !weekId) return { ok: false, error: 'Paramètres manquants' }
  const program = await assertProgram(supabase, programId, auth)
  if (!program) return { ok: false, error: 'Programme introuvable' }

  const { data: week } = await supabase
    .from('program_weeks')
    .select('id')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()
  if (!week) return { ok: false, error: 'Semaine introuvable' }

  let catalogSession: CatalogSessionPaletteItem | null = null

  if (publishAdmin) {
    const nameKey = title.trim().toLowerCase()
    const { data: existingRaw } = await supabase
      .from('session_library' as never)
      .select('id,name')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .eq('status' as never, 'published')
      .limit(200)
    const dup = ((existingRaw ?? []) as { id: string; name: string | null }[]).find(
      (r) => (r.name ?? '').trim().toLowerCase() === nameKey,
    )
    if (dup) {
      return { ok: false, error: 'Cette séance est déjà publiée dans le catalogue' }
    }
  }

  let insertOrder = 0
  try {
    insertOrder = await nextOrderForTarget(supabase, weekId, program.is_calendar, targetOrder)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Placement impossible' }
  }

  const { data: created, error } = await supabase
    .from('sessions')
    .insert({
      week_id: weekId,
      title,
      description: notes,
      notes,
      objective_ressenti: objectiveRessenti,
      objective_note: objectiveNote,
      objective_difficulty: objectiveDifficulty,
      session_order: insertOrder,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    return { ok: false, error: error?.message ?? 'Création séance impossible' }
  }

  const sessionId = (created as { id: string }).id

  if (publishAdmin) {
    const { data: libCreated, error: libErr } = await supabase
      .from('session_library' as never)
      .insert({
        coach_id: null,
        name: title,
        notes,
        objective_ressenti: objectiveRessenti,
        objective_note: objectiveNote,
        objective_difficulty: objectiveDifficulty,
        status: 'published',
        allow_duplicate: true,
        allow_download: false,
      } as never)
      .select('id')
      .maybeSingle()
    if (libErr || !libCreated) {
      return { ok: false, error: libErr?.message ?? 'Publication catalogue impossible' }
    }
    catalogSession = {
      id: (libCreated as { id: string }).id,
      name: title,
      notes,
      item_count: 0,
      sport_ids: [],
      type_ids: [],
    }
  }

  const { data: weekOrders } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })

  return {
    ok: true,
    programId,
    weekId,
    day,
    flash: publishAdmin ? 'Publié admin' : undefined,
    catalogSession: catalogSession ?? undefined,
    board: {
      sessionOrders: (weekOrders ?? []) as { id: string; session_order: number }[],
      upsertSession: {
        id: sessionId,
        week_id: weekId,
        title,
        session_order: insertOrder,
        notes,
        objective_ressenti: objectiveRessenti,
        objective_note: objectiveNote,
        objective_difficulty: objectiveDifficulty,
        item_count: 0,
        composition_version: 0,
        items: [],
        compositionSlots: [],
      },
    },
  }
}

/**
 * Publie / met à jour une session_library depuis une séance programme (meta + composition).
 * Anti-doublon : même nom (trim, case-insensitive) plateforme non deleted → update.
 */
export async function publishProgramSessionToLibraryQuietAction(
  formData: FormData,
): Promise<
  | { ok: true; flash: string; catalogSession: CatalogSessionPaletteItem }
  | { ok: false; error: string }
> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'Séance'
  const notes = String(formData.get('notes') ?? '').trim() || null
  const objectiveRessenti = formData.get('objective_ressenti') === 'on'
  const objectiveNote = formData.get('objective_note') === 'on'
  const objectiveDifficulty = formData.get('objective_difficulty') === 'on'

  if (!programId || !weekId || !sessionId) return { ok: false, error: 'Paramètres manquants' }
  if (!(await assertProgram(supabase, programId, auth))) {
    return { ok: false, error: 'Programme introuvable' }
  }

  const { data: sess } = await supabase
    .from('sessions')
    .select('id,week_id,title')
    .eq('id', sessionId)
    .eq('week_id', weekId)
    .maybeSingle()
  if (!sess) return { ok: false, error: 'Séance introuvable' }

  // Persist meta programme d’abord.
  const { error: metaErr } = await supabase
    .from('sessions')
    .update({
      title,
      notes,
      description: notes,
      objective_ressenti: objectiveRessenti,
      objective_note: objectiveNote,
      objective_difficulty: objectiveDifficulty,
    } as never)
    .eq('id', sessionId)
  if (metaErr) return { ok: false, error: metaErr.message }

  const { data: itemsRaw } = await supabase
    .from('session_items')
    .select('position,kind,session_block_id,program_exercise_id,prescriptions')
    .eq('session_id', sessionId)
    .order('position', { ascending: true })

  const items = (itemsRaw ?? []) as {
    position: number
    kind: string
    session_block_id: string | null
    program_exercise_id: string | null
    prescriptions: unknown
  }[]

  const blockIds = items
    .filter((i) => i.kind === 'block' && i.session_block_id)
    .map((i) => i.session_block_id!)
  const peIds = items
    .filter((i) => i.kind === 'exercise' && i.program_exercise_id)
    .map((i) => i.program_exercise_id!)

  const libraryBySessionBlock = new Map<string, string>()
  if (blockIds.length) {
    const { data: blocks } = await supabase
      .from('session_blocks')
      .select('id,source_block_library_id')
      .in('id', blockIds)
    for (const b of (blocks ?? []) as {
      id: string
      source_block_library_id: string | null
    }[]) {
      if (!b.source_block_library_id) {
        return {
          ok: false,
          error: 'Publie d’abord chaque bloc (Publier admin) avant la séance',
        }
      }
      libraryBySessionBlock.set(b.id, b.source_block_library_id)
    }
  }

  const exerciseByPe = new Map<string, { exercise_id: string; prescriptions: unknown }>()
  if (peIds.length) {
    // `program_exercises` n’a pas de colonne prescriptions (legacy plates).
    const { data: pes } = await supabase
      .from('program_exercises')
      .select('id,exercise_id,sets,reps,rest_time,load,rpe,notes')
      .in('id', peIds)
    for (const pe of (pes ?? []) as {
      id: string
      exercise_id: string | null
      sets: number | null
      reps: string | null
      rest_time: string | null
      load: string | null
      rpe: string | null
      notes: string | null
    }[]) {
      if (!pe.exercise_id) {
        return { ok: false, error: 'Exercice programme invalide' }
      }
      exerciseByPe.set(pe.id, {
        exercise_id: pe.exercise_id,
        prescriptions: {
          sets: pe.sets,
          reps: pe.reps,
          rest_time: pe.rest_time,
          load: pe.load,
          rpe: pe.rpe,
          notes: pe.notes,
        },
      })
    }
  }

  type LibSlot = {
    kind: 'block' | 'exercise' | 'rest'
    block_id: string | null
    exercise_id: string | null
    prescriptions: unknown
  }
  const slots: LibSlot[] = []
  for (const it of items) {
    if (it.kind === 'block' && it.session_block_id) {
      const libId = libraryBySessionBlock.get(it.session_block_id)
      if (!libId) continue
      slots.push({
        kind: 'block',
        block_id: libId,
        exercise_id: null,
        prescriptions: [],
      })
      continue
    }
    if (it.kind === 'exercise' && it.program_exercise_id) {
      const pe = exerciseByPe.get(it.program_exercise_id)
      if (!pe) continue
      slots.push({
        kind: 'exercise',
        block_id: null,
        exercise_id: pe.exercise_id,
        prescriptions: pe.prescriptions ?? [],
      })
      continue
    }
    if (it.kind === 'rest') {
      slots.push({
        kind: 'rest',
        block_id: null,
        exercise_id: null,
        prescriptions: it.prescriptions,
      })
    }
  }

  if (!slots.some((s) => s.kind === 'block' || s.kind === 'exercise')) {
    return { ok: false, error: 'Ajoute au moins un bloc ou exercice' }
  }

  const nameKey = title.trim().toLowerCase()
  const { data: existingRaw } = await supabase
    .from('session_library' as never)
    .select('id,name')
    .is('coach_id' as never, null)
    .is('deleted_at' as never, null)
    .eq('status' as never, 'published')
    .limit(200)

  const existing = (
    (existingRaw ?? []) as { id: string; name: string | null }[]
  ).find((r) => (r.name ?? '').trim().toLowerCase() === nameKey)

  if (existing) {
    return { ok: false, error: 'Cette séance est déjà publiée dans le catalogue' }
  }

  const { data: created, error: creErr } = await supabase
    .from('session_library' as never)
    .insert({
      coach_id: null,
      name: title,
      notes,
      objective_ressenti: objectiveRessenti,
      objective_note: objectiveNote,
      objective_difficulty: objectiveDifficulty,
      status: 'published',
      allow_duplicate: true,
      allow_download: false,
    } as never)
    .select('id')
    .maybeSingle()
  if (creErr || !created) {
    return { ok: false, error: creErr?.message ?? 'Création catalogue impossible' }
  }
  const librarySessionId = (created as { id: string }).id
  const flash = 'Publié admin'

  const { error: delErr } = await supabase
    .from('session_library_items' as never)
    .delete()
    .eq('session_id' as never, librarySessionId as never)
  if (delErr) return { ok: false, error: delErr.message }

  const rows = slots.map((s, position) => ({
    session_id: librarySessionId,
    position,
    item_kind: s.kind,
    block_id: s.block_id,
    exercise_id: s.exercise_id,
    prescriptions: s.prescriptions ?? [],
  }))
  const { error: insErr } = await supabase
    .from('session_library_items' as never)
    .insert(rows as never)
  if (insErr) return { ok: false, error: insErr.message }

  return {
    ok: true,
    flash,
    catalogSession: {
      id: librarySessionId!,
      name: title,
      notes,
      item_count: slots.filter((s) => s.kind === 'block' || s.kind === 'exercise').length,
      sport_ids: [],
      type_ids: [],
    },
  }
}

/** Métadonnées fiche (nom / notes / feedback) — hors composition. Pas de redirect (garde le jour ouvert). */
export async function updateTrainlyProgramSessionMetaAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'Séance'
  const notes = String(formData.get('notes') ?? '').trim() || null
  const objectiveRessenti = formData.get('objective_ressenti') === 'on'
  const objectiveNote = formData.get('objective_note') === 'on'
  const objectiveDifficulty = formData.get('objective_difficulty') === 'on'

  if (!programId || !weekId || !sessionId) return { ok: false, error: 'Paramètres manquants' }
  if (!(await assertProgram(supabase, programId, auth))) {
    return { ok: false, error: 'Programme introuvable' }
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      title,
      notes,
      description: notes,
      objective_ressenti: objectiveRessenti,
      objective_note: objectiveNote,
      objective_difficulty: objectiveDifficulty,
    } as never)
    .eq('id', sessionId)
    .eq('week_id', weekId)

  if (error) return { ok: false, error: error.message }
  // Pas de revalidatePath : le client met à jour en optimiste et garde le jour ouvert.
  // Un refresh RSC ici rechargerait tout le builder (lourd) et refermerait la vue jour.
  return { ok: true }
}

export async function renameTrainlyProgramSessionAction(formData: FormData) {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  if (!programId || !weekId || !sessionId) redirect('/admin/programs')
  if (!(await assertProgram(supabase, programId, auth))) redirect('/admin/programs')

  const { error } = await supabase
    .from('sessions')
    .update({ title: title || 'Séance' } as never)
    .eq('id', sessionId)
    .eq('week_id', weekId)

  if (error) redirect(builderPath(programId, weekId, undefined, error.message))
  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'session_renamed'))
}

/** Déplace une séance vers un jour/slot (quiet + RPC reorder si dispo). */
export async function moveTrainlyProgramSessionAction(
  formData: FormData,
): Promise<QuietMutationResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const targetOrder = Number.parseInt(String(formData.get('target_order') ?? ''), 10)
  const dayHint = dayFromForm(formData)

  if (!programId || !weekId || !sessionId) return { ok: false, error: 'Paramètres manquants' }
  const program = await assertProgram(supabase, programId, auth)
  if (!program) return { ok: false, error: 'Programme introuvable' }

  const { data: allRaw } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })

  const all = (allRaw ?? []) as { id: string; session_order: number }[]
  const moving = all.find((s) => s.id === sessionId)
  if (!moving) return { ok: false, error: 'Séance introuvable' }

  const orders: { id: string; session_order: number }[] = []
  let restoreDay = dayHint

  {
    const maxDay = program.is_calendar ? 6 : MAX_SLOTS - 1
    const fromDay = decodeDaySessionOrder(moving.session_order).day
    const toDay = Number.isFinite(targetOrder)
      ? Math.min(Math.max(targetOrder, 0), maxDay)
      : fromDay
    restoreDay = toDay
    const without = all.filter((s) => s.id !== sessionId)

    if (!program.is_calendar && fromDay !== toDay) {
      const occupied = new Set(without.map((s) => decodeDaySessionOrder(s.session_order).day))
      const toHas = without.some((s) => decodeDaySessionOrder(s.session_order).day === toDay)
      if (!toHas && occupied.size >= MAX_SLOTS && !occupied.has(toDay)) {
        return { ok: false, error: 'Max 6 journées / semaine en mode slots' }
      }
    }

    if (fromDay === toDay) {
      const onDay = without.filter((s) => decodeDaySessionOrder(s.session_order).day === fromDay)
      onDay.push({ id: sessionId, session_order: 0 })
      orders.push(...renumberDayOrders(fromDay, onDay))
    } else {
      const fromList = without.filter((s) => decodeDaySessionOrder(s.session_order).day === fromDay)
      const toList = without.filter((s) => decodeDaySessionOrder(s.session_order).day === toDay)
      toList.push({ id: sessionId, session_order: 0 })
      orders.push(...renumberDayOrders(fromDay, fromList), ...renumberDayOrders(toDay, toList))
    }
  }

  const { error: rpcErr } = await supabase.rpc('reorder_week_sessions' as never, {
    p_week_id: weekId,
    p_orders: orders as never,
  } as never)

  if (rpcErr) {
    for (const u of orders) {
      const { error } = await supabase
        .from('sessions')
        .update({ session_order: u.session_order } as never)
        .eq('id', u.id)
      if (error) return { ok: false, error: error.message }
    }
  }

  return {
    ok: true,
    day: restoreDay,
    board: { sessionOrders: orders },
  }
}

/** Monte / descend une séance dans la même journée (quiet). */
export async function reorderTrainlyProgramSessionInDayAction(
  formData: FormData,
): Promise<QuietMutationResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const direction = Number.parseInt(String(formData.get('direction') ?? ''), 10)
  const dayHint = dayFromForm(formData)

  if (!programId || !weekId || !sessionId || (direction !== -1 && direction !== 1)) {
    return { ok: false, error: 'Paramètres manquants' }
  }
  const program = await assertProgram(supabase, programId, auth)
  if (!program) return { ok: false, error: 'Programme introuvable' }

  const { data: allRaw } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })

  const all = (allRaw ?? []) as { id: string; session_order: number }[]
  const moving = all.find((s) => s.id === sessionId)
  if (!moving) return { ok: false, error: 'Séance introuvable' }

  const day =
    dayHint ?? decodeDaySessionOrder(moving.session_order).day

  const onDay = all.filter((s) => decodeDaySessionOrder(s.session_order).day === day)

  const idx = onDay.findIndex((s) => s.id === sessionId)
  const swapIdx = idx + direction
  if (idx < 0 || swapIdx < 0 || swapIdx >= onDay.length) {
    return { ok: true, day, board: { sessionOrders: [] } }
  }

  const reordered = onDay.slice()
  const tmp = reordered[idx]!
  reordered[idx] = reordered[swapIdx]!
  reordered[swapIdx] = tmp

  const orders = renumberDayOrders(day, reordered)

  const { error: rpcErr } = await supabase.rpc('reorder_week_sessions' as never, {
    p_week_id: weekId,
    p_orders: orders as never,
  } as never)

  if (rpcErr) {
    for (const u of orders) {
      const { error } = await supabase
        .from('sessions')
        .update({ session_order: u.session_order } as never)
        .eq('id', u.id)
      if (error) return { ok: false, error: error.message }
    }
  }

  // Pas de revalidatePath : patch client (sessionOrderPatch) — refresh RSC = flash / bounce semaine.
  return {
    ok: true,
    day,
    board: { sessionOrders: orders },
  }
}

export async function deleteTrainlyProgramSessionAction(
  formData: FormData,
): Promise<QuietMutationResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const dayHint = dayFromForm(formData)

  if (!programId || !weekId || !sessionId) return { ok: false, error: 'Paramètres manquants' }
  const program = await assertProgram(supabase, programId, auth)
  if (!program) return { ok: false, error: 'Programme introuvable' }

  const { data: victim } = await supabase
    .from('sessions')
    .select('session_order')
    .eq('id', sessionId)
    .eq('week_id', weekId)
    .maybeSingle()
  if (!victim) return { ok: false, error: 'Séance introuvable' }

  const victimDay = decodeDaySessionOrder(
    (victim as { session_order: number }).session_order,
  ).day
  const restoreDay = dayHint ?? victimDay

  const { error } = await supabase.from('sessions').delete().eq('id', sessionId).eq('week_id', weekId)
  if (error) return { ok: false, error: error.message }

  const { data: rest } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })

  const rows = (rest ?? []) as { id: string; session_order: number }[]
  const orders: { id: string; session_order: number }[] = []
  const onDay = rows.filter((s) => decodeDaySessionOrder(s.session_order).day === victimDay)
  orders.push(...renumberDayOrders(victimDay, onDay))

  if (orders.length) {
    const { error: rpcErr } = await supabase.rpc('reorder_week_sessions' as never, {
      p_week_id: weekId,
      p_orders: orders as never,
    } as never)
    if (rpcErr) {
      for (const u of orders) {
        await supabase.from('sessions').update({ session_order: u.session_order } as never).eq('id', u.id)
      }
    }
  }

  return {
    ok: true,
    day: restoreDay,
    board: {
      deletedSessionIds: [sessionId],
      sessionOrders: orders,
    },
  }
}

/**
 * Ajoute un bloc catalogue dans une séance (même materializer que save).
 * Sans session_id : crée une séance « Séance » et y place le bloc.
 */
export async function appendLibraryBlockToProgramAction(
  formData: FormData,
): Promise<QuietMutationResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const blockId = String(formData.get('block_id') ?? '').trim()
  const explicitSessionId = String(formData.get('session_id') ?? '').trim()
  const targetOrder = Number.parseInt(String(formData.get('target_order') ?? ''), 10)
  const dayHint = dayFromForm(formData) ?? (Number.isFinite(targetOrder) ? targetOrder : null)

  if (!programId || !weekId || !blockId) return { ok: false, error: 'Paramètres manquants' }
  const program = await assertProgram(supabase, programId, auth)
  if (!program) return { ok: false, error: 'Programme introuvable' }

  const { detail, error: detailErr } = await loadSessionBlockDetail(supabase, blockId)
  if (detailErr || !detail || detail.status !== 'published') {
    return { ok: false, error: detailErr ?? 'Bloc introuvable / non publié' }
  }
  if (detail.coach_id != null && detail.coach_id !== auth.userId) {
    return { ok: false, error: 'Bloc introuvable / non publié' }
  }

  const createdFresh = !explicitSessionId
  let sessionId: string
  let createdSession: CompositionAppendPatch['createdSession']
  try {
    sessionId = await resolveSessionForItemDrop(
      supabase,
      weekId,
      program.is_calendar,
      targetOrder,
      explicitSessionId,
    )
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur' }
  }

  if (createdFresh) {
    const { data: sess } = await supabase
      .from('sessions')
      .select('id,title,session_order')
      .eq('id', sessionId)
      .maybeSingle()
    const row = sess as { id: string; title: string | null; session_order: number } | null
    if (row) {
      createdSession = {
        id: row.id,
        week_id: weekId,
        title: row.title?.trim() || 'Séance',
        session_order: row.session_order,
      }
    }
  }

  const timelinePos = await nextTimelinePosition(supabase, sessionId)
  const blockPos = await nextBlockTablePosition(supabase, sessionId)
  const mat = await appendLibraryBlockToSession(supabase, {
    sessionId,
    blockLibraryId: blockId,
    timelinePos,
    blockTablePos: blockPos,
  })
  if (!mat.ok) return { ok: false, error: mat.error }

  const composition_version = await bumpSessionCompositionVersion(supabase, sessionId)

  // Pas de revalidatePath : patch client (append) — RSC refresh écrase le live et freine le board.
  return {
    ok: true,
    day: dayHint,
    append: {
      sessionId,
      composition_version,
      createdSession,
      item: {
        id: mat.sessionBlockId,
        kind: 'block',
        label: detail.name,
        position: timelinePos,
        children: (detail.exercises ?? []).map((ex) => ({
          id: ex.exercise_id,
          name: ex.name?.trim() || 'Exercice',
        })),
      },
      slot: {
        key: mat.sessionBlockId,
        kind: 'block',
        blockId,
        orphanSessionBlockId: mat.sessionBlockId,
        prescriptions: [],
      },
    },
  }
}

/** Ajoute un exo catalogue dans une séance (quiet). */
export async function appendLibraryExerciseToProgramAction(
  formData: FormData,
): Promise<QuietMutationResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const exerciseId = String(formData.get('exercise_id') ?? '').trim()
  const explicitSessionId = String(formData.get('session_id') ?? '').trim()
  const targetOrder = Number.parseInt(String(formData.get('target_order') ?? ''), 10)
  const dayHint = dayFromForm(formData) ?? (Number.isFinite(targetOrder) ? targetOrder : null)

  if (!programId || !weekId || !exerciseId) return { ok: false, error: 'Paramètres manquants' }
  const program = await assertProgram(supabase, programId, auth)
  if (!program) return { ok: false, error: 'Programme introuvable' }

  const { data: exo } = await supabase
    .from('exercise_library')
    .select('id,name,status,coach_id')
    .eq('id', exerciseId)
    .is('deleted_at', null)
    .maybeSingle()

  const exercise = exo as {
    id: string
    name: string
    status: string
    coach_id: string | null
  } | null
  const exerciseReadable =
    exercise &&
    exercise.status === 'published' &&
    (exercise.coach_id == null || exercise.coach_id === auth.userId)
  if (!exerciseReadable || !exercise) {
    return { ok: false, error: 'Exercice introuvable / non publié' }
  }

  const createdFresh = !explicitSessionId
  let sessionId: string
  let createdSession: CompositionAppendPatch['createdSession']
  try {
    sessionId = await resolveSessionForItemDrop(
      supabase,
      weekId,
      program.is_calendar,
      targetOrder,
      explicitSessionId,
    )
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur' }
  }

  if (createdFresh) {
    const { data: sess } = await supabase
      .from('sessions')
      .select('id,title,session_order')
      .eq('id', sessionId)
      .maybeSingle()
    const row = sess as { id: string; title: string | null; session_order: number } | null
    if (row) {
      createdSession = {
        id: row.id,
        week_id: weekId,
        title: row.title?.trim() || 'Séance',
        session_order: row.session_order,
      }
    }
  }

  const timelinePos = await nextTimelinePosition(supabase, sessionId)
  const mat = await appendLibraryExerciseToSession(supabase, {
    sessionId,
    exerciseId: exercise.id,
    name: exercise.name,
    timelinePos,
    prescriptions: [],
  })
  if (!mat.ok) return { ok: false, error: mat.error }

  const itemId = mat.programExerciseId ?? `ex-${exercise.id}-${timelinePos}`
  const composition_version = await bumpSessionCompositionVersion(supabase, sessionId)
  // Pas de revalidatePath : patch client (append).
  return {
    ok: true,
    day: dayHint,
    append: {
      sessionId,
      composition_version,
      createdSession,
      item: {
        id: itemId,
        kind: 'exercise',
        label: exercise.name,
        position: timelinePos,
      },
      slot: {
        key: itemId,
        kind: 'exercise',
        exerciseId: exercise.id,
        prescriptions: [],
      },
    },
  }
}

async function writeCompositionFromForm(formData: FormData): Promise<
  | {
      ok: true
      programId: string
      weekId: string
      day: number | null
      sessionId: string
      version?: number
      composition?: CompositionLiveSnapshot
    }
  | {
      ok: false
      error: string
      programId?: string
      weekId?: string
      day?: number | null
      stale?: boolean
      version?: number
    }
> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const day = dayFromForm(formData)

  if (!programId || !weekId || !sessionId) {
    return { ok: false, error: 'Paramètres manquants' }
  }
  if (!(await assertProgram(supabase, programId, auth))) {
    return { ok: false, error: 'Programme introuvable', programId, weekId, day }
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('week_id', weekId)
    .maybeSingle()
  if (!session) {
    return { ok: false, error: 'Séance introuvable', programId, weekId, day }
  }

  const expectedRaw = String(formData.get('expected_version') ?? '').trim()
  const expectedParsed = expectedRaw ? Number.parseInt(expectedRaw, 10) : NaN
  const expectedVersion = Number.isFinite(expectedParsed) ? expectedParsed : null

  const { parseSessionCompositionFormData } = await import(
    '@/src/lib/sessions/parseSessionCompositionForm'
  )
  const { writeProgramSessionComposition } = await import(
    '@/src/lib/sessions/writeProgramSessionComposition'
  )

  const slots = parseSessionCompositionFormData(formData)
  const result = await writeProgramSessionComposition(supabase, sessionId, slots, {
    expectedVersion,
  })
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      programId,
      weekId,
      day,
      stale: result.stale,
      version: result.version,
    }
  }
  // Relire après delete+reinsert — nouveaux orphan ids pour le client.
  const live = await loadProgramSessionBoardSnapshot(supabase, sessionId)
  return {
    ok: true,
    programId,
    weekId,
    day,
    sessionId,
    version: result.version,
    composition: {
      ...live,
      composition_version: result.version,
    },
  }
}

/** Remplace la composition d’une séance programme (même UI que /admin/sessions/new). */
export async function replaceProgramSessionCompositionAction(formData: FormData) {
  const result = await writeCompositionFromForm(formData)
  if (!result.ok) {
    if (!result.programId) redirect('/admin/programs')
    redirect(
      builderPath(result.programId, result.weekId, undefined, result.error, {
        day: result.day,
      }),
    )
  }
  revalidatePath(`/admin/programs/${result.programId}`)
  redirect(
    builderPath(result.programId, result.weekId, 'composition_saved', undefined, {
      day: result.day,
    }),
  )
}

/** Enregistrement sans redirect — fermeture jour / auto-save. Pas de revalidatePath (RSC trop lent). */
export async function saveProgramSessionCompositionQuietAction(
  formData: FormData,
): Promise<
  | {
      ok: true
      sessionId: string
      version?: number
      composition?: CompositionLiveSnapshot
    }
  | { ok: false; error: string; stale?: boolean; version?: number }
> {
  const result = await writeCompositionFromForm(formData)
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      stale: result.stale,
      version: result.version,
    }
  }
  return {
    ok: true,
    sessionId: result.sessionId,
    version: result.version,
    composition: result.composition,
  }
}
