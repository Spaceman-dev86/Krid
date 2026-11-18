import type { BilanInstanceRow } from './bilans'
import { canRelaunchBilan } from './relance'

export type BilanHubClientRow = {
  kind: 'client'
  instance: BilanInstanceRow
}

export type BilanHubGroupRow = {
  kind: 'group'
  batchId: string
  groupId: string | null
  groupName: string
  title: string
  appears_at: string
  instances: BilanInstanceRow[]
  pendingCount: number
  submittedCount: number
  unreadCount: number
}

export type BilanHubRow = BilanHubClientRow | BilanHubGroupRow

/**
 * 1 ligne hub par envoi groupe (batch avec source_group_id),
 * sinon 1 ligne par instance individuelle.
 */
export function buildBilanHubRows(
  instances: BilanInstanceRow[],
  groupNameById: Map<string, string>
): BilanHubRow[] {
  const byBatch = new Map<string, BilanInstanceRow[]>()
  const singles: BilanInstanceRow[] = []

  for (const inst of instances) {
    if (inst.batch_id && inst.source_group_id) {
      const list = byBatch.get(inst.batch_id) ?? []
      list.push(inst)
      byBatch.set(inst.batch_id, list)
    } else {
      singles.push(inst)
    }
  }

  const rows: BilanHubRow[] = []

  for (const [batchId, list] of byBatch) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const lead = sorted[0]
    const groupIds = [
      ...new Set(sorted.map((i) => i.source_group_id).filter(Boolean) as string[]),
    ]
    const groupId = groupIds[0] ?? null
    const groupName =
      groupIds.length > 1
        ? `${groupIds.length} groupes`
        : groupId
          ? groupNameById.get(groupId) || 'Groupe'
          : 'Groupe'

    rows.push({
      kind: 'group',
      batchId,
      groupId,
      groupName,
      title: lead.title,
      appears_at: lead.appears_at,
      instances: sorted,
      pendingCount: sorted.filter((i) => canRelaunchBilan(i.status)).length,
      submittedCount: sorted.filter((i) => i.status === 'submitted').length,
      unreadCount: sorted.filter((i) => i.status === 'submitted' && !i.coach_read_at).length,
    })
  }

  for (const inst of singles) {
    rows.push({ kind: 'client', instance: inst })
  }

  rows.sort((a, b) => {
    const da =
      a.kind === 'group'
        ? new Date(a.appears_at).getTime()
        : new Date(a.instance.created_at).getTime()
    const db =
      b.kind === 'group'
        ? new Date(b.appears_at).getTime()
        : new Date(b.instance.created_at).getTime()
    return db - da
  })

  return rows
}

export function hubRowMatchesFilters(
  row: BilanHubRow,
  opts: {
    statusFilter?: string
    searchQ?: string
    clientName: Map<string, string>
  }
): boolean {
  const { statusFilter = '', searchQ = '' } = opts

  if (row.kind === 'group') {
    if (statusFilter === 'unread') {
      if (!row.unreadCount) return false
    } else if (statusFilter) {
      if (!row.instances.some((i) => i.status === statusFilter)) return false
    }
    if (searchQ) {
      const memberNames = row.instances
        .map((i) => opts.clientName.get(i.client_id) ?? '')
        .join(' ')
      const hay = `${row.title} ${row.groupName} ${memberNames}`.toLowerCase()
      if (!hay.includes(searchQ)) return false
    }
    return true
  }

  const inst = row.instance
  if (statusFilter === 'unread') {
    if (!(inst.status === 'submitted' && !inst.coach_read_at)) return false
  } else if (statusFilter && inst.status !== statusFilter) {
    return false
  }
  if (searchQ) {
    const hay = `${inst.title} ${opts.clientName.get(inst.client_id) ?? ''}`.toLowerCase()
    if (!hay.includes(searchQ)) return false
  }
  return true
}
