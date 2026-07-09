import { libraryExerciseName } from './devExerciseLibrary'
import type { BlockKind } from './minimalCommands'

/** DB enum `session_block_type` values used by Supabase. */
export type SessionBlockDbType =
  | 'warmup'
  | 'strength'
  | 'powerlifting'
  | 'crosstraining'
  | 'run'
  | 'bike'
  | 'swim'
  | 'free_text'

const BLOCK_TITLES: Record<BlockKind, string> = {
  warmup: 'Warm-up',
  crossfit: 'CrossFit',
  superset: 'Superset',
  neutral: 'Bloc neutre',
}

export function blockKindToDbType(kind: BlockKind | null | undefined): SessionBlockDbType {
  switch (kind) {
    case 'warmup':
      return 'warmup'
    case 'crossfit':
      return 'crosstraining'
    case 'superset':
      return 'strength'
    case 'neutral':
    default:
      return 'free_text'
  }
}

export function dbTypeToBlockKind(dbType: string | null | undefined): BlockKind | null {
  const t = String(dbType ?? '').trim().toLowerCase()
  if (t === 'warmup') return 'warmup'
  if (t === 'crosstraining') return 'crossfit'
  if (t === 'strength' || t === 'powerlifting') return 'superset'
  if (t === 'free_text') return 'neutral'
  return null
}

export function inferBlockKindFromTitle(title: string | null | undefined): BlockKind | null {
  const t = String(title ?? '').trim().toLowerCase()
  if (t === 'warm-up' || t === 'warm up') return 'warmup'
  if (t === 'crossfit') return 'crossfit'
  if (t === 'superset') return 'superset'
  if (t === 'bloc neutre') return 'neutral'
  return null
}

export function defaultBlockTitle(kind: BlockKind | null | undefined, title?: string | null): string {
  const trimmed = String(title ?? '').trim()
  if (trimmed) return trimmed
  if (kind) return BLOCK_TITLES[kind]
  return 'Bloc'
}

export function isDevLibraryExerciseId(id: string | null | undefined): boolean {
  return Boolean(id && (id.startsWith('lib-') || id.startsWith('tmp-')))
}

/** Persist block_exercises / program_exercises without invalid dev library ids. */
export function resolveLibraryExerciseForDb(libraryExerciseId: string | null | undefined): {
  exercise_id: string | null
  exercise_name: string
} {
  const id = String(libraryExerciseId ?? '').trim()
  if (!id) return { exercise_id: null, exercise_name: 'Exercice' }

  if (isDevLibraryExerciseId(id)) {
    return { exercise_id: null, exercise_name: libraryExerciseName(id) ?? 'Exercice' }
  }

  return { exercise_id: id, exercise_name: libraryExerciseName(id) ?? 'Exercice' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

/** Server-side: resolve catalog UUID to exercise_library name. */
export async function resolveLibraryExerciseForDbAsync(
  supabase: SupabaseLike,
  libraryExerciseId: string | null | undefined
): Promise<{ exercise_id: string | null; exercise_name: string }> {
  const id = String(libraryExerciseId ?? '').trim()
  if (!id) return { exercise_id: null, exercise_name: 'Exercice' }

  if (isDevLibraryExerciseId(id)) {
    return { exercise_id: null, exercise_name: libraryExerciseName(id) ?? 'Exercice' }
  }

  const { data, error } = await supabase.from('exercise_library').select('name').eq('id', id).maybeSingle()
  if (error) throw error
  const fromDb = String((data as { name?: string | null } | null)?.name ?? '').trim()
  const name = fromDb || libraryExerciseName(id) || 'Exercice'
  return { exercise_id: id, exercise_name: name }
}
