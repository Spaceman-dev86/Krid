import { loadSessionBlockDetails } from '@/src/lib/sessions/blockDetail'
import {
  normalizeSessionCompositionSlots,
  restPrescriptionsPayload,
  type SessionPrescription,
} from '@/src/lib/sessions/constants'
import type { CompositionSlotInput } from '@/src/lib/sessions/parseSessionCompositionForm'
import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

export type RxRow = { unit_id?: string; value?: string; group?: number }

export type FlatRx = {
  sets: number | null
  reps: string | null
  rest_time: string | null
  rpe: number | null
  tempo: string | null
  load: string | null
  notes: string | null
}

/** Snapshot copie programme (figée) — y compris blocs issus du catalogue. */
export type OrphanBlockSnapshot = {
  id: string
  source_block_library_id: string | null
  type: string | null
  title: string | null
  notes: string | null
  objective: string | null
  timer_note: string | null
  sport_id: string | null
  expected_result_unit_id: string | null
  exercises: {
    exercise_id: string | null
    exercise_name: string | null
    position: number
    sets: number | null
    reps: string | null
    rest_time: string | null
    load: string | null
    rpe: number | null
    notes: string | null
    prescriptions: SessionPrescription[]
  }[]
}

export type ProgramBlockSnapshots = {
  byId: Map<string, OrphanBlockSnapshot>
  byLibraryId: Map<string, OrphanBlockSnapshot>
}

export function asRx(raw: SessionPrescription[] | RxRow[] | unknown): RxRow[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x) => x && typeof x === 'object' && (x as RxRow).unit_id) as RxRow[]
}

/** Colonnes plates dérivées des prescriptions jsonb (source de vérité). */
export function mapFlatRx(
  prescriptions: RxRow[],
  unitKeyById: Map<string, string>,
): FlatRx {
  const byKey: Record<string, string> = {}
  for (const p of prescriptions) {
    const key = unitKeyById.get(String(p.unit_id ?? '').trim())
    if (!key) continue
    const val = String(p.value ?? '').trim()
    if (!val) continue
    byKey[key] = val
  }
  const setsN = byKey.sets != null ? Number.parseInt(byKey.sets, 10) : NaN
  const rpeN = byKey.rpe != null ? Number.parseFloat(byKey.rpe) : NaN
  const restN = byKey.rest_s != null ? Number.parseInt(byKey.rest_s, 10) : NaN
  return {
    sets: Number.isFinite(setsN) ? setsN : null,
    reps: byKey.reps ?? null,
    rest_time: Number.isFinite(restN) ? `${restN}` : byKey.rest_s ?? null,
    rpe: Number.isFinite(rpeN) ? rpeN : null,
    tempo: byKey.tempo ?? null,
    load: byKey.load_kg ?? null,
    notes: byKey.note ?? null,
  }
}

export function formatKeyToBlockType(formatKey: string | null | undefined): string {
  const k = String(formatKey ?? '').trim().toLowerCase()
  if (k.includes('warm')) return 'warmup'
  if (k.includes('cross') || k.includes('amrap') || k.includes('emom') || k.includes('for_time')) {
    return 'crosstraining'
  }
  if (k.includes('super') || k.includes('strength')) return 'strength'
  return 'free_text'
}

/** Cache requête courte — 1er drop catalogue évite de recharger toutes les units. */
let unitKeyByIdCache: { at: number; map: Map<string, string> } | null = null

export async function loadUnitKeyById(supabase: AdminSupabase): Promise<Map<string, string>> {
  const now = Date.now()
  if (unitKeyByIdCache && unitKeyByIdCache.map.size > 0 && now - unitKeyByIdCache.at < 60_000) {
    return unitKeyByIdCache.map
  }
  // RLS filtre déjà plateforme + coach ; ne pas cacher une map vide (auth froide).
  const { data: unitsRaw } = await supabase
    .from('units' as never)
    .select('id, key')
    .is('deleted_at' as never, null)
  const map = new Map(
    ((unitsRaw ?? []) as { id: string; key: string }[]).map((u) => [u.id, u.key]),
  )
  if (map.size > 0) unitKeyByIdCache = { at: now, map }
  return map
}

