import { cache } from 'react'

import {
  ensureCoachTrial,
  isTrialExpired,
  trialDaysRemaining,
  type CoachBrandingRow,
  type CoachSubscriptionRow,
} from '../tenancy/ensureCoachTrial'
import { countCoachUnreadSav } from '../admin/savUnread'
import { countCoachChatUnread } from '../chat/chat'
import { createClient } from '../supabase/server'

/**
 * Shell coach (branding + compteurs). `cache()` = 1 seul fetch par requête RSC
 * (layout + page qui appellent tous les deux).
 */
export const loadCoachShellContext = cache(async function loadCoachShellContext(
  userId: string,
  opts?: { light?: boolean }
): Promise<{
  branding: CoachBrandingRow | null
  subscription: CoachSubscriptionRow | null
  trialLabel: string | null
  trialError?: string
  trialCreated: boolean
  savUnread: number
  chatUnread: number
  notifUnread: number
  /** Deep-link cloche (chat thread ou calendrier). */
  notifHref: string
}> {
  const supabase = await createClient()
  const light = Boolean(opts?.light)

  let subscription: CoachSubscriptionRow | null = null
  let created = false
  let error: string | undefined
  let branding: CoachBrandingRow | null = null
  let savUnread = 0
  let chatUnread = 0
  let notifUnread = 0
  let notifHref = '/chat'

  try {
    const trial = await ensureCoachTrial(supabase, userId)
    subscription = trial.subscription
    created = trial.created
    error = trial.error
  } catch {
    // ignore
  }

  try {
    const { data } = await supabase
      .from('coach_branding')
      .select('*')
      .eq('coach_id', userId)
      .maybeSingle()
    branding = (data as CoachBrandingRow | null) ?? null
  } catch {
    // ignore
  }

  // Compteurs : best-effort, jamais bloquant. Mode light = skip chat count (déjà dans inbox).
  try {
    const tasks: Promise<void>[] = [
      countCoachUnreadSav(supabase, userId)
        .then((n) => {
          savUnread = n
        })
        .catch(() => {}),
    ]
    if (!light) {
      tasks.push(
        countCoachChatUnread(supabase, userId, userId)
          .then((n) => {
            chatUnread = n
          })
          .catch(() => {})
      )
    }
    await Promise.all(tasks)
  } catch {
    // ignore
  }

  try {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
    notifUnread = count ?? 0
  } catch {
    // ignore
  }

  try {
    const { data: latestNotif } = await supabase
      .from('notifications')
      .select('type, payload')
      .eq('user_id', userId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestNotif) {
      const payload = (latestNotif.payload ?? {}) as { href?: string; thread_id?: string }
      if (typeof payload.href === 'string' && payload.href.startsWith('/')) {
        notifHref = payload.href
      } else if (latestNotif.type === 'showroom_interest') {
        notifHref = '/profile/liens'
      } else if (latestNotif.type === 'chat_message' && payload.thread_id) {
        notifHref = `/chat/${payload.thread_id}`
      } else if (latestNotif.type === 'chat_message') {
        notifHref = '/chat'
      }
    }
  } catch {
    // ignore
  }

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
    chatUnread,
    notifUnread,
    notifHref,
  }
})
