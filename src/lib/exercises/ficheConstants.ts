/** Constantes fiche exercice (biblio) — pas de prescription. */

export const EXERCISE_DIFFICULTIES = ['Débutant', 'Intermédiaire', 'Avancé'] as const
export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTIES)[number]

export const EXERCISE_MUSCLE_GROUPS = [
  'Pectoraux',
  'Dos',
  'Épaules',
  'Biceps',
  'Triceps',
  'Jambes',
  'Fessiers',
  'Ischios',
  'Quadriceps',
  'Mollets',
  'Abdos',
  'Full body',
] as const

export function normalizeDifficulty(raw: string): ExerciseDifficulty | null {
  const v = raw.trim()
  return (EXERCISE_DIFFICULTIES as readonly string[]).includes(v) ? (v as ExerciseDifficulty) : null
}

export function parseReplacementIds(formData: FormData): string[] {
  const raw = formData.getAll('replacement_ids')
  const ids = raw
    .map((v) => String(v ?? '').trim())
    .filter((id) => id.length > 0)
  return [...new Set(ids)]
}
