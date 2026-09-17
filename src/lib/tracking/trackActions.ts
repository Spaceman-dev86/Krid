'use server'

import { recordTrackedClickAndSetCookie } from './recordShowroomRef'
import { createServiceRoleClient } from '../supabase/serviceRole'

export async function trackShowroomRefAction(input: {
  coachId: string
  ref: string
}): Promise<
  | { ok: true; captureLeads: boolean; channel: string; linkId: string; label: string }
  | { ok: false }
> {
  const link = await recordTrackedClickAndSetCookie({
    coachId: input.coachId,
    ref: input.ref,
  })
  if (!link) return { ok: false }
  return {
    ok: true,
    captureLeads: link.captureLeads,
    channel: link.channel,
    linkId: link.id,
    label: link.label,
  }
}

export async function submitTrackedLeadAction(input: {
  linkId: string
  coachId: string
  channel: string
  handle?: string
  phone?: string
  firstName?: string
  lastName?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createServiceRoleClient()
  if (!admin) return { ok: false, error: 'config' }

  const { data: link } = await admin
    .from('coach_tracked_links')
    .select('id, coach_id, capture_leads, channel, status')
    .eq('id', input.linkId)
    .eq('coach_id', input.coachId)
    .maybeSingle()

  if (!link || link.status !== 'active' || !link.capture_leads) {
    return { ok: false, error: 'Capture leads désactivée pour ce lien.' }
  }

  const { error } = await admin.from('coach_tracked_leads').insert({
    link_id: link.id,
    coach_id: link.coach_id,
    channel: input.channel || link.channel,
    handle: input.handle?.trim() || null,
    phone: input.phone?.trim() || null,
    first_name: input.firstName?.trim() || null,
    last_name: input.lastName?.trim() || null,
  } as never)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
