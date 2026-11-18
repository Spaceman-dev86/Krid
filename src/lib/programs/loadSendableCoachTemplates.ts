import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Templates coach envoyables : feuille ou enfant.
 * Exclut les parents qui ont déjà des versions personnalisées.
 */
export async function loadSendableCoachTemplates(
  supabase: SupabaseClient,
  coachId: string,
): Promise<{ id: string; title: string; is_template?: boolean | null }[]> {
  let q = await supabase
    .from('programs')
    .select('id, title, is_template, parent_program_id')
    .eq('coach_id', coachId)
    .eq('is_template', true)
    .eq('is_client_instance', false)
    .is('deleted_at', null)
    .order('title', { ascending: true })

  if (q.error && /is_client_instance|parent_program_id/i.test(q.error.message)) {
    q = await supabase
      .from('programs')
      .select('id, title, is_template')
      .eq('coach_id', coachId)
      .eq('is_template', true)
      .is('deleted_at', null)
      .order('title', { ascending: true })
  }

  if (q.error) throw new Error(q.error.message)

  const rows = (q.data ?? []) as {
    id: string
    title: string | null
    is_template?: boolean | null
    parent_program_id?: string | null
  }[]

  const parentsWithKids = new Set(
    rows
      .map((r) => r.parent_program_id?.trim())
      .filter((id): id is string => Boolean(id)),
  )

  return rows
    .filter((r) => !parentsWithKids.has(r.id))
    .map((r) => ({
      id: r.id,
      title: r.title?.trim() || 'Sans titre',
      is_template: r.is_template,
    }))
}
