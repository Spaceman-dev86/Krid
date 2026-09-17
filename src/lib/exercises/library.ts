import { chatDb } from '../chat/chat'

export type ExerciseStatus = 'draft' | 'review' | 'published'

export type CoachExerciseRow = {
  id: string
  coach_id: string | null
  name: string
  description: string | null
  muscle_group: string | null
  difficulty: string | null
  video_url: string | null
  demo_media_path: string | null
  replacement_exercise_id: string | null
  status: ExerciseStatus
  exercise_type: string | null
  created_at: string
  updated_at: string
}

const SELECT_FULL =
  'id, coach_id, name, description, muscle_group, difficulty, video_url, demo_media_path, replacement_exercise_id, status, exercise_type, created_at, updated_at'

const SELECT_LEGACY =
  'id, coach_id, name, description, muscle_group, difficulty, video_url, demo_media_path, replacement_exercise_id, created_at, updated_at'

function mapRow(row: Record<string, unknown>): CoachExerciseRow {
  return {
    id: String(row.id),
    coach_id: (row.coach_id as string | null) ?? null,
    name: String(row.name ?? '').trim() || 'Exercice',
    description: (row.description as string | null) ?? null,
    muscle_group: (row.muscle_group as string | null) ?? null,
    difficulty: (row.difficulty as string | null) ?? null,
    video_url: (row.video_url as string | null) ?? null,
    demo_media_path: (row.demo_media_path as string | null) ?? null,
    replacement_exercise_id: (row.replacement_exercise_id as string | null) ?? null,
    status:
      row.status === 'draft' || row.status === 'review' || row.status === 'published'
        ? row.status
        : 'published',
    exercise_type: (row.exercise_type as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function isMissingColumnError(message: string) {
  return /status|exercise_type|column/i.test(message)
}

/** Catalogue Trainly publié (coach_id null · status published). */
export async function listTrainlyExercises(supabase: unknown) {
  const db = chatDb(supabase)
  let res = await db
    .from('exercise_library')
    .select(SELECT_FULL)
    .is('coach_id', null)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (res.error && isMissingColumnError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_LEGACY)
      .is('coach_id', null)
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }
  if (res.error) throw new Error(res.error.message)
  return (res.data ?? []).map((r: Record<string, unknown>) => mapRow(r))
}

export async function listCoachExercises(
  supabase: unknown,
  coachId: string,
  status: ExerciseStatus
) {
  const db = chatDb(supabase)
  let res = await db
    .from('exercise_library')
    .select(SELECT_FULL)
    .eq('coach_id', coachId)
    .eq('status', status)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (res.error && isMissingColumnError(res.error.message)) {
    // Pre-slice-20: treat all coach rows as published; drafts empty
    if (status === 'draft') return []
    res = await db
      .from('exercise_library')
      .select(SELECT_LEGACY)
      .eq('coach_id', coachId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }
  if (res.error) throw new Error(res.error.message)
  return (res.data ?? []).map((r: Record<string, unknown>) => mapRow(r))
}

export async function getExercise(supabase: unknown, id: string) {
  const db = chatDb(supabase)
  let res = await db
    .from('exercise_library')
    .select(SELECT_FULL)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (res.error && isMissingColumnError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_LEGACY)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
  }
  if (res.error) throw new Error(res.error.message)
  if (!res.data) return null
  return mapRow(res.data as Record<string, unknown>)
}
