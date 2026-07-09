/**
 * Exercices masqués dans les catalogues (program builder, dashboard/exercises).
 * Les programmes existants conservent leurs références `exercise_id` — seul l’ajout est bloqué.
 *
 * Alternative Supabase : colonne `visible_in_library boolean default true` + UPDATE … WHERE muscle_group = 'Maison'.
 * Le filtre applicatif évite une migration et reste suffisant tant qu’on ne liste pas la bibliothèque ailleurs sans filtre.
 */
const HIDDEN_LIBRARY_MUSCLE_GROUPS = new Set(['maison'])

export function isExerciseSelectableInLibrary(muscleGroup: string | null | undefined): boolean {
  const normalized = String(muscleGroup ?? '').trim().toLowerCase()
  if (!normalized) return true
  return !HIDDEN_LIBRARY_MUSCLE_GROUPS.has(normalized)
}

export function filterSelectableLibraryExercises<T extends { muscle_group: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => isExerciseSelectableInLibrary(row.muscle_group))
}

export function buildMuscleGroupsFromExercises(
  exercises: { muscle_group: string | null }[]
): string[] {
  const muscleSet = new Set<string>()
  for (const ex of exercises) {
    const mg = ex.muscle_group?.trim()
    if (mg) muscleSet.add(mg)
  }
  return [...muscleSet].sort((a, b) => a.localeCompare(b, 'fr'))
}
