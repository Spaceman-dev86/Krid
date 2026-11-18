import type { SupabaseClient } from '@supabase/supabase-js'

export type TagIdMaps = {
  sports: Map<string, string>
  types: Map<string, string>
  units: Map<string, string>
}

type Row = { id: string; source_id?: string | null; label?: string; key?: string }

/**
 * Seed copies Krid → coach (idempotent via source_id) + remap FKs des fiches coach
 * encore pointées sur des ids plateforme.
 */
export async function seedCoachTags(
  supabase: SupabaseClient,
  coachId: string,
): Promise<TagIdMaps> {
  const maps = await ensureCoachTagCopies(supabase, coachId)
  await remapCoachLibraryFks(supabase, coachId, maps)
  return maps
}

export async function ensureCoachTagCopies(
  supabase: SupabaseClient,
  coachId: string,
): Promise<TagIdMaps> {
  const [
    { data: kridSports },
    { data: coachSports },
    { data: kridTypes },
    { data: coachTypes },
    { data: kridUnits },
    { data: coachUnits },
  ] = await Promise.all([
    supabase
      .from('sports' as never)
      .select('id, label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null),
    supabase
      .from('sports' as never)
      .select('id, source_id, label')
      .eq('coach_id' as never, coachId as never)
      .is('deleted_at' as never, null),
    supabase
      .from('exercise_types' as never)
      .select('id, label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null),
    supabase
      .from('exercise_types' as never)
      .select('id, source_id, label')
      .eq('coach_id' as never, coachId as never)
      .is('deleted_at' as never, null),
    supabase
      .from('units' as never)
      .select('id, key, label, short_label, dimension, value_mode, list_options')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null),
    supabase
      .from('units' as never)
      .select('id, source_id, key')
      .eq('coach_id' as never, coachId as never)
      .is('deleted_at' as never, null),
  ])

  const sportBySource = new Map(
    ((coachSports ?? []) as Row[])
      .filter((r) => r.source_id)
      .map((r) => [r.source_id as string, r.id]),
  )
  const typeBySource = new Map(
    ((coachTypes ?? []) as Row[])
      .filter((r) => r.source_id)
      .map((r) => [r.source_id as string, r.id]),
  )
  const unitBySource = new Map(
    ((coachUnits ?? []) as Row[])
      .filter((r) => r.source_id)
      .map((r) => [r.source_id as string, r.id]),
  )

  const missingSports = ((kridSports ?? []) as { id: string; label: string }[]).filter(
    (s) => !sportBySource.has(s.id),
  )
  if (missingSports.length) {
    const { data: inserted } = await supabase
      .from('sports' as never)
      .insert(
        missingSports.map((s) => ({
          coach_id: coachId,
          label: s.label,
          source_id: s.id,
        })) as never,
      )
      .select('id, source_id')
    for (const row of (inserted ?? []) as Row[]) {
      if (row.source_id) sportBySource.set(row.source_id, row.id)
    }
  }

  const missingTypes = ((kridTypes ?? []) as { id: string; label: string }[]).filter(
    (t) => !typeBySource.has(t.id),
  )
  if (missingTypes.length) {
    const { data: inserted } = await supabase
      .from('exercise_types' as never)
      .insert(
        missingTypes.map((t) => ({
          coach_id: coachId,
          label: t.label,
          source_id: t.id,
        })) as never,
      )
      .select('id, source_id')
    for (const row of (inserted ?? []) as Row[]) {
      if (row.source_id) typeBySource.set(row.source_id, row.id)
    }
  }

  const missingUnits = (
    (kridUnits ?? []) as {
      id: string
      key: string
      label: string
      short_label?: string | null
      dimension: string
      value_mode?: string | null
      list_options?: unknown
    }[]
  ).filter((u) => !unitBySource.has(u.id))
  if (missingUnits.length) {
    const { data: inserted } = await supabase
      .from('units' as never)
      .insert(
        missingUnits.map((u) => ({
          coach_id: coachId,
          key: u.key,
          label: u.label,
          short_label: u.short_label ?? null,
          dimension: u.dimension,
          value_mode: u.value_mode ?? 'number',
          list_options: u.list_options ?? null,
          source_id: u.id,
        })) as never,
      )
      .select('id, source_id')
    for (const row of (inserted ?? []) as Row[]) {
      if (row.source_id) unitBySource.set(row.source_id, row.id)
    }
  }

  return { sports: sportBySource, types: typeBySource, units: unitBySource }
}

export function remapId(map: Map<string, string>, id: string | null | undefined): string | null {
  if (!id) return null
  return map.get(id) ?? id
}

async function remapCoachLibraryFks(
  supabase: SupabaseClient,
  coachId: string,
  maps: TagIdMaps,
) {
  const [{ data: exos }, { data: blocks }] = await Promise.all([
    supabase
      .from('exercise_library')
      .select('id, sport_id, exercise_type_id')
      .eq('coach_id', coachId)
      .is('deleted_at', null),
    supabase
      .from('block_library' as never)
      .select('id, sport_id, expected_result_unit_id')
      .eq('coach_id' as never, coachId as never)
      .is('deleted_at' as never, null),
  ])

  for (const ex of (exos ?? []) as {
    id: string
    sport_id: string | null
    exercise_type_id: string | null
  }[]) {
    const sport_id = remapId(maps.sports, ex.sport_id)
    const exercise_type_id = remapId(maps.types, ex.exercise_type_id)
    if (sport_id === ex.sport_id && exercise_type_id === ex.exercise_type_id) continue
    await supabase
      .from('exercise_library')
      .update({ sport_id, exercise_type_id } as never)
      .eq('id', ex.id)
      .eq('coach_id', coachId)
  }

  const blockIds: string[] = []
  for (const b of (blocks ?? []) as {
    id: string
    sport_id: string | null
    expected_result_unit_id: string | null
  }[]) {
    blockIds.push(b.id)
    const sport_id = remapId(maps.sports, b.sport_id)
    const expected_result_unit_id = remapId(maps.units, b.expected_result_unit_id)
    if (sport_id === b.sport_id && expected_result_unit_id === b.expected_result_unit_id) continue
    await supabase
      .from('block_library' as never)
      .update({ sport_id, expected_result_unit_id } as never)
      .eq('id' as never, b.id as never)
      .eq('coach_id' as never, coachId as never)
  }

  if (!blockIds.length) return

  const { data: slots } = await supabase
    .from('block_library_exercises' as never)
    .select('id, block_id, prescriptions')
    .in('block_id' as never, blockIds as never)

  for (const slot of (slots ?? []) as {
    id: string
    prescriptions?: { unit_id?: string | null; value?: unknown }[] | null
  }[]) {
    const rx = Array.isArray(slot.prescriptions) ? slot.prescriptions : []
    let changed = false
    const next = rx.map((p) => {
      const unit_id = remapId(maps.units, p.unit_id ?? null)
      if (unit_id !== (p.unit_id ?? null)) changed = true
      return { ...p, unit_id }
    })
    if (!changed) continue
    await supabase
      .from('block_library_exercises' as never)
      .update({ prescriptions: next } as never)
      .eq('id' as never, slot.id as never)
  }

  const { data: hidden } = await supabase
    .from('block_library_hidden_types' as never)
    .select('block_id, exercise_type_id')
    .in('block_id' as never, blockIds as never)

  for (const h of (hidden ?? []) as { block_id: string; exercise_type_id: string }[]) {
    const next = remapId(maps.types, h.exercise_type_id)
    if (!next || next === h.exercise_type_id) continue
    await supabase
      .from('block_library_hidden_types' as never)
      .delete()
      .eq('block_id' as never, h.block_id as never)
      .eq('exercise_type_id' as never, h.exercise_type_id as never)
    await supabase.from('block_library_hidden_types' as never).insert({
      block_id: h.block_id,
      exercise_type_id: next,
    } as never)
  }
}
