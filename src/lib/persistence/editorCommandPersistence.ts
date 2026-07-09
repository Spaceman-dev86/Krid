import { blockKindToDbType, resolveLibraryExerciseForDbAsync } from '../../domain/program-editor/blockDbTypes'
import { nextSessionBlockPosition } from './sessionOrderPersistence'
import { libraryExerciseName } from '../../domain/program-editor/devExerciseLibrary'
import type { MinimalCommand } from '../../domain/program-editor'
import {
  findSessionItemIdForBlock,
  findSessionItemIdForExercise,
  reorderSessionItemToIndex,
} from './sessionItemsPersistence'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

function persistenceErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return 'Persistence error.'
}

export { persistenceErrorMessage }

export async function persistTimelineExerciseAdd(
  supabase: SupabaseLike,
  cmd: Extract<MinimalCommand, { type: 'timeline.exercise.add' }>,
  idRemap: Record<string, string>,
  ensureServerId: (id: string) => string
): Promise<void> {
  const sessionId = ensureServerId(cmd.sessionId)
  const insertIndex = cmd.insertIndex ?? 0
  const resolved = await resolveLibraryExerciseForDbAsync(supabase, cmd.libraryExerciseId)

  let programExerciseId: string

  if (resolved.exercise_id) {
    const { data: rpcId, error: rpcErr } = await supabase.rpc('insert_program_exercise', {
      p_session_id: sessionId,
      p_exercise_id: resolved.exercise_id,
    })
    if (rpcErr) throw rpcErr
    if (!rpcId) throw new Error('insert_program_exercise returned no id')
    programExerciseId = String(rpcId)
    idRemap[cmd.programExerciseId] = programExerciseId
  } else {
    programExerciseId = ensureServerId(cmd.programExerciseId)
    const name = libraryExerciseName(cmd.libraryExerciseId) ?? resolved.exercise_name
    const { error: peErr } = await supabase.from('program_exercises').insert({
      id: programExerciseId,
      session_id: sessionId,
      exercise_id: null,
      name,
      sets: null,
      reps: null,
      rest_time: null,
      tempo: null,
      load: null,
      notes: null,
      exercise_order: insertIndex,
    })
    if (peErr) throw peErr
  }

  const { error: appendErr } = await supabase.rpc('append_session_item_exercise', {
    p_session_id: sessionId,
    p_program_exercise_id: programExerciseId,
  })
  if (appendErr) throw appendErr

  const sessionItemId = await findSessionItemIdForExercise(supabase, sessionId, programExerciseId)
  if (!sessionItemId) throw new Error('session_item not created after append_session_item_exercise')

  idRemap[cmd.timelineItemId] = sessionItemId
  await reorderSessionItemToIndex(supabase, sessionId, sessionItemId, insertIndex)
}

export async function persistTimelineBlockAdd(
  supabase: SupabaseLike,
  cmd: Extract<MinimalCommand, { type: 'timeline.block.add' }>,
  idRemap: Record<string, string>,
  ensureServerId: (id: string) => string
): Promise<void> {
  const sessionId = ensureServerId(cmd.sessionId)
  const blockId = ensureServerId(cmd.blockId)
  const insertIndex = cmd.insertIndex ?? 0
  const blockType = blockKindToDbType(cmd.blockKind)

  const blockPosition = await nextSessionBlockPosition(supabase, sessionId)

  const { error: bErr } = await supabase.from('session_blocks').insert({
    id: blockId,
    program_session_id: sessionId,
    position: blockPosition,
    type: blockType,
    title: cmd.title ?? null,
    notes: cmd.notes ?? null,
  })
  if (bErr) throw bErr

  for (let i = 0; i < (cmd.initialBlockExercises?.length ?? 0); i += 1) {
    const row = cmd.initialBlockExercises?.[i]
    if (!row) continue
    const resolvedBe = await resolveLibraryExerciseForDbAsync(supabase, row.libraryExerciseId)
    const beId = ensureServerId(row.blockExerciseId)
    const { error: beErr } = await supabase.from('block_exercises').insert({
      id: beId,
      session_block_id: blockId,
      position: i,
      exercise_id: resolvedBe.exercise_id,
      exercise_name: resolvedBe.exercise_name,
      notes: null,
    })
    if (beErr) throw beErr
  }

  const { error: appendErr } = await supabase.rpc('append_session_item_block', {
    p_session_id: sessionId,
    p_session_block_id: blockId,
  })
  if (appendErr) throw appendErr

  const sessionItemId = await findSessionItemIdForBlock(supabase, sessionId, blockId)
  if (!sessionItemId) throw new Error('session_item not created after append_session_item_block')

  idRemap[cmd.timelineItemId] = sessionItemId
  await reorderSessionItemToIndex(supabase, sessionId, sessionItemId, insertIndex)
}
