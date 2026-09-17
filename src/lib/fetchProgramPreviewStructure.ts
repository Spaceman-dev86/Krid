import type { SupabaseClient } from '@supabase/supabase-js'

import {
  hydrateBlockExerciseLibrary,
  hydrateProgramExerciseLibrary,
  loadExerciseLibraryLookupsForPreview,
} from './hydratePreviewExerciseLibrary'

export type PreviewWeekRow = { id: string; title: string; week_order: number }

export type PreviewSessionRow = {
  id: string
  week_id: string
  title: string
  description: string | null
  session_order: number
}

export type PreviewSessionItemRow = {
  id: string
  session_id: string
  position: number
  kind: string
  program_exercise_id: string | null
  session_block_id: string | null
}

export type PreviewSessionBlockRow = {
  id: string
  program_session_id: string
  position: number
  type: string
  title: string | null
  notes: string | null
  objective?: string | null
}

export type PreviewProgramExerciseRow = {
  id: string
  session_id: string
  exercise_id: string | null
  name: string | null
  exercise_order: number
  sets: number | string | null
  reps: number | string | null
  rest_time: string | null
  rpe: number | null
  tempo: string | null
  load: string | null
  notes: string | null
  exercise_library: { name: string; demo_media_path?: string | null } | null
  demo_media_url?: string | null
}

export type PreviewBlockExerciseRow = {
  id: string
  session_block_id: string
  position: number
  exercise_id: string | null
  exercise_name: string | null
  sets: number | string | null
  reps: number | string | null
  load_text: string | null
  rest_seconds: number | null
  notes: string | null
  exercise_library: { name: string; demo_media_path?: string | null } | null
  demo_media_url?: string | null
}

export type ProgramPreviewStructure = {
  weeks: PreviewWeekRow[]
  sessions: PreviewSessionRow[]
  sessionItems: PreviewSessionItemRow[]
  sessionBlocks: PreviewSessionBlockRow[]
  blockExercises: PreviewBlockExerciseRow[]
  programExercises: PreviewProgramExerciseRow[]
}

const STORAGE_BUCKET = 'exercise-media'

function isSessionItemBlockKind(kind: string | null | undefined): boolean {
  const k = String(kind ?? '').trim().toLowerCase()
  return k === 'block' || k === 'session_block' || k === 'bloc' || k === 'circuit' || k === 'crosstraining'
}

function normalizeStoragePath(p: string) {
  let out = p.trim()
  if (out.startsWith('/')) out = out.slice(1)
  if (out.startsWith(`${STORAGE_BUCKET}/`)) out = out.slice(STORAGE_BUCKET.length + 1)
  return out
}

function getStoragePathFromUrl(raw: string) {
  try {
    const u = new URL(raw)
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.findIndex((p) => p === 'object')
    if (idx === -1) return null
    const bucketIdx = idx + 2
    if (!parts[bucketIdx] || parts[bucketIdx] !== STORAGE_BUCKET) return null
    const internal = parts.slice(bucketIdx + 1).join('/')
    return internal || null
  } catch {
    return null
  }
}

async function signMediaPaths(
  supabase: SupabaseClient,
  paths: string[]
): Promise<Map<string, string>> {
  const signedUrlByPath = new Map<string, string>()
  const unique = Array.from(new Set(paths.filter(Boolean)))
  const internalEntries: { original: string; normalized: string }[] = []

  for (const path of unique) {
    const isHttp = /^https?:\/\//i.test(path)
    const internalFromUrl = isHttp ? getStoragePathFromUrl(path) : null
    const internalPath = internalFromUrl ?? (isHttp ? null : path)

    if (!internalPath) {
      signedUrlByPath.set(path, path)
      continue
    }

    internalEntries.push({ original: path, normalized: normalizeStoragePath(internalPath) })
  }

  const batchSize = 80
  for (let i = 0; i < internalEntries.length; i += batchSize) {
    const batch = internalEntries.slice(i, i + batchSize)
    const { data } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(
        batch.map((entry) => entry.normalized),
        60 * 60
      )

    batch.forEach((entry, index) => {
      const signedUrl = data?.[index]?.signedUrl
      if (signedUrl) signedUrlByPath.set(entry.original, signedUrl)
    })
  }

  return signedUrlByPath
}

type BlockExerciseDbRow = {
  id: string
  session_block_id: string
  position: number
  exercise_id: string | null
  exercise_name: string | null
  sets: number | string | null
  reps: number | string | null
  load_text: string | null
  rest_seconds: number | null
  notes: string | null
  exercise_library: { name: string; demo_media_path?: string | null } | null
}

