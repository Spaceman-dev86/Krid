import { restSecondsFromPrescriptions } from '@/src/lib/sessions/constants'
import { loadSessionBlockDetails } from '@/src/lib/sessions/blockDetail'
import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

type RxRow = { unit_id?: string; value?: string }

export type LibraryPreviewExercise = {
  id: string
  name: string
  sets: string | null
  reps: string | null
  restSeconds: number | null
  loadText: string | null
  rpe: string | null
  tempo: string | null
  notes: string | null
  demoMediaUrl: string | null
  demoMediaPath: string | null
}

export type LibraryPreviewSlot =
  | { kind: 'rest'; id: string; restSeconds: number }
  | { kind: 'exercise'; id: string; exercise: LibraryPreviewExercise }
  | {
      kind: 'block'
      id: string
      title: string
      notes: string | null
      exercises: LibraryPreviewExercise[]
    }

export type SessionLibraryPreviewPayload = {
  id: string
  name: string
  notes: string | null
  slots: LibraryPreviewSlot[]
}

function asRx(raw: unknown): RxRow[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x) => x && typeof x === 'object') as RxRow[]
}

function rxByUnitKey(
  prescriptions: RxRow[],
  unitKeyById: Map<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of prescriptions) {
    const uid = String(p.unit_id ?? '').trim()
    const key = unitKeyById.get(uid)
    if (!key) continue
    const val = String(p.value ?? '').trim()
    if (val) out[key] = val
  }
  return out
}

function toExercise(
  id: string,
  name: string,
  prescriptions: RxRow[],
  unitKeyById: Map<string, string>,
  media: { path: string | null; url: string | null },
): LibraryPreviewExercise {
  const byKey = rxByUnitKey(prescriptions, unitKeyById)
  const restRaw = byKey.rest_s
  const restSeconds = restRaw != null && restRaw !== '' ? Number.parseInt(restRaw, 10) : null
  return {
    id,
    name,
    sets: byKey.sets ?? null,
    reps: byKey.reps ?? null,
    restSeconds: Number.isFinite(restSeconds) ? restSeconds : null,
    loadText: byKey.load_kg ?? null,
    rpe: byKey.rpe ?? null,
    tempo: byKey.tempo ?? null,
    notes: byKey.note ?? null,
    demoMediaUrl: media.url,
    demoMediaPath: media.path,
  }
}

export async function fetchSessionLibraryPreview(
  supabase: AdminSupabase,
  sessionId: string,
): Promise<{ preview: SessionLibraryPreviewPayload | null; error: string | null }> {
  const { data: sessionRaw, error: sessErr } = await supabase
    .from('session_library' as never)
    .select('id, name, notes, status, coach_id')
    .eq('id' as never, sessionId as never)
    .is('deleted_at' as never, null)
    .maybeSingle()

  if (sessErr) return { preview: null, error: sessErr.message }
  const session = sessionRaw as {
    id: string
    name: string
    notes: string | null
    status: string
    coach_id: string | null
  } | null
  if (!session || session.coach_id != null) return { preview: null, error: 'Séance introuvable' }

  const [{ data: itemsRaw }, { data: unitsRaw }] = await Promise.all([
    supabase
      .from('session_library_items' as never)
      .select('id, item_kind, block_id, exercise_id, prescriptions, position')
      .eq('session_id' as never, sessionId as never)
      .order('position' as never, { ascending: true }),
    supabase
      .from('units' as never)
      .select('id, key')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null),
  ])

  const unitKeyById = new Map(
    ((unitsRaw ?? []) as { id: string; key: string }[]).map((u) => [u.id, u.key]),
  )

  const items = (itemsRaw ?? []) as {
    id: string
    item_kind: string
    block_id: string | null
    exercise_id: string | null
    prescriptions: unknown
    position: number
  }[]

  const exoIds = [
    ...new Set(items.filter((i) => i.item_kind === 'exercise' && i.exercise_id).map((i) => i.exercise_id!)),
  ]
  const blockIds = [
    ...new Set(items.filter((i) => i.item_kind === 'block' && i.block_id).map((i) => i.block_id!)),
  ]

  const exoById = new Map<string, { name: string; demo_media_path: string | null }>()
  if (exoIds.length) {
    const { data } = await supabase
      .from('exercise_library')
      .select('id, name, demo_media_path')
      .in('id', exoIds)
    for (const e of (data ?? []) as { id: string; name: string; demo_media_path: string | null }[]) {
      exoById.set(e.id, { name: e.name, demo_media_path: e.demo_media_path })
    }
  }

  const blockDetails = await loadSessionBlockDetails(supabase, blockIds)
  const blockById = new Map(blockDetails.map((b) => [b.id, b]))

  const allMediaPaths = new Set<string>()
  for (const e of exoById.values()) {
    if (e.demo_media_path) allMediaPaths.add(e.demo_media_path)
  }
  for (const b of blockDetails) {
    for (const ex of b.exercises) {
      // names only from block detail — fetch paths for block exos
    }
  }
  const blockExoIds = [...new Set(blockDetails.flatMap((b) => b.exercise_ids))]
  const missingMedia = blockExoIds.filter((id) => !exoById.has(id))
  if (missingMedia.length) {
    const { data } = await supabase
      .from('exercise_library')
      .select('id, name, demo_media_path')
      .in('id', missingMedia)
    for (const e of (data ?? []) as { id: string; name: string; demo_media_path: string | null }[]) {
      exoById.set(e.id, { name: e.name, demo_media_path: e.demo_media_path })
      if (e.demo_media_path) allMediaPaths.add(e.demo_media_path)
    }
  }

  const signed = new Map<string, string>()
  const paths = [...allMediaPaths]
  if (paths.length) {
    const { data } = await supabase.storage.from('exercise-media').createSignedUrls(paths, 60 * 60)
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl)
    }
  }

  function mediaFor(exerciseId: string) {
    const row = exoById.get(exerciseId)
    const path = row?.demo_media_path ?? null
    return { path, url: path ? signed.get(path) ?? null : null }
  }

  const slots: LibraryPreviewSlot[] = []
  for (const item of items) {
    if (item.item_kind === 'rest') {
      const secs = restSecondsFromPrescriptions(item.prescriptions)
      slots.push({ kind: 'rest', id: item.id, restSeconds: secs })
      continue
    }
    if (item.item_kind === 'exercise' && item.exercise_id) {
      const meta = exoById.get(item.exercise_id)
      slots.push({
        kind: 'exercise',
        id: item.id,
        exercise: toExercise(
          item.exercise_id,
          meta?.name ?? 'Exercice',
          asRx(item.prescriptions),
          unitKeyById,
          mediaFor(item.exercise_id),
        ),
      })
      continue
    }
    if (item.item_kind === 'block' && item.block_id) {
      const block = blockById.get(item.block_id)
      if (!block) continue
      slots.push({
        kind: 'block',
        id: item.id,
        title: block.name,
        notes: block.notes,
        exercises: block.exercises.map((ex) =>
          toExercise(
            ex.exercise_id,
            ex.name,
            ex.prescriptions as RxRow[],
            unitKeyById,
            mediaFor(ex.exercise_id),
          ),
        ),
      })
    }
  }

  return {
    preview: {
      id: session.id,
      name: session.name,
      notes: session.notes,
      slots,
    },
    error: null,
  }
}
