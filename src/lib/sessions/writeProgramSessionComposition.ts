import type { CompositionSlotInput } from '@/src/lib/sessions/parseSessionCompositionForm'
import {
  buildCompositionRpcPayload,
  snapshotProgramSessionBlocks,
  type CompositionRpcPayload,
} from '@/src/lib/sessions/materializeProgramSessionSlots'
import { restPrescriptionsPayload } from '@/src/lib/sessions/constants'
import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

async function applyPayloadTs(
  supabase: AdminSupabase,
  programSessionId: string,
  payload: CompositionRpcPayload,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  await supabase.from('session_items').delete().eq('session_id', programSessionId)
  await supabase.from('program_exercises').delete().eq('session_id', programSessionId)
  await supabase.from('session_blocks').delete().eq('program_session_id', programSessionId)

  let timelinePos = 0
  let blockTablePos = 0

  for (const item of payload.items) {
    if (item.kind === 'rest') {
      const { error: siErr } = await supabase.from('session_items').insert({
        session_id: programSessionId,
        position: timelinePos,
        kind: 'rest',
        program_exercise_id: null,
        session_block_id: null,
        prescriptions: restPrescriptionsPayload(item.rest_seconds),
      } as never)
      if (siErr) return { ok: false, error: siErr.message }
      timelinePos += 1
      continue
    }

    if (item.kind === 'exercise') {
      const { data: pe, error: peErr } = await supabase
        .from('program_exercises')
        .insert({
          session_id: programSessionId,
          exercise_id: item.exercise_id,
          name: item.name,
          exercise_order: timelinePos,
          sets: item.flat.sets,
          reps: item.flat.reps,
          rest_time: item.flat.rest_time,
          rpe: item.flat.rpe,
          tempo: item.flat.tempo,
          load: item.flat.load,
          notes: item.flat.notes,
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

    if (item.kind === 'block') {
      const { data: sb, error: bErr } = await supabase
        .from('session_blocks')
        .insert({
          program_session_id: programSessionId,
          position: blockTablePos,
          type: item.type,
          title: item.title,
          notes: item.notes,
          objective: item.objective,
          source_block_library_id: item.source_block_library_id,
          timer_note: item.timer_note ?? null,
          sport_id: item.sport_id ?? null,
          expected_result_unit_id: item.expected_result_unit_id ?? null,
        } as never)
        .select('id')
        .maybeSingle()
      if (bErr || !sb) return { ok: false, error: bErr?.message ?? 'Insert bloc impossible' }
      const newBlockId = (sb as { id: string }).id

      for (const ex of item.exercises) {
        const { error: beErr } = await supabase.from('block_exercises').insert({
          session_block_id: newBlockId,
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          position: ex.position,
          sets: ex.flat.sets,
          reps: ex.flat.reps,
          rest_time: ex.flat.rest_time,
          load: ex.flat.load,
          rpe: ex.flat.rpe,
          notes: ex.flat.notes,
          prescriptions: ex.prescriptions ?? [],
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

  const nextVersion = (payload.expected_version ?? 0) + 1
  await supabase
    .from('sessions')
    .update({
      composition_version: nextVersion,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programSessionId)

  return { ok: true, version: nextVersion }
}

/**
 * Remplace toute la composition d’une séance programme.
 * Préfère RPC transactionnelle ; fallback TS si RPC absente.
 * Orphelins traités à leur position dans les slots (pas append fin).
 */
export async function writeProgramSessionComposition(
  supabase: AdminSupabase,
  programSessionId: string,
  rawSlots: CompositionSlotInput[],
  opts?: { expectedVersion?: number | null },
): Promise<
  | { ok: true; version?: number }
  | { ok: false; error: string; stale?: boolean; version?: number }
> {
  const programBlockSnapshots = await snapshotProgramSessionBlocks(
    supabase,
    programSessionId,
  )

  let expectedVersion = opts?.expectedVersion ?? null
  if (expectedVersion == null) {
    const { data: sess } = await supabase
      .from('sessions')
      .select('composition_version')
      .eq('id', programSessionId)
      .maybeSingle()
    expectedVersion =
      (sess as { composition_version?: number } | null)?.composition_version ?? 0
  }

  const built = await buildCompositionRpcPayload(supabase, rawSlots, {
    programBlockSnapshots,
    expectedVersion,
  })
  if (!built.ok) return built

  // RPC refuse items=[] — wipe vide via fallback TS (avec check de version).
  if (built.payload.items.length === 0) {
    if (expectedVersion != null) {
      const { data: sess } = await supabase
        .from('sessions')
        .select('composition_version')
        .eq('id', programSessionId)
        .maybeSingle()
      const cur = (sess as { composition_version?: number } | null)?.composition_version
      if (typeof cur === 'number' && cur !== expectedVersion) {
        return {
          ok: false,
          error: 'Composition modifiée ailleurs — recharge la page',
          stale: true,
          version: cur,
        }
      }
    }
    return applyPayloadTs(supabase, programSessionId, built.payload)
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    'replace_program_session_composition' as never,
    {
      p_session_id: programSessionId,
      p_payload: built.payload as never,
    } as never,
  )

  if (!rpcErr && rpcData != null) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
    const result = row as { ok?: boolean; error?: string; stale?: boolean; version?: number } | null
    if (result?.stale) {
      return {
        ok: false,
        error: result.error || 'Composition obsolète',
        stale: true,
        version: result.version,
      }
    }
    if (result?.ok === false) return { ok: false, error: result.error || 'Replace RPC failed' }
    if (result?.ok === true) return { ok: true, version: result.version }
  }

  // Fallback si RPC absente / erreur schema cache
  const rpcMissing =
    rpcErr &&
    (rpcErr.message.includes('replace_program_session_composition') ||
      rpcErr.code === 'PGRST202' ||
      rpcErr.message.includes('Could not find the function'))

  if (rpcErr && !rpcMissing) {
    // Stale check client-side if column exists
    if (opts?.expectedVersion != null) {
      const { data: sess } = await supabase
        .from('sessions')
        .select('composition_version')
        .eq('id', programSessionId)
        .maybeSingle()
      const cur = (sess as { composition_version?: number } | null)?.composition_version
      if (typeof cur === 'number' && cur !== opts.expectedVersion) {
        return {
          ok: false,
          error: 'Composition modifiée ailleurs — recharge la page',
          stale: true,
          version: cur,
        }
      }
    }
  }

  return applyPayloadTs(supabase, programSessionId, built.payload)
}
