import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

export type SessionLibraryFilterMeta = {
  sport_ids: string[]
  type_ids: string[]
}

/** Attache sport_ids / type_ids dérivés des items (blocs + exos) — même logique que SessionsCatalog. */
export async function loadSessionLibraryFilterMeta(
  supabase: AdminSupabase,
  sessionIds: string[],
): Promise<Map<string, SessionLibraryFilterMeta>> {
  const out = new Map<string, SessionLibraryFilterMeta>()
  if (!sessionIds.length) return out

  const { data: items } = await supabase
    .from('session_library_items' as never)
    .select('session_id, item_kind, block_id, exercise_id')
    .in('session_id' as never, sessionIds as never)

  const rows = (items ?? []) as {
    session_id: string
    item_kind: string
    block_id?: string | null
    exercise_id?: string | null
  }[]

  const blockIds = [...new Set(rows.filter((r) => r.block_id).map((r) => r.block_id as string))]
  const exoIds = [...new Set(rows.filter((r) => r.exercise_id).map((r) => r.exercise_id as string))]

  const blockSport = new Map<string, string | null>()
  const exoMeta = new Map<string, { sport_id: string | null; exercise_type_id: string | null }>()
  const nestedByBlock = new Map<string, string[]>()

  if (blockIds.length) {
    const { data } = await supabase
      .from('block_library' as never)
      .select('id, sport_id')
      .in('id' as never, blockIds as never)
    for (const b of (data ?? []) as { id: string; sport_id: string | null }[]) {
      blockSport.set(b.id, b.sport_id)
    }
    const { data: blockExos } = await supabase
      .from('block_library_exercises' as never)
      .select('block_id, exercise_id')
      .in('block_id' as never, blockIds as never)
    for (const r of (blockExos ?? []) as { block_id: string; exercise_id: string }[]) {
      if (!nestedByBlock.has(r.block_id)) nestedByBlock.set(r.block_id, [])
      nestedByBlock.get(r.block_id)!.push(r.exercise_id)
    }
    const nestedExoIds = [
      ...new Set(
        ((blockExos ?? []) as { exercise_id?: string }[])
          .map((r) => r.exercise_id)
          .filter(Boolean) as string[],
      ),
    ]
    if (nestedExoIds.length) {
      const { data: nested } = await supabase
        .from('exercise_library')
        .select('id, sport_id, exercise_type_id')
        .in('id', nestedExoIds)
      for (const e of (nested ?? []) as {
        id: string
        sport_id: string | null
        exercise_type_id: string | null
      }[]) {
        exoMeta.set(e.id, { sport_id: e.sport_id, exercise_type_id: e.exercise_type_id })
      }
    }
  }

  if (exoIds.length) {
    const { data } = await supabase
      .from('exercise_library')
      .select('id, sport_id, exercise_type_id')
      .in('id', exoIds)
    for (const e of (data ?? []) as {
      id: string
      sport_id: string | null
      exercise_type_id: string | null
    }[]) {
      exoMeta.set(e.id, { sport_id: e.sport_id, exercise_type_id: e.exercise_type_id })
    }
  }

  const bags = new Map<string, { sportIds: Set<string>; typeIds: Set<string> }>()

  for (const it of rows) {
    if (!bags.has(it.session_id)) {
      bags.set(it.session_id, { sportIds: new Set(), typeIds: new Set() })
    }
    const bag = bags.get(it.session_id)!
    if (it.item_kind === 'block' && it.block_id) {
      const sid = blockSport.get(it.block_id)
      if (sid) bag.sportIds.add(sid)
      for (const eid of nestedByBlock.get(it.block_id) ?? []) {
        const em = exoMeta.get(eid)
        if (em?.sport_id) bag.sportIds.add(em.sport_id)
        if (em?.exercise_type_id) bag.typeIds.add(em.exercise_type_id)
      }
    }
    if (it.item_kind === 'exercise' && it.exercise_id) {
      const em = exoMeta.get(it.exercise_id)
      if (em?.sport_id) bag.sportIds.add(em.sport_id)
      if (em?.exercise_type_id) bag.typeIds.add(em.exercise_type_id)
    }
  }

  for (const [id, bag] of bags) {
    out.set(id, { sport_ids: [...bag.sportIds], type_ids: [...bag.typeIds] })
  }
  return out
}