export async function loadFormatKeyByBlockIds(
  supabase: AdminSupabase,
  blockIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  if (!blockIds.length) return out
  const { data: blRaw } = await supabase
    .from('block_library' as never)
    .select('id, format_id')
    .in('id' as never, blockIds as never)
  const formatIds = [
    ...new Set(
      ((blRaw ?? []) as { format_id?: string | null }[])
        .map((b) => b.format_id)
        .filter(Boolean) as string[],
    ),
  ]
  const formatKeyById = new Map<string, string>()
  if (formatIds.length) {
    const { data: fmt } = await supabase
      .from('block_formats' as never)
      .select('id, key')
      .in('id' as never, formatIds as never)
    for (const f of (fmt ?? []) as { id: string; key: string }[]) {
      formatKeyById.set(f.id, f.key)
    }
  }
  for (const b of (blRaw ?? []) as { id: string; format_id: string | null }[]) {
    out.set(b.id, b.format_id ? formatKeyById.get(b.format_id) ?? null : null)
  }
  return out
}

/**
 * Snapshot de toutes les copies programme de la séance.
 * Source de vérité au rewrite — on ne re-lit le catalogue live que pour un
 * bloc catalogue jamais encore matérialisé dans cette séance.
 */
export async function snapshotProgramSessionBlocks(
  supabase: AdminSupabase,
  programSessionId: string,
): Promise<ProgramBlockSnapshots> {
  const byId = new Map<string, OrphanBlockSnapshot>()
  const byLibraryId = new Map<string, OrphanBlockSnapshot>()
  const { data: blocksRaw } = await supabase
    .from('session_blocks')
    .select(
      'id,type,title,notes,objective,source_block_library_id,timer_note,sport_id,expected_result_unit_id',
    )
    .eq('program_session_id', programSessionId)
  const blocks = (blocksRaw ?? []) as {
    id: string
    type: string | null
    title: string | null
    notes: string | null
    objective: string | null
    source_block_library_id: string | null
    timer_note?: string | null
    sport_id?: string | null
    expected_result_unit_id?: string | null
  }[]
  if (!blocks.length) return { byId, byLibraryId }

  const { data: beRaw } = await supabase
    .from('block_exercises')
    .select(
      'session_block_id,position,exercise_id,exercise_name,sets,reps,rest_time,load,rpe,notes,prescriptions',
    )
    .in(
      'session_block_id',
      blocks.map((b) => b.id),
    )
    .order('position', { ascending: true })

  const beByBlock = new Map<string, OrphanBlockSnapshot['exercises']>()
  type BeRow = OrphanBlockSnapshot['exercises'][number] & {
    session_block_id: string
    prescriptions?: unknown
  }
  for (const be of (beRaw ?? []) as unknown as BeRow[]) {
    const list = beByBlock.get(be.session_block_id) ?? []
    const prescriptions = Array.isArray(be.prescriptions)
      ? (be.prescriptions as SessionPrescription[]).filter((p) => p?.unit_id)
      : []
    list.push({
      exercise_id: be.exercise_id,
      exercise_name: be.exercise_name,
      position: be.position,
      sets: be.sets,
      reps: be.reps,
      rest_time: be.rest_time,
      load: be.load,
      rpe: be.rpe,
      notes: be.notes,
      prescriptions,
    })
    beByBlock.set(be.session_block_id, list)
  }

  for (const ob of blocks) {
    const snap: OrphanBlockSnapshot = {
      id: ob.id,
      source_block_library_id: ob.source_block_library_id,
      type: ob.type,
      title: ob.title,
      notes: ob.notes,
      objective: ob.objective,
      timer_note: ob.timer_note ?? null,
      sport_id: ob.sport_id ?? null,
      expected_result_unit_id: ob.expected_result_unit_id ?? null,
      exercises: beByBlock.get(ob.id) ?? [],
    }
    byId.set(ob.id, snap)
    if (ob.source_block_library_id && !byLibraryId.has(ob.source_block_library_id)) {
      byLibraryId.set(ob.source_block_library_id, snap)
    }
  }
  return { byId, byLibraryId }
}

/** @deprecated alias — préférer snapshotProgramSessionBlocks */
export async function snapshotOrphanBlocks(
  supabase: AdminSupabase,
  programSessionId: string,
): Promise<Map<string, OrphanBlockSnapshot>> {
  const { byId } = await snapshotProgramSessionBlocks(supabase, programSessionId)
  return byId
}

