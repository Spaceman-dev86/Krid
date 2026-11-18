'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../../lib/auth/roles'
import { emptySchema, parseSchema, type BilanSchema } from '../../../lib/bilans/bilans'
import { canDeleteBilan, canRelaunchBilan } from '../../../lib/bilans/relance'
import {
  chatDb,
  ensureDmThreadId,
  sendChatMessage,
} from '../../../lib/chat/chat'
import { createClient } from '../../../lib/supabase/server'

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

function schemaFromForm(formData: FormData): BilanSchema {
  const photos = formData.get('photos') === 'on' || formData.get('photos') === '1' || formData.get('photos') === 'true'
  const measurementIds = formData.getAll('measurement_id').map(String)
  const measurements = measurementIds
    .map((id) => {
      const label = String(formData.get(`m_label_${id}`) ?? '').trim()
      const unit = String(formData.get(`m_unit_${id}`) ?? '').trim() || '—'
      if (!label) return null
      return { id, label, unit }
    })
    .filter(Boolean) as BilanSchema['measurements']

  const qLabels = formData.getAll('question_label').map((v) => String(v).trim()).filter(Boolean)
  const questions = qLabels.map((label, i) => ({
    id: `q_${i + 1}_${crypto.randomUUID().slice(0, 8)}`,
    label,
    type: 'textarea' as const,
  }))

  return { photos, measurements, questions }
}

function safeClientsReturnTo(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (v.startsWith('/clients/') || v.startsWith('/clients/bilans')) return v.split('?')[0]
  return null
}

export async function createTemplateAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const title = String(formData.get('title') ?? '').trim()
  const instructions = String(formData.get('instructions') ?? '').trim() || null
  const returnTo = safeClientsReturnTo(String(formData.get('return_to') ?? ''))
  const failBase = returnTo ?? '/clients/bilans'
  function fail(msg: string): never {
    const sep = failBase.includes('?') ? '&' : '?'
    const tab = returnTo ? '' : 'tab=templates&'
    redirect(`${failBase}${sep}${tab}error=${encodeURIComponent(msg)}`)
  }
  if (!title) fail('Titre requis')

  const schema = schemaFromForm(formData)
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('bilan_templates')
    .insert({
      coach_id: userId,
      title,
      instructions,
      schema,
      status: 'ready',
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    fail(error?.message || 'Création impossible')
  }

  revalidatePath('/clients/bilans')
  if (returnTo) {
    revalidatePath(returnTo)
    const sep = returnTo.includes('?') ? '&' : '?'
    // Reste sur la fiche — envoi manuel via bouton Envoyer
    redirect(`${returnTo}${sep}template_created=1`)
  }
  redirect('/clients/bilans?tab=templates&created=1')
}

