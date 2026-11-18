import type { SupabaseClient } from '@supabase/supabase-js'

import type { BlockExerciseCandidate } from '@/src/components/admin/BlockFicheEditor'
import type { UnitRow, UnitValueMode } from '@/src/lib/blocks/constants'
import { seedCoachTags } from '@/src/lib/tags/seedCoachTags'

function asUnitValueMode(v: string | null | undefined): UnitValueMode | null {
  if (v === 'number' || v === 'time' || v === 'text' || v === 'list') return v
  return null
}

/** Pool composition bloc coach = Krid publié + Ma biblio (pas brouillons). */
export async function loadCoachBlockFicheOptions(supabase: SupabaseClient, coachId: string) {
  await seedCoachTags(supabase, coachId)

  const [{ data: sportsRaw }, { data: unitsRaw }, { data: kridExos }, { data: mineExos }, { data: typesRaw }] =
    await Promise.all([
      supabase
        .from('sports' as never)
        .select('id, label')
        .eq('coach_id' as never, coachId as never)
        .is('deleted_at' as never, null)
        .order('label' as never, { ascending: true }),
      supabase
        .from('units' as never)
        .select('id, label, key, short_label, value_mode, dimension, list_options')
        .eq('coach_id' as never, coachId as never)
        .is('deleted_at' as never, null)
        .order('label' as never, { ascending: true }),
      supabase
        .from('exercise_library')
        .select('id, name, exercise_type_id, sport_id, muscle_group')
        .is('coach_id', null)
        .is('deleted_at', null)
        .eq('status', 'published')
        .order('name', { ascending: true })
        .limit(500),
      supabase
        .from('exercise_library')
        .select('id, name, exercise_type_id, sport_id, muscle_group')
        .eq('coach_id', coachId)
        .is('deleted_at', null)
        .eq('status', 'published')
        .order('name', { ascending: true })
        .limit(500),
      supabase
        .from('exercise_types' as never)
        .select('id, label')
        .eq('coach_id' as never, coachId as never)
        .is('deleted_at' as never, null),
    ])

  const sports = (sportsRaw ?? []) as { id: string; label: string }[]
  const units: UnitRow[] = (
    (unitsRaw ?? []) as {
      id: string
      label: string
      key: string
      value_mode?: string | null
      dimension?: string | null
      list_options?: unknown
      short_label?: string | null
    }[]
  ).map((u) => ({
    ...u,
    value_mode: asUnitValueMode(u.value_mode),
    list_options: Array.isArray(u.list_options) ? (u.list_options as string[]) : null,
  }))

  const typeLabel = new Map(
    ((typesRaw ?? []) as { id: string; label: string }[]).map((t) => [t.id, t.label]),
  )
  const sportLabel = new Map(sports.map((s) => [s.id, s.label]))

  const byId = new Map<string, BlockExerciseCandidate>()
  for (const e of [
    ...((kridExos ?? []) as {
      id: string
      name: string
      exercise_type_id: string | null
      sport_id: string | null
      muscle_group: string | null
    }[]),
    ...((mineExos ?? []) as {
      id: string
      name: string
      exercise_type_id: string | null
      sport_id: string | null
      muscle_group: string | null
    }[]),
  ]) {
    byId.set(e.id, {
      id: e.id,
      name: e.name,
      exercise_type_id: e.exercise_type_id,
      exercise_type_label: e.exercise_type_id ? typeLabel.get(e.exercise_type_id) ?? null : null,
      sport_id: e.sport_id,
      sport_label: e.sport_id ? sportLabel.get(e.sport_id) ?? null : null,
      muscle_group: e.muscle_group,
    })
  }

  const candidates = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return { sports, units, candidates }
}
