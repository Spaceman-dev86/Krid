import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

function newId() {
  return crypto.randomUUID()
}

/**
 * Deep-copie le contenu d’une semaine programme (séances + items + PE + blocs + BE).
 * Préfère RPC transactionnelle ; fallback TS multi-roundtrip si RPC absente.
 */
export async function duplicateProgramWeekContents(
  supabase: AdminSupabase,
  sourceWeekId: string,
  newWeekId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    'duplicate_program_week_contents' as never,
    {
      p_source_week_id: sourceWeekId,
      p_new_week_id: newWeekId,
    } as never,
  )

  if (!rpcErr && rpcData != null) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
    const result = row as { ok?: boolean; error?: string } | null
    if (result?.ok === true) return { ok: true }
    if (result?.ok === false) return { ok: false, error: result.error || 'Duplication échouée' }
  }

  const rpcMissing =
    rpcErr &&
    (rpcErr.message.includes('duplicate_program_week_contents') ||
      rpcErr.code === 'PGRST202' ||
      rpcErr.message.includes('Could not find the function'))

  if (rpcErr && !rpcMissing) {
    return { ok: false, error: rpcErr.message }
  }

  return duplicateProgramWeekContentsTs(supabase, sourceWeekId, newWeekId)
}

async function duplicateProgramWeekContentsTs(
  supabase: AdminSupabase,
  sourceWeekId: string,
  newWeekId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: sessionsRaw, error: sessErr } = await supabase
    .from('sessions')
    .select(
      'id,title,description,session_order,notes,objective_ressenti,objective_note,objective_difficulty',
    )
    .eq('week_id', sourceWeekId)
    .order('session_order', { ascending: true })

  if (sessErr) return { ok: false, error: sessErr.message }

  const sessions = (sessionsRaw ?? []) as {
    id: string
    title: string | null
    description: string | null
    session_order: number
    notes: string | null
    objective_ressenti: boolean
    objective_note: boolean
    objective_difficulty: boolean
  }[]

  if (!sessions.length) return { ok: true }

  const sessionIdMap = new Map<string, string>()
  for (const s of sessions) {
    sessionIdMap.set(s.id, newId())
  }

  const { error: insSessErr } = await supabase.from('sessions').insert(
    sessions.map((s) => ({
      id: sessionIdMap.get(s.id)!,
      week_id: newWeekId,
      title: s.title,
      description: s.description,
      session_order: s.session_order,
      notes: s.notes,
      objective_ressenti: s.objective_ressenti !== false,
      objective_note: s.objective_note !== false,
      objective_difficulty: s.objective_difficulty !== false,
    })) as never,
  )
  if (insSessErr) return { ok: false, error: insSessErr.message }

  const sourceSessionIds = sessions.map((s) => s.id)

  const { data: itemsRaw, error: itemsErr } = await supabase
    .from('session_items')
    .select('id,session_id,position,kind,program_exercise_id,session_block_id,prescriptions')
    .in('session_id', sourceSessionIds)
    .order('position', { ascending: true })
  if (itemsErr) return { ok: false, error: itemsErr.message }

  const items = (itemsRaw ?? []) as {
    id: string
    session_id: string
    position: number
    kind: string
    program_exercise_id: string | null
    session_block_id: string | null
    prescriptions: unknown
  }[]

  const peIds = [
    ...new Set(items.filter((i) => i.program_exercise_id).map((i) => i.program_exercise_id!)),
  ]
  const sbIds = [
    ...new Set(items.filter((i) => i.session_block_id).map((i) => i.session_block_id!)),
  ]

  const peIdMap = new Map<string, string>()
  const sbIdMap = new Map<string, string>()
  for (const id of peIds) peIdMap.set(id, newId())
  for (const id of sbIds) sbIdMap.set(id, newId())

  if (sbIds.length) {
    const { data: blocksRaw, error: bErr } = await supabase
      .from('session_blocks')
      .select(
        'id,program_session_id,position,type,title,notes,objective,source_block_library_id,timer_note,sport_id,expected_result_unit_id',
      )
      .in('id', sbIds)
    if (bErr) return { ok: false, error: bErr.message }

    const blocks = (blocksRaw ?? []) as {
      id: string
      program_session_id: string
      position: number
      type: string | null
      title: string | null
      notes: string | null
      objective: string | null
      source_block_library_id: string | null
      timer_note: string | null
      sport_id: string | null
      expected_result_unit_id: string | null
    }[]

    const { error: insBErr } = await supabase.from('session_blocks').insert(
      blocks.map((b) => ({
        id: sbIdMap.get(b.id)!,
        program_session_id: sessionIdMap.get(b.program_session_id)!,
        position: b.position,
        type: b.type,
        title: b.title,
        notes: b.notes,
        objective: b.objective,
        source_block_library_id: b.source_block_library_id,
        timer_note: b.timer_note,
        sport_id: b.sport_id,
        expected_result_unit_id: b.expected_result_unit_id,
      })) as never,
    )
    if (insBErr) return { ok: false, error: insBErr.message }

    const { data: beRaw, error: beErr } = await supabase
      .from('block_exercises')
      .select(
        'session_block_id,position,exercise_id,exercise_name,sets,reps,rest_time,load,rpe,notes,prescriptions',
      )
      .in('session_block_id', sbIds)
      .order('position', { ascending: true })
    if (beErr) return { ok: false, error: beErr.message }

    const bes = (beRaw ?? []) as {
      session_block_id: string
      position: number
      exercise_id: string | null
      exercise_name: string | null
      sets: number | null
      reps: string | null
      rest_time: string | null
      load: string | null
      rpe: number | null
      notes: string | null
      prescriptions: unknown
    }[]
    if (bes.length) {
      const { error: insBeErr } = await supabase.from('block_exercises').insert(
        bes.map((be) => ({
          id: newId(),
          session_block_id: sbIdMap.get(be.session_block_id)!,
          position: be.position,
          exercise_id: be.exercise_id,
          exercise_name: be.exercise_name,
          sets: be.sets,
          reps: be.reps,
          rest_time: be.rest_time,
          load: be.load,
          rpe: be.rpe,
          notes: be.notes,
          prescriptions: Array.isArray(be.prescriptions) ? be.prescriptions : [],
        })) as never,
      )
      if (insBeErr) return { ok: false, error: insBeErr.message }
    }
  }

  if (peIds.length) {
    const { data: peRaw, error: peErr } = await supabase
      .from('program_exercises')
      .select(
        'id,session_id,exercise_id,name,exercise_order,sets,reps,rest_time,rpe,tempo,load,notes',
      )
      .in('id', peIds)
    if (peErr) return { ok: false, error: peErr.message }

    const pes = (peRaw ?? []) as {
      id: string
      session_id: string
      exercise_id: string | null
      name: string | null
      exercise_order: number
      sets: number | null
      reps: string | null
      rest_time: string | null
      rpe: number | null
      tempo: string | null
      load: string | null
      notes: string | null
    }[]

    const { error: insPeErr } = await supabase.from('program_exercises').insert(
      pes.map((pe) => ({
        id: peIdMap.get(pe.id)!,
        session_id: sessionIdMap.get(pe.session_id)!,
        exercise_id: pe.exercise_id,
        name: pe.name,
        exercise_order: pe.exercise_order,
        sets: pe.sets,
        reps: pe.reps,
        rest_time: pe.rest_time,
        rpe: pe.rpe,
        tempo: pe.tempo,
        load: pe.load,
        notes: pe.notes,
      })) as never,
    )
    if (insPeErr) return { ok: false, error: insPeErr.message }
  }

  if (items.length) {
    const { error: insItemsErr } = await supabase.from('session_items').insert(
      items.map((it) => ({
        id: newId(),
        session_id: sessionIdMap.get(it.session_id)!,
        position: it.position,
        kind: it.kind,
        program_exercise_id: it.program_exercise_id
          ? peIdMap.get(it.program_exercise_id) ?? null
          : null,
        session_block_id: it.session_block_id
          ? sbIdMap.get(it.session_block_id) ?? null
          : null,
        prescriptions: it.prescriptions ?? [],
      })) as never,
    )
    if (insItemsErr) return { ok: false, error: insItemsErr.message }
  }

  return { ok: true }
}
