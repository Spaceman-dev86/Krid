'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  clientCalendrierPath,
  findCoachConflicts,
  listCoachEvents,
  notifyCoachProposedRdv,
  parseLocalDateTime,
  rdvReminderDraft,
  type CalendarEventRow,
} from '../../lib/calendar/rdv'
import { chatDb, ensureDmThreadId, sendChatMessage } from '../../lib/chat/chat'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { safeInternalPath } from '../../lib/navigation/safeReturnTo'
import { createClient } from '../../lib/supabase/server'
import { appUrl } from '../../lib/urls'

export type CreateCoachRdvResult =
  | { ok: true }
  | { ok: false; reason: 'conflict' }
  | { ok: false; reason: 'error'; message: string }

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

function safeReturnTo(raw: string): string {
  return safeInternalPath(raw, '/calendar')
}

function withQuery(path: string, params: Record<string, string>) {
  const u = new URL(path, 'http://local')
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, v)
  }
  return `${u.pathname}${u.search}`
}

async function coachCalendrierLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
): Promise<string | null> {
  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', coachId)
    .maybeSingle()
  if (!branding?.slug) return null
  return appUrl(clientCalendrierPath(branding.slug))
}

async function revalidateClientPortal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
  extraPaths: string[] = [],
) {
  revalidatePath('/calendar')
  revalidatePath('/home')
  for (const p of extraPaths) revalidatePath(p)
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

/**
 * Coach crée un créneau → pending.
 * Conflit sans ack → retour soft `{ reason: 'conflict' }` (popup reste ouverte).
 * Succès → redirect `?created=1`.
 */
export async function createCoachRdvAction(
  _prev: CreateCoachRdvResult | null,
  formData: FormData,
): Promise<CreateCoachRdvResult> {
  const { supabase, userId } = await requireCoach()
  const returnTo = safeReturnTo(String(formData.get('return_to') ?? '/calendar'))
  const audience = String(formData.get('audience') ?? '').trim()
  const legacyClientId = String(formData.get('client_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'RDV'
  const date = String(formData.get('date') ?? '').trim()
  const time = String(formData.get('time') ?? '').trim()
  const durationMin = Math.min(
    240,
    Math.max(15, Number(formData.get('duration_min') ?? 60) || 60),
  )
  const modalityRaw = String(formData.get('modality') ?? '').trim()
  const modality = modalityRaw === 'visio' || modalityRaw === 'physique' ? modalityRaw : null
  const location = String(formData.get('location') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null
  const confirmConflict = String(formData.get('confirm_conflict') ?? '').trim() === '1'

  let clientIds: string[] = []
  let groupId: string | null = null
  let prestationId: string | null = null

  if (audience.startsWith('client:')) {
    clientIds = [audience.slice('client:'.length)]
  } else if (audience.startsWith('group:')) {
    groupId = audience.slice('group:'.length)
  } else if (audience.startsWith('presta:')) {
    prestationId = audience.slice('presta:'.length)
  } else if (legacyClientId) {
    clientIds = [legacyClientId]
  }

  if (groupId) {
    const { data: group } = await supabase
      .from('client_groups')
      .select('id')
      .eq('id', groupId)
      .eq('coach_id', userId)
      .in('type', ['manual', 'linked'])
      .maybeSingle()
    if (!group) return { ok: false, reason: 'error', message: 'Groupe introuvable' }
    const { resolveGroupAudienceClientIds } = await import('../../lib/coach/linkedGroups')
    const audience = await resolveGroupAudienceClientIds(supabase, {
      coachId: userId,
      groupIds: [groupId],
    })
    clientIds = audience.clientIds
    if (!clientIds.length) {
      return { ok: false, reason: 'error', message: 'Aucun membre actif dans ce groupe' }
    }
  }

  if (prestationId) {
    const { data: presta } = await supabase
      .from('prestations')
      .select('id')
      .eq('id', prestationId)
      .eq('coach_id', userId)
      .maybeSingle()
    if (!presta) return { ok: false, reason: 'error', message: 'Prestation introuvable' }
    const { data: grants } = await supabase
      .from('client_grants')
      .select('client_id')
      .eq('prestation_id', prestationId)
      .eq('status', 'active')
    clientIds = [...new Set((grants ?? []).map((g) => g.client_id).filter(Boolean))]
    if (!clientIds.length) {
      return { ok: false, reason: 'error', message: 'Aucun client actif sur cette prestation' }
    }
  }

  if (!clientIds.length) return { ok: false, reason: 'error', message: 'Destinataire requis' }

  const { data: owned } = await supabase
    .from('clients')
    .select('id')
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .in('id', clientIds)

  const ownedIds = new Set((owned ?? []).map((c) => c.id))
  clientIds = clientIds.filter((id) => ownedIds.has(id))
  if (!clientIds.length) return { ok: false, reason: 'error', message: 'Client introuvable' }

  const startsAt = parseLocalDateTime(date, time)
  if (!startsAt) return { ok: false, reason: 'error', message: 'Date / heure invalides' }

  const ends = new Date(startsAt)
  ends.setMinutes(ends.getMinutes() + durationMin)
  const endsAt = ends.toISOString()

  let existing: CalendarEventRow[] = []
  try {
    existing = await listCoachEvents(supabase, userId)
  } catch {
    existing = []
  }
  const conflicts = findCoachConflicts(existing, startsAt, endsAt)
  if (conflicts.length && !confirmConflict) {
    return { ok: false, reason: 'conflict' }
  }

  const db = chatDb(supabase)
  const baseRows = clientIds.map((clientId) => ({
    coach_id: userId,
    client_id: clientId,
    title,
    starts_at: startsAt,
    ends_at: endsAt,
    modality,
    location,
    notes,
    status: 'pending' as const,
    created_by: 'coach' as const,
  }))

  const wantGroupMeta = Boolean(groupId) || clientIds.length > 1
  if (wantGroupMeta) {
    const batchId = randomUUID()
    const { error } = await db.from('calendar_events').insert(
      baseRows.map((row) => ({
        ...row,
        group_id: groupId,
        batch_id: batchId,
      })),
    )
    if (error) {
      const { error: err2 } = await db.from('calendar_events').insert(baseRows)
      if (err2) return { ok: false, reason: 'error', message: err2.message }
    }
  } else {
    const { error } = await db.from('calendar_events').insert(baseRows)
    if (error) return { ok: false, reason: 'error', message: error.message }
  }

  const chatThreadMatch = returnTo.match(/^\/chat\/([0-9a-f-]{36})/i)
  await notifyCoachProposedRdv(supabase, {
    coachUserId: userId,
    clientIds,
    title,
    startsAt,
    modality,
    location,
    preferThreadId: chatThreadMatch?.[1] ?? null,
  })

  await revalidateClientPortal(supabase, userId, [returnTo.split('?')[0]])
  if (chatThreadMatch?.[1]) {
    revalidatePath(`/chat/${chatThreadMatch[1]}`)
    revalidatePath('/chat')
  }
  // `rdv=1` (pas `created`) pour ne pas collisionner avec « Client créé » sur la fiche
  redirect(withQuery(returnTo, { rdv: '1' }))
}

/** Events calendrier à la demande (évite de bloquer le SSR chat). */
export async function loadCoachCalendarEventsAction(): Promise<CalendarEventRow[]> {
  const { supabase, userId } = await requireCoach()
  try {
    return await listCoachEvents(supabase, userId)
  } catch {
    return []
  }
}

/** Coach accepte ou refuse une demande client (requested). */
export async function respondCoachRdvAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const eventId = String(formData.get('event_id') ?? '').trim()
  const decision = String(formData.get('decision') ?? '').trim()
  const returnTo = safeReturnTo(String(formData.get('return_to') ?? '/calendar'))

  if (!eventId) redirect(withQuery(returnTo, { error: 'RDV manquant' }))
  if (decision !== 'accepted' && decision !== 'refused') {
    redirect(withQuery(returnTo, { error: 'Décision invalide' }))
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

  if (error) redirect(withQuery(returnTo, { error: error.message }))

  await revalidateClientPortal(supabase, userId)
  redirect(withQuery(returnTo, decision === 'accepted' ? { accepted: '1' } : { refused: '1' }))
}

export async function cancelCoachRdvAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const eventId = String(formData.get('event_id') ?? '').trim()
  const returnTo = safeReturnTo(String(formData.get('return_to') ?? '/calendar'))
  if (!eventId) redirect(returnTo)

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
  redirect(returnTo)
}

/** Ouvre le DM avec un brouillon de rappel (le coach envoie lui-même). */
export async function nudgePendingRdvAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const eventId = String(formData.get('event_id') ?? '').trim()
  const returnTo = safeReturnTo(String(formData.get('return_to') ?? '/calendar'))
  if (!eventId) redirect(withQuery(returnTo, { error: 'RDV manquant' }))

  const db = chatDb(supabase)
  const { data: row, error } = await db
    .from('calendar_events')
    .select('id, client_id, title, starts_at, status')
    .eq('id', eventId)
    .eq('coach_id', userId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .maybeSingle()

  if (error) redirect(withQuery(returnTo, { error: error.message }))
  if (!row) redirect(withQuery(returnTo, { error: 'RDV non relançable' }))

  const ev = row as { id: string; client_id: string; title: string; starts_at: string | null }
  let threadId: string
  try {
    threadId = await ensureDmThreadId(supabase, ev.client_id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Chat impossible'
    redirect(withQuery(returnTo, { error: msg }))
  }

  const calLink = await coachCalendrierLink(supabase, userId)
  redirect(
    withQuery(`/chat/${threadId}`, {
      draft: rdvReminderDraft(ev.title, ev.starts_at, calLink),
    }),
  )
}

/**
 * Relance batch :
 * - avec `client_id` → ouvre le DM + brouillon (édition manuelle)
 * - sans → envoi auto à tous les pending
 */
export async function nudgeBatchPendingAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const batchId = String(formData.get('batch_id') ?? '').trim()
  const clientIdOnly = String(formData.get('client_id') ?? '').trim()
  const returnTo = safeReturnTo(String(formData.get('return_to') ?? '/calendar'))

  if (!batchId) redirect(withQuery(returnTo, { error: 'Groupe RDV manquant' }))

  const db = chatDb(supabase)
  let q = db
    .from('calendar_events')
    .select('id, client_id, title, starts_at, status')
    .eq('coach_id', userId)
    .eq('batch_id', batchId)
    .eq('status', 'pending')
    .is('deleted_at', null)
  if (clientIdOnly) q = q.eq('client_id', clientIdOnly)

  const { data: rows, error } = await q
  if (error) redirect(withQuery(returnTo, { error: error.message }))
  const list = (rows ?? []) as Array<{
    id: string
    client_id: string
    title: string
    starts_at: string | null
  }>
  if (!list.length) {
    redirect(withQuery(returnTo, { error: 'Personne en attente à relancer' }))
  }

  const calLink = await coachCalendrierLink(supabase, userId)

  // 1 membre : brouillon dans le composer, pas d’envoi auto
  if (clientIdOnly && list[0]) {
    let threadId: string
    try {
      threadId = await ensureDmThreadId(supabase, list[0].client_id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chat impossible'
      redirect(withQuery(returnTo, { error: msg }))
    }
    redirect(
      withQuery(`/chat/${threadId}`, {
        draft: rdvReminderDraft(list[0].title, list[0].starts_at, calLink),
      }),
    )
  }

  let sent = 0
  for (const row of list) {
    try {
      const threadId = await ensureDmThreadId(supabase, row.client_id)
      await sendChatMessage(
        supabase,
        threadId,
        userId,
        rdvReminderDraft(row.title, row.starts_at, calLink),
        'prise_de_rdv',
      )
      sent += 1
    } catch {
      // best-effort par membre
    }
  }

  revalidatePath('/chat')
  await revalidateClientPortal(supabase, userId)
  if (!sent) redirect(withQuery(returnTo, { error: 'Relance impossible' }))
  redirect(returnTo)
}
