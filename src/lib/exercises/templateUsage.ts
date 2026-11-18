import type { SupabaseClient } from '@supabase/supabase-js'

export type ExerciseUsageKind = 'block' | 'session' | 'program'

export type ExerciseUsageRef = {
  kind: ExerciseUsageKind
  id: string
  name: string
  status?: string | null
  href: string
  /** Programme parent (copies figées) */
  subtitle?: string | null
}

export type ExerciseUsageBundle = {
  /** Usages dans templates hubs — bloquent le soft-delete */
  templates: ExerciseUsageRef[]
  /** Photocopies programme — info only */
  programs: ExerciseUsageRef[]
}

function emptyBundle(): ExerciseUsageBundle {
  return { templates: [], programs: [] }
}

function blockHref(status: string | null | undefined, id: string) {
  return status === 'draft'
    ? `/exercises/blocks/brouillon/${id}`
    : `/exercises/blocks/mine/${id}`
}

function sessionHref(status: string | null | undefined, id: string) {
  return status === 'draft'
    ? `/programs/sessions/brouillon/${id}`
    : `/programs/sessions/mine/${id}`
}

async function loadProgramUsages(
  supabase: SupabaseClient,
  coachId: string,
  exerciseIds: string[],
): Promise<Map<string, ExerciseUsageRef[]>> {
  const out = new Map<string, ExerciseUsageRef[]>()
  for (const id of exerciseIds) out.set(id, [])

  const { data: beRows } = await supabase
    .from('block_exercises' as never)
    .select('exercise_id, session_block_id')
    .in('exercise_id' as never, exerciseIds as never)
    .not('exercise_id' as never, 'is', null)

  const links = (beRows ?? []) as { exercise_id: string; session_block_id: string }[]
  if (!links.length) return out

  const sessionBlockIds = [...new Set(links.map((r) => r.session_block_id))]
  const { data: sbRows } = await supabase
    .from('session_blocks' as never)
    .select('id, program_session_id')
    .in('id' as never, sessionBlockIds as never)

  const blocks = (sbRows ?? []) as { id: string; program_session_id: string }[]
  if (!blocks.length) return out

  const sessionIdByBlock = new Map(blocks.map((b) => [b.id, b.program_session_id]))
  const sessionIds = [...new Set(blocks.map((b) => b.program_session_id))]

  const { data: sessRows } = await supabase
    .from('sessions' as never)
    .select('id, title, week_id')
    .in('id' as never, sessionIds as never)

  const sessions = (sessRows ?? []) as {
    id: string
    title: string | null
    week_id: string
  }[]
  if (!sessions.length) return out

  const weekIds = [...new Set(sessions.map((s) => s.week_id))]
  const { data: weekRows } = await supabase
    .from('program_weeks' as never)
    .select('id, program_id')
    .in('id' as never, weekIds as never)

  const weeks = (weekRows ?? []) as { id: string; program_id: string }[]
  if (!weeks.length) return out

  const programIdByWeek = new Map(weeks.map((w) => [w.id, w.program_id]))
  const programIds = [...new Set(weeks.map((w) => w.program_id))]

  const { data: progRows } = await supabase
    .from('programs' as never)
    .select('id, title, coach_id, deleted_at')
    .in('id' as never, programIds as never)
    .eq('coach_id' as never, coachId as never)
    .is('deleted_at' as never, null)

  const programs = new Map(
    ((progRows ?? []) as { id: string; title: string | null; coach_id: string }[]).map((p) => [
      p.id,
      p,
    ]),
  )

  const sessionMeta = new Map(
    sessions.map((s) => {
      const programId = programIdByWeek.get(s.week_id)
      const prog = programId ? programs.get(programId) : null
      return [s.id, { session: s, prog }] as const
    }),
  )

  const seen = new Set<string>()
  for (const link of links) {
    const sessionId = sessionIdByBlock.get(link.session_block_id)
    if (!sessionId) continue
    const meta = sessionMeta.get(sessionId)
    if (!meta?.prog) continue
    const dedupe = `${link.exercise_id}:${sessionId}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    const list = out.get(link.exercise_id) ?? []
    list.push({
      kind: 'program',
      id: sessionId,
      name: meta.session.title?.trim() || 'Séance',
      subtitle: meta.prog.title?.trim() || 'Programme',
      href: `/programs/${meta.prog.id}/sessions/${sessionId}/edit`,
    })
    out.set(link.exercise_id, list)
  }

  return out
}

/** Usages template (blocs + séances modèles) + aperçu programmes (safe). */
export async function loadExerciseTemplateUsages(
  supabase: SupabaseClient,
  coachId: string,
  exerciseIds: string[],
): Promise<Map<string, ExerciseUsageBundle>> {
  const map = new Map<string, ExerciseUsageBundle>()
  for (const id of exerciseIds) map.set(id, emptyBundle())
  if (!exerciseIds.length) return map

  const [{ data: blockLinks }, { data: sessionLinks }, programMap] = await Promise.all([
    supabase
      .from('block_library_exercises' as never)
      .select('exercise_id, block_id')
      .in('exercise_id' as never, exerciseIds as never),
    supabase
      .from('session_library_items' as never)
      .select('exercise_id, session_id')
      .eq('item_kind' as never, 'exercise' as never)
      .in('exercise_id' as never, exerciseIds as never),
    loadProgramUsages(supabase, coachId, exerciseIds),
  ])

  const blockIds = [
    ...new Set(
      ((blockLinks ?? []) as { block_id: string }[]).map((r) => r.block_id).filter(Boolean),
    ),
  ]
  const sessionIds = [
    ...new Set(
      ((sessionLinks ?? []) as { session_id: string }[])
        .map((r) => r.session_id)
        .filter(Boolean),
    ),
  ]

  const [{ data: blocksRaw }, { data: sessionsRaw }] = await Promise.all([
    blockIds.length
      ? supabase
          .from('block_library' as never)
          .select('id, name, status, coach_id, deleted_at')
          .in('id' as never, blockIds as never)
          .eq('coach_id' as never, coachId as never)
          .is('deleted_at' as never, null)
      : Promise.resolve({ data: [] as unknown[] }),
    sessionIds.length
      ? supabase
          .from('session_library' as never)
          .select('id, name, status, coach_id, deleted_at')
          .in('id' as never, sessionIds as never)
          .eq('coach_id' as never, coachId as never)
          .is('deleted_at' as never, null)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  const blocks = new Map(
    ((blocksRaw ?? []) as {
      id: string
      name: string
      status: string | null
    }[]).map((b) => [b.id, b]),
  )
  const sessions = new Map(
    ((sessionsRaw ?? []) as {
      id: string
      name: string
      status: string | null
    }[]).map((s) => [s.id, s]),
  )

  for (const row of (blockLinks ?? []) as { exercise_id: string; block_id: string }[]) {
    const b = blocks.get(row.block_id)
    if (!b) continue
    const bundle = map.get(row.exercise_id) ?? emptyBundle()
    if (bundle.templates.some((t) => t.kind === 'block' && t.id === b.id)) continue
    bundle.templates.push({
      kind: 'block',
      id: b.id,
      name: b.name || 'Bloc',
      status: b.status,
      href: blockHref(b.status, b.id),
    })
    map.set(row.exercise_id, bundle)
  }

  for (const row of (sessionLinks ?? []) as { exercise_id: string; session_id: string }[]) {
    const s = sessions.get(row.session_id)
    if (!s) continue
    const bundle = map.get(row.exercise_id) ?? emptyBundle()
    if (bundle.templates.some((t) => t.kind === 'session' && t.id === s.id)) continue
    bundle.templates.push({
      kind: 'session',
      id: s.id,
      name: s.name || 'Séance',
      status: s.status,
      href: sessionHref(s.status, s.id),
    })
    map.set(row.exercise_id, bundle)
  }

  for (const [exerciseId, refs] of programMap) {
    const bundle = map.get(exerciseId) ?? emptyBundle()
    bundle.programs = refs
    map.set(exerciseId, bundle)
  }

  return map
}

export function attachExerciseUsages<T extends { id: string }>(
  items: T[],
  usages: Map<string, ExerciseUsageBundle>,
): (T & { usage: ExerciseUsageBundle; template_usage_count: number })[] {
  return items.map((item) => {
    const usage = usages.get(item.id) ?? emptyBundle()
    return {
      ...item,
      usage,
      template_usage_count: usage.templates.length,
    }
  })
}
