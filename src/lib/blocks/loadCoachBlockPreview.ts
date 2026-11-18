import { signExerciseMediaUrl } from '@/src/lib/exerciseMedia'
import {
  formatBlockTimerSummary,
  formatFilledPrescriptionLines,
  loadSessionBlockDetail,
} from '@/src/lib/sessions/blockDetail'
import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

export type CoachBlockPreviewExercise = {
  id: string
  name: string
  demo_media_path: string | null
  demo_media_url: string | null
  exercise_type_label: string | null
  rxLines: string[]
}

export type CoachBlockPreview = {
  id: string
  name: string
  notes: string | null
  sport_label: string | null
  timer_summary: string | null
  expected_result_label: string | null
  type_labels: string[]
  exercises: CoachBlockPreviewExercise[]
}

/** Détail riche catalogue pour le coach (exos + média + RX + timer). */
export async function loadCoachBlockPreview(
  supabase: AdminSupabase,
  blockId: string,
): Promise<{ preview: CoachBlockPreview | null; error: string | null }> {
  const [{ detail, error }, unitsRes] = await Promise.all([
    loadSessionBlockDetail(supabase, blockId),
    supabase
      .from('units' as never)
      .select('id, key, label, short_label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null),
  ])

  if (error) return { preview: null, error }
  if (!detail) return { preview: null, error: null }

  const unitById = new Map(
    ((unitsRes.data ?? []) as {
      id: string
      key: string
      label: string
      short_label: string | null
    }[]).map((u) => [u.id, u]),
  )

  let sport_label: string | null = null
  if (detail.sport_id) {
    const { data: sport } = await supabase
      .from('sports' as never)
      .select('label')
      .eq('id' as never, detail.sport_id as never)
      .maybeSingle()
    sport_label = (sport as { label?: string } | null)?.label?.trim() || null
  }

  const exerciseIds = detail.exercises.map((e) => e.exercise_id)
  const mediaById = new Map<
    string,
    { demo_media_path: string | null; exercise_type_id: string | null; type_label: string | null }
  >()

  if (exerciseIds.length) {
    let exosRaw: unknown[] | null = null
    const nested = await supabase
      .from('exercise_library')
      .select('id, demo_media_path, exercise_type_id, exercise_types(label)')
      .in('id', exerciseIds)
    if (nested.error) {
      const flat = await supabase
        .from('exercise_library')
        .select('id, demo_media_path, exercise_type_id')
        .in('id', exerciseIds)
      exosRaw = (flat.data ?? []) as unknown[]
    } else {
      exosRaw = (nested.data ?? []) as unknown[]
    }

    const typeIds = new Set<string>()
    for (const row of exosRaw as Array<{
      id: string
      demo_media_path: string | null
      exercise_type_id: string | null
      exercise_types?: { label?: string | null } | { label?: string | null }[] | null
    }>) {
      const join = Array.isArray(row.exercise_types) ? row.exercise_types[0] : row.exercise_types
      let type_label = join?.label?.trim() || null
      if (!type_label && row.exercise_type_id) typeIds.add(row.exercise_type_id)
      mediaById.set(row.id, {
        demo_media_path: row.demo_media_path,
        exercise_type_id: row.exercise_type_id,
        type_label,
      })
    }

    if (typeIds.size) {
      const { data: typesRaw } = await supabase
        .from('exercise_types' as never)
        .select('id, label')
        .in('id' as never, [...typeIds] as never)
      const labelById = new Map(
        ((typesRaw ?? []) as { id: string; label: string }[]).map((t) => [
          t.id,
          t.label?.trim() || '',
        ]),
      )
      for (const [id, meta] of mediaById) {
        if (meta.type_label || !meta.exercise_type_id) continue
        const label = labelById.get(meta.exercise_type_id)
        if (label) mediaById.set(id, { ...meta, type_label: label })
      }
    }
  }

  const hidden = new Set(detail.hidden_type_ids)
  const typeLabels = new Map<string, string>()

  const exercises: CoachBlockPreviewExercise[] = await Promise.all(
    detail.exercises.map(async (ex) => {
      const meta = mediaById.get(ex.exercise_id)
      const path = meta?.demo_media_path ?? null
      if (meta?.exercise_type_id && meta.type_label && !hidden.has(meta.exercise_type_id)) {
        typeLabels.set(meta.exercise_type_id, meta.type_label)
      }
      return {
        id: ex.exercise_id,
        name: ex.name,
        demo_media_path: path,
        demo_media_url: await signExerciseMediaUrl(supabase, path),
        exercise_type_label: meta?.type_label ?? null,
        rxLines: formatFilledPrescriptionLines(
          (ex.prescriptions ?? []).filter(
            (p) => p?.unit_id && String(p.value ?? '').trim() !== '',
          ),
          unitById,
        ),
      }
    }),
  )

  return {
    preview: {
      id: detail.id,
      name: detail.name,
      notes: detail.notes,
      sport_label,
      timer_summary: formatBlockTimerSummary(detail.timer_note),
      expected_result_label: detail.expected_result_label,
      type_labels: [...typeLabels.values()].sort((a, b) => a.localeCompare(b, 'fr')),
      exercises,
    },
    error: null,
  }
}
