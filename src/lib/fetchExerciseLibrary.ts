import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildMuscleGroupsFromExercises,
  filterSelectableLibraryExercises,
} from './exerciseLibraryVisibility'

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
  const { data, error } = await supabase
    .from('exercise_library')
    .select('id,name,muscle_group')
    .order('name', { ascending: true })

  if (error) throw error

  const exercises: ExerciseLibraryEntry[] = filterSelectableLibraryExercises(
    (data ?? []).map((row) => ({
      id: String((row as { id: string }).id),
      name: String((row as { name: string | null }).name ?? '').trim() || 'Exercice',
      muscle_group: (row as { muscle_group: string | null }).muscle_group,
    }))
  )

  const muscleGroups = buildMuscleGroupsFromExercises(exercises)

  return { exercises, muscleGroups }
}