/** Payload résolu prêt pour RPC transactionnelle. */
export type CompositionRpcPayload = {
  expected_version?: number | null
  items: Array<
    | { kind: 'rest'; rest_seconds: number }
    | {
        kind: 'exercise'
        exercise_id: string
        name: string
        prescriptions: SessionPrescription[]
        flat: FlatRx
      }
    | {
        kind: 'block'
        source_block_library_id: string | null
        type: string
        title: string
        notes: string | null
        objective: string | null
        timer_note: string | null
        sport_id: string | null
        expected_result_unit_id: string | null
        exercises: Array<{
          exercise_id: string | null
          exercise_name: string | null
          position: number
          flat: FlatRx
          prescriptions: SessionPrescription[]
        }>
      }
  >
}

function rpcBlockFromSnapshot(
  snap: OrphanBlockSnapshot,
  sourceLibraryId: string | null,
): Extract<CompositionRpcPayload['items'][number], { kind: 'block' }> {
  return {
    kind: 'block',
    source_block_library_id: sourceLibraryId,
    type: snap.type ?? 'free_text',
    title: snap.title ?? 'Bloc',
    notes: snap.notes,
    objective: snap.objective,
    timer_note: snap.timer_note,
    sport_id: snap.sport_id,
    expected_result_unit_id: snap.expected_result_unit_id,
    exercises: snap.exercises.map((be) => ({
      exercise_id: be.exercise_id,
      exercise_name: be.exercise_name,
      position: be.position,
      prescriptions: be.prescriptions ?? [],
      flat: {
        sets: be.sets,
        reps: be.reps,
        rest_time: be.rest_time,
        load: be.load,
        rpe: be.rpe,
        tempo: null,
        notes: be.notes,
      },
    })),
  }
}

