import { formatBlockTimerSummary, loadSessionBlockDetails } from '@/src/lib/sessions/blockDetail'
import {
  normalizeSessionCompositionSlots,
  restPrescriptionsPayload,
  type SessionPrescription,
} from '@/src/lib/sessions/constants'
import type { CompositionSlotInput } from '@/src/lib/sessions/parseSessionCompositionForm'
import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

type RxRow = { unit_id?: string; value?: string; group?: number }

function asRx(raw: SessionPrescription[]): RxRow[] {
  return raw.filter((x) => x && x.unit_id) as RxRow[]
}

function mapFlatRx(
  prescriptions: RxRow[],
  unitKeyById: Map<string, string>,
): {
  sets: number | null
  reps: string | null
  rest_time: string | null
  rpe: number | null
  tempo: string | null
  load: string | null
  notes: string | null
} {
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

function formatKeyToBlockType(formatKey: string | null | undefined): string {
  const k = String(formatKey ?? '').trim().toLowerCase()
  if (k.includes('warm')) return 'warmup'
  if (k.includes('cross') || k.includes('amrap') || k.includes('emom') || k.includes('for_time')) {
    return 'crosstraining'
  }
  if (k.includes('super') || k.includes('strength')) return 'strength'
  return 'free_text'
}

/** Remplace toute la composition d’une séance programme (même slots que la fiche). */
export async function writeProgramSessionComposition(
  supabase: AdminSupabase,
  programSessionId: string,
  rawSlots: CompositionSlotInput[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const slots = normalizeSessionCompositionSlots(rawSlots)
  if (!slots.some((s) => s.kind === 'block' || s.kind === 'exercise')) {
    return { ok: false, error: 'Ajoute au moins un bloc ou un exercice' }
  }

  // Clear timeline
  await supabase.from('session_items').delete().eq('session_id', programSessionId)
  await supabase.from('program_exercises').delete().eq('session_id', programSessionId)
  await supabase.from('session_blocks').delete().eq('program_session_id', programSessionId)

  const [{ data: unitsRaw }] = await Promise.all([
    supabase
      .from('units' as never)
      .select('id, key')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null),
  ])
  const unitKeyById = new Map(
    ((unitsRaw ?? []) as { id: string; key: string }[]).map((u) => [u.id, u.key]),
  )

  const exoIds = [
    ...new Set(slots.filter((s) => s.kind === 'exercise' && s.exerciseId).map((s) => s.exerciseId!)),
  ]
  const blockIds = [
    ...new Set(slots.filter((s) => s.kind === 'block' && s.blockId).map((s) => s.blockId!)),
  ]

  const exoNameById = new Map<string, string>()
  if (exoIds.length) {
    const { data } = await supabase.from('exercise_library').select('id, name').in('id', exoIds)
    for (const e of (data ?? []) as { id: string; name: string }[]) {
      exoNameById.set(e.id, e.name)
    }
  }

  const blockDetails = await loadSessionBlockDetails(supabase, blockIds)
  const blockById = new Map(blockDetails.map((b) => [b.id, b]))

  const formatKeyByBlock = new Map<string, string | null>()
  if (blockIds.length) {
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
      formatKeyByBlock.set(b.id, b.format_id ? formatKeyById.get(b.format_id) ?? null : null)
    }
  }

  let timelinePos = 0
  let blockTablePos = 0

  for (const item of slots) {
    if (item.kind === 'rest') {
      const secs = item.restSeconds ?? 60
      const { error: siErr } = await supabase.from('session_items').insert({
        session_id: programSessionId,
        position: timelinePos,
        kind: 'rest',
        program_exercise_id: null,
        session_block_id: null,
        prescriptions: restPrescriptionsPayload(secs),
      } as never)
      if (siErr) return { ok: false, error: siErr.message }
      timelinePos += 1
      continue
    }

    if (item.kind === 'exercise' && item.exerciseId) {
      const rx = mapFlatRx(asRx(item.prescriptions), unitKeyById)
      const { data: pe, error: peErr } = await supabase
        .from('program_exercises')
        .insert({
          session_id: programSessionId,
          exercise_id: item.exerciseId,
          name: exoNameById.get(item.exerciseId) ?? 'Exercice',
          exercise_order: timelinePos,
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
      if (peErr || !pe) return { ok: false, error: peErr?.message ?? 'Insert exercice impossible' }

      const { error: siErr } = await supabase.from('session_items').insert({
        session_id: programSessionId,
        position: timelinePos,
        kind: 'exercise',
        program_exercise_id: (pe as { id: string }).id,
        session_block_id: null,
        prescriptions: item.prescriptions ?? [],
      } as never)
      if (siErr) return { ok: false, error: siErr.message }
      timelinePos += 1
      continue
    }

    if (item.kind === 'block' && item.blockId) {
      const block = blockById.get(item.blockId)
      if (!block) return { ok: false, error: 'Bloc introuvable' }

      const timer = formatBlockTimerSummary(block.timer_note)
      const notes = [block.notes?.trim(), timer].filter(Boolean).join('\n') || null

      const { data: sb, error: bErr } = await supabase
        .from('session_blocks')
        .insert({
          program_session_id: programSessionId,
          position: blockTablePos,
          type: formatKeyToBlockType(formatKeyByBlock.get(item.blockId)),
          title: block.name,
          notes,
          objective: block.expected_result_label,
          source_block_library_id: item.blockId,
        } as never)
        .select('id')
        .maybeSingle()
      if (bErr || !sb) return { ok: false, error: bErr?.message ?? 'Insert bloc impossible' }
      const newBlockId = (sb as { id: string }).id

      for (let i = 0; i < block.exercises.length; i += 1) {
        const ex = block.exercises[i]!
        const rx = mapFlatRx(asRx(ex.prescriptions as SessionPrescription[]), unitKeyById)
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
        } as never)
        if (beErr) return { ok: false, error: beErr.message }
      }

      const { error: siErr } = await supabase.from('session_items').insert({
        session_id: programSessionId,
        position: timelinePos,
        kind: 'block',
        program_exercise_id: null,
        session_block_id: newBlockId,
        prescriptions: [],
      } as never)
      if (siErr) return { ok: false, error: siErr.message }

      timelinePos += 1
      blockTablePos += 1
    }
  }

  return { ok: true }
}
