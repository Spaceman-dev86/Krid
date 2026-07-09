// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

export type ReorderScopedRowsOptions = {
  table: string
  scopeColumn: string
  scopeId: string
  orderColumn: string
  orderedIds: string[]
  /** First final index (0 for position, 1 for week_order / session_order). */
  finalOrderBase?: number
  rowIdColumn?: string
}

/**
 * Reorder rows under a scoped unique (scopeColumn, orderColumn) constraint without collisions.
 * Pass 1: temporary unique order values; pass 2: final sequential values.
 */
export async function reorderScopedRowsTwoPass(
  supabase: SupabaseLike,
  options: ReorderScopedRowsOptions
): Promise<void> {
  const {
    table,
    scopeColumn,
    scopeId,
    orderColumn,
    orderedIds,
    finalOrderBase = 0,
    rowIdColumn = 'id',
  } = options

  if (orderedIds.length === 0) return

  const { data: minRow, error: minErr } = await supabase
    .from(table)
    .select(orderColumn)
    .eq(scopeColumn, scopeId)
    .order(orderColumn, { ascending: true })
    .limit(1)
    .maybeSingle()

  if (minErr) throw minErr

  const rawMin = (minRow as Record<string, unknown> | null)?.[orderColumn]
  const minOrder = typeof rawMin === 'number' && Number.isFinite(rawMin) ? rawMin : 0
  const tmpBase = minOrder - orderedIds.length - 10

  for (let idx = 0; idx < orderedIds.length; idx += 1) {
    const rowId = orderedIds[idx]!
    const { error } = await supabase
      .from(table)
      .update({ [orderColumn]: tmpBase + idx })
      .eq(rowIdColumn, rowId)
      .eq(scopeColumn, scopeId)
    if (error) throw error
  }

  for (let idx = 0; idx < orderedIds.length; idx += 1) {
    const rowId = orderedIds[idx]!
    const { error } = await supabase
      .from(table)
      .update({ [orderColumn]: finalOrderBase + idx })
      .eq(rowIdColumn, rowId)
      .eq(scopeColumn, scopeId)
    if (error) throw error
  }
}
