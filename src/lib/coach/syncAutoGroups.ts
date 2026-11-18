/**
 * Legacy no-ops + migration douce auto → manual.
 * Sync live des groupes liés : voir linkedGroups.ts
 */

import { ensureClientInLinkedGroup } from './linkedGroups'

type Db = {
  from: (table: string) => any
}

/** Au grant : sync vers groupe lié s’il existe. */
export async function ensureClientInAutoGroup(
  supabase: Db,
  opts: { coachId: string; clientId: string; prestationId: string; prestationName?: string | null }
) {
  await ensureClientInLinkedGroup(supabase, {
    coachId: opts.coachId,
    clientId: opts.clientId,
    prestationId: opts.prestationId,
  })
}

/** Fin de grant : on laisse le membre (alumni) — no-op. */
export async function removeClientFromAutoGroupIfIdle(
  _supabase: Db,
  _opts: { coachId: string; clientId: string; prestationId: string }
) {
  return
}

/** @deprecated */
export async function syncAllAutoGroupsForCoach(_supabase: Db, _coachId: string) {
  return
}

/**
 * Migration douce (idempotente) :
 * - auto avec ≥2 membres → type=manual
 * - auto avec &lt;2 membres → suppression
 */
export async function migrateAutoGroupsAway(supabase: Db, coachId: string) {
  const { data: autos } = await supabase
    .from('client_groups')
    .select('id')
    .eq('coach_id', coachId)
    .eq('type', 'auto')

  if (!autos?.length) return { converted: 0, deleted: 0 }

  let converted = 0
  let deleted = 0

  for (const g of autos as { id: string }[]) {
    const { count } = await supabase
      .from('client_group_members')
      .select('client_id', { count: 'exact', head: true })
      .eq('group_id', g.id)

    const n = count ?? 0
    if (n >= 2) {
      const { error } = await supabase
        .from('client_groups')
        .update({ type: 'manual' })
        .eq('id', g.id)
        .eq('coach_id', coachId)
        .eq('type', 'auto')
      if (!error) converted += 1
    } else {
      const { error } = await supabase
        .from('client_groups')
        .delete()
        .eq('id', g.id)
        .eq('coach_id', coachId)
        .eq('type', 'auto')
      if (!error) deleted += 1
    }
  }

  return { converted, deleted }
}
