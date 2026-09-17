import type { createClient } from '../supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Lie la session auth aux fiches client dont l’email CRM correspond. */
export async function tryClaimClientForCoach(
  supabase: Supabase,
  coachId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('claim_client_by_email_for_coach', {
    p_coach_id: coachId,
  })
  return !error
}

export async function tryClaimClientRowsByEmail(supabase: Supabase): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_client_rows_by_email')
  if (error) return false
  return typeof data === 'number' && data > 0
}
