import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { reorderScopedRowsTwoPass } from './reorderUniquePositions'

type UpdateCall = {
  table: string
  patch: Record<string, number>
  filters: Record<string, string>
}

function createMockSupabase(orderColumn: string, minOrder: number | null) {
  const updates: UpdateCall[] = []

  function buildUpdateChain(table: string, patch: Record<string, number>) {
    const filters: Record<string, string> = {}
    let eqCount = 0
    const chain = {
      eq: (col: string, val: string) => {
        filters[col] = val
        eqCount += 1
        if (eqCount === 2) {
          updates.push({ table, patch, filters: { ...filters } })
          return Promise.resolve({ error: null })
        }
        return chain
      },
    }
    return chain
  }

  return {
    supabase: {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: minOrder == null ? null : { [orderColumn]: minOrder },
                  error: null,
                }),
              }),
            }),
          }),
        }),
        update: (patch: Record<string, number>) => buildUpdateChain(table, patch),
      }),
    },
    updates,
  }
}

describe('reorderScopedRowsTwoPass', () => {
  it('runs two update passes with final positions 0..n-1', async () => {
    const { supabase, updates } = createMockSupabase('position', 0)
    const orderedIds = ['item-a', 'item-b', 'item-c']

    await reorderScopedRowsTwoPass(supabase, {
      table: 'session_items',
      scopeColumn: 'session_id',
      scopeId: 'session-1',
      orderColumn: 'position',
      orderedIds,
      finalOrderBase: 0,
    })

    assert.equal(updates.length, 6)

    const byId = (id: string) => updates.filter((u) => u.filters.id === id).map((u) => u.patch.position)
    assert.deepEqual(byId('item-a'), [-13, 0])
    assert.deepEqual(byId('item-b'), [-12, 1])
    assert.deepEqual(byId('item-c'), [-11, 2])
  })

  it('uses finalOrderBase 1 for session_order', async () => {
    const { supabase, updates } = createMockSupabase('session_order', 1)
    const orderedIds = ['s1', 's2']

    await reorderScopedRowsTwoPass(supabase, {
      table: 'sessions',
      scopeColumn: 'week_id',
      scopeId: 'week-1',
      orderColumn: 'session_order',
      orderedIds,
      finalOrderBase: 1,
    })

    assert.equal(updates.length, 4)
    const finals = updates
      .filter((u) => typeof u.patch.session_order === 'number' && u.patch.session_order >= 1)
      .map((u) => u.patch.session_order)
    assert.deepEqual(finals, [1, 2])
  })

  it('no-ops on empty orderedIds', async () => {
    const { supabase, updates } = createMockSupabase('position', 0)

    await reorderScopedRowsTwoPass(supabase, {
      table: 'session_items',
      scopeColumn: 'session_id',
      scopeId: 'session-1',
      orderColumn: 'position',
      orderedIds: [],
    })

    assert.equal(updates.length, 0)
  })
})
