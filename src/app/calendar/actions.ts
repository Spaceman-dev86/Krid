'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { parseLocalDateTime } from '../../lib/calendar/rdv'
import { chatDb } from '../../lib/chat/chat'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { createClient } from '../../lib/supabase/server'

async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  return { supabase, userId: user.id }
}

async function revalidateClientPortal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string
) {
  revalidatePath('/calendar')
  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', coachId)
    .maybeSingle()
  if (branding?.slug) {
    revalidatePath(`/c/${branding.slug}/home`)
    revalidatePath(`/c/${branding.slug}/calendrier`)
  }
}

/** Coach crée un créneau → pending (client Accept / Refuse). */
export async function createCoachRdvAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const clientId = String(formData.get('client_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'RDV'
  const date = String(formData.get('date') ?? '').trim()
  const time = String(formData.get('time') ?? '').trim()
  const durationMin = Math.min(
    240,
    Math.max(15, Number(formData.get('duration_min') ?? 60) || 60)
  )
  const modalityRaw = String(formData.get('modality') ?? '').trim()
  const modality = modalityRaw === 'visio' || modalityRaw === 'physique' ? modalityRaw : null
  const location = String(formData.get('location') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!clientId) redirect('/calendar?error=' + encodeURIComponent('Client requis'))

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect('/calendar?error=' + encodeURIComponent('Client introuvable'))

  const startsAt = parseLocalDateTime(date, time)
  if (!startsAt) redirect('/calendar?error=' + encodeURIComponent('Date / heure invalides'))

  const ends = new Date(startsAt)
  ends.setMinutes(ends.getMinutes() + durationMin)

  const db = chatDb(supabase)
  const { error } = await db.from('calendar_events').insert({
    coach_id: userId,
    client_id: clientId,
    title,
    starts_at: startsAt,
    ends_at: ends.toISOString(),
    modality,
    location,
    notes,
    status: 'pending',
    created_by: 'coach',
  })

  if (error) redirect('/calendar?error=' + encodeURIComponent(error.message))

  await revalidateClientPortal(supabase, userId)
  redirect('/calendar?created=1')
}

/** Coach accepte ou refuse une demande client (requested). */
export async function respondCoachRdvAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const eventId = String(formData.get('event_id') ?? '').trim()
  const decision = String(formData.get('decision') ?? '').trim()
  const week = String(formData.get('week') ?? '').trim()

  if (!eventId) redirect('/calendar?error=' + encodeURIComponent('RDV manquant'))
  if (decision !== 'accepted' && decision !== 'refused') {
    redirect('/calendar?error=' + encodeURIComponent('Décision invalide'))
  }

  const db = chatDb(supabase)
  const { error } = await db
    .from('calendar_events')
    .update({
      status: decision,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('coach_id', userId)
    .eq('status', 'requested')
    .is('deleted_at', null)

  if (error) redirect('/calendar?error=' + encodeURIComponent(error.message))

  await revalidateClientPortal(supabase, userId)
  const q = decision === 'accepted' ? 'accepted=1' : 'refused=1'
  redirect(`/calendar?${q}${week ? `&week=${encodeURIComponent(week)}` : ''}`)
}

export async function cancelCoachRdvAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const eventId = String(formData.get('event_id') ?? '').trim()
  const week = String(formData.get('week') ?? '').trim()
  if (!eventId) redirect('/calendar')

  const db = chatDb(supabase)
  await db
    .from('calendar_events')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  await revalidateClientPortal(supabase, userId)
  redirect(`/calendar${week ? `?week=${encodeURIComponent(week)}` : ''}`)
}