async function fetchBlockExercisesForPreview(
  supabase: SupabaseClient,
  sessionBlockIds: string[]
): Promise<BlockExerciseDbRow[]> {
  if (!sessionBlockIds.length) return []

  const chunkSize = 120
  const chunks: string[][] = []
  for (let i = 0; i < sessionBlockIds.length; i += chunkSize) {
    chunks.push(sessionBlockIds.slice(i, i + chunkSize))
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const beRes = await supabase
        .from('block_exercises')
        .select(
          'id,session_block_id,position,exercise_id,exercise_name,sets,reps,load_text,rest_seconds,notes,exercise_library(name,demo_media_path)'
        )
        .in('session_block_id', chunk)
        .order('position', { ascending: true })

 

      if (!beRes.error) {
        return (beRes.data ?? []) as unknown as BlockExerciseDbRow[]
      }

      // Backward-compatible fallback: if some columns don't exist, select the legacy shape.
      const retryWithJoin = await supabase
        .from('block_exercises')
        .select('id,session_block_id,position,exercise_id,exercise_name,notes,exercise_library(name,demo_media_path)')
        .in('session_block_id', chunk)
        .order('position', { ascending: true })

      if (!retryWithJoin.error) {
        return (retryWithJoin.data ?? []) as unknown as BlockExerciseDbRow[]
      }

      const retryMinimal = await supabase
        .from('block_exercises')
        .select('id,session_block_id,position,exercise_id,exercise_name,notes')
        .in('session_block_id', chunk)
        .order('position', { ascending: true })

      if (retryMinimal.error) return []
      return (retryMinimal.data ?? []) as unknown as BlockExerciseDbRow[]
    })
  )

  const blockExercisesRaw = chunkResults.flat()
  blockExercisesRaw.sort((a, b) => {
    const byBlock = String(a.session_block_id).localeCompare(String(b.session_block_id))
    if (byBlock !== 0) return byBlock
    return (a.position ?? 0) - (b.position ?? 0)
  })

  return blockExercisesRaw
}

export async function fetchProgramPreviewStructure(
  supabase: SupabaseClient,
  programId: string
): Promise<ProgramPreviewStructure> {
  const { data: weeksData } = await supabase
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', programId)
    .order('week_order', { ascending: true })

  const weeks = (weeksData ?? []) as PreviewWeekRow[]
  const weekIds = weeks.map((w) => w.id)

  const sessions: PreviewSessionRow[] = weekIds.length
    ? (((await supabase
        .from('sessions')
        .select('id,week_id,title,description,session_order')
        .in('week_id', weekIds)
        .order('session_order', { ascending: true })).data ?? []) as PreviewSessionRow[])
    : []

  const sessionIds = sessions.map((s) => s.id)

  if (!sessionIds.length) {
    return {
      weeks,
      sessions,
      sessionItems: [],
      sessionBlocks: [],
      blockExercises: [],
      programExercises: [],
    }
  }

  const [sessionBlocksRes, sessionItemsRes, programExercisesRes] = await Promise.all([
    supabase
      .from('session_blocks')
      .select('id,program_session_id,position,type,title,notes,objective')
      .in('program_session_id', sessionIds)
      .order('position', { ascending: true }),
    supabase
      .from('session_items')
      .select('id,session_id,position,kind,program_exercise_id,session_block_id')
      .in('session_id', sessionIds)
      .order('position', { ascending: true }),
    supabase
      .from('program_exercises')
      .select(
        'id,session_id,exercise_id,name,exercise_order,sets,reps,rest_time,rpe,tempo,load,notes,exercise_library(name,demo_media_path)'
      )
      .in('session_id', sessionIds)
      .order('exercise_order', { ascending: true }),
  ])

  const sessionBlocks = (sessionBlocksRes.data ?? []) as PreviewSessionBlockRow[]
  const sessionItems = (sessionItemsRes.data ?? []) as PreviewSessionItemRow[]
  const programExercisesRaw = (programExercisesRes.data ?? []) as unknown as PreviewProgramExerciseRow[]

  const blockIdsFromItems = sessionItems
    .filter((r) => isSessionItemBlockKind(r.kind) && r.session_block_id)
    .map((r) => String(r.session_block_id))

  const sessionBlockIds = Array.from(new Set([...sessionBlocks.map((b) => b.id), ...blockIdsFromItems]))

  const blockExercisesRaw = await fetchBlockExercisesForPreview(supabase, sessionBlockIds)

  const libraryLookups = await loadExerciseLibraryLookupsForPreview(
    supabase,
    blockExercisesRaw,
    programExercisesRaw
  )

  const programExercises = programExercisesRaw.map((row) =>
    hydrateProgramExerciseLibrary(row, libraryLookups)
  )
  const blockExercisesHydrated = blockExercisesRaw.map((row) =>
    hydrateBlockExerciseLibrary(row, libraryLookups)
  )

  const mediaPaths: string[] = []
  for (const pe of programExercises) {
    const p = pe.exercise_library?.demo_media_path
    if (p) mediaPaths.push(p)
  }
  for (const be of blockExercisesHydrated) {
    const p = be.exercise_library?.demo_media_path
    if (p) mediaPaths.push(p)
  }

  const signedUrlByPath = await signMediaPaths(supabase, mediaPaths)

  const programExercisesWithMedia = programExercises.map((e) => {
    const path = e.exercise_library?.demo_media_path ?? null
    const url = path ? signedUrlByPath.get(path) ?? null : null
    return { ...e, demo_media_url: url }
  })

  const blockExercises: PreviewBlockExerciseRow[] = blockExercisesHydrated.map((be) => {
    const path = be.exercise_library?.demo_media_path ?? null
    const url = path ? signedUrlByPath.get(path) ?? null : null
    return { ...be, demo_media_url: url }
  })

  return {
    weeks,
    sessions,
    sessionItems,
    sessionBlocks,
    blockExercises,
    programExercises: programExercisesWithMedia,
  }
}
