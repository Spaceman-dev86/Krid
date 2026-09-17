'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../../lib/auth/roles'
import { emptySchema, parseSchema, type BilanSchema } from '../../../lib/bilans/bilans'
import { chatDb } from '../../../lib/chat/chat'
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

export async function createTemplateAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const title = String(formData.get('title') ?? '').trim()
  const instructions = String(formData.get('instructions') ?? '').trim() || null
  if (!title) redirect('/clients/bilans?tab=templates&error=' + encodeURIComponent('Titre requis'))

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
    redirect('/clients/bilans?tab=templates&error=' + encodeURIComponent(error?.message || 'Création impossible'))
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
    await db
      .from('bilan_templates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('coach_id', userId)
  } else {
    await db.from('bilan_templates').delete().eq('id', id).eq('coach_id', userId)
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
  const dayOfMonthRaw = String(formData.get('day_of_month') ?? '').trim()
  const dayOfMonth = dayOfMonthRaw ? Number(dayOfMonthRaw) : null

  if (!templateId) {
    redirect('/clients/bilans?error=' + encodeURIComponent('Modèle requis'))
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
    redirect('/clients/bilans?error=' + encodeURIComponent('Modèle introuvable'))
  }

  const schema = parseSchema(template.schema) || emptySchema()
  const appearsAt = appearsRaw ? new Date(appearsRaw) : new Date()
  if (Number.isNaN(appearsAt.getTime())) {
    redirect('/clients/bilans?error=' + encodeURIComponent('Date d’apparition invalide'))
  }
  const dueAt = new Date(appearsAt.getTime() + 14 * 24 * 60 * 60 * 1000)

  const targetClientIds = new Set<string>(clientIds)

  if (groupIds.length) {
    const { data: members } = await db
      .from('client_group_members')
      .select('client_id, group_id')
      .in('group_id', groupIds)
    for (const m of members ?? []) targetClientIds.add(m.client_id)
  }

  if (!targetClientIds.size) {
    redirect('/clients/bilans?error=' + encodeURIComponent('Choisis au moins un client ou un groupe'))
  }

  // Vérifie que les clients appartiennent au coach
  const { data: owned } = await db
    .from('clients')
    .select('id')
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .in('id', Array.from(targetClientIds))

  const ownedIds = (owned ?? []).map((c: { id: string }) => c.id)
  if (!ownedIds.length) {
    redirect('/clients/bilans?error=' + encodeURIComponent('Aucun client valide'))
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
      redirect('/clients/bilans?error=' + encodeURIComponent(rErr.message))
    }
    recurrenceId = rec?.id ?? null
  }

  const rows = ownedIds.map((clientId) => ({
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

  const { error } = await db.from('bilan_instances').insert(rows)
  if (error) {
    redirect('/clients/bilans?error=' + encodeURIComponent(error.message))
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
  redirect('/clients/bilans?sent=1')
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
