import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../supabase/database.types'

export const TRIAL_DAYS = 15

export type CoachSubscriptionRow = Database['public']['Tables']['coach_subscriptions']['Row']
export type CoachBrandingRow = Database['public']['Tables']['coach_branding']['Row']

type Client = SupabaseClient<Database>

function addCalendarDays(from: Date, days: number) {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

/** Démarre l’essai 15 j à la 1ʳᵉ connexion app si aucune subscription. */
export async function ensureCoachTrial(
  supabase: Client,
  coachId: string
): Promise<{ subscription: CoachSubscriptionRow | null; created: boolean; error?: string }> {
  const { data: existing, error: selectError } = await supabase
    .from('coach_subscriptions')
    .select('*')
    .eq('coach_id', coachId)
    .in('status', ['trial', 'active', 'past_due', 'expired_trial', 'canceled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (selectError) {
    return { subscription: null, created: false, error: selectError.message }
  }

  if (existing) {
    return { subscription: existing, created: false }
  }

  const now = new Date()
  const trialEnds = addCalendarDays(now, TRIAL_DAYS)

  const { data: inserted, error: insertError } = await supabase
    .from('coach_subscriptions')
    .insert({
      coach_id: coachId,
      plan_tier: 'business',
      status: 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
    })
    .select('*')
    .maybeSingle()

  if (insertError) {
    return { subscription: null, created: false, error: insertError.message }
  }

  return { subscription: inserted, created: true }
}

export function trialDaysRemaining(subscription: CoachSubscriptionRow | null): number | null {
  if (!subscription?.trial_ends_at) return null
  if (subscription.status !== 'trial' && subscription.status !== 'expired_trial') return null
  const end = new Date(subscription.trial_ends_at).getTime()
  const ms = end - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

export function isTrialExpired(subscription: CoachSubscriptionRow | null): boolean {
  if (!subscription) return false
  if (subscription.status === 'expired_trial') return true
  if (subscription.status !== 'trial' || !subscription.trial_ends_at) return false
  return new Date(subscription.trial_ends_at).getTime() < Date.now()
}
