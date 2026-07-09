import type { SupabaseClient } from '@supabase/supabase-js'

export type ExerciseLibraryPreviewRow = {
  id: string
  name: string
  demo_media_path: string | null
}

export type ExerciseLibraryPreviewSlice = {
  name: string
  demo_media_path?: string | null
}

export function normalizeExerciseNameKey(name: string | null | undefined): string {
  return String(name ?? '').trim().toLowerCase()
}

export function buildExerciseLibraryLookups(rows: ExerciseLibraryPreviewRow[]) {
  const byId = new Map<string, ExerciseLibraryPreviewRow>()
  const byName = new Map<string, ExerciseLibraryPreviewRow>()

  for (const row of rows) {
    byId.set(row.id, row)
    const key = normalizeExerciseNameKey(row.name)
    if (key && !byName.has(key)) byName.set(key, row)
  }

  return { byId, byName }
}

export type ExerciseLibraryLookups = ReturnType<typeof buildExerciseLibraryLookups>

export function mergeExerciseLibraryLookups(...maps: ExerciseLibraryLookups[]): ExerciseLibraryLookups {
  const byId = new Map<string, ExerciseLibraryPreviewRow>()
  const byName = new Map<string, ExerciseLibraryPreviewRow>()

  for (const map of maps) {
    for (const [id, row] of map.byId) byId.set(id, row)
    for (const [name, row] of map.byName) {
      if (!byName.has(name)) byName.set(name, row)
    }
  }

  return { byId, byName }
}

export function resolveExerciseLibrarySlice(
  lookups: ExerciseLibraryLookups,
  exerciseId: string | null | undefined,
  exerciseName: string | null | undefined,
  existing: ExerciseLibraryPreviewSlice | null | undefined
): ExerciseLibraryPreviewSlice | null {
  const fromJoin = existing?.name?.trim()
    ? {
        name: existing.name.trim(),
        demo_media_path: existing.demo_media_path ?? null,
      }
    : null

  if (fromJoin?.demo_media_path) return fromJoin

  const id = String(exerciseId ?? '').trim()
  if (id) {
    const byId = lookups.byId.get(id)
    if (byId) {
      return {
        name: byId.name,
        demo_media_path: byId.demo_media_path,
      }
    }
  }

  const nameKey = normalizeExerciseNameKey(exerciseName ?? fromJoin?.name)
  if (nameKey) {
    const byName = lookups.byName.get(nameKey)
    if (byName) {
      return {
        name: byName.name,
        demo_media_path: byName.demo_media_path,
      }
    }
  }

  if (fromJoin) return fromJoin
  if (id && lookups.byId.has(id)) {
    const row = lookups.byId.get(id)!
    return { name: row.name, demo_media_path: row.demo_media_path }
  }
  if (nameKey && exerciseName?.trim()) {
    return { name: exerciseName.trim(), demo_media_path: null }
  }

  return null
}

type BlockExerciseHydratable = {
  exercise_id: string | null
  exercise_name: string | null
  exercise_library: ExerciseLibraryPreviewSlice | null
}

type ProgramExerciseHydratable = {
  exercise_id: string | null
  name: string | null
  exercise_library: ExerciseLibraryPreviewSlice | null
}

export function hydrateBlockExerciseLibrary<T extends BlockExerciseHydratable>(
  row: T,
  lookups: ExerciseLibraryLookups
): T {
  const library = resolveExerciseLibrarySlice(
    lookups,
    row.exercise_id,
    row.exercise_name,
    row.exercise_library
  )
  return { ...row, exercise_library: library }
}

