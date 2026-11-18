import type { ExercisePrescription } from '@/src/lib/blocks/constants'
import {
  type SessionBlockDetail,
  type SessionBlockDetailExercise,
} from '@/src/lib/sessions/blockDetail'
import {
  asRx,
  appendLibraryBlockToSession,
  loadUnitKeyById,
  mapFlatRx,
} from '@/src/lib/sessions/materializeProgramSessionSlots'
import type { SessionPrescription } from '@/src/lib/sessions/constants'
import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

export type ProgramBlockWriteInput = {
  name: string
  notes?: string | null
  timer_note?: string | null
  sport_id?: string | null
  expected_result_label?: string | null
  expected_result_unit_id?: string | null
  exercise_ids: string[]
  exercise_prescriptions: ExercisePrescription[][]
  /** Lie / met à jour la provenance catalogue. */
  source_block_library_id?: string | null
}

function normalizePrescriptions(raw: unknown): ExercisePrescription[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((p) => {
      if (!p || typeof p !== 'object') return null
      const row = p as {
        unit_id?: unknown
        value?: unknown
        varies?: unknown
        input_mode?: unknown
        group?: unknown
      }
      const unit_id = String(row.unit_id ?? '').trim()
      if (!unit_id) return null
      return {
        unit_id,
        value: String(row.value ?? ''),
        varies: Boolean(row.varies),
        input_mode:
          row.input_mode === 'number' ||
          row.input_mode === 'time' ||
          row.input_mode === 'text' ||
          row.input_mode === 'list'
            ? row.input_mode
            : null,
        ...(typeof row.group === 'number' ? { group: row.group } : {}),
      } as ExercisePrescription
    })
    .filter(Boolean) as ExercisePrescription[]
}

/** Charge une copie programme (session_blocks) au format SessionBlockDetail. */
export async function loadProgramSessionBlockDetail(
  supabase: AdminSupabase,
  sessionBlockId: string,
): Promise<{ detail: SessionBlockDetail | null; error: string | null }> {
  const { data: sbRaw, error } = await supabase
    .from('session_blocks')
    .select(
      'id,title,notes,objective,type,source_block_library_id,timer_note,sport_id,expected_result_unit_id',
    )
    .eq('id', sessionBlockId)
    .maybeSingle()
  if (error) return { detail: null, error: error.message }
  if (!sbRaw) return { detail: null, error: null }

  const sb = sbRaw as {
    id: string
    title: string | null
    notes: string | null
    objective: string | null
    type: string | null
    source_block_library_id: string | null
    timer_note?: string | null
    sport_id?: string | null
    expected_result_unit_id?: string | null
  }

  const { data: beRaw } = await supabase
    .from('block_exercises')
    .select(
      'id,exercise_id,exercise_name,position,sets,reps,rest_time,load,rpe,notes,prescriptions',
    )
    .eq('session_block_id', sessionBlockId)
    .order('position', { ascending: true })

  const unitKeyById = await loadUnitKeyById(supabase)
  const unitIdByKey = new Map<string, string>()
  for (const [id, key] of unitKeyById) unitIdByKey.set(key, id)

  const exercises: SessionBlockDetailExercise[] = (
    (beRaw ?? []) as {
      id: string
      exercise_id: string | null
      exercise_name: string | null
      position: number
      sets: number | null
      reps: string | null
      rest_time: string | null
      load: string | null
      rpe: number | null
      notes: string | null
      prescriptions?: unknown
    }[]
  ).map((be) => {
    let prescriptions = normalizePrescriptions(be.prescriptions)
    // Fallback legacy : reconstruire depuis colonnes plates si jsonb vide.
    if (!prescriptions.length) {
      const push = (key: string, value: string) => {
        const unit_id = unitIdByKey.get(key)
        if (!unit_id || !value.trim()) return
        prescriptions.push({ unit_id, value: value.trim(), varies: false, input_mode: null })
      }
      if (be.sets != null) push('sets', String(be.sets))
      if (be.reps) push('reps', String(be.reps))
      if (be.rest_time) push('rest_s', String(be.rest_time))
      if (be.load) push('load_kg', String(be.load))
      if (be.rpe != null) push('rpe', String(be.rpe))
      if (be.notes) push('note', String(be.notes))
    }
    return {
      exercise_id: be.exercise_id ?? '',
      name: be.exercise_name?.trim() || 'Exercice',
      prescriptions,
    }
  })

  const detail: SessionBlockDetail = {
    id: sb.id,
    name: sb.title?.trim() || 'Bloc',
    status: 'published',
    sport_id: sb.sport_id ?? null,
    notes: sb.notes,
    timer_note: sb.timer_note ?? null,
    expected_result_unit_id: sb.expected_result_unit_id ?? null,
    expected_result_label: sb.objective,
    allow_duplicate: true,
    exercise_ids: exercises.map((e) => e.exercise_id).filter(Boolean),
    exercise_prescriptions: exercises.map((e) => e.prescriptions),
    hidden_type_ids: [],
    exercises,
    source_block_library_id: sb.source_block_library_id,
  }
  return { detail, error: null }
}