/** Brouillon template (status=draft) — onglet Brouillons. */
export async function saveDraftTemplateAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const title = String(formData.get('title') ?? '').trim() || 'Brouillon sans titre'
  const instructions = String(formData.get('instructions') ?? '').trim() || null
  const templateId = String(formData.get('template_id') ?? '').trim()
  const returnTo = safeClientsReturnTo(String(formData.get('return_to') ?? ''))
  const schema = schemaFromForm(formData)
  const db = chatDb(supabase)

  if (templateId) {
    const { error } = await db
      .from('bilan_templates')
      .update({
        title,
        instructions,
        schema,
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('coach_id', userId)
      .is('deleted_at', null)
    if (error) {
      redirect('/clients/bilans?tab=brouillon&error=' + encodeURIComponent(error.message))
    }
  } else {
    const { error } = await db.from('bilan_templates').insert({
      coach_id: userId,
      title,
      instructions,
      schema,
      status: 'draft',
    })
    if (error) {
      redirect('/clients/bilans?tab=brouillon&error=' + encodeURIComponent(error.message))
    }
  }

  revalidatePath('/clients/bilans')
  if (returnTo) {
    revalidatePath(returnTo)
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}saved=1`)
  }
  redirect('/clients/bilans?tab=brouillon&saved=1')
}

/** Publie un brouillon → ready (catalogue Templates). */
export async function publishDraftTemplateAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('template_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const instructions = String(formData.get('instructions') ?? '').trim() || null
  if (!id || !title) {
    redirect('/clients/bilans?tab=brouillon&error=' + encodeURIComponent('Titre requis'))
  }

  const schema = schemaFromForm(formData)
  const db = chatDb(supabase)
  const { error } = await db
    .from('bilan_templates')
    .update({
      title,
      instructions,
      schema,
      status: 'ready',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) {
    redirect(`/clients/bilans?tab=brouillon&error=` + encodeURIComponent(error.message))
  }

  revalidatePath('/clients/bilans')
  redirect('/clients/bilans?tab=templates&created=1')
}

export async function updateTemplateAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('template_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const instructions = String(formData.get('instructions') ?? '').trim() || null
  if (!id || !title) redirect('/clients/bilans?tab=templates')

  const schema = schemaFromForm(formData)
  const db = chatDb(supabase)
  const { error } = await db
    .from('bilan_templates')
    .update({
      title,
      instructions,
      schema,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) {
    redirect(`/clients/bilans/templates/${id}?error=` + encodeURIComponent(error.message))
  }

  revalidatePath('/clients/bilans')
  revalidatePath(`/clients/bilans/templates/${id}`)
  redirect('/clients/bilans?tab=templates&saved=1')
}

export async function deleteTemplateAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('template_id') ?? '').trim()
  if (!id) redirect('/clients/bilans?tab=templates')

  const db = chatDb(supabase)
  const { count } = await db
    .from('bilan_instances')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', id)
    .eq('coach_id', userId)

  if ((count ?? 0) > 0) {
    const { error } = await db
      .from('bilan_templates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('coach_id', userId)
    if (error) {
      redirect(`/clients/bilans?tab=templates&error=` + encodeURIComponent(error.message))
    }
  } else {
    const { error } = await db.from('bilan_templates').delete().eq('id', id).eq('coach_id', userId)
    if (error) {
      redirect(`/clients/bilans?tab=templates&error=` + encodeURIComponent(error.message))
    }
  }

  revalidatePath('/clients/bilans')
  redirect('/clients/bilans?tab=templates&deleted=1')
}

export async function sendBilanAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const templateId = String(formData.get('template_id') ?? '').trim()
  const appearsRaw = String(formData.get('appears_at') ?? '').trim()
  const clientIds = formData.getAll('client_id').map(String).filter(Boolean)
  const groupIds = formData.getAll('group_id').map(String).filter(Boolean)
  const prestationIds = formData.getAll('prestation_id').map(String).filter(Boolean)
  const dayOfMonthRaw = String(formData.get('day_of_month') ?? '').trim()
  const dayOfMonth = dayOfMonthRaw ? Number(dayOfMonthRaw) : null
  const returnToRaw = String(formData.get('return_to') ?? '').trim()
  const returnTo =
    returnToRaw.startsWith('/clients/') ||
    returnToRaw.startsWith('/clients/bilans') ||
    returnToRaw.startsWith('/programs/plans/')
      ? returnToRaw
      : '/clients/bilans'

  function fail(msg: string): never {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=${encodeURIComponent(msg)}`)
  }

  if (!templateId) {
    fail('Modèle requis')
  }

  const db = chatDb(supabase)
  const { data: template, error: tErr } = await db
    .from('bilan_templates')
    .select('id, title, schema, coach_id')
    .eq('id', templateId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (tErr || !template) {
    fail('Modèle introuvable')
  }

  const schema = parseSchema(template.schema) || emptySchema()
  const appearsAt = appearsRaw ? new Date(appearsRaw) : new Date()
  if (Number.isNaN(appearsAt.getTime())) {
    fail('Date d’apparition invalide')
  }
  const dueAt = new Date(appearsAt.getTime() + 14 * 24 * 60 * 60 * 1000)

  const targetClientIds = new Set<string>(clientIds)

  /** client_id → premier groupe source (si expansion groupe). Linked = actifs only. */
  const clientToGroup = new Map<string, string>()
  if (groupIds.length) {
    const { resolveGroupAudienceClientIds } = await import('../../../lib/coach/linkedGroups')
    const audience = await resolveGroupAudienceClientIds(supabase, {
      coachId: userId,
      groupIds,
    })
    for (const clientId of audience.clientIds) {
      targetClientIds.add(clientId)
      const gid = audience.clientToGroup.get(clientId)
      if (gid && !clientToGroup.has(clientId)) clientToGroup.set(clientId, gid)
    }
  }

  if (prestationIds.length) {
    const { data: ownedPrestas } = await db
      .from('prestations')
      .select('id')
      .eq('coach_id', userId)
      .in('id', prestationIds)
    const okPresta = new Set((ownedPrestas ?? []).map((p: { id: string }) => p.id))
    const prestaFilter = prestationIds.filter((id) => okPresta.has(id))
    if (prestaFilter.length) {
      const { data: grants } = await db
        .from('client_grants')
        .select('client_id')
        .in('prestation_id', prestaFilter)
        .eq('status', 'active')
      for (const g of grants ?? []) {
        if (g.client_id) targetClientIds.add(g.client_id)
      }
    }
  }

  if (!targetClientIds.size) {
    fail('Choisis au moins un client, un groupe ou une prestation')
  }

  // Vérifie que les clients appartiennent au coach
  const { data: owned } = await db
    .from('clients')
    .select('id')
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .in('id', Array.from(targetClientIds))

  const ownedIds: string[] = (owned ?? []).map((c: { id: string }) => c.id)
  if (!ownedIds.length) {
    fail('Aucun client valide')
  }

  let recurrenceId: string | null = null
  if (dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 28) {
    const next = new Date(appearsAt)
    next.setMonth(next.getMonth() + 1)
    next.setDate(dayOfMonth)
    const { data: rec, error: rErr } = await db
      .from('bilan_recurrences')
      .insert({
        coach_id: userId,
        template_id: templateId,
        client_ids: ownedIds,
        group_ids: groupIds,
        day_of_month: dayOfMonth,
        active: true,
        next_appears_at: next.toISOString(),
      })
      .select('id')
      .single()
    if (rErr) {
      fail(rErr.message)
    }
    recurrenceId = rec?.id ?? null
  }

  const batchId = crypto.randomUUID()
  const baseRows = ownedIds.map((clientId) => ({
    coach_id: userId,
    client_id: clientId,
    template_id: templateId,
    recurrence_id: recurrenceId,
    title: template.title,
    schema_snapshot: schema,
    payload: {},
    status: 'waiting',
    appears_at: appearsAt.toISOString(),
    due_at: dueAt.toISOString(),
  }))

  // Membres issus d’un groupe → source_group_id (1 ligne hub). Clients seuls → null.
  const withBatch = baseRows.map((row) => ({
    ...row,
    batch_id: batchId,
    source_group_id: clientToGroup.get(row.client_id) ?? null,
  }))

  let { error } = await db.from('bilan_instances').insert(withBatch)
  if (error && /batch_id|source_group/i.test(error.message)) {
    ;({ error } = await db.from('bilan_instances').insert(baseRows))
  }
  if (error) {
    fail(error.message)
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', userId)
    .maybeSingle()
  if (branding?.slug) {
    revalidatePath(`/c/${branding.slug}/profil`)
    revalidatePath(`/c/${branding.slug}/profil/bilans`)
  }

  revalidatePath('/clients/bilans')
  for (const cid of ownedIds) {
    revalidatePath(`/clients/${cid}`)
    revalidatePath(`/clients/${cid}/bilan`)
  }
  if (returnTo.startsWith('/programs/plans/')) {
    revalidatePath(returnTo.split('?')[0])
  }
  const sep = returnTo.includes('?') ? '&' : '?'
  redirect(`${returnTo}${sep}sent=1`)
}

export async function markInstanceReadAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('instance_id') ?? '').trim()
  if (!id) redirect('/clients/bilans')

  const db = chatDb(supabase)
  await db
    .from('bilan_instances')
    .update({ coach_read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('coach_id', userId)
    .is('coach_read_at', null)

  revalidatePath(`/clients/bilans/${id}`)
  redirect(`/clients/bilans/${id}`)
}

/** Supprime une instance non remplie (waiting / in_progress / no_response). */
export async function deleteBilanInstanceAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('instance_id') ?? '').trim()
  const returnToRaw = String(formData.get('return_to') ?? '').trim()
  const returnTo =
    returnToRaw.startsWith('/clients/') || returnToRaw.startsWith('/clients/bilans')
      ? returnToRaw
      : '/clients/bilans'

  function fail(msg: string): never {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=${encodeURIComponent(msg)}`)
  }

  if (!id) fail('Bilan manquant')

  const db = chatDb(supabase)
  const { data: inst, error } = await db
    .from('bilan_instances')
    .select('id, client_id, status, due_at, coach_id, batch_id')
    .eq('id', id)
    .eq('coach_id', userId)
    .maybeSingle()

  if (error || !inst) fail('Bilan introuvable')

  const status =
    inst.status === 'waiting' || inst.status === 'in_progress'
      ? new Date(inst.due_at).getTime() < Date.now()
        ? 'no_response'
        : inst.status
      : inst.status

  if (!canDeleteBilan(status)) {
    fail('Impossible de supprimer un bilan déjà rempli')
  }

  const { error: delErr } = await db
    .from('bilan_instances')
    .delete()
    .eq('id', id)
    .eq('coach_id', userId)

  if (delErr) fail(delErr.message)

  revalidatePath('/clients/bilans')
  revalidatePath(`/clients/${inst.client_id}`)
  revalidatePath(`/clients/${inst.client_id}/bilan`)
  if (inst.batch_id) revalidatePath(`/clients/bilans/batch/${inst.batch_id}`)

  const sep = returnTo.includes('?') ? '&' : '?'
  redirect(`${returnTo}${sep}deleted=1`)
}

/** Supprime toutes les instances encore non remplies d’un lot groupe. */
export async function deleteBilanBatchDeletableAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const batchId = String(formData.get('batch_id') ?? '').trim()
  const returnToRaw = String(formData.get('return_to') ?? '').trim()
  const returnTo =
    returnToRaw.startsWith('/clients/') || returnToRaw.startsWith('/clients/bilans')
      ? returnToRaw
      : batchId
        ? `/clients/bilans/batch/${batchId}`
        : '/clients/bilans'

  function fail(msg: string): never {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=${encodeURIComponent(msg)}`)
  }

  if (!batchId) fail('Lot manquant')

  const db = chatDb(supabase)
  const { data: rows, error } = await db
    .from('bilan_instances')
    .select('id, client_id, status, due_at')
    .eq('coach_id', userId)
    .eq('batch_id', batchId)

  if (error) fail(error.message)
  const deletableIds = (rows ?? [])
    .filter((r: { status: string; due_at: string }) => {
      const status =
        r.status === 'waiting' || r.status === 'in_progress'
          ? new Date(r.due_at).getTime() < Date.now()
            ? 'no_response'
            : r.status
          : r.status
      return canDeleteBilan(status)
    })
    .map((r: { id: string }) => r.id)

  if (!deletableIds.length) fail('Rien à supprimer (tout est déjà rempli)')

  const { error: delErr } = await db
    .from('bilan_instances')
    .delete()
    .eq('coach_id', userId)
    .in('id', deletableIds)

  if (delErr) fail(delErr.message)

  const clientIds = [
    ...new Set(
      (rows ?? [])
        .filter((r: { id: string }) => deletableIds.includes(r.id))
        .map((r: { client_id: string }) => r.client_id)
    ),
  ]
  revalidatePath('/clients/bilans')
  revalidatePath(`/clients/bilans/batch/${batchId}`)
  for (const cid of clientIds) {
    revalidatePath(`/clients/${cid}`)
    revalidatePath(`/clients/${cid}/bilan`)
  }

  // S’il ne reste plus d’instances → retour hub
  const { count } = await db
    .from('bilan_instances')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', userId)
    .eq('batch_id', batchId)

  if (!(count ?? 0)) {
    redirect('/clients/bilans?deleted=1')
  }

  const sep = returnTo.includes('?') ? '&' : '?'
  redirect(`${returnTo}${sep}deleted=1`)
}

