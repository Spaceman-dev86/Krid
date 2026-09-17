import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildMuscleGroupsFromExercises,
  filterSelectableLibraryExercises,
} from './exerciseLibraryVisibility'
import { filterCatalogPublished } from './exercises/catalogVisibility'

export type ExerciseLibraryEntry = {
  id: string
  name: string
  muscle_group: string | null
}

export type ExerciseLibraryCatalog = {
  exercises: ExerciseLibraryEntry[]
  muscleGroups: string[]
}

export async function fetchExerciseLibrary(supabase: SupabaseClient): Promise<ExerciseLibraryCatalog> {
  // Published only (Trainly + coach). Drafts stay out of the program builder.
  // chatDb-style: status may be missing pre-slice-20 — fallback without filter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  let data: Array<{ id: string; name: string | null; muscle_group: string | null }> | null = null
  let error: { message: string } | null = null

  const withStatus = await db
    .from('exercise_library')
    .select('id,name,muscle_group,status,coach_id,deleted_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (withStatus.error && /status/i.test(String(withStatus.error.message ?? ''))) {
    const legacy = await supabase
      .from('exercise_library')
      .select('id,name,muscle_group')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    data = legacy.data as typeof data
    error = legacy.error
  } else {
    error = withStatus.error
    const rows = (withStatus.data ?? []) as Array<{
      id: string
      name: string | null
      muscle_group: string | null
      status?: string | null
      coach_id?: string | null
      deleted_at?: string | null
    }>
    data = filterCatalogPublished(rows)
  }

  if (error) throw error

  const exercises: ExerciseLibraryEntry[] = filterSelectableLibraryExercises(
    (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? '').trim() || 'Exercice',
      muscle_group: row.muscle_group,
    })),
  )

  const muscleGroups = buildMuscleGroupsFromExercises(exercises)

  return { exercises, muscleGroups }
}