export async function loadProgramSessionBlockDetails(
  supabase: AdminSupabase,
  sessionBlockIds: string[],
): Promise<SessionBlockDetail[]> {
  const unique = [...new Set(sessionBlockIds.filter(Boolean))]
  if (!unique.length) return []

  // 2 requêtes + units (évite N×3 waterfall sur les gros programmes).
  const [{ data: sbRows }, { data: beRows }, unitKeyById] = await Promise.all([
    supabase
      .from('session_blocks')
      .select(
        'id,title,notes,objective,type,source_block_library_id,timer_note,sport_id,expected_result_unit_id',
      )
      .in('id', unique),
    supabase
      .from('block_exercises')
      .select(
        'id,session_block_id,exercise_id,exercise_name,position,sets,reps,rest_time,load,rpe,notes,prescriptions',
      )
      .in('session_block_id', unique)
      .order('position', { ascending: true }),
    loadUnitKeyById(supabase),
  ])

  const unitIdByKey = new Map<string, string>()
  for (const [id, key] of unitKeyById) unitIdByKey.set(key, id)

  type BeRow = {
    id: string
    session_block_id: string
    exercise_id: string | null
    exercise_name: string | null
    position: number
    sets: number | null
    reps: string | null
    rest_time: string | null
    load: string | null
    rpe: number | null
    notes: string | null
    prescriptions?: unknown
  }

  const exercisesByBlock = new Map<string, BeRow[]>()
  for (const be of (beRows ?? []) as BeRow[]) {
    const list = exercisesByBlock.get(be.session_block_id) ?? []
    list.push(be)
    exercisesByBlock.set(be.session_block_id, list)
  }

  const details: SessionBlockDetail[] = []
  for (const sbRaw of (sbRows ?? []) as {
    id: string
    title: string | null
    notes: string | null
    objective: string | null
    type: string | null
    source_block_library_id: string | null
    timer_note?: string | null
    sport_id?: string | null
    expected_result_unit_id?: string | null
  }[]) {
    const exercises: SessionBlockDetailExercise[] = (
      exercisesByBlock.get(sbRaw.id) ?? []
    ).map((be) => {
      let prescriptions = normalizePrescriptions(be.prescriptions)
      if (!prescriptions.length) {
        const push = (key: string, value: string) => {
          const unit_id = unitIdByKey.get(key)
          if (!unit_id || !value.trim()) return
          prescriptions.push({
            unit_id,
            value: value.trim(),
            varies: false,
            input_mode: null,
          })
        }
        if (be.sets != null) push('sets', String(be.sets))
        if (be.reps) push('reps', String(be.reps))
        if (be.rest_time) push('rest_s', String(be.rest_time))
        if (be.load) push('load_kg', String(be.load))
        if (be.rpe != null) push('rpe', String(be.rpe))
        if (be.notes) push('note', String(be.notes))
      }
      return {
        exercise_id: be.exercise_id ?? '',
        name: be.exercise_name?.trim() || 'Exercice',
        prescriptions,
      }
    })

    details.push({
      id: sbRaw.id,
      name: sbRaw.title?.trim() || 'Bloc',
      status: 'published',
      sport_id: sbRaw.sport_id ?? null,
      notes: sbRaw.notes,
      timer_note: sbRaw.timer_note ?? null,
      expected_result_unit_id: sbRaw.expected_result_unit_id ?? null,
      expected_result_label: sbRaw.objective,
      allow_duplicate: true,
      exercise_ids: exercises.map((e) => e.exercise_id).filter(Boolean),
      exercise_prescriptions: exercises.map((e) => e.prescriptions),
      hidden_type_ids: [],
      exercises,
      source_block_library_id: sbRaw.source_block_library_id,
    })
  }

  // Ordre stable = ordre des ids demandés.
  const byId = new Map(details.map((d) => [d.id, d] as const))
  return unique.map((id) => byId.get(id)).filter((d): d is SessionBlockDetail => Boolean(d))
}