/** Relance 1:1 — envoi chat immédiat, reste sur la page bilans. */
export async function sendBilanRelanceAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const clientId = String(formData.get('client_id') ?? '').trim()
  const instanceId = String(formData.get('instance_id') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!clientId || !body) {
    return { ok: false as const, error: 'Message requis' }
  }

  const db = chatDb(supabase)
  if (instanceId) {
    const { data: inst } = await db
      .from('bilan_instances')
      .select('id, status, due_at, coach_id, client_id')
      .eq('id', instanceId)
      .eq('coach_id', userId)
      .maybeSingle()
    if (!inst || inst.client_id !== clientId) {
      return { ok: false as const, error: 'Bilan introuvable' }
    }
    if (!canRelaunchBilan(inst.status)) {
      return { ok: false as const, error: 'Ce bilan n’est plus relançable' }
    }
  }

  const { data: client } = await db
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) return { ok: false as const, error: 'Client introuvable' }

  try {
    const threadId = await ensureDmThreadId(supabase, clientId)
    await sendChatMessage(supabase, threadId, userId, body)
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'Chat impossible' }
  }

  revalidatePath('/clients/bilans')
  revalidatePath(`/clients/${clientId}/bilan`)
  if (instanceId) revalidatePath(`/clients/bilans/${instanceId}`)
  return { ok: true as const }
}

