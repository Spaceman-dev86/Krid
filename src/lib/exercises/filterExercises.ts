import type { CoachExerciseRow } from './library'

export function filterExerciseRows(
  items: CoachExerciseRow[],
  opts: { q?: string; type?: string; sport?: string; muscle?: string },
) {
  const q = (opts.q ?? '').trim().toLowerCase()
  const type = (opts.type ?? '').trim()
  const sport = (opts.sport ?? '').trim()
  const muscle = (opts.muscle ?? '').trim()

  return items.filter((ex) => {
    if (type && (ex.exercise_type ?? '') !== type) return false
    if (sport && (ex.sport_id ?? '') !== sport && (ex.sport_label ?? '') !== sport) return false
    if (muscle && (ex.muscle_group ?? '') !== muscle) return false
    if (q) {
      const hay =
        `${ex.name} ${ex.exercise_type ?? ''} ${ex.sport_label ?? ''} ${ex.difficulty ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function collectExerciseFilterOptions(items: CoachExerciseRow[]) {
  const types = new Set<string>()
  const sports = new Map<string, string>()
  for (const ex of items) {
    if (ex.exercise_type?.trim()) types.add(ex.exercise_type.trim())
    if (ex.sport_id && ex.sport_label?.trim()) sports.set(ex.sport_id, ex.sport_label.trim())
  }
  return {
    typeOptions: [...types].sort((a, b) => a.localeCompare(b, 'fr')),
    sportOptions: [...sports.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
  }
}