export async function buildCompositionRpcPayload(
  supabase: AdminSupabase,
  rawSlots: CompositionSlotInput[],
  opts?: {
    programBlockSnapshots?: ProgramBlockSnapshots
    /** @deprecated */
    orphanSnapshots?: Map<string, OrphanBlockSnapshot>
    expectedVersion?: number | null
  },
): Promise<{ ok: true; payload: CompositionRpcPayload } | { ok: false; error: string }> {
  const slots = normalizeSessionCompositionSlots(rawSlots)
  // Composition vide / pauses seules = wipe autorisé (fermeture jour après clear).
  if (!slots.length) {
    return {
      ok: true,
      payload: {
        expected_version: opts?.expectedVersion ?? null,
        items: [],
      },
    }
  }

  const unitKeyById = await loadUnitKeyById(supabase)
  const exoIds = [
    ...new Set(slots.filter((s) => s.kind === 'exercise' && s.exerciseId).map((s) => s.exerciseId!)),
  ]

  const snaps: ProgramBlockSnapshots = opts?.programBlockSnapshots ?? {
    byId: opts?.orphanSnapshots ?? new Map(),
    byLibraryId: new Map(),
  }
  if (!opts?.programBlockSnapshots && opts?.orphanSnapshots) {
    for (const snap of opts.orphanSnapshots.values()) {
      if (snap.source_block_library_id && !snaps.byLibraryId.has(snap.source_block_library_id)) {
        snaps.byLibraryId.set(snap.source_block_library_id, snap)
      }
    }
  }

  // Catalogue live uniquement pour les NOUVEAUX drops (pas encore de copie programme).
  const newLibraryIds = [
    ...new Set(
      slots
        .filter((s) => s.kind === 'block' && s.blockId)
        .filter((s) => {
          if (s.kind !== 'block') return false
          if (s.orphanSessionBlockId && snaps.byId.has(s.orphanSessionBlockId)) return false
          if (s.blockId && snaps.byLibraryId.has(s.blockId)) return false
          return Boolean(s.blockId)
        })
        .map((s) => (s.kind === 'block' ? s.blockId! : '')),
    ),
  ]

  const exoNameById = new Map<string, string>()
  if (exoIds.length) {
    const { data } = await supabase.from('exercise_library').select('id, name').in('id', exoIds)
    for (const e of (data ?? []) as { id: string; name: string }[]) {
      exoNameById.set(e.id, e.name)
    }
  }

  const blockDetails = await loadSessionBlockDetails(supabase, newLibraryIds)
  const blockById = new Map(blockDetails.map((b) => [b.id, b]))
  const formatKeyByBlock = await loadFormatKeyByBlockIds(supabase, newLibraryIds)

  const items: CompositionRpcPayload['items'] = []

  for (const item of slots) {
    if (item.kind === 'rest') {
      items.push({ kind: 'rest', rest_seconds: item.restSeconds ?? 60 })
      continue
    }

    if (item.kind === 'exercise' && item.exerciseId) {
      const prescriptions = (item.prescriptions ?? []) as SessionPrescription[]
      items.push({
        kind: 'exercise',
        exercise_id: item.exerciseId,
        name: exoNameById.get(item.exerciseId) ?? 'Exercice',
        prescriptions,
        flat: mapFlatRx(asRx(prescriptions), unitKeyById),
      })
      continue
    }

    if (item.kind !== 'block') continue

    // 1) Copie programme existante (figée) — prioritaire.
    if (item.orphanSessionBlockId) {
      const snap = snaps.byId.get(item.orphanSessionBlockId)
      if (snap) {
        items.push(
          rpcBlockFromSnapshot(
            snap,
            snap.source_block_library_id ?? item.blockId ?? null,
          ),
        )
        continue
      }
      // Orphan périmé (delete+reinsert après flush) — fallback library / live, pas hard-fail.
      if (item.blockId) {
        const frozen = snaps.byLibraryId.get(item.blockId)
        if (frozen) {
          items.push(rpcBlockFromSnapshot(frozen, item.blockId))
          continue
        }
        const live = blockById.get(item.blockId)
        if (live) {
          items.push({
            kind: 'block',
            source_block_library_id: item.blockId,
            type: formatKeyToBlockType(formatKeyByBlock.get(item.blockId)),
            title: live.name,
            notes: live.notes?.trim() || null,
            objective: live.expected_result_label,
            timer_note: live.timer_note ?? null,
            sport_id: live.sport_id ?? null,
            expected_result_unit_id: live.expected_result_unit_id ?? null,
            exercises: live.exercises.map((ex, i) => {
              const prescriptions = asRx(ex.prescriptions as SessionPrescription[])
              return {
                exercise_id: ex.exercise_id,
                exercise_name: ex.name,
                position: i,
                prescriptions: prescriptions as SessionPrescription[],
                flat: mapFlatRx(prescriptions, unitKeyById),
              }
            }),
          })
          continue
        }
      }
      // Bloc créé dans le programme (pas de library id) + id mort → contenu perdu.
      return {
        ok: false,
        error: 'Bloc programme introuvable — rouvre le jour puis réessaie',
      }
    }
    if (item.blockId) {
      const frozen = snaps.byLibraryId.get(item.blockId)
      if (frozen) {
        items.push(rpcBlockFromSnapshot(frozen, item.blockId))
        continue
      }
      // 2) Premier drop catalogue → une seule copie depuis le live.
      const block = blockById.get(item.blockId)
      if (!block) return { ok: false, error: 'Bloc introuvable' }
      items.push({
        kind: 'block',
        source_block_library_id: item.blockId,
        type: formatKeyToBlockType(formatKeyByBlock.get(item.blockId)),
        title: block.name,
        notes: block.notes?.trim() || null,
        objective: block.expected_result_label,
        timer_note: block.timer_note ?? null,
        sport_id: block.sport_id ?? null,
        expected_result_unit_id: block.expected_result_unit_id ?? null,
        exercises: block.exercises.map((ex, i) => {
          const prescriptions = asRx(ex.prescriptions as SessionPrescription[])
          return {
            exercise_id: ex.exercise_id,
            exercise_name: ex.name,
            position: i,
            prescriptions: prescriptions as SessionPrescription[],
            flat: mapFlatRx(prescriptions, unitKeyById),
          }
        }),
      })
    }
  }

  const hadContentSlots = slots.some((s) => s.kind === 'block' || s.kind === 'exercise')
  const hasContentItems = items.some((i) => i.kind === 'block' || i.kind === 'exercise')
  if (hadContentSlots && !hasContentItems) {
    return { ok: false, error: 'Ajoute au moins un bloc ou un exercice' }
  }

  return {
    ok: true,
    payload: {
      expected_version: opts?.expectedVersion ?? null,
      items,
    },
  }
}

