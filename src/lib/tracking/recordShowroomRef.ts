'use server'

import { cookies } from 'next/headers'

import { createServiceRoleClient } from '../supabase/serviceRole'
import { TRACKED_REF_COOKIE } from './trackedLinks'

export type ResolvedTrackedLink = {
  id: string
  coachId: string
  code: string
  channel: string
  captureLeads: boolean
  label: string
  targetKind: string
  prestationId: string | null
  promoCodeId: string | null
}

function mapTrackedLinkRow(data: {
  id: string
  coach_id: string
  code: string
  channel: string
  capture_leads: boolean | null
  label: string
  target_kind: string
  prestation_id: string | null
  promo_code_id?: string | null
}): ResolvedTrackedLink {
  return {
    id: data.id,
    coachId: data.coach_id,
    code: data.code,
    channel: data.channel,
    captureLeads: true,
    label: data.label,
    targetKind: data.target_kind,
    prestationId: data.prestation_id,
    promoCodeId: data.promo_code_id ?? null,
  }
}

export async function resolveTrackedLinkByRef(
  coachId: string,
  ref: string | null | undefined
): Promise<ResolvedTrackedLink | null> {
  const code = ref?.trim()
  if (!code) return null

  const admin = createServiceRoleClient()
  if (!admin) return null

  // Exact match case-insensitive (évite wildcards %/_ d’un ilike brut).
  const safe = code.replace(/[%_]/g, '')
  if (!safe) return null

  const { data } = await admin
    .from('coach_tracked_links')
    .select(
      'id, coach_id, code, channel, capture_leads, label, target_kind, prestation_id, promo_code_id, status',
    )
    .eq('coach_id', coachId)
    .eq('status', 'active')
    .ilike('code', safe)
    .maybeSingle()

  if (!data) return null
  return mapTrackedLinkRow(data)
}

/** Lien défaut coach (ou premier actif) — pour CTA intérêt sans ?ref=. */
export async function resolveDefaultTrackedLink(
  coachId: string,
): Promise<ResolvedTrackedLink | null> {
  const admin = createServiceRoleClient()
  if (!admin) return null

  const { data: defaults } = await admin
    .from('coach_tracked_links')
    .select(
      'id, coach_id, code, channel, capture_leads, label, target_kind, prestation_id, promo_code_id, status',
    )
    .eq('coach_id', coachId)
    .eq('status', 'active')
    .eq('is_default', true)
    .order('created_at', { ascending: true })
    .limit(1)

  const fallback = defaults?.[0]
  if (fallback) return mapTrackedLinkRow(fallback)

  const { data: anyActive } = await admin
    .from('coach_tracked_links')
    .select(
      'id, coach_id, code, channel, capture_leads, label, target_kind, prestation_id, promo_code_id, status',
    )
    .eq('coach_id', coachId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)

  const row = anyActive?.[0]
  return row ? mapTrackedLinkRow(row) : null
}

/** Charge le code texte d’une promo liée à une campagne (active). */
export async function loadPromoCodeForLink(
  coachId: string,
  promoCodeId: string | null | undefined
): Promise<{ code: string; percentOff: number | null } | null> {
  if (!promoCodeId) return null
  const admin = createServiceRoleClient()
  if (!admin) return null
  const { data } = await admin
    .from('coach_codes')
    .select('code, percent_off, type, status')
    .eq('id', promoCodeId)
    .eq('coach_id', coachId)
    .maybeSingle()
  if (!data || data.type !== 'promo' || data.status !== 'active') return null
  return { code: data.code, percentOff: data.percent_off }
}

export async function recordTrackedClickAndSetCookie(opts: {
  coachId: string
  ref: string
  visitorKey?: string | null
}): Promise<ResolvedTrackedLink | null> {
  const link = await resolveTrackedLinkByRef(opts.coachId, opts.ref)
  if (!link) return null

  const admin = createServiceRoleClient()
  if (!admin) return link

  await admin.from('coach_tracked_link_clicks').insert({
    link_id: link.id,
    coach_id: link.coachId,
    visitor_key: opts.visitorKey ?? null,
  } as never)

  const jar = await cookies()
  jar.set(TRACKED_REF_COOKIE, link.code, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
    httpOnly: false,
  })

  return link
}

export async function getTrackedLinkIdFromCookie(coachId: string): Promise<string | null> {
  const jar = await cookies()
  const code = jar.get(TRACKED_REF_COOKIE)?.value
  if (!code) return null
  const link = await resolveTrackedLinkByRef(coachId, code)
  return link?.id ?? null
}

export async function attributeClientTrackedLink(opts: {
  coachId: string
  clientUserId: string
}) {
  const linkId = await getTrackedLinkIdFromCookie(opts.coachId)
  if (!linkId) return

  const admin = createServiceRoleClient()
  if (!admin) return

  await admin
    .from('clients')
    .update({ tracked_link_id: linkId } as never)
    .eq('coach_id', opts.coachId)
    .eq('user_id', opts.clientUserId)
    .is('tracked_link_id', null)
}
