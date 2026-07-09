import { blockKindToDbType } from '../../domain/program-editor/blockDbTypes'
import {
  findSessionItemIdForBlock,
  findSessionItemIdForExercise,
  reorderSessionItemToIndex,
} from './sessionItemsPersistence'
import { nextSessionBlockPosition } from './sessionOrderPersistence'
import type {
  BlockDuplicateSnapshot,
  SessionDuplicateSnapshot,
  WeekDuplicateSnapshot,
} from '../../persistence/buildDuplicateContext'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

async function shiftSessionItems(supabase: SupabaseLike, sessionId: string, fromPosition: number) {
  const { data, error } = await supabase
    .from('session_items')
    .select('id,position')
    .eq('session_id', sessionId)
    .gte('position', fromPosition)
    .order('position', { ascending: false })
  if (error) throw error
  for (const row of data ?? []) {
    const { error: updErr } = await supabase
      .from('session_items')
      .update({ position: Number(row.position) + 1 })
      .eq('id', row.id)
    if (updErr) throw updErr
  }
}

export async function persistSessionDuplicateSnapshot(
  supabase: SupabaseLike,
  snapshot: SessionDuplicateSnapshot,
  ensureServerId: (id: string) => string,
  options?: { sessionOrder?: number }
): Promise<void> {
  const sessionId = ensureServerId(snapshot.session.id)
  const weekId = ensureServerId(snapshot.session.weekId)

  let nextOrder = options?.sessionOrder
  if (nextOrder == null) {
    const { data: maxRow, error: maxErr } = await supabase
      .from('sessions')
      .select('session_order')
      .eq('week_id', weekId)
      .order('session_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (maxErr) throw maxErr
    nextOrder = (maxRow?.session_order ?? 0) + 1
  }

  const { error: sessErr } = await supabase.from('sessions').insert({
    id: sessionId,
    week_id: weekId,
    title: snapshot.session.title,
    description: snapshot.session.description,
    session_order: nextOrder,
  })
  if (sessErr) throw sessErr

  for (let position = 0; position < snapshot.timelineItems.length; position += 1) {
    const item = snapshot.timelineItems[position]
    const timelineItemId = ensureServerId(item.id)

    if (item.kind === 'block' && item.sessionBlockId) {
      const block = snapshot.sessionBlocks.find((b) => b.id === item.sessionBlockId)
      if (!block) continue

      const blockId = ensureServerId(block.id)
      const { error: bErr } = await supabase.from('session_blocks').insert({
        id: blockId,
        program_session_id: sessionId,
        position,
        type: blockKindToDbType(block.blockKind ?? undefined),
        title: block.title,
        notes: block.notes,
      })
      if (bErr) throw bErr

      for (let i = 0; i < block.blockExerciseIds.length; i += 1) {
        const beId = block.blockExerciseIds[i]
        const be = snapshot.blockExercises.find((r) => r.id === beId)
        if (!be) continue
        const serverBeId = ensureServerId(be.id)
        const { error: beErr } = await supabase.from('block_exercises').insert({
          id: serverBeId,
          session_block_id: blockId,
          position: i,
          exercise_id: null,
          exercise_name: be.exerciseName,
          notes: be.notes,
        })
        if (beErr) throw beErr
      }

      const { error: siErr } = await supabase.from('session_items').insert({
        id: timelineItemId,
        session_id: sessionId,
        position,
        kind: 'block',
        program_exercise_id: null,
        session_block_id: blockId,
      })
      if (siErr) throw siErr
      continue
    }

    if (item.kind === 'exercise' && item.programExerciseId) {
      const pe = snapshot.programExercises.find((p) => p.id === item.programExerciseId)
      if (!pe) continue
      const peId = ensureServerId(pe.id)

      const { error: peErr } = await supabase.from('program_exercises').insert({
        id: peId,
        session_id: sessionId,
        exercise_id: pe.libraryExerciseId,
        name: pe.subtitle ?? 'Exercice',
        description: null,
        sets: pe.sets,
        reps: pe.reps,
        rest_time: pe.restTime,
        tempo: pe.tempo,
        load: pe.load,
        notes: pe.notes,
        video_url: null,
        exercise_order: position,
      })
      if (peErr) throw peErr

      const { error: siErr } = await supabase.from('session_items').insert({
        id: timelineItemId,
        session_id: sessionId,
        position,
        kind: 'exercise',
        program_exercise_id: peId,
        session_block_id: null,
      })
      if (siErr) throw siErr
    }
  }
}

export async function persistWeekDuplicateSnapshot(
  supabase: SupabaseLike,
  programId: string,
  snapshot: WeekDuplicateSnapshot,
  ensureServerId: (id: string) => string
): Promise<void> {
  const weekId = ensureServerId(snapshot.week.id)

  const { data: maxRow, error: maxErr } = await supabase
    .from('program_weeks')
    .select('week_order')
    .eq('program_id', programId)
    .order('week_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (maxErr) throw maxErr
  const nextOrder = ((maxRow as { week_order?: number } | null)?.week_order ?? 0) + 1

  const { error: weekErr } = await supabase.from('program_weeks').insert({
    id: weekId,
    program_id: programId,
    title: snapshot.week.title,
    notes: snapshot.week.notes,
    week_order: nextOrder,
  })
  if (weekErr) throw weekErr

  for (let i = 0; i < snapshot.sessions.length; i += 1) {
    await persistSessionDuplicateSnapshot(supabase, snapshot.sessions[i], ensureServerId, {
      sessionOrder: i + 1,
    })
  }
}

export async function persistBlockDuplicateSnapshot(
  supabase: SupabaseLike,
  sourceTimelineItemId: string,
  snapshot: BlockDuplicateSnapshot,
  idRemap: Record<string, string>,
  ensureServerId: (id: string) => string
): Promise<void> {
  const sourceId = ensureServerId(sourceTimelineItemId)
  const sessionId = ensureServerId(snapshot.timelineItem.sessionId)
  const blockId = ensureServerId(snapshot.block.id)

  const { data: sourceItem, error: readErr } = await supabase
    .from('session_items')
    .select('session_id,position')
    .eq('id', sourceId)
    .maybeSingle()
  if (readErr) throw readErr
  if (!sourceItem) throw new Error('Source block timeline item not found')

  const insertPos = Number(sourceItem.position) + 1
  const blockPosition = await nextSessionBlockPosition(supabase, sessionId)

  const { error: bErr } = await supabase.from('session_blocks').insert({
    id: blockId,
    program_session_id: sessionId,
    position: blockPosition,
    type: blockKindToDbType(snapshot.block.blockKind ?? undefined),
    title: snapshot.block.title,
    notes: snapshot.block.notes,
  })
  if (bErr) throw bErr

  for (let i = 0; i < snapshot.block.blockExerciseIds.length; i += 1) {
    const beId = snapshot.block.blockExerciseIds[i]
    const be = snapshot.blockExercises.find((r) => r.id === beId)
    if (!be) continue
    const serverBeId = ensureServerId(be.id)
    const { error: beErr } = await supabase.from('block_exercises').insert({
      id: serverBeId,
      session_block_id: blockId,
      position: i,
      exercise_id: null,
      exercise_name: be.exerciseName,
      notes: be.notes,
    })
    if (beErr) throw beErr
  }

  const { error: appendErr } = await supabase.rpc('append_session_item_block', {
    p_session_id: sessionId,
    p_session_block_id: blockId,
  })
  if (appendErr) throw appendErr

  const sessionItemId = await findSessionItemIdForBlock(supabase, sessionId, blockId)
  if (!sessionItemId) throw new Error('session_item not created after duplicate block')

  idRemap[snapshot.timelineItem.id] = sessionItemId
  await reorderSessionItemToIndex(supabase, sessionId, sessionItemId, insertPos)
}

export async function persistTimelineExerciseDuplicate(
  supabase: SupabaseLike,
  sourceTimelineItemId: string,
  newTimelineItemId: string,
  newProgramExerciseId: string,
  idRemap: Record<string, string>,
  ensureServerId: (id: string) => string
): Promise<void> {
  const sourceId = ensureServerId(sourceTimelineItemId)
  const newItemId = ensureServerId(newTimelineItemId)
  const newPeId = ensureServerId(newProgramExerciseId)

  const { data: sourceItem, error: readErr } = await supabase
    .from('session_items')
    .select('session_id,position,program_exercise_id')
    .eq('id', sourceId)
    .maybeSingle()
  if (readErr) throw readErr
  const row = sourceItem as {
    session_id: string
    position: number
    program_exercise_id: string | null
  } | null
  if (!row?.program_exercise_id) throw new Error('Source exercise timeline item not found')

  const { data: sourcePe, error: peReadErr } = await supabase
    .from('program_exercises')
    .select('session_id,exercise_id,name,sets,reps,rest_time,tempo,load,notes')
    .eq('id', row.program_exercise_id)
    .maybeSingle()
  if (peReadErr) throw peReadErr
  if (!sourcePe) throw new Error('Source program exercise not found')

  const insertPos = Number(row.position) + 1
  const pe = sourcePe as Record<string, unknown>

  const { error: peErr } = await supabase.from('program_exercises').insert({
    id: newPeId,
    session_id: row.session_id,
    exercise_id: pe.exercise_id,
    name: pe.name ?? 'Exercice',
    sets: pe.sets,
    reps: pe.reps,
    rest_time: pe.rest_time,
    tempo: pe.tempo,
    load: pe.load,
    notes: pe.notes,
    exercise_order: insertPos,
  })
  if (peErr) throw peErr

  const { error: appendErr } = await supabase.rpc('append_session_item_exercise', {
    p_session_id: row.session_id,
    p_program_exercise_id: newPeId,
  })
  if (appendErr) throw appendErr

  const sessionItemId = await findSessionItemIdForExercise(supabase, row.session_id, newPeId)
  if (!sessionItemId) throw new Error('session_item not created after duplicate exercise')

  idRemap[newTimelineItemId] = sessionItemId
  idRemap[newProgramExerciseId] = newPeId
  await reorderSessionItemToIndex(supabase, row.session_id, sessionItemId, insertPos)
}

