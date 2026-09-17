import {
  ensureCoachTrial,
  isTrialExpired,
  trialDaysRemaining,
  type CoachBrandingRow,
  type CoachSubscriptionRow,
} from '../tenancy/ensureCoachTrial'
import { countCoachUnreadSav } from '../admin/savUnread'
import { createClient } from '../supabase/server'

export async function loadCoachShellContext(userId: string): Promise<{
  branding: CoachBrandingRow | null
  subscription: CoachSubscriptionRow | null
  trialLabel: string | null
  trialError?: string
  trialCreated: boolean
  savUnread: number
}> {
  const supabase = await createClient()
  const { subscription, created, error } = await ensureCoachTrial(supabase, userId)
  const { data: branding } = await supabase.from('coach_branding').select('*').eq('coach_id', userId).maybeSingle()

  const savUnread = await countCoachUnreadSav(supabase, userId)

  const days = trialDaysRemaining(subscription)
  const expired = isTrialExpired(subscription)
  const trialLabel =
    subscription?.status === 'active'
      ? `Plan ${subscription.plan_tier}`
      : expired
        ? 'Essai expiré'
        : days != null
          ? `Essai · ${days} j restants`
          : subscription
            ? `Statut · ${subscription.status}`
            : null

  return {
    branding,
    subscription,
    trialLabel,
    trialError: error,
    trialCreated: created,
    savUnread,
  }
}
