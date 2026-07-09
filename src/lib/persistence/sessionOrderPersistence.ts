// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

/** Make room for a new session at `insertOrder` within a week (unique on week_id + session_order). */
export async function shiftWeekSessionOrdersForInsert(
  supabase: SupabaseLike,
  weekId: string,
  insertOrder: number
): Promise<void> {
  const { data: allSessionsData, error: readErr } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })
  if (readErr) throw readErr

  const allSessions = (allSessionsData ?? []) as { id: string; session_order: number | null }[]
  const toShift = allSessions.filter((s) => (s.session_order ?? 0) >= insertOrder)
  if (!toShift.length) return

  const tmpBase = 100_000
  for (let idx = 0; idx < toShift.length; idx += 1) {
    const row = toShift[idx]!
    const { error } = await supabase
      .from('sessions')
      .update({ session_order: tmpBase + idx })
      .eq('id', row.id)
    if (error) throw error
  }

  for (let idx = 0; idx < toShift.length; idx += 1) {
    const row = toShift[idx]!
    const original =
      typeof row.session_order === 'number' && Number.isFinite(row.session_order)
        ? row.session_order
        : insertOrder
    const { error } = await supabase
      .from('sessions')
      .update({ session_order: original + 1 })
      .eq('id', row.id)
    if (error) throw error
  }
}

/** Next free `session_blocks.position` for a session (unique on program_session_id + position). */
export async function nextSessionBlockPosition(supabase: SupabaseLike, sessionId: string): Promise<number> {
  const { data: maxRow, error } = await supabase
    .from('session_blocks')
    .select('position')
    .eq('program_session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  const maxPos = maxRow?.position
  return (typeof maxPos === 'number' && Number.isFinite(maxPos) ? maxPos : -1) + 1
}
