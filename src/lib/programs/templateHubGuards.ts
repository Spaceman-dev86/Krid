import type { createClient } from '@/src/lib/supabase/server'

import { countTemplateChildren } from '@/src/lib/programs/duplicateCoachProgram'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

export type TemplateHubBlockKind = 'children' | 'active_plans' | 'presta'

async function hasActivePlansForTemplate(
  supabase: AdminSupabase,
  programId: string,
  coachId: string,
): Promise<boolean> {
  const { count: byTemplate, error: e1 } = await supabase
    .from('client_fitness_plans')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('template_program_id', programId)
    .in('status', ['waiting', 'started', 'paused'])
  if (!e1 && (byTemplate ?? 0) > 0) return true

  // Legacy : plans encore pointés sur le template live.
  const { count: legacy, error: e2 } = await supabase
    .from('client_fitness_plans')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('source_program_id', programId)
    .in('status', ['waiting', 'started', 'paused'])
  return !e2 && (legacy ?? 0) > 0
}

/**
 * Blocage hub Templates : enfants / envoi actif (client|groupe) / lien presta.
 * null = libre.
 */
export async function getTemplateHubUsageBlock(
  supabase: AdminSupabase,
  programId: string,
  coachId: string,
): Promise<TemplateHubBlockKind | null> {
  const kids = await countTemplateChildren(supabase, programId, coachId)
  if (kids > 0) return 'children'

  if (await hasActivePlansForTemplate(supabase, programId, coachId)) {
    return 'active_plans'
  }

  const { data: prestas, error: prErr } = await supabase
    .from('prestations')
    .select('id, program_template_id, program_template_ids')
    .eq('coach_id', coachId)
    .is('deleted_at', null)

  if (prErr) return null

  for (const pr of prestas ?? []) {
    if (pr.program_template_id === programId) return 'presta'
    const ids = (pr.program_template_ids ?? []) as string[]
    if (ids.includes(programId)) return 'presta'
  }

  return null
}

const MOVE_MSGS: Record<TemplateHubBlockKind, string> = {
  children: 'Passe d’abord les versions personnalisées en brouillon (ou archive-les)',
  active_plans: 'Déjà envoyé à un client ou un groupe — impossible de le passer en brouillon',
  presta: 'Lié à une presta — retire le lien avant de passer en brouillon',
}

const ARCHIVE_MSGS: Record<TemplateHubBlockKind, string> = {
  children: 'Archive d’abord les versions personnalisées (enfants)',
  active_plans: 'Déjà envoyé à un client ou un groupe actif — impossible d’archiver',
  presta: 'Lié à une presta — retire le lien avant d’archiver',
}

export async function whyCannotMoveTemplateToDraft(
  supabase: AdminSupabase,
  programId: string,
  coachId: string,
): Promise<string | null> {
  const block = await getTemplateHubUsageBlock(supabase, programId, coachId)
  return block ? MOVE_MSGS[block] : null
}

export async function whyCannotArchiveTemplate(
  supabase: AdminSupabase,
  programId: string,
  coachId: string,
): Promise<string | null> {
  const block = await getTemplateHubUsageBlock(supabase, programId, coachId)
  return block ? ARCHIVE_MSGS[block] : null
}
