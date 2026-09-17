'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInstance, isClientEditable, parsePayload } from '../../../../../lib/bilans/bilans'
import { chatDb } from '../../../../../lib/chat/chat'
import { createClient } from '../../../../../lib/supabase/server'

function storageSafeName(original: string): string {
  const trimmed = original.trim() || 'photo'
  const dot = trimmed.lastIndexOf('.')
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed
  const ext = dot > 0 ? trimmed.slice(dot) : ''
  const asciiBase =
    base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'photo'
  const asciiExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12)
  return `${asciiBase}${asciiExt}`
}

export async function submitBilanAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const slug = String(formData.get('slug') ?? '').trim()
  const instanceId = String(formData.get('instance_id') ?? '').trim()
  if (!slug || !instanceId) redirect(`/c/${slug || ''}/profil/bilans`)

  const instance = await getInstance(supabase, instanceId)
  if (!instance) {
    redirect(`/c/${slug}/profil/bilans?error=` + encodeURIComponent('Bilan introuvable'))
  }
  if (!isClientEditable(instance.status, instance.due_at)) {
    redirect(`/c/${slug}/profil/bilans/${instanceId}?error=` + encodeURIComponent('Bilan verrouillé'))
  }

  // Vérifie ownership via RLS / client row
  const db = chatDb(supabase)
  const { data: client } = await db
    .from('clients')
    .select('id, user_id')
    .eq('id', instance.client_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!client) {
    redirect(`/c/${slug}/profil/bilans?error=` + encodeURIComponent('Accès refusé'))
  }

  const schema = instance.schema_snapshot
  const measurements: Record<string, string> = {}
  for (const m of schema.measurements) {
    measurements[m.id] = String(formData.get(`m_${m.id}`) ?? '').trim()
  }
  const questions: Record<string, string> = {}
  for (const q of schema.questions) {
    questions[q.id] = String(formData.get(`q_${q.id}`) ?? '').trim()
  }

  const existing = parsePayload(instance.payload)
  const photos = [...(existing.photos ?? [])]

  if (schema.photos) {
    const files = formData.getAll('photo').filter(
      (f): f is File =>
        !!f &&
        typeof f === 'object' &&
        'arrayBuffer' in f &&
        typeof (f as File).arrayBuffer === 'function' &&
        (f as File).size > 0
    )
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) continue
      const safe = storageSafeName(file.name)
      const path = `${instance.coach_id}/${instance.id}/${crypto.randomUUID()}_${safe}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await db.storage.from('bilans').upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })
      if (!upErr) {
        photos.push({ path, label: String(formData.get('photo_label') ?? '').trim() || undefined })
      }
    }
  }

  const payload = { measurements, questions, photos }
  const now = new Date().toISOString()

  const { error } = await db
    .from('bilan_instances')
    .update({
      payload,
      status: 'submitted',
      submitted_at: now,
      updated_at: now,
      client_opened_at: instance.client_opened_at ?? now,
    })
    .eq('id', instanceId)
    .eq('client_id', instance.client_id)

  if (error) {
    redirect(
      `/c/${slug}/profil/bilans/${instanceId}?error=` + encodeURIComponent(error.message)
    )
  }

  // MAJ infos physiques si poids / taille renseignés
  const patch: Record<string, number> = {}
  const w = Number(measurements.weight_kg)
  const h = Number(measurements.height_cm)
  if (Number.isFinite(w) && w > 0) patch.weight_kg = w
  if (Number.isFinite(h) && h > 0) patch.height_cm = h
  if (Object.keys(patch).length) {
    await db.from('clients').update(patch).eq('id', instance.client_id)
  }

  // Notif coach (table prête, UI cloche later)
  await db.from('notifications').insert({
    user_id: instance.coach_id,
    type: 'bilan_submitted',
    title: 'Bilan rempli',
    body: instance.title,
    payload: { instance_id: instanceId, client_id: instance.client_id },
  })

  revalidatePath(`/c/${slug}/profil/bilans`)
  revalidatePath(`/c/${slug}/profil/bilans/${instanceId}`)
  revalidatePath('/clients/bilans')
  revalidatePath(`/clients/bilans/${instanceId}`)
  redirect(`/c/${slug}/profil/bilans/${instanceId}?saved=1`)
}

export async function openBilanAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const instanceId = String(formData.get('instance_id') ?? '').trim()
  if (!instanceId) return

  const instance = await getInstance(supabase, instanceId)
  if (!instance || instance.client_opened_at) return

  const db = chatDb(supabase)
  const { data: client } = await db
    .from('clients')
    .select('id')
    .eq('id', instance.client_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!client) return

  await db
    .from('bilan_instances')
    .update({ client_opened_at: new Date().toISOString() })
    .eq('id', instanceId)
    .is('client_opened_at', null)
}
