import type { SupabaseClient } from '@supabase/supabase-js'

import type { ProgramShowroomMeta } from './showroomPresentation'

/** Charge méta programme pour tags showroom (niveau, objectif, semaines, séances). */
export async function loadProgramShowroomMeta(
  supabase: SupabaseClient,
  programId: string | null | undefined,
): Promise<ProgramShowroomMeta | null> {
  const id = String(programId ?? '').trim()
  if (!id) return null

  const { data: program } = await supabase
    .from('programs')
    .select('id, title, level, goal, duration')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!program) return null

  const { data: weeksRaw } = await supabase
    .from('program_weeks')
    .select('id')
    .eq('program_id', id)

  const weeks = (weeksRaw ?? []) as { id: string }[]
  const weekIds = weeks.map((w) => w.id)

  let sessionsCount = 0
  if (weekIds.length) {
    const { count } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .in('week_id', weekIds)
    sessionsCount = count ?? 0
  }

  return {
    id: program.id,
    title: program.title,
    level: program.level,
    goal: program.goal,
    duration: program.duration,
    weeksCount: weeks.length,
    sessionsCount,
  }
}
