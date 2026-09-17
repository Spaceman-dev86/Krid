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
  const channel = clean(formData.get('channel')) ?? 'other'
  const targetKind = clean(formData.get('target_kind')) ?? 'showroom'
  const prestationId = clean(formData.get('prestation_id'))
  const customCode = clean(formData.get('code'))
  const captureLeads = formData.get('capture_leads') === 'on'
  const shareMessage = clean(formData.get('share_message'))

  if (!label) redirect('/profile/liens?error=' + encodeURIComponent('Libellé requis'))
  if (!['ig', 'wa', 'fb', 'other'].includes(channel)) {
    redirect('/profile/liens?error=' + encodeURIComponent('Canal invalide'))
  }
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

  const code = (customCode ?? randomRefCode(channel === 'other' ? 'r' : channel.slice(0, 2))).toLowerCase()
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
    capture_leads: captureLeads,
    share_message: shareMessage,
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

  const { data: existing } = await supabase
    .from('coach_tracked_links')
    .select('id')
    .eq('coach_id', user.id)
    .eq('is_default', true)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) return

  await supabase.from('coach_tracked_links').insert({
    coach_id: user.id,
    code: randomRefCode('main'),
    label: 'Showroom principal',
    channel: 'other',
    target_kind: 'showroom',
    capture_leads: false,
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
