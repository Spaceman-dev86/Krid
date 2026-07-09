import type { ProgramExerciseNode } from './minimalDocument'

export type DevExerciseLibraryEntry = {
  id: string
  name: string
  muscle_group: string | null
}

export const DEV_EXERCISE_MUSCLE_GROUPS = [
  'Pectoraux',
  'Dos',
  'Jambes',
  'Épaules',
  'Bras',
  'Core',
] as const

export const DEV_EXERCISE_LIBRARY: DevExerciseLibraryEntry[] = [
  { id: 'lib-squat', name: 'Squat', muscle_group: 'Jambes' },
  { id: 'lib-deadlift', name: 'Soulevé de terre', muscle_group: 'Dos' },
  { id: 'lib-bench', name: 'Développé couché', muscle_group: 'Pectoraux' },
  { id: 'lib-row', name: 'Rowing', muscle_group: 'Dos' },
  { id: 'lib-pullup', name: 'Tractions', muscle_group: 'Dos' },
  { id: 'lib-ohp', name: 'Développé militaire', muscle_group: 'Épaules' },
  { id: 'lib-lunge', name: 'Fentes', muscle_group: 'Jambes' },
  { id: 'lib-burpee', name: 'Burpees', muscle_group: 'Core' },
  { id: 'lib-plank', name: 'Planche', muscle_group: 'Core' },
  { id: 'lib-curl', name: 'Curl biceps', muscle_group: 'Bras' },
  { id: 'lib-dip', name: 'Dips', muscle_group: 'Bras' },
  { id: 'lib-hip-thrust', name: 'Hip thrust', muscle_group: 'Jambes' },
  { id: 'lib-face-pull', name: 'Face pull', muscle_group: 'Épaules' },
  { id: 'lib-kb-swing', name: 'Kettlebell swing', muscle_group: 'Core' },
  { id: 'lib-box-jump', name: 'Box jump', muscle_group: 'Jambes' },
  { id: 'lib-assault-bike', name: 'Assault bike', muscle_group: 'Core' },
  { id: 'lib-rower', name: 'Rameur', muscle_group: 'Core' },
  { id: 'lib-curl-dumbbell', name: 'Curl biceps haltères', muscle_group: 'Bras' },
  { id: 'lib-triceps-extension', name: 'Extension triceps', muscle_group: 'Bras' },
  { id: 'lib-burpee-box-jump', name: 'Burpees box jump', muscle_group: 'Core' },
  { id: 'lib-db-snatch', name: 'DB snatch', muscle_group: 'Épaules' },
  { id: 'lib-ski-erg', name: 'ski_erg', muscle_group: 'Core' },
]

const legacyNameByProgramExerciseId: Record<string, string> = {
  'pe-squat': 'Squat',
  'pe-row': 'Rowing',
}

let catalogNameById: Map<string, string> | null = null

/** Client catalog from Supabase — registered by ExerciseLibraryProvider. */
export function registerExerciseLibraryCatalog(
  exercises: ReadonlyArray<{ id: string; name: string }>
): void {
  const entries: [string, string][] = []
  for (const e of exercises) {
    const name = String(e.name ?? '').trim()
    if (name.length > 0) entries.push([e.id, name])
  }
  catalogNameById = new Map(entries)
}

export function clearExerciseLibraryCatalog(): void {
  catalogNameById = null
}

export function libraryExerciseName(libraryExerciseId: string | null): string | null {
  if (!libraryExerciseId) return null
  const fromCatalog = catalogNameById?.get(libraryExerciseId)
  if (fromCatalog) return fromCatalog
  const entry = DEV_EXERCISE_LIBRARY.find((e) => e.id === libraryExerciseId)
  return entry?.name?.trim() || null
}

export function libraryExerciseIdByName(name: string): string | null {
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  const entry = DEV_EXERCISE_LIBRARY.find((e) => e.name.trim().toLowerCase() === needle)
  return entry?.id ?? null
}

function looksLikeOpaqueId(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (v.startsWith('tmp-')) return true
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export function resolveBlockExerciseDisplayName(
  row: {
    exerciseName: string | null
    libraryExerciseId?: string | null
  } | null | undefined,
  catalogExercises?: ReadonlyArray<{ id: string; name: string }>
): string {
  if (!row) return 'Exercice'
  const fromName = row.exerciseName?.trim()
  const libraryId = row.libraryExerciseId ?? null

  let fromReactCatalog: string | null = null
  if (libraryId && catalogExercises) {
    fromReactCatalog = catalogExercises.find((e) => e.id === libraryId)?.name?.trim() || null
  }
  const fromLibrary = fromReactCatalog || libraryExerciseName(libraryId)

  if (fromName && fromName !== 'Exercice') return fromName
  if (fromLibrary) return fromLibrary
  return fromName || 'Exercice'
}

/** @deprecated Prefer resolveBlockExerciseDisplayName with catalog when available. */
export function resolveBlockExerciseLabel(row: {
  exerciseName: string | null
  libraryExerciseId?: string | null
} | null | undefined): string {
  return resolveBlockExerciseDisplayName(row)
}

export function resolveProgramExerciseLabel(
  programExerciseId: string | null,
  pe?: ProgramExerciseNode | null
): string {
  if (!programExerciseId) return 'Exercice'

  const subtitle = pe?.subtitle?.trim()
  if (subtitle && !looksLikeOpaqueId(subtitle)) return subtitle

  const fromLibrary = libraryExerciseName(pe?.libraryExerciseId ?? null)
  if (fromLibrary) return fromLibrary

  const legacy = legacyNameByProgramExerciseId[programExerciseId]
  if (legacy) return legacy

  return 'Exercice'
}