export function hydrateProgramExerciseLibrary<T extends ProgramExerciseHydratable>(
  row: T,
  lookups: ExerciseLibraryLookups
): T {
  const library = resolveExerciseLibrarySlice(lookups, row.exercise_id, row.name, row.exercise_library)
  return { ...row, exercise_library: library }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function fetchLibraryByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<ExerciseLibraryPreviewRow[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (!unique.length) return []

  const rows: ExerciseLibraryPreviewRow[] = []
  for (const chunk of chunkArray(unique, 120)) {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('id,name,demo_media_path')
      .in('id', chunk)
    if (error) throw error
    for (const row of (data ?? []) as ExerciseLibraryPreviewRow[]) {
      rows.push({
        id: row.id,
        name: row.name,
        demo_media_path: row.demo_media_path ?? null,
      })
    }
  }
  return rows
}

async function fetchLibraryByNames(
  supabase: SupabaseClient,
  names: string[]
): Promise<ExerciseLibraryPreviewRow[]> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
  if (!unique.length) return []

  const rows: ExerciseLibraryPreviewRow[] = []
  for (const chunk of chunkArray(unique, 80)) {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('id,name,demo_media_path')
      .in('name', chunk)
    if (error) throw error
    for (const row of (data ?? []) as ExerciseLibraryPreviewRow[]) {
      rows.push({
        id: row.id,
        name: row.name,
        demo_media_path: row.demo_media_path ?? null,
      })
    }
  }
  return rows
}

export async function loadExerciseLibraryLookupsForPreview(
  supabase: SupabaseClient,
  blockExercises: BlockExerciseHydratable[],
  programExercises: ProgramExerciseHydratable[]
): Promise<ExerciseLibraryLookups> {
  const exerciseIds = new Set<string>()
  const exerciseNames = new Set<string>()

  for (const row of blockExercises) {
    const id = String(row.exercise_id ?? '').trim()
    if (id) exerciseIds.add(id)
    const name = String(row.exercise_name ?? row.exercise_library?.name ?? '').trim()
    if (name) exerciseNames.add(name)
  }

  for (const row of programExercises) {
    const id = String(row.exercise_id ?? '').trim()
    if (id) exerciseIds.add(id)
    const name = String(row.name ?? row.exercise_library?.name ?? '').trim()
    if (name) exerciseNames.add(name)
  }

  const byIdRows = await fetchLibraryByIds(supabase, Array.from(exerciseIds))
  let lookups = buildExerciseLibraryLookups(byIdRows)

  const unresolvedNames: string[] = []
  for (const row of blockExercises) {
    const slice = resolveExerciseLibrarySlice(
      lookups,
      row.exercise_id,
      row.exercise_name,
      row.exercise_library
    )
    if (!slice?.demo_media_path) {
      const name = String(row.exercise_name ?? row.exercise_library?.name ?? '').trim()
      if (name) unresolvedNames.push(name)
    }
  }
  for (const row of programExercises) {
    const slice = resolveExerciseLibrarySlice(lookups, row.exercise_id, row.name, row.exercise_library)
    if (!slice?.demo_media_path) {
      const name = String(row.name ?? row.exercise_library?.name ?? '').trim()
      if (name) unresolvedNames.push(name)
    }
  }

  const namesStillNeeded = Array.from(
    new Set(
      unresolvedNames.filter((name) => {
        const key = normalizeExerciseNameKey(name)
        const existing = lookups.byName.get(key)
        return !existing?.demo_media_path
      })
    )
  )

  if (namesStillNeeded.length) {
    const byNameRows = await fetchLibraryByNames(supabase, namesStillNeeded)
    lookups = mergeExerciseLibraryLookups(lookups, buildExerciseLibraryLookups(byNameRows))
  }

  // Case-insensitive pass: if exact name match failed, scan fetched rows for normalized keys.
  const neededKeys = new Set(
    namesStillNeeded.map((n) => normalizeExerciseNameKey(n)).filter(Boolean)
  )
  if (neededKeys.size > 0) {
    const missingKeys = Array.from(neededKeys).filter((key) => {
      const row = lookups.byName.get(key)
      return !row?.demo_media_path
    })
    if (missingKeys.length > 0) {
      const { data, error } = await supabase.from('exercise_library').select('id,name,demo_media_path')
      if (!error && data) {
        const catalog = (data as ExerciseLibraryPreviewRow[]).filter((row) => {
          const key = normalizeExerciseNameKey(row.name)
          return key && missingKeys.includes(key)
        })
        if (catalog.length) {
          lookups = mergeExerciseLibraryLookups(lookups, buildExerciseLibraryLookups(catalog))
        }
      }
    }
  }

  return lookups
}