/** Relance groupée : template avec `{{lien}}` remplacé par l’URL de chaque instance. */
export async function sendBilanBatchRelanceAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const batchId = String(formData.get('batch_id') ?? '').trim()
  const bodyTemplate = String(formData.get('body_template') ?? '').trim()
  const instanceIds = formData.getAll('instance_id').map(String).filter(Boolean)
  if (!batchId || !bodyTemplate || !instanceIds.length) {
    return { ok: false as const, error: 'Paramètres manquants' }
  }

  const db = chatDb(supabase)
  const { data: rows, error } = await db
    .from('bilan_instances')
    .select('id, client_id, status, title, batch_id')
    .eq('coach_id', userId)
    .eq('batch_id', batchId)
    .in('id', instanceIds)

  if (error) return { ok: false as const, error: error.message }
  const list = (rows ?? []).filter((r: { status: string }) => canRelaunchBilan(r.status))
  if (!list.length) return { ok: false as const, error: 'Personne à relancer' }

  let sent = 0
  for (const row of list as Array<{ id: string; client_id: string }>) {
    const url = String(formData.get(`url_${row.id}`) ?? '').trim()
    const body = bodyTemplate.includes('{{lien}}')
      ? bodyTemplate.split('{{lien}}').join(url || '')
      : url
        ? `${bodyTemplate}\n\n➡️ ${url}`
        : bodyTemplate
    try {
      const threadId = await ensureDmThreadId(supabase, row.client_id)
      await sendChatMessage(supabase, threadId, userId, body.trim())
      sent += 1
    } catch {
      // best-effort
    }
  }

  if (!sent) return { ok: false as const, error: 'Aucun message envoyé' }
  revalidatePath('/clients/bilans')
  revalidatePath(`/clients/bilans/batch/${batchId}`)
  return { ok: true as const, sent }
}
