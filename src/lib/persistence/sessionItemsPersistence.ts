import { reorderScopedRowsTwoPass } from './reorderUniquePositions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

export async function reorderSessionItemToIndex(
  supabase: SupabaseLike,
  sessionId: string,
  itemId: string,
  insertIndex: number
): Promise<void> {
  const { data: allItemsData, error: itemsError } = await supabase
    .from('session_items')
    .select('id,position')
    .eq('session_id', sessionId)
    .order('position', { ascending: true })

  if (itemsError) throw itemsError

  const allItems = (allItemsData ?? []) as { id: string; position: number }[]
  const currentIds = allItems.map((r) => r.id)
  const without = currentIds.filter((x) => x !== itemId)
  const clampedInsert = Math.max(0, Math.min(without.length, insertIndex))
  const orderedIds = without.slice(0, clampedInsert).concat([itemId]).concat(without.slice(clampedInsert))

  await reorderScopedRowsTwoPass(supabase, {
    table: 'session_items',
    scopeColumn: 'session_id',
    scopeId: sessionId,
    orderColumn: 'position',
    orderedIds,
    finalOrderBase: 0,
  })
}

export async function findSessionItemIdForBlock(
  supabase: SupabaseLike,
  sessionId: string,
  blockId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('session_items')
    .select('id')
    .eq('session_id', sessionId)
    .eq('session_block_id', blockId)
    .eq('kind', 'block')
    .maybeSingle()
  if (error) throw error
  return (data as { id?: string } | null)?.id ?? null
}

export async function findSessionItemIdForExercise(
  supabase: SupabaseLike,
  sessionId: string,
  programExerciseId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('session_items')
    .select('id')
    .eq('session_id', sessionId)
    .eq('program_exercise_id', programExerciseId)
    .eq('kind', 'exercise')
    .maybeSingle()
  if (error) throw error
  return (data as { id?: string } | null)?.id ?? null
}
