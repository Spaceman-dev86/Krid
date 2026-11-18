import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  SessionBlockCandidate,
  SessionExerciseCandidate,
} from '@/src/components/admin/SessionFicheEditor'
import type { BlockExerciseCandidate } from '@/src/components/admin/BlockFicheEditor'
import type { UnitRow, UnitValueMode } from '@/src/lib/blocks/constants'
import { seedCoachTags } from '@/src/lib/tags/seedCoachTags'

function asUnitValueMode(v: string | null | undefined): UnitValueMode | null {
  if (v === 'number' || v === 'time' || v === 'text' || v === 'list') return v
  return null
}

/** Options fiche séance coach : exos/blocs publiés Krid + Ma biblio. */
export async function loadCoachSessionFicheOptions(supabase: SupabaseClient, coachId: string) {
  await seedCoachTags(supabase, coachId)

  const [
    { data: sportsRaw },
    { data: unitsRaw },
    { data: typesRaw },
    { data: kridBlocks },
    { data: mineBlocks },
    { data: kridExos },
    { data: mineExos },
  ] = await Promise.all([
    supabase
      .from('sports' as never)
      .select('id, label')
      .eq('coach_id' as never, coachId as never)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true }),
    supabase
      .from('units' as never)
      .select('id, key, label, short_label, value_mode, list_options')
      .eq('coach_id' as never, coachId as never)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true }),
    supabase
      .from('exercise_types' as never)
      .select('id, label')
      .eq('coach_id' as never, coachId as never)
      .is('deleted_at' as never, null),
    supabase
      .from('block_library' as never)
      .select('id, name, status, sport_id')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .eq('status' as never, 'published')
      .order('name' as never, { ascending: true })
      .limit(400),
    supabase
      .from('block_library' as never)
      .select('id, name, status, sport_id')
      .eq('coach_id' as never, coachId as never)
      .is('deleted_at' as never, null)
      .eq('hub_visible' as never, true as never)
      .eq('status' as never, 'published' as never)
      .order('name' as never, { ascending: true })
      .limit(400),
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
  ])

  const sports = ((sportsRaw ?? []) as { id: string; label: string }[]).map((s) => ({
    id: s.id,
    label: s.label,
  }))
  const sportLabel = new Map(sports.map((s) => [s.id, s.label]))
  const typeLabel = new Map(
    ((typesRaw ?? []) as { id: string; label: string }[]).map((t) => [t.id, t.label]),
  )

  const units: UnitRow[] = (
    (unitsRaw ?? []) as {
      id: string
      key: string
      label: string
      short_label?: string | null
      value_mode?: string | null
      list_options?: unknown
    }[]
  ).map((u) => ({
    id: u.id,
    key: u.key,
    label: u.label,
    short_label: u.short_label ?? null,
    value_mode: asUnitValueMode(u.value_mode),
    list_options: Array.isArray(u.list_options) ? (u.list_options as string[]) : null,
  }))

  const blockById = new Map<string, SessionBlockCandidate>()
  for (const b of [
    ...((kridBlocks ?? []) as { id: string; name: string; status: string; sport_id: string | null }[]),
    ...((mineBlocks ?? []) as { id: string; name: string; status: string; sport_id: string | null }[]),
  ]) {
    blockById.set(b.id, {
      id: b.id,
      name: b.name?.trim() || 'Bloc',
      status: b.status,
      sport_id: b.sport_id,
      sport_label: b.sport_id ? sportLabel.get(b.sport_id) ?? null : null,
    })
  }
  const blocks = [...blockById.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  const exoById = new Map<string, SessionExerciseCandidate>()
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
    exoById.set(e.id, {
      id: e.id,
      name: e.name?.trim() || 'Exercice',
      exercise_type_id: e.exercise_type_id,
      exercise_type_label: e.exercise_type_id ? typeLabel.get(e.exercise_type_id) ?? null : null,
      sport_id: e.sport_id,
      sport_label: e.sport_id ? sportLabel.get(e.sport_id) ?? null : null,
      muscle_group: e.muscle_group,
    })
  }
  const exercises = [...exoById.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  const blockCatalogCandidates: BlockExerciseCandidate[] = exercises.map((e) => ({
    id: e.id,
    name: e.name,
    exercise_type_id: e.exercise_type_id,
    exercise_type_label: e.exercise_type_label ?? null,
    sport_id: e.sport_id,
    sport_label: e.sport_label ?? null,
    muscle_group: e.muscle_group ?? null,
  }))

  return {
    sports,
    units,
    blocks,
    exercises,
    blockCatalog: {
      candidates: blockCatalogCandidates,
      sports,
      units,
    },
  }
}
