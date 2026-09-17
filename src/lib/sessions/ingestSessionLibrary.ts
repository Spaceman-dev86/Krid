import { restSecondsFromPrescriptions } from '@/src/lib/sessions/constants'
import { loadSessionBlockDetails, formatBlockTimerSummary } from '@/src/lib/sessions/blockDetail'
import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

type RxRow = { unit_id?: string; value?: string; group?: number }

type MappedRx = {
  sets: number | null
  reps: string | null
  rest_time: string | null
  rpe: number | null
  tempo: string | null
  load: string | null
  notes: string | null
}

function asRx(raw: unknown): RxRow[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x) => x && typeof x === 'object') as RxRow[]
}

function mapPrescriptions(
  prescriptions: RxRow[],
  unitKeyById: Map<string, string>,
): MappedRx {
  const groups = new Map<number, Record<string, string>>()
  for (const p of prescriptions) {
    const group = typeof p.group === 'number' && Number.isFinite(p.group) ? p.group : 0
    const uid = String(p.unit_id ?? '').trim()
    const key = unitKeyById.get(uid)
    if (!key) continue
    const val = String(p.value ?? '').trim()
    if (!val) continue
    if (!groups.has(group)) groups.set(group, {})
    groups.get(group)![key] = val
  }

  const byKey = groups.get(0) ?? groups.values().next().value ?? {}
  const setsN = byKey.sets != null ? Number.parseInt(byKey.sets, 10) : NaN
  const rpeN = byKey.rpe != null ? Number.parseFloat(byKey.rpe) : NaN
  const restN = byKey.rest_s != null ? Number.parseInt(byKey.rest_s, 10) : NaN

  const extraGroups: string[] = []
  for (const [g, vals] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    if (g === 0) continue
    const parts = Object.entries(vals).map(([k, v]) => `${k}=${v}`)
    if (parts.length) extraGroups.push(`G${g}: ${parts.join(', ')}`)
  }

  const baseNote = byKey.note ?? null
  const notes = [baseNote, extraGroups.length ? extraGroups.join(' · ') : null]
    .filter(Boolean)
    .join('\n') || null

  return {
    sets: Number.isFinite(setsN) ? setsN : null,
    reps: byKey.reps ?? null,
    rest_time: Number.isFinite(restN) ? `${restN}` : byKey.rest_s ?? null,
    rpe: Number.isFinite(rpeN) ? rpeN : null,
    tempo: byKey.tempo ?? null,
    load: byKey.load_kg ?? null,
    notes,
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

/**
 * Deep-copy figée : session_library_items → session_items / program_exercises / session_blocks / block_exercises.
 * Rest catalogue → appliqué sur le repos de l’item contenu précédent (pas de kind rest côté programme).
 */
export async function ingestSessionLibraryComposition(
  supabase: AdminSupabase,
  args: { librarySessionId: string; programSessionId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { librarySessionId, programSessionId } = args

  const [{ data: itemsRaw }, { data: unitsRaw }] = await Promise.all([
    supabase
      .from('session_library_items' as never)
      .select('id, item_kind, block_id, exercise_id, prescriptions, position')
      .eq('session_id' as never, librarySessionId as never)
      .order('position' as never, { ascending: true }),
    supabase
      .from('units' as never)
      .select('id, key')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null),
  ])

  const items = (itemsRaw ?? []) as {
    id: string
    item_kind: string
    block_id: string | null
    exercise_id: string | null
    prescriptions: unknown
    position: number
  }[]

  if (!items.length) return { ok: true }

  const unitKeyById = new Map(
    ((unitsRaw ?? []) as { id: string; key: string }[]).map((u) => [u.id, u.key]),
  )

  const exoIds = [
    ...new Set(items.filter((i) => i.item_kind === 'exercise' && i.exercise_id).map((i) => i.exercise_id!)),
  ]
  const blockIds = [
    ...new Set(items.filter((i) => i.item_kind === 'block' && i.block_id).map((i) => i.block_id!)),
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
  let lastPeId: string | null = null
  let lastBeId: string | null = null

  async function applyRestToLast(seconds: number) {
    const restText = String(seconds)
    if (lastBeId) {
      await supabase.from('block_exercises').update({ rest_time: restText } as never).eq('id', lastBeId)
      return
    }
    if (lastPeId) {
      await supabase.from('program_exercises').update({ rest_time: restText } as never).eq('id', lastPeId)
    }
  }

  for (const item of items) {
    if (item.item_kind === 'rest') {
      const secs = restSecondsFromPrescriptions(item.prescriptions)
      await applyRestToLast(secs)
      continue
    }

    if (item.item_kind === 'exercise' && item.exercise_id) {
      const rx = mapPrescriptions(asRx(item.prescriptions), unitKeyById)
      const { data: pe, error: peErr } = await supabase
        .from('program_exercises')
        .insert({
          session_id: programSessionId,
          exercise_id: item.exercise_id,
          name: exoNameById.get(item.exercise_id) ?? 'Exercice',
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
      const peId = (pe as { id: string }).id

      const { error: siErr } = await supabase.from('session_items').insert({
        session_id: programSessionId,
        position: timelinePos,
        kind: 'exercise',
        program_exercise_id: peId,
        session_block_id: null,
      } as never)
      if (siErr) return { ok: false, error: siErr.message }

      lastPeId = peId
      lastBeId = null
      timelinePos += 1
      continue
    }

    if (item.item_kind === 'block' && item.block_id) {
      const block = blockById.get(item.block_id)
      if (!block) continue

      const timer = formatBlockTimerSummary(block.timer_note)
      const notes = [block.notes?.trim(), timer].filter(Boolean).join('\n') || null
      const objective = block.expected_result_label?.trim() || null

      const { data: sb, error: bErr } = await supabase
        .from('session_blocks')
        .insert({
          program_session_id: programSessionId,
          position: blockTablePos,
          type: formatKeyToBlockType(formatKeyByBlock.get(item.block_id)),
          title: block.name,
          notes,
          objective,
        } as never)
        .select('id')
        .maybeSingle()

      if (bErr || !sb) return { ok: false, error: bErr?.message ?? 'Insert bloc impossible' }
      const blockId = (sb as { id: string }).id

      lastBeId = null
      for (let i = 0; i < block.exercises.length; i += 1) {
        const ex = block.exercises[i]!
        const rx = mapPrescriptions(ex.prescriptions as RxRow[], unitKeyById)
        const { data: be, error: beErr } = await supabase
          .from('block_exercises')
          .insert({
            session_block_id: blockId,
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
          .select('id')
          .maybeSingle()
        if (beErr || !be) return { ok: false, error: beErr?.message ?? 'Insert exo bloc impossible' }
        lastBeId = (be as { id: string }).id
      }

      const { error: siErr } = await supabase.from('session_items').insert({
        session_id: programSessionId,
        position: timelinePos,
        kind: 'block',
        program_exercise_id: null,
        session_block_id: blockId,
      } as never)
      if (siErr) return { ok: false, error: siErr.message }

      lastPeId = null
      timelinePos += 1
      blockTablePos += 1
    }
  }

  return { ok: true }
}
