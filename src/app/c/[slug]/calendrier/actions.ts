'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  formatRdvDuration,
  formatRdvWhen,
  notifyCoachRdvRequest,
  parseLocalDateTime,
  RDV_MODALITY_LABELS,
  type RdvModality,
} from '../../../../lib/calendar/rdv'
import { chatDb } from '../../../../lib/chat/chat'
import { createClient } from '../../../../lib/supabase/server'

function portalBase(slug: string) {
  return `/c/${slug}`
}

async function requirePortalClient(slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login/client?redirectTo=${encodeURIComponent(portalBase(slug) + '/calendrier')}`)
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) redirect('/')

  const { data: client } = await supabase
    .from('clients')
    .select('id, coach_id')
    .eq('coach_id', branding.coach_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect(`${portalBase(slug)}?error=not_your_coach`)

  return {
    supabase,
    userId: user.id,
    clientId: client.id,
    coachId: client.coach_id as string,
    slug,
  }
}

/** Client propose un créneau → status requested (coach Accept / Refuse). */
export async function requestRdvAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'RDV'
  const message = String(formData.get('message') ?? '').trim()
  const date = String(formData.get('date') ?? '').trim()
  const time = String(formData.get('time') ?? '').trim()
  const durationMin = Math.min(
    240,
    Math.max(15, Number(formData.get('duration_min') ?? 60) || 60)
  )
  const modalityRaw = String(formData.get('modality') ?? '').trim() as RdvModality | ''
  const modality =
    modalityRaw === 'visio' || modalityRaw === 'physique' ? modalityRaw : null

  if (!slug) redirect('/login/client')

  const ctx = await requirePortalClient(slug)

  const startsAt = parseLocalDateTime(date, time)
  if (!startsAt) {
    redirect(`${portalBase(slug)}/calendrier?error=${encodeURIComponent('Date / heure invalides')}`)
  }

  if (new Date(startsAt).getTime() < Date.now() - 60_000) {
    redirect(
      `${portalBase(slug)}/calendrier?error=${encodeURIComponent('Choisis une date dans le futur')}`
    )
  }

  if (!modality) {
    redirect(
      `${portalBase(slug)}/calendrier?error=${encodeURIComponent('Choisis Physique ou Visio')}`
    )
  }

  const ends = new Date(startsAt)
  ends.setMinutes(ends.getMinutes() + durationMin)

  const db = chatDb(ctx.supabase)
  const { error } = await db.from('calendar_events').insert({
    coach_id: ctx.coachId,
    client_id: ctx.clientId,
    title,
    starts_at: startsAt,
    ends_at: ends.toISOString(),
    modality,
    status: 'requested',
    created_by: 'client',
    client_message: message ? message.slice(0, 2000) : null,
  })

  if (error) {
    redirect(`${portalBase(slug)}/calendrier?error=${encodeURIComponent(error.message)}`)
  }

  const summary = [
    formatRdvWhen(startsAt),
    formatRdvDuration(durationMin),
    RDV_MODALITY_LABELS[modality],
    message || null,
  ]
    .filter(Boolean)
    .join(' · ')

  await notifyCoachRdvRequest(ctx.supabase, ctx.clientId, ctx.userId, summary)

  revalidatePath(`${portalBase(slug)}/calendrier`)
  revalidatePath(`${portalBase(slug)}/home`)
  revalidatePath('/calendar')
  redirect(`${portalBase(slug)}/calendrier?requested=1`)
}

/** Client répond à une proposition coach (pending). */
export async function respondRdvAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const eventId = String(formData.get('event_id') ?? '').trim()
  const decision = String(formData.get('decision') ?? '').trim()
  if (!slug || !eventId) redirect('/login/client')

  if (decision !== 'accepted' && decision !== 'refused') {
    redirect(`${portalBase(slug)}/calendrier?error=${encodeURIComponent('Décision invalide')}`)
  }

  const ctx = await requirePortalClient(slug)
  const db = chatDb(ctx.supabase)
  const { error } = await db
    .from('calendar_events')
    .update({
      status: decision,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('client_id', ctx.clientId)
    .eq('status', 'pending')
    .eq('created_by', 'coach')
    .is('deleted_at', null)

  if (error) {
    redirect(`${portalBase(slug)}/calendrier?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`${portalBase(slug)}/calendrier`)
  revalidatePath(`${portalBase(slug)}/home`)
  revalidatePath('/calendar')
  redirect(
    `${portalBase(slug)}/calendrier?${decision === 'accepted' ? 'accepted' : 'refused'}=1`
  )
}

/** Client annule sa demande (requested) ou une proposition coach non répondue (pending). */
export async function cancelClientRdvAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const eventId = String(formData.get('event_id') ?? '').trim()
  if (!slug || !eventId) redirect('/login/client')

  const ctx = await requirePortalClient(slug)
  const db = chatDb(ctx.supabase)

  const { data: row } = await db
    .from('calendar_events')
    .select('id, status, created_by')
    .eq('id', eventId)
    .eq('client_id', ctx.clientId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!row) {
    redirect(`${portalBase(slug)}/calendrier?error=${encodeURIComponent('RDV introuvable')}`)
  }

  const canCancel =
    row.status === 'requested' ||
    (row.status === 'pending' && row.created_by === 'coach')

  if (!canCancel) {
    redirect(
      `${portalBase(slug)}/calendrier?error=${encodeURIComponent('Impossible d’annuler ce RDV')}`
    )
  }

  const { error } = await db
    .from('calendar_events')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('client_id', ctx.clientId)

  if (error) {
    redirect(`${portalBase(slug)}/calendrier?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`${portalBase(slug)}/calendrier`)
  revalidatePath(`${portalBase(slug)}/home`)
  revalidatePath('/calendar')
  redirect(`${portalBase(slug)}/calendrier?cancelled=1`)
}
