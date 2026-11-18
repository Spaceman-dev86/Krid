import type { SupabaseClient } from '@supabase/supabase-js'

export type BlockUsageKind = 'session' | 'program'

export type BlockUsageRef = {
  kind: BlockUsageKind
  id: string
  name: string
  status?: string | null
  href: string
  subtitle?: string | null
}

export type BlockUsageBundle = {
  templates: BlockUsageRef[]
  programs: BlockUsageRef[]
}

function emptyBundle(): BlockUsageBundle {
  return { templates: [], programs: [] }
}

function sessionHref(status: string | null | undefined, id: string) {
  return status === 'draft'
    ? `/programs/sessions/brouillon/${id}`
    : `/programs/sessions/mine/${id}`
}

async function loadProgramUsages(
  supabase: SupabaseClient,
  coachId: string,
  blockIds: string[],
): Promise<Map<string, BlockUsageRef[]>> {
  const out = new Map<string, BlockUsageRef[]>()
  for (const id of blockIds) out.set(id, [])

  const { data: sbRows } = await supabase
    .from('session_blocks' as never)
    .select('id, program_session_id, source_block_library_id')
    .in('source_block_library_id' as never, blockIds as never)
    .not('source_block_library_id' as never, 'is', null)

  const links = (sbRows ?? []) as {
    id: string
    program_session_id: string
    source_block_library_id: string
  }[]
  if (!links.length) return out

  const sessionIds = [...new Set(links.map((r) => r.program_session_id))]
  const { data: sessRows } = await supabase
    .from('sessions' as never)
    .select('id, title, week_id')
    .in('id' as never, sessionIds as never)

  const sessions = (sessRows ?? []) as { id: string; title: string | null; week_id: string }[]
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
    ((progRows ?? []) as { id: string; title: string | null }[]).map((p) => [p.id, p]),
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
    const meta = sessionMeta.get(link.program_session_id)
    if (!meta?.prog) continue
    const dedupe = `${link.source_block_library_id}:${link.program_session_id}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    const list = out.get(link.source_block_library_id) ?? []
    list.push({
      kind: 'program',
      id: link.program_session_id,
      name: meta.session.title?.trim() || 'Séance',
      subtitle: meta.prog.title?.trim() || 'Programme',
      href: `/programs/${meta.prog.id}/sessions/${link.program_session_id}/edit`,
    })
    out.set(link.source_block_library_id, list)
  }

  return out
}

export async function loadBlockTemplateUsages(
  supabase: SupabaseClient,
  coachId: string,
  blockIds: string[],
): Promise<Map<string, BlockUsageBundle>> {
  const map = new Map<string, BlockUsageBundle>()
  for (const id of blockIds) map.set(id, emptyBundle())
  if (!blockIds.length) return map

  const [{ data: sessionLinks }, programMap] = await Promise.all([
    supabase
      .from('session_library_items' as never)
      .select('block_id, session_id')
      .eq('item_kind' as never, 'block' as never)
      .in('block_id' as never, blockIds as never),
    loadProgramUsages(supabase, coachId, blockIds),
  ])

  const sessionIds = [
    ...new Set(
      ((sessionLinks ?? []) as { session_id: string }[]).map((r) => r.session_id).filter(Boolean),
    ),
  ]

  const { data: sessionsRaw } = sessionIds.length
    ? await supabase
        .from('session_library' as never)
        .select('id, name, status, coach_id, deleted_at')
        .in('id' as never, sessionIds as never)
        .eq('coach_id' as never, coachId as never)
        .is('deleted_at' as never, null)
    : { data: [] as unknown[] }

  const sessions = new Map(
    ((sessionsRaw ?? []) as { id: string; name: string; status: string | null }[]).map((s) => [
      s.id,
      s,
    ]),
  )

  for (const row of (sessionLinks ?? []) as { block_id: string; session_id: string }[]) {
    const s = sessions.get(row.session_id)
    if (!s) continue
    const bundle = map.get(row.block_id) ?? emptyBundle()
    if (bundle.templates.some((t) => t.id === s.id)) continue
    bundle.templates.push({
      kind: 'session',
      id: s.id,
      name: s.name || 'Séance',
      status: s.status,
      href: sessionHref(s.status, s.id),
    })
    map.set(row.block_id, bundle)
  }

  for (const [blockId, refs] of programMap) {
    const bundle = map.get(blockId) ?? emptyBundle()
    bundle.programs = refs
    map.set(blockId, bundle)
  }

  return map
}

export function attachBlockUsages<T extends { id: string }>(
  items: T[],
  usages: Map<string, BlockUsageBundle>,
): (T & { usage: BlockUsageBundle; template_usage_count: number })[] {
  return items.map((item) => {
    const usage = usages.get(item.id) ?? emptyBundle()
    return {
      ...item,
      usage,
      template_usage_count: usage.templates.length,
    }
  })
}
