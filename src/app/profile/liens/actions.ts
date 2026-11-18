'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { randomRefCode } from '../../../lib/tracking/trackedLinks'
import { createClient } from '../../../lib/supabase/server'

function clean(v: FormDataEntryValue | null) {
  const s = typeof v === 'string' ? v.trim() : ''
  return s || null
}

export async function createTrackedLinkAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const label = clean(formData.get('label'))
  const channel = 'other'
  const targetKind = clean(formData.get('target_kind')) ?? 'showroom'
  const prestationId = clean(formData.get('prestation_id'))
  const promoCodeId = clean(formData.get('promo_code_id'))

  if (!label) redirect('/profile/liens?error=' + encodeURIComponent('Libellé requis'))
  if (targetKind === 'prestation' && !prestationId) {
    redirect('/profile/liens?error=' + encodeURIComponent('Choisis une prestation'))
  }
  if (targetKind === 'prestation' && prestationId) {
    const { data: presta } = await supabase
      .from('prestations')
      .select('id')
      .eq('id', prestationId)
      .eq('coach_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!presta) redirect('/profile/liens?error=' + encodeURIComponent('Prestation invalide'))
  }

  if (promoCodeId) {
    const { data: promo } = await supabase
      .from('coach_codes')
      .select('id, type, status, prestation_ids')
      .eq('id', promoCodeId)
      .eq('coach_id', user.id)
      .maybeSingle()
    if (!promo || promo.type !== 'promo' || promo.status !== 'active') {
      redirect('/profile/liens?error=' + encodeURIComponent('Promo invalide ou inactive'))
    }
    if (targetKind === 'prestation' && prestationId) {
      const ids = promo.prestation_ids ?? []
      if (!ids.includes(prestationId)) {
        redirect(
          '/profile/liens?error=' +
            encodeURIComponent('Cette promo ne s’applique pas à la prestation choisie'),
        )
      }
    }
  }

  const code = randomRefCode('r').toLowerCase()
  if (!/^[a-z0-9-]{3,24}$/.test(code)) {
    redirect('/profile/liens?error=' + encodeURIComponent('Code ref : 3–24 caractères (a-z, 0-9, -)'))
  }

  const { error } = await supabase.from('coach_tracked_links').insert({
    coach_id: user.id,
    code,
    label,
    channel,
    target_kind: targetKind,
    prestation_id: targetKind === 'prestation' ? prestationId : null,
    promo_code_id: promoCodeId,
    capture_leads: true,
    share_message: null,
    is_default: false,
    status: 'active',
  } as never)

  if (error) {
    const msg = /unique|duplicate/i.test(error.message) ? 'Ce code ref existe déjà.' : error.message
    redirect('/profile/liens?error=' + encodeURIComponent(msg))
  }

  revalidatePath('/profile/liens')
  redirect(`/profile/liens?created=${encodeURIComponent(code)}`)
}

export async function ensureDefaultTrackedLinkAction() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  // Self-heal : toutes les campagnes actives capturent les leads.
  await supabase
    .from('coach_tracked_links')
    .update({ capture_leads: true } as never)
    .eq('coach_id', user.id)
    .eq('status', 'active')
    .eq('capture_leads', false)

  const { data: existingRows } = await supabase
    .from('coach_tracked_links')
    .select('id')
    .eq('coach_id', user.id)
    .eq('is_default', true)
    .eq('status', 'active')
    .limit(1)

  if (existingRows?.length) return

  await supabase.from('coach_tracked_links').insert({
    coach_id: user.id,
    code: randomRefCode('main'),
    label: 'Showroom principal',
    channel: 'other',
    target_kind: 'showroom',
    capture_leads: true,
    is_default: true,
    status: 'active',
  } as never)
}

export async function toggleCaptureLeadsAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('link_id'))
  const next = clean(formData.get('next')) === '1'
  if (!id) redirect('/profile/liens')

  await supabase
    .from('coach_tracked_links')
    .update({ capture_leads: next } as never)
    .eq('id', id)
    .eq('coach_id', user.id)

  revalidatePath('/profile/liens')
  redirect('/profile/liens')
}

export async function archiveTrackedLinkAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('link_id'))
  if (!id) redirect('/profile/liens')

  await supabase
    .from('coach_tracked_links')
    .update({ status: 'archived', is_default: false } as never)
    .eq('id', id)
    .eq('coach_id', user.id)

  revalidatePath('/profile/liens')
  redirect('/profile/liens?archived=1')
}

export async function updateTrackedLinkShareAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('link_id'))
  const shareMessage = clean(formData.get('share_message'))
  if (!id) redirect('/profile/liens')

  const { error } = await supabase
    .from('coach_tracked_links')
    .update({ share_message: shareMessage } as never)
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) redirect('/profile/liens?error=' + encodeURIComponent(error.message))

  revalidatePath('/profile/liens')
  redirect('/profile/liens?saved=1')
}

/** Contacts IG / WA / FB utilisés pour ouvrir la discussion après Envoyer. */
export async function saveLiensContactsAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawIg = clean(formData.get('contact_instagram'))
  const contactInstagram = rawIg
    ? rawIg
        .replace(/^@+/, '')
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/^instagram\.com\//i, '')
        .split(/[/?#]/)[0]
        ?.replace(/\/+$/, '')
        .toLowerCase() || null
    : null
  const contactWhatsapp = clean(formData.get('contact_whatsapp'))?.replace(/\D/g, '') || null
  const contactFacebook = clean(formData.get('contact_facebook'))

  const { data: existing } = await supabase
    .from('coach_branding')
    .select('slug, app_name')
    .eq('coach_id', user.id)
    .maybeSingle()

  const { error } = await supabase.from('coach_branding').upsert(
    {
      coach_id: user.id,
      slug: existing?.slug ?? `coach-${user.id.slice(0, 8)}`,
      app_name: existing?.app_name ?? 'Mon app',
      contact_instagram: contactInstagram,
      contact_whatsapp: contactWhatsapp,
      contact_facebook: contactFacebook,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: 'coach_id' },
  )

  if (error) redirect('/profile/liens?error=' + encodeURIComponent(error.message))

  revalidatePath('/profile/liens')
  revalidatePath('/profile/mon-app')
  redirect('/profile/liens?contacts=1')
}
