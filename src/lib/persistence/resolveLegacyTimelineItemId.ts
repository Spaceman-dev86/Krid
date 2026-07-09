import { findSessionItemIdForBlock, findSessionItemIdForExercise } from './sessionItemsPersistence'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

const LEGACY_EXERCISE_PREFIX = 'legacy-ex-'

/**
 * Maps V1 synthetic timeline ids to real session_items rows (lazy migration).
 * Returns the server session_item id and optionally records a client id remap.
 */
export async function resolveTimelineItemIdForPersistence(
  supabase: SupabaseLike,
  sessionId: string,
  timelineItemId: string,
  idRemap: Record<string, string>
): Promise<string> {
  if (timelineItemId.startsWith(LEGACY_EXERCISE_PREFIX)) {
    const programExerciseId = timelineItemId.slice(LEGACY_EXERCISE_PREFIX.length)
    let sessionItemId = await findSessionItemIdForExercise(supabase, sessionId, programExerciseId)
    if (!sessionItemId) {
      const { error } = await supabase.rpc('append_session_item_exercise', {
        p_session_id: sessionId,
        p_program_exercise_id: programExerciseId,
      })
      if (error) throw error
      sessionItemId = await findSessionItemIdForExercise(supabase, sessionId, programExerciseId)
    }
    if (sessionItemId) {
      idRemap[timelineItemId] = sessionItemId
      return sessionItemId
    }
  }

  const { data: existingById, error: existingErr } = await supabase
    .from('session_items')
    .select('id')
    .eq('id', timelineItemId)
    .maybeSingle()
  if (existingErr) throw existingErr
  if (existingById?.id) return String(existingById.id)

  const { data: blockRow, error: blockErr } = await supabase
    .from('session_blocks')
    .select('id')
    .eq('id', timelineItemId)
    .maybeSingle()
  if (blockErr) throw blockErr

  if (blockRow?.id) {
    let sessionItemId = await findSessionItemIdForBlock(supabase, sessionId, timelineItemId)
    if (!sessionItemId) {
      const { error } = await supabase.rpc('append_session_item_block', {
        p_session_id: sessionId,
        p_session_block_id: timelineItemId,
      })
      if (error) throw error
      sessionItemId = await findSessionItemIdForBlock(supabase, sessionId, timelineItemId)
    }
    if (sessionItemId) {
      idRemap[timelineItemId] = sessionItemId
      return sessionItemId
    }
  }

  return timelineItemId
}
