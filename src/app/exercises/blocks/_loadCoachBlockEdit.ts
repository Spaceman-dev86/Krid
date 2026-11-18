import type { SupabaseClient } from '@supabase/supabase-js'

import type { ExercisePrescription } from '@/src/lib/blocks/constants'
import { loadCoachBlockFicheOptions } from '@/src/lib/blocks/loadCoachBlockFicheOptions'

export type CoachBlockEditRow = {
  id: string
  name: string
  notes: string | null
  timer_note: string | null
  sport_id: string | null
  expected_result_unit_id: string | null
  status: string | null
  coach_id: string | null
  source_kind: string | null
}

export async function loadCoachBlockEdit(
  supabase: SupabaseClient,
  coachId: string,
  id: string,
) {
  const { data: blockRaw, error } = await supabase
    .from('block_library' as never)
    .select(
      'id,name,notes,timer_note,sport_id,expected_result_unit_id,status,coach_id,source_kind',
    )
    .eq('id' as never, id as never)
    .is('deleted_at' as never, null)
    .maybeSingle()

  if (error || !blockRaw) return null
  const block = blockRaw as CoachBlockEditRow
  if (block.coach_id !== coachId) return null

  const [{ sports, units, candidates }, { data: linkedRaw }, { data: hiddenRaw }] =
    await Promise.all([
      loadCoachBlockFicheOptions(supabase, coachId),
      supabase
        .from('block_library_exercises' as never)
        .select('exercise_id, position, prescriptions')
        .eq('block_id' as never, id as never)
        .order('position' as never, { ascending: true }),
      supabase
        .from('block_library_hidden_types' as never)
        .select('exercise_type_id')
        .eq('block_id' as never, id as never),
    ])

  const linked = (linkedRaw ?? []) as {
    exercise_id: string
    prescriptions?: {
      unit_id: string
      value: string
      varies?: boolean
      input_mode?: string | null
    }[] | null
  }[]

  const exerciseIds = linked.map((r) => r.exercise_id)
  const exercisePrescriptions: ExercisePrescription[][] = linked.map((r) =>
    (Array.isArray(r.prescriptions) ? r.prescriptions : []).map((p) => ({
      unit_id: p.unit_id,
      value: p.value,
      varies: p.varies,
      input_mode:
        p.input_mode === 'number' ||
        p.input_mode === 'time' ||
        p.input_mode === 'text' ||
        p.input_mode === 'list'
          ? p.input_mode
          : null,
    })),
  )

  const hiddenTypeIds = ((hiddenRaw ?? []) as { exercise_type_id: string }[]).map(
    (h) => h.exercise_type_id,
  )

  return {
    block,
    sports,
    units,
    candidates,
    exerciseIds,
    exercisePrescriptions,
    hiddenTypeIds,
  }
}
