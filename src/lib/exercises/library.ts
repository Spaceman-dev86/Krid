import type { SupabaseClient } from '@supabase/supabase-js'

import { signExerciseMediaUrl } from '../exerciseMedia'
import { chatDb } from '../chat/chat'
import { isSchemaCacheError } from '../supabase/errors'

export type ExerciseStatus = 'draft' | 'review' | 'published'
export type ExerciseSourceKind = 'own' | 'krid' | 'network'

export type CoachExerciseRow = {
  id: string
  coach_id: string | null
  name: string
  description: string | null
  muscle_group: string | null
  difficulty: string | null
  video_url: string | null
  demo_media_path: string | null
  /** URL signée pour vignette liste (optionnel, hydraté côté page). */
  demo_media_url?: string | null
  replacement_exercise_id: string | null
  status: ExerciseStatus
  exercise_type: string | null
  sport_id: string | null
  sport_label: string | null
  source_kind: ExerciseSourceKind
  source_exercise_id: string | null
  created_at: string
  updated_at: string
  /** Nb templates hubs (blocs/séances) — hydrate listes mine/brouillon. */
  template_usage_count?: number
}

const SELECT_FULL =
  'id, coach_id, name, description, muscle_group, difficulty, video_url, demo_media_path, replacement_exercise_id, status, exercise_type, sport_id, source_kind, source_exercise_id, created_at, updated_at, sports(label)'

const SELECT_NO_PROVENANCE =
  'id, coach_id, name, description, muscle_group, difficulty, video_url, demo_media_path, replacement_exercise_id, status, exercise_type, sport_id, created_at, updated_at, sports(label)'

const SELECT_LEGACY =
  'id, coach_id, name, description, muscle_group, difficulty, video_url, demo_media_path, replacement_exercise_id, created_at, updated_at'

function mapSourceKind(raw: unknown): ExerciseSourceKind {
  if (raw === 'krid' || raw === 'network' || raw === 'own') return raw
  return 'own'
}

function mapRow(row: Record<string, unknown>): CoachExerciseRow {
  const sportJoin = row.sports as { label?: string | null } | { label?: string | null }[] | null | undefined
  const sportLabel = Array.isArray(sportJoin) ? sportJoin[0]?.label : sportJoin?.label
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
    sport_id: (row.sport_id as string | null) ?? null,
    sport_label: sportLabel ?? null,
    source_kind: mapSourceKind(row.source_kind),
    source_exercise_id: (row.source_exercise_id as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function isMissingColumnError(message: string) {
  // Ne pas matcher « column … does not exist » générique (schema cache PostgREST).
  return /status|exercise_type|source_kind|source_exercise_id/i.test(message)
}

function isMissingSportsEmbedError(message: string) {
  return isSchemaCacheError(message) || /sports|relationship/i.test(message)
}

const SELECT_FULL_NO_SPORT =
  'id, coach_id, name, description, muscle_group, difficulty, video_url, demo_media_path, replacement_exercise_id, status, exercise_type, sport_id, source_kind, source_exercise_id, created_at, updated_at'

const SELECT_NO_PROVENANCE_NO_SPORT =
  'id, coach_id, name, description, muscle_group, difficulty, video_url, demo_media_path, replacement_exercise_id, status, exercise_type, sport_id, created_at, updated_at'

/** Catalogue Krid publié (coach_id null · status published). */
export async function listTrainlyExercises(supabase: unknown) {
  const db = chatDb(supabase)
  let res = await db
    .from('exercise_library')
    .select(SELECT_FULL)
    .is('coach_id', null)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (res.error && isMissingSportsEmbedError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_FULL_NO_SPORT)
      .is('coach_id', null)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }
  if (res.error && isMissingColumnError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_NO_PROVENANCE)
      .is('coach_id', null)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }
  if (res.error && isMissingSportsEmbedError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_NO_PROVENANCE_NO_SPORT)
      .is('coach_id', null)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }
  if (res.error && isMissingColumnError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_LEGACY)
      .is('coach_id', null)
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }
  if (res.error) {
    if (isSchemaCacheError(res.error.message)) return []
    throw new Error(res.error.message)
  }
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

  if (res.error && isMissingSportsEmbedError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_FULL_NO_SPORT)
      .eq('coach_id', coachId)
      .eq('status', status)
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }
  if (res.error && isMissingColumnError(res.error.message)) {
    if (/source_kind|source_exercise_id/i.test(res.error.message)) {
      res = await db
        .from('exercise_library')
        .select(SELECT_NO_PROVENANCE)
        .eq('coach_id', coachId)
        .eq('status', status)
        .is('deleted_at', null)
        .order('name', { ascending: true })
    }
  }
  if (res.error && isMissingSportsEmbedError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_NO_PROVENANCE_NO_SPORT)
      .eq('coach_id', coachId)
      .eq('status', status)
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }
  if (res.error && isMissingColumnError(res.error.message)) {
    if (status === 'draft') return []
    res = await db
      .from('exercise_library')
      .select(SELECT_LEGACY)
      .eq('coach_id', coachId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }
  if (res.error) {
    if (isSchemaCacheError(res.error.message)) return []
    throw new Error(res.error.message)
  }
  return (res.data ?? []).map((r: Record<string, unknown>) => mapRow(r))
}

/** IDs Krid déjà forkés par ce coach (copie existante, draft ou published). */
export async function listCoachForkedKridSourceIds(supabase: unknown, coachId: string) {
  const db = chatDb(supabase)
  const res = await db
    .from('exercise_library')
    .select('source_exercise_id')
    .eq('coach_id', coachId)
    .eq('source_kind', 'krid')
    .is('deleted_at', null)
    .not('source_exercise_id', 'is', null)

  if (res.error) {
    if (isMissingColumnError(res.error.message)) return new Set<string>()
    throw new Error(res.error.message)
  }
  const ids = new Set<string>()
  for (const row of res.data ?? []) {
    const id = (row as { source_exercise_id?: string | null }).source_exercise_id
    if (id) ids.add(id)
  }
  return ids
}

export async function getExercise(supabase: unknown, id: string) {
  const db = chatDb(supabase)
  let res = await db
    .from('exercise_library')
    .select(SELECT_FULL)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (res.error && isMissingSportsEmbedError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_FULL_NO_SPORT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
  }
  if (res.error && isMissingColumnError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_NO_PROVENANCE)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
  }
  if (res.error && isMissingSportsEmbedError(res.error.message)) {
    res = await db
      .from('exercise_library')
      .select(SELECT_NO_PROVENANCE_NO_SPORT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
  }
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

export function originLabel(kind: ExerciseSourceKind): string {
  if (kind === 'krid') return 'Krid'
  if (kind === 'network') return 'Réseau'
  return 'Perso'
}

/** Hydrate les vignettes média pour les listes coach. */
export async function withExerciseMediaUrls(
  supabase: SupabaseClient,
  items: CoachExerciseRow[],
): Promise<CoachExerciseRow[]> {
  return Promise.all(
    items.map(async (ex) => ({
      ...ex,
      demo_media_url: await signExerciseMediaUrl(supabase, ex.demo_media_path),
    })),
  )
}
