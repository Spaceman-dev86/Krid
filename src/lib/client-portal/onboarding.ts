import type { createClient } from '../supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type OnboardingQuestion = {
  id: string
  label: string
  type: 'texte' | 'nombre' | 'choix' | 'oui_non' | string
  required: boolean
  sort_order: number
  options: string[] | null
}

export function parseQuestionOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

export async function listCoachOnboardingQuestions(
  supabase: Supabase,
  coachId: string
): Promise<OnboardingQuestion[]> {
  const { data, error } = await supabase
    .from('coach_onboarding_questions')
    .select('id, label, type, required, sort_order, options')
    .eq('coach_id', coachId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((q) => ({
    id: q.id,
    label: q.label,
    type: q.type,
    required: q.required,
    sort_order: q.sort_order,
    options: parseQuestionOptions(q.options),
  }))
}

/** Nouveau compte : pas encore marqué completed, et le coach a au moins 1 question. */
export async function clientNeedsOnboarding(
  supabase: Supabase,
  opts: { coachId: string; clientId: string; onboardingCompletedAt: string | null }
): Promise<boolean> {
  if (opts.onboardingCompletedAt) return false
  const { count, error } = await supabase
    .from('coach_onboarding_questions')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', opts.coachId)
  if (error) return false
  return (count ?? 0) > 0
}