/** Append d’un bloc catalogue (même shape que save composition). */
export async function appendLibraryBlockToSession(
  supabase: AdminSupabase,
  args: {
    sessionId: string
    blockLibraryId: string
    timelinePos: number
    blockTablePos: number
  },
): Promise<{ ok: true; sessionBlockId: string } | { ok: false; error: string }> {
  const unitKeyById = await loadUnitKeyById(supabase)
  const details = await loadSessionBlockDetails(supabase, [args.blockLibraryId])
  const block = details[0]
  if (!block) return { ok: false, error: 'Bloc introuvable' }
  const formatKeyByBlock = await loadFormatKeyByBlockIds(supabase, [args.blockLibraryId])

  const { data: sb, error: bErr } = await supabase
    .from('session_blocks')
    .insert({
      program_session_id: args.sessionId,
      position: args.blockTablePos,
      type: formatKeyToBlockType(formatKeyByBlock.get(args.blockLibraryId)),
      title: block.name,
      notes: block.notes?.trim() || null,
      timer_note: block.timer_note ?? null,
      sport_id: block.sport_id ?? null,
      expected_result_unit_id: block.expected_result_unit_id ?? null,
      objective: block.expected_result_label,
      source_block_library_id: args.blockLibraryId,
    } as never)
    .select('id')
    .maybeSingle()
  if (bErr || !sb) return { ok: false, error: bErr?.message ?? 'Insert bloc impossible' }
  const newBlockId = (sb as { id: string }).id

  for (let i = 0; i < block.exercises.length; i += 1) {
    const ex = block.exercises[i]!
    const prescriptions = asRx(ex.prescriptions as SessionPrescription[])
    const rx = mapFlatRx(prescriptions, unitKeyById)
    const { error: beErr } = await supabase.from('block_exercises').insert({
      session_block_id: newBlockId,
      exercise_id: ex.exercise_id,
      exercise_name: ex.name,
      position: i,
      sets: rx.sets,
      reps: rx.reps,
      rest_time: rx.rest_time,
      load: rx.load,
      rpe: rx.rpe,
      notes: rx.notes,
      prescriptions,
    } as never)
    if (beErr) return { ok: false, error: beErr.message }
  }

  const { error: siErr } = await supabase.from('session_items').insert({
    session_id: args.sessionId,
    position: args.timelinePos,
    kind: 'block',
    session_block_id: newBlockId,
    program_exercise_id: null,
    prescriptions: [],
  } as never)
  if (siErr) return { ok: false, error: siErr.message }

  return { ok: true, sessionBlockId: newBlockId }
}

/** Append d’un exo catalogue (prescriptions jsonb = source). */
export async function appendLibraryExerciseToSession(
  supabase: AdminSupabase,
  args: {
    sessionId: string
    exerciseId: string
    name: string
    timelinePos: number
    prescriptions?: SessionPrescription[]
  },
): Promise<{ ok: true; programExerciseId: string } | { ok: false; error: string }> {
  const unitKeyById = await loadUnitKeyById(supabase)
  const prescriptions = args.prescriptions ?? []
  const rx = mapFlatRx(asRx(prescriptions), unitKeyById)

  const { data: pe, error: peErr } = await supabase
    .from('program_exercises')
    .insert({
      session_id: args.sessionId,
      exercise_id: args.exerciseId,
      name: args.name,
      exercise_order: args.timelinePos,
      sets: rx.sets,
      reps: rx.reps,
      rest_time: rx.rest_time,
      rpe: rx.rpe,
      tempo: rx.tempo,
      load: rx.load,
      notes: rx.notes,
    } as never)
    .select('id')
    .maybeSingle()
  if (peErr || !pe) return { ok: false, error: peErr?.message ?? 'Insert exo impossible' }

  const programExerciseId = (pe as { id: string }).id
  const { error: siErr } = await supabase.from('session_items').insert({
    session_id: args.sessionId,
    position: args.timelinePos,
    kind: 'exercise',
    program_exercise_id: programExerciseId,
    session_block_id: null,
    prescriptions,
  } as never)
  if (siErr) return { ok: false, error: siErr.message }
  return { ok: true, programExerciseId }
}