async function resolveExerciseNames(
  supabase: AdminSupabase,
  exerciseIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!exerciseIds.length) return map
  const { data } = await supabase
    .from('exercise_library')
    .select('id,name')
    .in('id', exerciseIds)
  for (const e of (data ?? []) as { id: string; name: string }[]) {
    map.set(e.id, e.name)
  }
  return map
}

async function resolveExpectedResultLabel(
  supabase: AdminSupabase,
  unitId: string | null | undefined,
  fallback: string | null | undefined,
): Promise<string | null> {
  const label = String(fallback ?? '').trim()
  if (label) return label
  const id = String(unitId ?? '').trim()
  if (!id) return null
  const { data } = await supabase
    .from('units' as never)
    .select('label,short_label')
    .eq('id' as never, id as never)
    .maybeSingle()
  const u = data as { label?: string; short_label?: string | null } | null
  return u?.short_label?.trim() || u?.label?.trim() || null
}

/** Crée une copie programme (pas de block_library). */
export async function createProgramOwnedBlock(
  supabase: AdminSupabase,
  args: { programSessionId: string; input: ProgramBlockWriteInput },
): Promise<{ ok: true; detail: SessionBlockDetail } | { ok: false; error: string }> {
  const { programSessionId, input } = args
  const unitKeyById = await loadUnitKeyById(supabase)
  const names = await resolveExerciseNames(supabase, input.exercise_ids)
  const objective = await resolveExpectedResultLabel(
    supabase,
    input.expected_result_unit_id,
    input.expected_result_label,
  )

  const { data: maxPos } = await supabase
    .from('session_blocks')
    .select('position')
    .eq('program_session_id', programSessionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const position =
    ((maxPos as { position?: number } | null)?.position ?? -1) + 1

  const { data: sb, error: bErr } = await supabase
    .from('session_blocks')
    .insert({
      program_session_id: programSessionId,
      position,
      type: 'free_text',
      title: input.name,
      notes: String(input.notes ?? '').trim() || null,
      timer_note: String(input.timer_note ?? '').trim() || null,
      sport_id: String(input.sport_id ?? '').trim() || null,
      expected_result_unit_id: String(input.expected_result_unit_id ?? '').trim() || null,
      objective,
      source_block_library_id: null,
    } as never)
    .select('id')
    .maybeSingle()
  if (bErr || !sb) return { ok: false, error: bErr?.message ?? 'Insert bloc impossible' }
  const sessionBlockId = (sb as { id: string }).id

  for (let i = 0; i < input.exercise_ids.length; i += 1) {
    const exerciseId = input.exercise_ids[i]!
    const prescriptions = asRx(input.exercise_prescriptions[i] as SessionPrescription[])
    const rx = mapFlatRx(prescriptions, unitKeyById)
    const { error: beErr } = await supabase.from('block_exercises').insert({
      session_block_id: sessionBlockId,
      exercise_id: exerciseId,
      exercise_name: names.get(exerciseId) ?? 'Exercice',
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

  // Timeline item en fin — la composition complète sera réordonnée au flush.
  const { data: maxSi } = await supabase
    .from('session_items')
    .select('position')
    .eq('session_id', programSessionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const timelinePos =
    ((maxSi as { position?: number } | null)?.position ?? -1) + 1
  const { error: siErr } = await supabase.from('session_items').insert({
    session_id: programSessionId,
    position: timelinePos,
    kind: 'block',
    session_block_id: sessionBlockId,
    program_exercise_id: null,
    prescriptions: [],
  } as never)
  if (siErr) return { ok: false, error: siErr.message }

  const loaded = await loadProgramSessionBlockDetail(supabase, sessionBlockId)
  if (!loaded.detail) return { ok: false, error: loaded.error ?? 'Reload impossible' }
  return { ok: true, detail: loaded.detail }
}

/** Met à jour une copie programme (jamais le catalogue). */
export async function updateProgramOwnedBlock(
  supabase: AdminSupabase,
  args: { sessionBlockId: string; input: ProgramBlockWriteInput },
): Promise<{ ok: true; detail: SessionBlockDetail } | { ok: false; error: string }> {
  const { sessionBlockId, input } = args

  // Guard RLS : id mort après flush (delete+reinsert) → message clair, pas erreur Postgres.
  const { data: existing, error: existErr } = await supabase
    .from('session_blocks')
    .select('id')
    .eq('id', sessionBlockId)
    .maybeSingle()
  if (existErr) return { ok: false, error: existErr.message }
  if (!existing) {
    return {
      ok: false,
      error: 'Bloc obsolète (séance réenregistrée) — ferme et rouvre le bloc',
    }
  }

  const unitKeyById = await loadUnitKeyById(supabase)
  const names = await resolveExerciseNames(supabase, input.exercise_ids)
  const objective = await resolveExpectedResultLabel(
    supabase,
    input.expected_result_unit_id,
    input.expected_result_label,
  )

  const patch: Record<string, unknown> = {
    title: input.name,
    notes: String(input.notes ?? '').trim() || null,
    timer_note: String(input.timer_note ?? '').trim() || null,
    sport_id: String(input.sport_id ?? '').trim() || null,
    expected_result_unit_id: String(input.expected_result_unit_id ?? '').trim() || null,
    objective,
  }
  if (input.source_block_library_id !== undefined) {
    patch.source_block_library_id = input.source_block_library_id
  }
  const { error: updErr } = await supabase
    .from('session_blocks')
    .update(patch as never)
    .eq('id', sessionBlockId)
  if (updErr) return { ok: false, error: updErr.message }

  const { error: delErr } = await supabase
    .from('block_exercises')
    .delete()
    .eq('session_block_id', sessionBlockId)
  if (delErr) return { ok: false, error: delErr.message }

  for (let i = 0; i < input.exercise_ids.length; i += 1) {
    const exerciseId = input.exercise_ids[i]!
    const prescriptions = asRx(input.exercise_prescriptions[i] as SessionPrescription[])
    const rx = mapFlatRx(prescriptions, unitKeyById)
    const { error: beErr } = await supabase.from('block_exercises').insert({
      session_block_id: sessionBlockId,
      exercise_id: exerciseId,
      exercise_name: names.get(exerciseId) ?? 'Exercice',
      position: i,
      sets: rx.sets,
      reps: rx.reps,
      rest_time: rx.rest_time,
      load: rx.load,
      rpe: rx.rpe,
      notes: rx.notes,
      prescriptions,
    } as never)
    if (beErr) {
      const msg = beErr.message ?? ''
      if (/row-level security|RLS/i.test(msg)) {
        return {
          ok: false,
          error: 'Bloc obsolète (séance réenregistrée) — ferme et rouvre le bloc',
        }
      }
      return { ok: false, error: msg }
    }
  }

  const loaded = await loadProgramSessionBlockDetail(supabase, sessionBlockId)
  if (!loaded.detail) return { ok: false, error: loaded.error ?? 'Reload impossible' }
  return { ok: true, detail: loaded.detail }
}

/**
 * Fork immédiat catalogue → copie programme (pour éditer sans toucher au modèle).
 * Attache aussi un session_item en fin de timeline (réordonné au prochain flush).
 */
export async function forkLibraryBlockIntoProgramSession(
  supabase: AdminSupabase,
  args: { programSessionId: string; blockLibraryId: string },
): Promise<{ ok: true; detail: SessionBlockDetail } | { ok: false; error: string }> {
  const [maxSiRes, maxSbRes] = await Promise.all([
    supabase
      .from('session_items')
      .select('position')
      .eq('session_id', args.programSessionId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('session_blocks')
      .select('position')
      .eq('program_session_id', args.programSessionId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const timelinePos =
    ((maxSiRes.data as { position?: number } | null)?.position ?? -1) + 1
  const blockTablePos =
    ((maxSbRes.data as { position?: number } | null)?.position ?? -1) + 1

  const mat = await appendLibraryBlockToSession(supabase, {
    sessionId: args.programSessionId,
    blockLibraryId: args.blockLibraryId,
    timelinePos,
    blockTablePos,
  })
  if (!mat.ok) return mat

  const loaded = await loadProgramSessionBlockDetail(supabase, mat.sessionBlockId)
  if (!loaded.detail) return { ok: false, error: loaded.error ?? 'Reload impossible' }
  return { ok: true, detail: loaded.detail }
}
