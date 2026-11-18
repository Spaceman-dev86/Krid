import type { SupabaseClient } from '@supabase/supabase-js'

export type SessionUsageKind = 'program'

export type SessionUsageRef = {
  kind: SessionUsageKind
  id: string
  name: string
  href: string
  subtitle?: string | null
}

export type SessionUsageBundle = {
  /** Pas de lien live hub→hub pour les séances modèles aujourd’hui */
  templates: SessionUsageRef[]
  /** Photocopies programme — info only, ne bloquent pas l’archive */
  programs: SessionUsageRef[]
}

function emptyBundle(): SessionUsageBundle {
  return { templates: [], programs: [] }
}

/** Usages d’une séance modèle (principalement photocopies programme). */
export async function loadSessionTemplateUsages(
  supabase: SupabaseClient,
  coachId: string,
  sessionIds: string[],
): Promise<Map<string, SessionUsageBundle>> {
  const map = new Map<string, SessionUsageBundle>()
  for (const id of sessionIds) map.set(id, emptyBundle())
  if (!sessionIds.length) return map

  const { data: sessRows } = await supabase
    .from('sessions' as never)
    .select('id, title, week_id, source_session_library_id')
    .in('source_session_library_id' as never, sessionIds as never)
    .not('source_session_library_id' as never, 'is', null)

  const links = (sessRows ?? []) as {
    id: string
    title: string | null
    week_id: string
    source_session_library_id: string
  }[]
  if (!links.length) return map

  const weekIds = [...new Set(links.map((s) => s.week_id))]
  const { data: weekRows } = await supabase
    .from('program_weeks' as never)
    .select('id, program_id')
    .in('id' as never, weekIds as never)

  const weeks = (weekRows ?? []) as { id: string; program_id: string }[]
  if (!weeks.length) return map

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

  const seen = new Set<string>()
  for (const link of links) {
    const programId = programIdByWeek.get(link.week_id)
    const prog = programId ? programs.get(programId) : null
    if (!prog) continue
    const dedupe = `${link.source_session_library_id}:${link.id}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    const bundle = map.get(link.source_session_library_id) ?? emptyBundle()
    bundle.programs.push({
      kind: 'program',
      id: link.id,
      name: link.title?.trim() || 'Séance',
      subtitle: prog.title?.trim() || 'Programme',
      href: `/programs/${prog.id}/sessions/${link.id}/edit`,
    })
    map.set(link.source_session_library_id, bundle)
  }

  return map
}

export function attachSessionUsages<T extends { id: string }>(
  items: T[],
  usages: Map<string, SessionUsageBundle>,
): (T & { usage: SessionUsageBundle; template_usage_count: number; display_usage_count: number })[] {
  return items.map((item) => {
    const usage = usages.get(item.id) ?? emptyBundle()
    return {
      ...item,
      usage,
      template_usage_count: usage.templates.length,
      /** Affiché dans la liste (programmes inclus — info) */
      display_usage_count: usage.templates.length + usage.programs.length,
    }
  })
}
