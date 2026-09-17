import type { ExercisePrescription, UnitValueMode } from '@/src/lib/blocks/constants'
import { parseTimerConfig, summarizeTimerConfig } from '@/src/lib/blocks/timerConfig'
import type { createClient } from '@/src/lib/supabase/server'

export type SessionBlockDetailExercise = {
  exercise_id: string
  name: string
  prescriptions: ExercisePrescription[]
}

/** Snapshot catalogue d’un bloc pour l’aperçu / édition dans la fiche séance. */
export type SessionBlockDetail = {
  id: string
  name: string
  status: string
  sport_id: string | null
  notes: string | null
  timer_note: string | null
  expected_result_unit_id: string | null
  expected_result_label: string | null
  allow_duplicate: boolean
  exercise_ids: string[]
  exercise_prescriptions: ExercisePrescription[][]
  hidden_type_ids: string[]
  exercises: SessionBlockDetailExercise[]
}

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

function asUnitValueMode(v: string | null | undefined): UnitValueMode | null {
  if (v === 'number' || v === 'time' || v === 'text' || v === 'list') return v
  return null
}

function normalizePrescriptions(raw: unknown): ExercisePrescription[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((p) => {
      if (!p || typeof p !== 'object') return null
      const row = p as {
        unit_id?: unknown
        value?: unknown
        varies?: unknown
        input_mode?: unknown
      }
      const unit_id = String(row.unit_id ?? '').trim()
      if (!unit_id) return null
      return {
        unit_id,
        value: String(row.value ?? ''),
        varies: Boolean(row.varies),
        input_mode: asUnitValueMode(
          typeof row.input_mode === 'string' ? row.input_mode : null,
        ),
      } satisfies ExercisePrescription
    })
    .filter((p): p is ExercisePrescription => Boolean(p))
}

/** Charge le détail d’un bloc Trainly (aperçu séance / modal édition). */
export async function loadSessionBlockDetail(
  supabase: AdminSupabase,
  blockId: string,
): Promise<{ detail: SessionBlockDetail | null; error: string | null }> {
  const { data: blockRaw, error } = await supabase
    .from('block_library' as never)
    .select(
      'id,name,notes,timer_note,sport_id,expected_result_unit_id,status,allow_duplicate,coach_id',
    )
    .eq('id' as never, blockId as never)
    .maybeSingle()

  if (error) return { detail: null, error: error.message }
  if (!blockRaw) return { detail: null, error: null }

  const block = blockRaw as {
    id: string
    name: string
    notes: string | null
    timer_note: string | null
    sport_id: string | null
    expected_result_unit_id: string | null
    status: string
    allow_duplicate: boolean | null
    coach_id: string | null
  }

  const [{ data: linkedRaw }, { data: hiddenRaw }] = await Promise.all([
    supabase
      .from('block_library_exercises' as never)
      .select('exercise_id, position, prescriptions')
      .eq('block_id' as never, blockId as never)
      .order('position' as never, { ascending: true }),
    supabase
      .from('block_library_hidden_types' as never)
      .select('exercise_type_id')
      .eq('block_id' as never, blockId as never),
  ])

  const linked = (linkedRaw ?? []) as {
    exercise_id: string
    position: number
    prescriptions?: unknown
  }[]

  const exerciseIds = linked.map((r) => r.exercise_id)
  const exercisePrescriptions = linked.map((r) => normalizePrescriptions(r.prescriptions))

  const nameById = new Map<string, string>()
  if (exerciseIds.length) {
    const { data: exosRaw } = await supabase
      .from('exercise_library')
      .select('id, name')
      .in('id', exerciseIds)
    for (const e of (exosRaw ?? []) as { id: string; name: string }[]) {
      nameById.set(e.id, e.name)
    }
  }

  let expected_result_label: string | null = null
  if (block.expected_result_unit_id) {
    const { data: unitRaw } = await supabase
      .from('units' as never)
      .select('id, label')
      .eq('id' as never, block.expected_result_unit_id as never)
      .maybeSingle()
    const u = unitRaw as { id: string; label: string } | null
    expected_result_label = u?.label ?? null
  }

  const hidden_type_ids = ((hiddenRaw ?? []) as { exercise_type_id: string }[]).map(
    (r) => r.exercise_type_id,
  )

  const exercises: SessionBlockDetailExercise[] = linked.map((r, i) => ({
    exercise_id: r.exercise_id,
    name: nameById.get(r.exercise_id) ?? 'Exercice',
    prescriptions: exercisePrescriptions[i] ?? [],
  }))

  return {
    detail: {
      id: block.id,
      name: block.name,
      status: block.status || 'draft',
      sport_id: block.sport_id,
      notes: block.notes,
      timer_note: block.timer_note,
      expected_result_unit_id: block.expected_result_unit_id,
      expected_result_label,
      allow_duplicate: block.allow_duplicate !== false,
      exercise_ids: exerciseIds,
      exercise_prescriptions: exercisePrescriptions,
      hidden_type_ids,
      exercises,
    },
    error: null,
  }
}

export async function loadSessionBlockDetails(
  supabase: AdminSupabase,
  blockIds: string[],
): Promise<SessionBlockDetail[]> {
  const unique = [...new Set(blockIds.filter(Boolean))]
  if (!unique.length) return []
  const out: SessionBlockDetail[] = []
  for (const id of unique) {
    const { detail } = await loadSessionBlockDetail(supabase, id)
    if (detail) out.push(detail)
  }
  return out
}

export function formatBlockTimerSummary(timerNote: string | null | undefined): string | null {
  const cfg = parseTimerConfig(timerNote)
  if (!cfg) return null
  return summarizeTimerConfig(cfg)
}

export function formatFilledPrescriptions(
  prescriptions: Array<{ unit_id: string; value: string }>,
  unitById: Map<
    string,
    { key: string; label: string; short_label?: string | null }
  >,
  shortByKey?: Record<string, string>,
): string {
  return prescriptions
    .filter((p) => p.unit_id && String(p.value ?? '').trim() !== '')
    .map((p) => {
      const u = unitById.get(p.unit_id)
      const short =
        (u?.short_label && String(u.short_label).trim()) ||
        (u?.key && shortByKey?.[u.key]) ||
        u?.label ||
        '—'
      return `${short} ${String(p.value).trim()}`
    })
    .join(' · ')
}
