'use server'

import {
  recordTrackedClickAndSetCookie,
  resolveDefaultTrackedLink,
  resolveTrackedLinkByRef,
} from './recordShowroomRef'
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
    captureLeads: true,
    channel: link.channel,
    linkId: link.id,
    label: link.label,
  }
}

export async function resolveShowroomRefAction(input: {
  coachId: string
  ref?: string | null
}): Promise<
  | { ok: true; captureLeads: boolean; channel: string; linkId: string; label: string; code: string }
  | { ok: false }
> {
  const link = input.ref?.trim()
    ? await resolveTrackedLinkByRef(input.coachId, input.ref)
    : await resolveDefaultTrackedLink(input.coachId)
  if (!link) return { ok: false }
  return {
    ok: true,
    captureLeads: true,
    channel: link.channel,
    linkId: link.id,
    label: link.label,
    code: link.code,
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
  email?: string
  birthdate?: string
  prestationId?: string
  note?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createServiceRoleClient()
  if (!admin) return { ok: false, error: 'config' }

  const { data: link } = await admin
    .from('coach_tracked_links')
    .select('id, coach_id, capture_leads, channel, status')
    .eq('id', input.linkId)
    .eq('coach_id', input.coachId)
    .maybeSingle()

  if (!link || link.status !== 'active') {
    return { ok: false, error: 'Lien indisponible.' }
  }

  if (!link.capture_leads) {
    await admin
      .from('coach_tracked_links')
      .update({ capture_leads: true } as never)
      .eq('id', link.id)
  }

  const email = input.email?.trim().toLowerCase() || null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Email invalide.' }
  }

  const birthdate = input.birthdate?.trim() || null
  if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    return { ok: false, error: 'Date de naissance invalide.' }
  }

  if (input.prestationId) {
    const { data: presta } = await admin
      .from('prestations')
      .select('id')
      .eq('id', input.prestationId)
      .eq('coach_id', input.coachId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!presta) return { ok: false, error: 'Prestation invalide.' }
  }

  const note = input.note?.trim() || null
  if (note && note.length > 500) {
    return { ok: false, error: 'Note trop longue (500 caractères max).' }
  }

  const firstName = input.firstName?.trim() || null
  const lastName = input.lastName?.trim() || null

  const { error } = await admin.from('coach_tracked_leads').insert({
    link_id: link.id,
    coach_id: link.coach_id,
    channel: input.channel || link.channel,
    handle: input.handle?.trim() || null,
    phone: input.phone?.trim() || null,
    first_name: firstName,
    last_name: lastName,
    email,
    birthdate,
    note,
    prestation_id: input.prestationId ?? null,
  } as never)

  if (error) return { ok: false, error: error.message }

  const who =
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    email ||
    'Un prospect'
  await admin.from('notifications').insert({
    user_id: link.coach_id,
    type: 'showroom_interest',
    title: 'Nouveau « Je suis intéressé »',
    body: `${who} a laissé ses infos sur ton showroom.`,
    payload: { href: '/profile/liens' },
  } as never)

  return { ok: true }
}
