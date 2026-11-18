'use server'

import { redirect } from 'next/navigation'

import { resolveTrackedLinkByRef } from '../../../../../../lib/tracking/recordShowroomRef'
import { createClient } from '../../../../../../lib/supabase/server'
import { createServiceRoleClient } from '../../../../../../lib/supabase/serviceRole'
import { withRef } from '../../../../../../lib/tracking/trackedLinks'

function clean(v: FormDataEntryValue | null) {
  const s = typeof v === 'string' ? v.trim() : ''
  return s || null
}

function interestPath(slug: string, prestaId: string, ref: string | null, error?: string) {
  const path = withRef(`/c/${slug}/showroom/${prestaId}/interesse`, ref)
  if (!error) return path
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}error=${encodeURIComponent(error)}`
}

export async function pursuePrestaInterestAction(formData: FormData) {
  const slug = clean(formData.get('slug'))
  const prestaId = clean(formData.get('prestation_id'))
  const coachId = clean(formData.get('coach_id'))
  const ref = clean(formData.get('ref'))
  const firstName = clean(formData.get('first_name'))
  const lastName = clean(formData.get('last_name'))
  const emailRaw = clean(formData.get('email'))
  const birthdate = clean(formData.get('birthdate'))

  if (!slug || !prestaId || !coachId) redirect('/')

  const fail = (msg: string) => redirect(interestPath(slug, prestaId, ref, msg))

  if (!firstName || !lastName || !emailRaw || !birthdate) {
    fail('Tous les champs sont requis.')
  }

  const email = emailRaw!.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Email invalide.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate!)) fail('Date de naissance invalide.')

  const supabase = await createClient()
  const { data: presta } = await supabase
    .from('prestations')
    .select('id, coach_id')
    .eq('id', prestaId)
    .eq('coach_id', coachId)
    .eq('showroom_visible', true)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()

  if (!presta) fail('Offre introuvable.')

  let linkId: string | null = null
  let channel = 'other'
  if (ref) {
    const link = await resolveTrackedLinkByRef(coachId, ref)
    if (link?.captureLeads) {
      linkId = link.id
      channel = link.channel
    }
  }

  if (!linkId) {
    const admin = createServiceRoleClient()
    if (admin) {
      const { data: def } = await admin
        .from('coach_tracked_links')
        .select('id, channel, capture_leads, status')
        .eq('coach_id', coachId)
        .eq('is_default', true)
        .eq('status', 'active')
        .maybeSingle()
      if (def?.capture_leads) {
        linkId = def.id
        channel = def.channel
      }
    }
  }

  if (!linkId) fail('Capture leads indisponible pour cette campagne.')

  const admin = createServiceRoleClient()
  if (!admin) fail('Configuration serveur.')

  const { error } = await admin!.from('coach_tracked_leads').insert({
    link_id: linkId,
    coach_id: coachId,
    channel,
    first_name: firstName,
    last_name: lastName,
    email,
    birthdate,
    prestation_id: prestaId,
  } as never)

  if (error) fail(error.message)

  redirect(withRef(`/c/${slug}/showroom/${prestaId}`, ref))
}
